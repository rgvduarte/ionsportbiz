import type { Activity, Api, Channel, Companion, Invitation, InvitationRow } from '../types';
import { ApiError } from '../errors';
import {
  CAN_EDIT, CAN_READ_CRM, delay, getDb, logActivity, newCheckinCode, newToken, nowIso, requireRole, save,
  setInvitationStatus, uid, withSecrets, type DemoInvitation,
} from './store';

// Imita a vista invitation_overview, a tabela invitations (checks, unique, on delete cascade,
// trigger invitations_log) e a função mark_sent.

const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

/** Ordem do Postgres (order by last_name, first_name): vazios no fim. */
function byName(a: InvitationRow, b: InvitationRow): number {
  if (a.last_name !== b.last_name) {
    if (a.last_name === null) return 1;
    if (b.last_name === null) return -1;
    const c = collator.compare(a.last_name, b.last_name);
    if (c) return c;
  }
  return collator.compare(a.first_name, b.first_name) || a.id.localeCompare(b.id);
}

function overview(inv: Invitation): InvitationRow | null {
  const d = getDb();
  const c = d.contacts.find((x) => x.id === inv.contact_id);
  if (!c) return null;
  const comps = d.companions.filter((m) => m.invitation_id === inv.id);
  return withSecrets({
    ...inv,
    salutation: c.salutation,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone,
    organization: c.organization,
    job_title: c.job_title,
    segment: c.segment,
    tags: c.tags,
    language: c.language,
    marketing_consent: c.marketing_consent,
    companions_count: comps.length,
    companions_checked_in: comps.filter((m) => m.checked_in_at).length,
    pass_type_name: d.passTypes.find((p) => p.id === inv.pass_type_id)?.name ?? null,
    pass_type_color: d.passTypes.find((p) => p.id === inv.pass_type_id)?.color ?? null,
  });
}

function find(id: string): Invitation {
  const inv = getDb().invitations.find((i) => i.id === id);
  if (!inv) throw new ApiError('not_found');
  return inv;
}

const blank = (s: string | null | undefined) => (s ?? '').trim() || null;

function checkPlusOnes(n: unknown): number {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 10) {
    throw new ApiError('validation', 'invitations_plus_ones_allowed_check', 'O número de acompanhantes tem de estar entre 0 e 10.');
  }
  return n;
}

/** Como a função mark_sent (a permissão é verificada por quem chama). */
function markSentRows(ids: string[], channel: Channel): number {
  const d = getDb();
  const set = new Set(ids);
  const targets = d.invitations.filter((i) => set.has(i.id));
  // Reenvios: o convite já não era rascunho. Os primeiros envios ficam registados pela mudança de estado.
  for (const inv of targets) {
    if (inv.status !== 'draft' && inv.status !== 'cancelled') {
      logActivity({ kind: 'invitation.resent', contact_id: inv.contact_id, invitation_id: inv.id, event_id: inv.event_id, channel, detail: {} });
    }
  }
  const now = nowIso();
  let n = 0;
  for (const inv of targets) {
    if (inv.status === 'cancelled') continue;
    inv.sent_at = now;
    inv.sent_channel = channel;
    inv.updated_at = now;
    if (inv.status === 'draft') setInvitationStatus(inv, 'sent');
    n++;
  }
  return n;
}

/** Como approve_invitations / reject_invitations / reset_approval: só regista quem mudou. */
function decide(ids: string[], apply: (inv: DemoInvitation) => boolean, kind: string, detail: Record<string, unknown> = {}): number {
  const d = getDb();
  const set = new Set(ids);
  let n = 0;
  for (const inv of d.invitations.filter((i) => set.has(i.id))) {
    if (!apply(inv)) continue;
    inv.updated_at = nowIso();
    logActivity({ kind, contact_id: inv.contact_id, invitation_id: inv.id, event_id: inv.event_id, channel: null, detail });
    n++;
  }
  save();
  return n;
}

