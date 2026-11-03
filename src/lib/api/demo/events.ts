import type { Api, BreakdownRow, EventInput, EventRecord, EventSession, EventSessionInput, EventStats } from '../types';
import { ApiError } from '../errors';
import { ALL_STAFF, CAN_EDIT, CAN_READ_CRM, delay, getDb, nowIso, requireRole, save, uid } from './store';

const EVENT_KEYS: (keyof EventInput)[] = [
  'slug', 'name', 'host_name', 'invitation_text', 'description', 'starts_at', 'ends_at', 'timezone',
  'venue_name', 'venue_address', 'venue_maps_url', 'dress_code', 'contact_email', 'contact_phone',
  'rsvp_deadline', 'capacity', 'default_plus_ones', 'status', 'rsvp_fields', 'branding',
  'privacy_controller', 'privacy_policy_url', 'marketing_consent_text',
];

const ts = (iso: string) => new Date(iso).getTime();

// As mesmas restrições da tabela events (checks e unique do slug).
function checkEvent(e: EventRecord): void {
  const d = getDb();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug) || e.slug.length > 60) throw new ApiError('validation', 'slug');
  if (d.events.some((x) => x.slug === e.slug && x.id !== e.id)) throw new ApiError('duplicate', 'events_slug_key');
  if (!e.name || e.name.length > 160) throw new ApiError('validation', 'name');
  if (!e.starts_at || Number.isNaN(ts(e.starts_at))) throw new ApiError('validation', 'starts_at');
  if (e.ends_at && ts(e.ends_at) < ts(e.starts_at)) throw new ApiError('validation', 'ends_at');
  if (e.capacity !== null && !(Number.isInteger(e.capacity) && e.capacity > 0)) throw new ApiError('validation', 'capacity');
  if (!Number.isInteger(e.default_plus_ones) || e.default_plus_ones < 0 || e.default_plus_ones > 10) {
    throw new ApiError('validation', 'default_plus_ones');
  }
  if (!Array.isArray(e.rsvp_fields)) throw new ApiError('validation', 'rsvp_fields');
  if (!e.branding || typeof e.branding !== 'object' || Array.isArray(e.branding)) throw new ApiError('validation', 'branding');
}

function checkSession(s: EventSession): void {
  if (!getDb().events.some((e) => e.id === s.event_id)) throw new ApiError('validation', 'event_id');
  if (!s.title || s.title.length > 200) throw new ApiError('validation', 'title');
  if (!s.starts_at || Number.isNaN(ts(s.starts_at))) throw new ApiError('validation', 'starts_at');
  if (s.ends_at && ts(s.ends_at) < ts(s.starts_at)) throw new ApiError('validation', 'ends_at');
}

function pickEvent(input: Partial<EventInput>): Partial<EventInput> {
  const out: Record<string, unknown> = {};
  for (const key of EVENT_KEYS) {
    if (input[key] !== undefined) out[key] = structuredClone(input[key]);
  }
  return out as Partial<EventInput>;
}

