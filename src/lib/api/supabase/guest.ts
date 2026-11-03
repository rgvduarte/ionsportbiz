import type { Api, GuestView } from '../types';
import { ApiError, toApiError } from '../errors';
import { supabase, must } from './client';

// O convidado não tem conta: o token do link pessoal é a credencial e tudo passa
// pelas funções guest_* (security definer), as únicas que o papel anon pode executar.

export const guest: Api['guest'] = {
  async view(token, opts) {
    const { data, error } = await supabase.rpc('guest_invitation', { p_token: token, p_track: opts?.track ?? true });
    if (error) throw toApiError(error);
    return (data as GuestView | null) ?? null;
  },

  async respond(token, input) {
    return must(await supabase.rpc('guest_respond', {
      p_token: token,
      p_accept: input.accept,
      p_answers: input.answers ?? {},
      p_companions: input.companions ?? [],
      p_note: input.note ?? null,
      p_marketing_consent: input.marketingConsent ?? null,
    })) as GuestView;
  },

  async requestErasure(token) {
    // A função devolve false quando o link não existe.
    const ok = must(await supabase.rpc('guest_request_erasure', { p_token: token }));
    if (ok !== true) throw new ApiError('not_found');
  },
};