export const invitations: Api['invitations'] = {
  async list(eventId, q) {
    requireRole(...CAN_READ_CRM);
    // ilike: ignora maiúsculas, mas não acentos.
    const words = (q?.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const rows = getDb().invitations
      .filter((i) => i.event_id === eventId && (!q?.status || i.status === q.status) && (!q?.wave || i.wave === q.wave)
        && (!q?.approval || i.approval_status === q.approval))
      .map(overview)
      .filter((r): r is InvitationRow => r !== null)
      .filter((r) => words.every((w) => [r.first_name, r.last_name, r.email, r.organization].some((f) => (f ?? '').toLowerCase().includes(w))))
      .sort(byName);
    return delay(rows);
  },

  async get(id) {
    requireRole(...CAN_READ_CRM);
    const row = overview(find(id));
    if (!row) throw new ApiError('not_found');
    const companions: Companion[] = getDb().companions
      .filter((m) => m.invitation_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    return delay({ ...row, companions });
  },

  async create(eventId, contactIds, opts) {
    const me = requireRole(...CAN_EDIT);
    const d = getDb();
    const event = d.events.find((e) => e.id === eventId);
    // Chave estrangeira: no Postgres daria erro 23503 (validation).
    if (!event) throw new ApiError('validation', 'invitations_event_id_fkey');
    const plusOnes = checkPlusOnes(opts?.plusOnes ?? event.default_plus_ones);
    const wave = blank(opts?.wave);
    const ids = [...new Set(contactIds)];
    if (ids.some((id) => !d.contacts.some((c) => c.id === id))) throw new ApiError('validation', 'invitations_contact_id_fkey');

    let created = 0;
    for (const contactId of ids) {
      // on conflict (event_id, contact_id) do nothing
      if (d.invitations.some((i) => i.event_id === eventId && i.contact_id === contactId)) continue;
      const now = nowIso();
      const inv: DemoInvitation = {
        id: uid(), event_id: eventId, contact_id: contactId, token: newToken(), checkin_code: newCheckinCode(),
        status: 'draft', wave, plus_ones_allowed: plusOnes, invited_by: me.user_id,
        sent_at: null, sent_channel: null, first_opened_at: null, last_opened_at: null, open_count: 0,
        responded_at: null, answers: {}, guest_note: null, checked_in_at: null, checked_in_by: null,
        approval_status: 'pending', pass_type_id: null, approved_at: null, approved_by: null,
        created_at: now, updated_at: now,
      };
      d.invitations.push(inv);
      logActivity({ kind: 'invitation.created', contact_id: contactId, invitation_id: inv.id, event_id: eventId, channel: null, detail: { wave } });
      created++;
    }
    save();
    return delay(created, 300);
  },

  async update(id, patch) {
    requireRole(...CAN_EDIT);
    const inv = find(id);
    if (patch.plus_ones_allowed !== undefined) checkPlusOnes(patch.plus_ones_allowed);
    if (patch.guest_note !== undefined && (patch.guest_note ?? '').length > 1000) {
      throw new ApiError('validation', 'invitations_guest_note_check', 'A nota tem mais de 1000 caracteres.');
    }
    if (patch.answers !== undefined && (typeof patch.answers !== 'object' || patch.answers === null || Array.isArray(patch.answers))) {
      throw new ApiError('validation', 'invitations_answers_check');
    }
    const now = nowIso();
    if (patch.wave !== undefined) inv.wave = blank(patch.wave);
    if (patch.plus_ones_allowed !== undefined) inv.plus_ones_allowed = patch.plus_ones_allowed;
    if (patch.answers !== undefined) inv.answers = structuredClone(patch.answers);
    if (patch.guest_note !== undefined) inv.guest_note = blank(patch.guest_note);
    if (patch.status !== undefined) {
      if (patch.status === 'accepted' || patch.status === 'declined') inv.responded_at = now;
      const wasAccepted = inv.status === 'accepted';
      setInvitationStatus(inv, patch.status);
      // Como o trigger invitations_auto_approve: sem aprovação obrigatória, a confirmação fica aprovada.
      const event = getDb().events.find((e) => e.id === inv.event_id);
      if (patch.status === 'accepted' && !wasAccepted && inv.approval_status === 'pending' && event && !event.requires_approval) {
        inv.approval_status = 'approved';
        inv.approved_at = now;
      }
      // Como guest_respond: quem recusa deixa de ter acompanhantes.
      if (patch.status === 'declined') {
        const d = getDb();
        d.companions = d.companions.filter((m) => m.invitation_id !== id);
      }
    }
    inv.updated_at = now;
    save();
    await delay(null);
  },

  async remove(id) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    find(id);
    // on delete cascade: acompanhantes, envios e linha do tempo do convite.
    d.companions = d.companions.filter((m) => m.invitation_id !== id);
    d.deliveries = d.deliveries.filter((x) => x.invitation_id !== id);
    d.activities = d.activities.filter((a) => a.invitation_id !== id);
    d.invitations = d.invitations.filter((i) => i.id !== id);
    save();
    await delay(null);
  },

  async approve(ids, passTypeId) {
    const me = requireRole(...CAN_EDIT);
    const d = getDb();
    const pass = d.passTypes.find((p) => p.id === passTypeId);
    if (!pass || d.invitations.some((i) => ids.includes(i.id) && i.event_id !== pass.event_id)) throw new ApiError('invalid_pass_type');
    const n = decide(ids, (inv) => {
      if (inv.status === 'cancelled' || inv.status === 'declined') return false;
      if (inv.approval_status === 'approved' && inv.pass_type_id === pass.id) return false;
      Object.assign(inv, { approval_status: 'approved', pass_type_id: pass.id, approved_at: nowIso(), approved_by: me.user_id });
      return true;
    }, 'invitation.approved', { pass_type: pass.name });
    return delay(n, 250);
  },

  async reject(ids, reason) {
    const me = requireRole(...CAN_EDIT);
    const text = (reason ?? '').trim();
    if (text.length > 500) throw new ApiError('validation');
    const n = decide(ids, (inv) => {
      if (inv.approval_status === 'rejected' || inv.checked_in_at) return false;
      Object.assign(inv, { approval_status: 'rejected', pass_type_id: null, approved_at: null, approved_by: me.user_id });
      return true;
    }, 'invitation.rejected', text ? { reason: text } : {});
    return delay(n, 250);
  },

  async resetApproval(ids) {
    requireRole(...CAN_EDIT);
    const n = decide(ids, (inv) => {
      if (inv.approval_status === 'pending' || inv.checked_in_at) return false;
      Object.assign(inv, { approval_status: 'pending', pass_type_id: null, approved_at: null, approved_by: null });
      return true;
    }, 'invitation.approval_reset');
    return delay(n, 250);
  },

  async markSent(ids, channel) {
    requireRole(...CAN_EDIT);
    const n = markSentRows(ids, channel);
    save();
    return delay(n);
  },

  async sendEmail(ids, templateId) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    const template = d.templates.find((t) => t.id === templateId);
    if (!template) throw new ApiError('not_found', 'template', 'O modelo de email não existe.');
    if (template.channel !== 'email') throw new ApiError('validation', 'template_channel', 'O modelo escolhido não é de email.');
    const event = d.events.find((e) => e.id === template.event_id);
    if (!event) throw new ApiError('not_found', 'event', 'O evento não existe.');
    if (event.status !== 'open' && event.status !== 'closed') {
      throw new ApiError('validation', 'event_status', 'O evento não está publicado: os links pessoais ainda não abrem.');
    }

    // Simula a função send-invitations: sem email não há envio; cada tentativa fica em deliveries.
    const sent: string[] = [];
    let failed = 0;
    const now = nowIso();
    for (const id of new Set(ids)) {
      const inv = d.invitations.find((i) => i.id === id && i.event_id === event.id);
      if (!inv || inv.status === 'cancelled') {
        failed++;
        continue;
      }
      const email = d.contacts.find((c) => c.id === inv.contact_id)?.email;
      d.deliveries.push({ id: uid(), invitation_id: id, channel: 'email', template_id: template.id, status: email ? 'sent' : 'failed', created_at: now });
      if (email) sent.push(id);
      else failed++;
    }
    markSentRows(sent, 'email');
    save();
    return delay({ sent: sent.length, failed }, 700);
  },

  async waves(eventId) {
    requireRole(...CAN_READ_CRM);
    const all = getDb().invitations.filter((i) => i.event_id === eventId && i.wave !== null).map((i) => i.wave as string);
    return delay([...new Set(all)].sort(collator.compare), 60);
  },

  async activities(eventId, limit = 50) {
    requireRole(...CAN_READ_CRM);
    const rows: Activity[] = getDb().activities
      .filter((a) => a.event_id === eventId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .slice(0, limit);
    return delay(rows);
  },
};
