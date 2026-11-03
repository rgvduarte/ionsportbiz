import type { Api, GuestView, Invitation } from '../types';
import { ApiError } from '../errors';
import { delay, getDb, logActivity, nowIso, save, setInvitationStatus, uid } from './store';

// Imita as funções guest_invitation, guest_respond e guest_request_erasure.
// Não exige sessão da equipa: o token do link pessoal é a credencial. Ações registadas com actor null.

const TOKEN_LENGTH = 22;
const MAX_ANSWERS_BYTES = 8192;

/** btrim() do Postgres: só tira espaços. */
const btrim = (s: string) => s.replace(/^ +| +$/g, '');
/** length() do Postgres conta caracteres, não unidades UTF-16. */
const chars = (s: string) => [...s].length;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** x ->> 'full_name' */
function fullNameOf(x: unknown): string | null {
  if (!isObject(x)) return null;
  const v = x.full_name;
  if (v === null || v === undefined) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/** Igual a guest_payload: sem email, telefone, notas internas, tags ou segmento. */
function payload(inv: Invitation): GuestView {
  const d = getDb();
  const c = d.contacts.find((x) => x.id === inv.contact_id)!;
  const e = d.events.find((x) => x.id === inv.event_id)!;
  const now = Date.now();
  return {
    invitation: {
      status: inv.status,
      plus_ones_allowed: inv.plus_ones_allowed,
      answers: inv.answers,
      guest_note: inv.guest_note,
      responded_at: inv.responded_at,
      checked_in_at: inv.checked_in_at,
      checkin_code: inv.status === 'accepted' ? inv.checkin_code : null,
      companions: d.companions
        .filter((m) => m.invitation_id === inv.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => ({ full_name: m.full_name })),
    },
    contact: {
      salutation: c.salutation,
      first_name: c.first_name,
      last_name: c.last_name,
      language: c.language,
      marketing_consent: c.marketing_consent,
    },
    event: {
      name: e.name,
      host_name: e.host_name,
      invitation_text: e.invitation_text,
      description: e.description,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      timezone: e.timezone,
      venue_name: e.venue_name,
      venue_address: e.venue_address,
      venue_maps_url: e.venue_maps_url,
      dress_code: e.dress_code,
      contact_email: e.contact_email,
      contact_phone: e.contact_phone,
      rsvp_deadline: e.rsvp_deadline,
      rsvp_fields: e.rsvp_fields,
      branding: e.branding,
      status: e.status,
      privacy_controller: e.privacy_controller,
      privacy_policy_url: e.privacy_policy_url,
      marketing_consent_text: e.marketing_consent_text,
      rsvp_open: e.status === 'open' && (e.rsvp_deadline === null || now <= new Date(e.rsvp_deadline).getTime()),
    },
    sessions: d.sessions
      .filter((s) => s.event_id === e.id)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((s) => ({
        id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, title: s.title,
        description: s.description, location: s.location, speakers: s.speakers,
      })),
  };
}

/** Convite pelo link pessoal, como nas funções guest_*: sem convites de contactos apagados (RGPD). */
function byToken(token: string, opts: { cancelled: boolean }) {
  const d = getDb();
  return d.invitations.find((i) => i.token === token && (opts.cancelled || i.status !== 'cancelled')
    && d.contacts.some((c) => c.id === i.contact_id && c.anonymized_at === null));
}

export const guest: Api['guest'] = {
  async view(token, opts) {
    const track = opts?.track ?? true;
    if (typeof token !== 'string' || token.length !== TOKEN_LENGTH) return delay(null);
    const d = getDb();
    const inv = byToken(token, { cancelled: false });
    const event = inv && d.events.find((e) => e.id === inv.event_id);
    if (!inv || !event || (event.status !== 'open' && event.status !== 'closed')) return delay(null);
    if (track) {
      const now = nowIso();
      inv.first_opened_at ??= now;
      inv.last_opened_at = now;
      inv.open_count += 1;
      inv.updated_at = now;
      if (inv.status === 'draft' || inv.status === 'sent') setInvitationStatus(inv, 'opened', null);
      save();
    }
    return delay(payload(inv));
  },

  async respond(token, input) {
    if (typeof token !== 'string' || token.length !== TOKEN_LENGTH) throw new ApiError('not_found');
    const d = getDb();
    const inv = byToken(token, { cancelled: false });
    if (!inv) throw new ApiError('not_found');
    const e = d.events.find((x) => x.id === inv.event_id);
    if (!e || (e.status !== 'open' && e.status !== 'closed')) throw new ApiError('not_found');
    if (e.status !== 'open' || (e.rsvp_deadline !== null && Date.now() > new Date(e.rsvp_deadline).getTime())) {
      throw new ApiError('rsvp_closed');
    }
    if (inv.checked_in_at !== null) throw new ApiError('already_checked_in');

    const accept = input.accept;
    const answers = input.answers;
    if (!isObject(answers) || new TextEncoder().encode(JSON.stringify(answers)).length > MAX_ANSWERS_BYTES) {
      throw new ApiError('invalid_answers');
    }
    const note = input.note ?? null;
    if (note !== null && chars(note) > 1000) throw new ApiError('invalid_note');
    if (!Array.isArray(input.companions)) throw new ApiError('invalid_companions');

    let companions = input.companions.map((x) => {
      const name = fullNameOf(x);
      return name === null ? null : btrim(name);
    });
    if (!accept) companions = [];
    if (companions.length > inv.plus_ones_allowed) throw new ApiError('too_many_companions');
    if (companions.some((n) => n === null || chars(n) < 1 || chars(n) > 160)) throw new ApiError('invalid_companions');
    const names = companions as string[];

    if (accept && e.capacity !== null) {
      const taken = d.invitations
        .filter((i) => i.event_id === e.id && i.status === 'accepted' && i.id !== inv.id)
        .reduce((n, i) => n + 1 + d.companions.filter((m) => m.invitation_id === i.id).length, 0);
      if (taken + 1 + names.length > e.capacity) throw new ApiError('capacity_full');
    }

    const now = nowIso();
    setInvitationStatus(inv, accept ? 'accepted' : 'declined', null);
    inv.responded_at = now;
    inv.answers = accept ? structuredClone(answers) : {};
    inv.guest_note = note === null ? null : btrim(note) || null;
    inv.first_opened_at ??= now;
    inv.last_opened_at ??= now;
    inv.updated_at = now;

    d.companions = d.companions.filter((m) => m.invitation_id !== inv.id);
    for (const full_name of names) {
      d.companions.push({ id: uid(), invitation_id: inv.id, full_name, checked_in_at: null, created_at: now });
    }

    // Consentimento para comunicações futuras: só muda se o convidado o indicar.
    const consent = input.marketingConsent ?? null;
    if (consent !== null) {
      const c = d.contacts.find((x) => x.id === inv.contact_id)!;
      if (consent && !c.marketing_consent) {
        c.marketing_consent = true;
        c.marketing_consent_at = now;
        c.marketing_consent_text = e.marketing_consent_text;
        c.updated_at = now;
        logActivity({
          kind: 'consent.granted', contact_id: c.id, invitation_id: inv.id, event_id: e.id,
          channel: 'link', detail: { text: e.marketing_consent_text }, actor_id: null,
        });
      } else if (!consent && c.marketing_consent) {
        c.marketing_consent = false;
        c.marketing_consent_at = null;
        c.marketing_consent_text = null;
        c.updated_at = now;
        logActivity({
          kind: 'consent.revoked', contact_id: c.id, invitation_id: inv.id, event_id: e.id,
          channel: 'link', detail: {}, actor_id: null,
        });
      }
    }

    save();
    return delay(payload(inv));
  },

  async requestErasure(token) {
    const inv = typeof token === 'string' && token.length === TOKEN_LENGTH
      ? byToken(token, { cancelled: true })
      : undefined;
    if (!inv) throw new ApiError('not_found');
    logActivity({
      kind: 'privacy.erasure_requested', contact_id: inv.contact_id, invitation_id: inv.id, event_id: inv.event_id,
      channel: 'link', detail: {}, actor_id: null,
    });
    save();
    await delay(null);
  },
};
