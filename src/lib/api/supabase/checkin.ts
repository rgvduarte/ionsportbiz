import type { Api, CheckinRecord } from '../types';
import { supabase, must } from './client';
import { toApiError } from '../errors';

// Funções checkin_* (security definer): devolvem só o registo mínimo para a porta,
// por isso funcionam para o papel Receção, que não lê o CRM.

export const checkin: Api['checkin'] = {
  async lookup(eventId, code) {
    const res = await supabase.rpc('checkin_lookup', { p_event_id: eventId, p_code: code });
    if (res.error) throw toApiError(res.error);
    return (res.data as CheckinRecord | null) ?? null;
  },
  async search(eventId, query) {
    const res = await supabase.rpc('checkin_search', { p_event_id: eventId, p_query: query });
    if (res.error) throw toApiError(res.error);
    return (res.data as CheckinRecord[] | null) ?? [];
  },
  async checkIn(invitationId, companionIds, force = false) {
    return must(await supabase.rpc('check_in', {
      p_invitation_id: invitationId,
      p_companion_ids: companionIds,
      p_force: force,
    })) as CheckinRecord;
  },
  async undo(invitationId) {
    return must(await supabase.rpc('undo_check_in', { p_invitation_id: invitationId })) as CheckinRecord;
  },
};
