import type { Activity, Api, Contact, ContactInput, ImportResult } from '../types';
import { ApiError } from '../errors';
import type { ErasureRequest, ErasureRequestsApi } from '../erasure';
import { normalizeEmail, normalizePhone } from '../../phone';
import {
  CAN_EDIT, CAN_READ_CRM, delay, getDb, logActivity, newCheckinCode, newToken, nowIso, requireRole, save, uid,
  withSecrets, type DemoInvitation,
} from './store';

// Imita a tabela contacts: o trigger normalize_contact, as restrições (check) e as funções
// import_contacts, contact_export e anonymize_contact.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const E164 = /^\+[1-9][0-9]{6,14}$/;
const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

/** Minúsculas e sem acentos, para a pesquisa. */
const fold = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const blank = (s: string | null | undefined) => {
  const t = (s ?? '').trim();
  return t ? t : null;
};

/** Como o trigger normalize_contact (exceto o consentimento, que a equipa não altera). */
function normalize(c: Contact): void {
  c.first_name = (c.first_name ?? '').trim();
  c.last_name = blank(c.last_name);
  c.salutation = blank(c.salutation);
  c.email = normalizeEmail(c.email);
  c.phone = c.phone ? (normalizePhone(c.phone) ?? (c.phone.replace(/[\s().-]/g, '') || null)) : null;
  c.organization = blank(c.organization);
  c.job_title = blank(c.job_title);
  c.segment = blank(c.segment);
  c.tags = [...new Set((c.tags ?? []).map((t) => t.trim()).filter(Boolean))].sort();
  c.notes = c.notes ?? null;
  if (!c.marketing_consent) {
    c.marketing_consent_at = null;
    c.marketing_consent_text = null;
  }
}

/** Restrições da tabela; as mensagens imitam as do Postgres traduzidas por toApiError. */
function validate(c: Contact): void {
  if (c.first_name.length < 1 || c.first_name.length > 120) throw new ApiError('validation', 'contacts_first_name_check', 'Indique o nome (até 120 caracteres).');
  if (c.email && !EMAIL.test(c.email)) throw new ApiError('validation', 'contacts_email_check', 'O email não é válido.');
  if (c.phone && !E164.test(c.phone)) throw new ApiError('validation', 'contacts_phone_check', 'O número de telemóvel não é válido.');
  if (c.language !== 'pt' && c.language !== 'en') throw new ApiError('validation', 'contacts_language_check');
}

function find(id: string): Contact {
  const c = getDb().contacts.find((x) => x.id === id);
  if (!c) throw new ApiError('not_found');
  return c;
}

function matches(c: Contact, word: string): boolean {
  const w = fold(word);
  if ([c.first_name, c.last_name, c.email, c.organization, c.phone].some((f) => fold(f).includes(w))) return true;
  const digits = word.replace(/[\s().+-]/g, '');
  return /^\d{3,}$/.test(digits) && digits !== word && (c.phone ?? '').includes(digits);
}

/** Ordem do Postgres: nulls last nos dois sentidos, depois apelido e nome. */
function compare(column: 'last_name' | 'organization' | 'created_at', ascending: boolean) {
  const text = (a: string | null, b: string | null) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return collator.compare(a, b);
  };
  const primary = (x: Contact, y: Contact) => {
    if (column === 'created_at') return ascending ? x.created_at.localeCompare(y.created_at) : y.created_at.localeCompare(x.created_at);
    const a = x[column];
    const b = y[column];
    // Os vazios ficam no fim nos dois sentidos.
    if (a === null || b === null) return text(a, b);
    return ascending ? text(a, b) : -text(a, b);
  };
  return (x: Contact, y: Contact) =>
    primary(x, y)
    || (column !== 'last_name' ? text(x.last_name, y.last_name) : 0)
    || collator.compare(x.first_name, y.first_name)
    || x.id.localeCompare(y.id);
}

function insertContact(input: ContactInput, source: string | null): Contact {
  const d = getDb();
  const now = nowIso();
  const c: Contact = {
    id: uid(),
    salutation: input.salutation ?? null,
    first_name: input.first_name,
    last_name: input.last_name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    organization: input.organization ?? null,
    job_title: input.job_title ?? null,
    segment: input.segment ?? null,
    tags: input.tags ?? [],
    language: input.language ?? 'pt',
    notes: input.notes ?? null,
    owner_id: input.owner_id ?? null,
    source,
    marketing_consent: false,
    marketing_consent_at: null,
    marketing_consent_text: null,
    anonymized_at: null,
    created_at: now,
    updated_at: now,
  };
  normalize(c);
  validate(c);
  d.contacts.push(c);
  logActivity({ kind: 'contact.created', contact_id: c.id, invitation_id: null, event_id: null, channel: null, detail: { source } });
  return c;
}

