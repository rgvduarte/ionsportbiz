import type { Api, EventInput, EventRecord, EventSession, EventSessionInput, EventStats } from '../types';
import { ApiError } from '../errors';
import { supabase, must } from './client';

const EVENT_COLUMNS: (keyof EventInput)[] = [
  'slug', 'name', 'host_name', 'invitation_text', 'description', 'starts_at', 'ends_at', 'timezone',
  'venue_name', 'venue_address', 'venue_maps_url', 'dress_code', 'contact_email', 'contact_phone',
  'rsvp_deadline', 'capacity', 'default_plus_ones', 'status', 'rsvp_fields', 'branding',
  'privacy_controller', 'privacy_policy_url', 'marketing_consent_text',
];

const SESSION_COLUMNS = 'id, event_id, starts_at, ends_at, title, description, location, speakers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Só as colunas editáveis (ignora id, created_at, updated_at e campos a mais). */
function eventFields(input: Partial<EventInput>): Partial<EventInput> {
  const out: Record<string, unknown> = {};
  for (const key of EVENT_COLUMNS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out as Partial<EventInput>;
}

function sessionFields(input: EventSessionInput): Omit<EventSession, 'id'> {
  return {
    event_id: input.event_id,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    title: input.title,
    description: input.description,
    location: input.location,
    speakers: input.speakers,
  };
}

export const events: Api['events'] = {
  async list() {
    return must(await supabase.from('events').select('*').order('starts_at', { ascending: false })) as EventRecord[];
  },

  async get(id) {
    // Um id mal formado daria erro de tipo no Postgres; para quem navega é simplesmente "não encontrado".
    if (!UUID.test(id)) throw new ApiError('not_found');
    return must(await supabase.from('events').select('*').eq('id', id).maybeSingle()) as EventRecord;
  },

  async create(input) {
    return must(await supabase.from('events').insert(eventFields(input)).select().single()) as EventRecord;
  },

  async update(id, patch) {
    return must(await supabase.from('events').update(eventFields(patch)).eq('id', id).select().single()) as EventRecord;
  },

  async remove(id) {
    // Com RLS, apagar sem permissão não dá erro: simplesmente não apaga nenhuma linha.
    const rows = must(await supabase.from('events').delete().eq('id', id).select('id'));
    if (!rows.length) throw new ApiError('not_found');
  },

  async stats(id) {
    return must(await supabase.rpc('event_stats', { p_event_id: id })) as EventStats;
  },

  async sessions(eventId) {
    return must(
      await supabase.from('event_sessions').select(SESSION_COLUMNS).eq('event_id', eventId)
        .order('starts_at').order('created_at'),
    ) as EventSession[];
  },

  async saveSession(input) {
    const fields = sessionFields(input);
    const res = input.id
      ? await supabase.from('event_sessions').update(fields).eq('id', input.id).select(SESSION_COLUMNS).single()
      : await supabase.from('event_sessions').insert(fields).select(SESSION_COLUMNS).single();
    return must(res) as EventSession;
  },

  async removeSession(id) {
    const rows = must(await supabase.from('event_sessions').delete().eq('id', id).select('id'));
    if (!rows.length) throw new ApiError('not_found');
  },
};