function breakdown<K extends string>(rows: { key: string; status: string }[], name: K): (BreakdownRow & Record<K, string>)[] {
  const groups = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const g = groups.get(r.key) ?? { invited: 0, accepted: 0, declined: 0 };
    g.invited++;
    if (r.status === 'accepted') g.accepted++;
    if (r.status === 'declined') g.declined++;
    groups.set(r.key, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt'))
    .map(([key, g]) => ({ [name]: key, ...g }) as BreakdownRow & Record<K, string>);
}

/** Igual à função SQL event_stats: ignora convites cancelados; os acompanhantes contam como pessoas esperadas. */
export function computeEventStats(eventId: string): EventStats {
  const d = getDb();
  const contacts = new Map(d.contacts.map((c) => [c.id, c]));
  const inv = d.invitations
    .filter((i) => i.event_id === eventId && i.status !== 'cancelled')
    .map((i) => {
      const comps = d.companions.filter((m) => m.invitation_id === i.id);
      return { ...i, segment: contacts.get(i.contact_id)?.segment ?? null, comp: comps.length, compIn: comps.filter((m) => m.checked_in_at).length };
    });
  const count = (f: (i: (typeof inv)[number]) => boolean) => inv.filter(f).length;
  return {
    invited: inv.length,
    by_status: {
      draft: count((i) => i.status === 'draft'),
      sent: count((i) => i.status === 'sent'),
      opened: count((i) => i.status === 'opened'),
      accepted: count((i) => i.status === 'accepted'),
      declined: count((i) => i.status === 'declined'),
    },
    delivered: count((i) => i.status !== 'draft'),
    opened: count((i) => i.first_opened_at !== null),
    responded: count((i) => i.status === 'accepted' || i.status === 'declined'),
    expected_attendees: inv.filter((i) => i.status === 'accepted').reduce((n, i) => n + 1 + i.comp, 0),
    checked_in: count((i) => i.checked_in_at !== null) + inv.reduce((n, i) => n + i.compIn, 0),
    capacity: d.events.find((e) => e.id === eventId)?.capacity ?? null,
    by_wave: breakdown(inv.map((i) => ({ key: i.wave ?? '', status: i.status })), 'wave'),
    by_segment: breakdown(inv.map((i) => ({ key: i.segment ?? '', status: i.status })), 'segment'),
  };
}

export const events: Api['events'] = {
  async list() {
    requireRole(...ALL_STAFF);
    const rows = [...getDb().events].sort((a, b) => ts(b.starts_at) - ts(a.starts_at));
    return delay(rows);
  },

  async get(id) {
    requireRole(...ALL_STAFF);
    const event = getDb().events.find((e) => e.id === id);
    if (!event) throw new ApiError('not_found');
    return delay(event);
  },

  async create(input) {
    requireRole(...CAN_EDIT);
    const now = nowIso();
    // Valores por omissão das colunas, para o caso de faltar algum campo.
    const defaults: EventInput = {
      slug: '', name: '', starts_at: '', host_name: null, invitation_text: null, description: null, ends_at: null,
      timezone: 'Europe/Lisbon', venue_name: null, venue_address: null, venue_maps_url: null, dress_code: null,
      contact_email: null, contact_phone: null, rsvp_deadline: null, capacity: null, default_plus_ones: 0, status: 'draft',
      rsvp_fields: [], branding: {}, privacy_controller: null, privacy_policy_url: null, marketing_consent_text: null,
    };
    const event: EventRecord = { ...defaults, ...pickEvent(input), id: uid(), created_at: now, updated_at: now };
    checkEvent(event);
    getDb().events.push(event);
    save();
    return delay(event);
  },

  async update(id, patch) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    const index = d.events.findIndex((e) => e.id === id);
    if (index < 0) throw new ApiError('not_found');
    const next: EventRecord = { ...d.events[index], ...pickEvent(patch), updated_at: nowIso() };
    checkEvent(next);
    d.events[index] = next;
    save();
    return delay(next);
  },

  async remove(id) {
    // Como a política events_delete: apaga tudo em cascata, por isso só o administrador.
    requireRole('admin');
    const d = getDb();
    if (!d.events.some((e) => e.id === id)) throw new ApiError('not_found');
    // Como o "on delete cascade" da base de dados.
    const invitationIds = new Set(d.invitations.filter((i) => i.event_id === id).map((i) => i.id));
    d.events = d.events.filter((e) => e.id !== id);
    d.sessions = d.sessions.filter((s) => s.event_id !== id);
    d.templates = d.templates.filter((t) => t.event_id !== id);
    d.invitations = d.invitations.filter((i) => !invitationIds.has(i.id));
    d.companions = d.companions.filter((m) => !invitationIds.has(m.invitation_id));
    d.deliveries = d.deliveries.filter((x) => !invitationIds.has(x.invitation_id));
    d.activities = d.activities.filter((a) => a.event_id !== id && !(a.invitation_id && invitationIds.has(a.invitation_id)));
    save();
    return delay(undefined);
  },

  async stats(id) {
    const me = requireRole(...ALL_STAFF);
    const stats = computeEventStats(id);
    // Como event_stats: a receção não lê o CRM, recebe só os totais.
    if (!CAN_READ_CRM.includes(me.role)) {
      stats.by_wave = [];
      stats.by_segment = [];
    }
    return delay(stats);
  },

  async sessions(eventId) {
    requireRole(...ALL_STAFF);
    const rows = getDb().sessions.filter((s) => s.event_id === eventId).sort((a, b) => ts(a.starts_at) - ts(b.starts_at));
    return delay(rows);
  },

  async saveSession(input: EventSessionInput) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    const fields = {
      event_id: input.event_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      speakers: input.speakers ?? null,
    };
    let session: EventSession;
    if (input.id) {
      const index = d.sessions.findIndex((s) => s.id === input.id);
      if (index < 0) throw new ApiError('not_found');
      session = { ...d.sessions[index], ...fields };
      checkSession(session);
      d.sessions[index] = session;
    } else {
      session = { id: uid(), ...fields };
      checkSession(session);
      d.sessions.push(session);
    }
    save();
    return delay(session);
  },

  async removeSession(id) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    if (!d.sessions.some((s) => s.id === id)) throw new ApiError('not_found');
    d.sessions = d.sessions.filter((s) => s.id !== id);
    save();
    return delay(undefined);
  },
};