export const contacts: Api['contacts'] & ErasureRequestsApi = {
  async list(q) {
    requireRole(...CAN_READ_CRM);
    const words = (q.search ?? '').split(/\s+/).filter(Boolean);
    const rows = getDb().contacts.filter((c) =>
      words.every((w) => matches(c, w))
      && (!q.segment || c.segment === q.segment)
      && (!q.tag || c.tags.includes(q.tag))
      && (q.consent === undefined || c.marketing_consent === q.consent));
    const sort = q.sort ?? { column: 'last_name', ascending: true };
    rows.sort(compare(sort.column, sort.ascending));
    const from = q.page * q.pageSize;
    return delay({ rows: rows.slice(from, from + q.pageSize), total: rows.length });
  },

  async get(id) {
    requireRole(...CAN_READ_CRM);
    return delay(find(id));
  },

  async create(input) {
    requireRole(...CAN_EDIT);
    const c = insertContact(input, input.source ?? null);
    save();
    return delay(c);
  },

  async update(id, patch) {
    requireRole(...CAN_EDIT);
    const current = find(id);
    const next: Contact = { ...current, ...patch, id: current.id, updated_at: nowIso() };
    normalize(next);
    validate(next);
    Object.assign(current, next);
    save();
    return delay(current);
  },

  async remove(id) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    find(id);
    // on delete cascade: convites, acompanhantes, envios e linha do tempo.
    const invitationIds = new Set(d.invitations.filter((i) => i.contact_id === id).map((i) => i.id));
    d.companions = d.companions.filter((m) => !invitationIds.has(m.invitation_id));
    d.deliveries = d.deliveries.filter((x) => !invitationIds.has(x.invitation_id));
    d.activities = d.activities.filter((a) => a.contact_id !== id && !(a.invitation_id && invitationIds.has(a.invitation_id)));
    d.invitations = d.invitations.filter((i) => !invitationIds.has(i.id));
    d.contacts = d.contacts.filter((c) => c.id !== id);
    save();
    await delay(null);
  },

  async anonymize(id) {
    requireRole('admin');
    const d = getDb();
    const c = find(id);
    const now = nowIso();
    Object.assign(c, {
      salutation: null, first_name: 'Anónimo', last_name: null, email: null, phone: null,
      organization: null, job_title: null, tags: [], notes: null, marketing_consent: false,
      marketing_consent_at: null, marketing_consent_text: null, anonymized_at: now, updated_at: now,
    } satisfies Partial<Contact>);
    const invitations = d.invitations.filter((i) => i.contact_id === id);
    const invitationIds = new Set(invitations.map((i) => i.id));
    d.companions = d.companions.filter((m) => !invitationIds.has(m.invitation_id));
    for (const inv of invitations) {
      inv.answers = {};
      inv.guest_note = null;
      // Novo link e novo código: o link e o QR antigos deixam de funcionar.
      inv.token = newToken();
      inv.checkin_code = newCheckinCode();
      inv.updated_at = now;
    }
    d.activities = d.activities.filter((a) => !(a.contact_id === id && a.kind === 'note'));
    for (const a of d.activities) if (a.contact_id === id) a.detail = {};
    logActivity({ kind: 'contact.anonymized', contact_id: id, invitation_id: null, event_id: null, channel: null, detail: {} });
    save();
    await delay(null);
  },

  async exportData(id) {
    // Como contact_export: exige permissão de edição.
    requireRole(...CAN_EDIT);
    const d = getDb();
    const contact = d.contacts.find((c) => c.id === id) ?? null;
    const invitations = d.invitations
      .filter((i) => i.contact_id === id)
      .map(({ token: _t, checkin_code: _c, ...inv }) => ({
        ...inv,
        event: d.events.find((e) => e.id === inv.event_id)?.name ?? null,
        companions: d.companions.filter((m) => m.invitation_id === inv.id).map((m) => m.full_name),
      }));
    const activities = d.activities
      .filter((a) => a.contact_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return delay({ contact, invitations, activities });
  },

  async segments() {
    requireRole(...CAN_READ_CRM);
    const all = getDb().contacts.map((c) => c.segment).filter((s): s is string => !!s);
    return delay([...new Set(all)].sort(collator.compare), 60);
  },

  async tags() {
    requireRole(...CAN_READ_CRM);
    const all = getDb().contacts.flatMap((c) => c.tags);
    return delay([...new Set(all)].sort(collator.compare), 60);
  },

  async import(rows, opts) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    if (!Array.isArray(rows) || rows.length > 5000) throw new ApiError('validation', 'invalid_rows');
    let plusOnes = 0;
    const eventId = opts?.eventId ?? null;
    if (eventId) {
      const event = d.events.find((e) => e.id === eventId);
      if (!event) throw new ApiError('not_found');
      plusOnes = opts?.plusOnes ?? event.default_plus_ones;
      if (!Number.isInteger(plusOnes) || plusOnes < 0 || plusOnes > 10) throw new ApiError('validation', 'invitations_plus_ones_allowed_check');
    }
    const wave = opts?.wave?.trim() || null;
    const result: ImportResult = { inserted: 0, updated: 0, invited: 0, errors: [] };

    rows.forEach((r, i) => {
      try {
        if (!(r.first_name ?? '').trim()) throw new Error('Falta o nome');
        const email = normalizeEmail(r.email);
        const phone = r.phone ? r.phone.replace(/[\s().-]/g, '') : null;
        const alive = d.contacts
          .filter((c) => c.anonymized_at === null)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const existing = email
          ? alive.find((c) => c.email === email)
          : phone ? alive.find((c) => c.phone === phone) : undefined;

        let contactId: string;
        if (!existing) {
          const c = insertContact({
            salutation: r.salutation ?? null, first_name: r.first_name, last_name: r.last_name ?? null,
            email: r.email ?? null, phone: r.phone ?? null, organization: r.organization ?? null,
            job_title: r.job_title ?? null, segment: r.segment ?? null, tags: r.tags ?? [],
            language: r.language || 'pt', notes: r.notes ?? null,
          }, 'importação');
          contactId = c.id;
          result.inserted++;
        } else {
          // Só preenche campos vazios; as etiquetas juntam-se.
          const next: Contact = {
            ...existing,
            salutation: existing.salutation ?? blank(r.salutation),
            last_name: existing.last_name ?? blank(r.last_name),
            email: existing.email ?? blank(r.email),
            phone: existing.phone ?? blank(r.phone),
            organization: existing.organization ?? blank(r.organization),
            job_title: existing.job_title ?? blank(r.job_title),
            segment: existing.segment ?? blank(r.segment),
            tags: [...existing.tags, ...(r.tags ?? [])],
            notes: existing.notes ?? blank(r.notes),
            updated_at: nowIso(),
          };
          normalize(next);
          validate(next);
          Object.assign(existing, next);
          contactId = existing.id;
          result.updated++;
        }

        if (eventId && !d.invitations.some((x) => x.event_id === eventId && x.contact_id === contactId)) {
          const now = nowIso();
          const inv: DemoInvitation = {
            id: uid(), event_id: eventId, contact_id: contactId, token: newToken(), checkin_code: newCheckinCode(),
            status: 'draft', wave, plus_ones_allowed: plusOnes, invited_by: d.currentUserId,
            sent_at: null, sent_channel: null, first_opened_at: null, last_opened_at: null, open_count: 0,
            responded_at: null, answers: {}, guest_note: null, checked_in_at: null, checked_in_by: null,
            created_at: now, updated_at: now,
          };
          d.invitations.push(inv);
          logActivity({ kind: 'invitation.created', contact_id: contactId, invitation_id: inv.id, event_id: eventId, channel: null, detail: { wave } });
          result.invited++;
        }
      } catch (err) {
        result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : String(err) });
      }
    });
    save();
    return delay(result, 400);
  },

  async activities(contactId) {
    requireRole(...CAN_READ_CRM);
    const rows: Activity[] = getDb().activities
      .filter((a) => a.contact_id === contactId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .slice(0, 200);
    return delay(rows);
  },

  async addNote(contactId, text) {
    requireRole(...CAN_EDIT);
    const body = text.trim();
    if (!body) throw new ApiError('validation');
    find(contactId);
    logActivity({ kind: 'note', contact_id: contactId, invitation_id: null, event_id: null, channel: null, detail: { text: body } });
    save();
    await delay(null);
  },

  async erasureRequests() {
    requireRole(...CAN_READ_CRM);
    const d = getDb();
    const out = new Map<string, ErasureRequest>();
    const requests = d.activities
      .filter((a) => a.kind === 'privacy.erasure_requested' && a.contact_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    for (const a of requests) {
      const c = d.contacts.find((x) => x.id === a.contact_id);
      // Fica tratado quando o contacto é anonimizado (ou eliminado).
      if (!c || c.anonymized_at || out.has(c.id)) continue;
      out.set(c.id, { contact_id: c.id, requested_at: a.created_at, contact: c });
    }
    return delay([...out.values()]);
  },

  async invitations(contactId) {
    requireRole(...CAN_READ_CRM);
    const d = getDb();
    const rows = d.invitations
      .filter((i) => i.contact_id === contactId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .flatMap((i) => {
        const e = d.events.find((x) => x.id === i.event_id);
        return e ? [{ ...withSecrets(i), event: { id: e.id, name: e.name, starts_at: e.starts_at, status: e.status } }] : [];
      });
    return delay(rows);
  },
};
