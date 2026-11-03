import type { Api, Staff } from '../types';
import { supabase, must } from './client';
import { ApiError, toApiError } from '../errors';

// Tabela staff: toda a equipa lê; só admin altera (RLS). O trigger keep_one_admin
// levanta 'last_admin' se a alteração deixasse a plataforma sem administrador ativo.

export const staff: Api['staff'] = {
  async list() {
    return must(await supabase.from('staff').select('*').order('full_name')) as Staff[];
  },
  async update(userId, patch) {
    const values: Partial<Pick<Staff, 'full_name' | 'role' | 'active'>> = {};
    if (patch.full_name !== undefined) values.full_name = patch.full_name.trim();
    if (patch.role !== undefined) values.role = patch.role;
    if (patch.active !== undefined) values.active = patch.active;
    if (!Object.keys(values).length) {
      return must(await supabase.from('staff').select('*').eq('user_id', userId).single()) as Staff;
    }
    // Sem linha devolvida: não existe ou a RLS não deixou alterar (não é admin).
    const res = await supabase.from('staff').update(values).eq('user_id', userId).select('*').maybeSingle();
    if (res.error) throw toApiError(res.error);
    if (!res.data) throw new ApiError('forbidden');
    return res.data as Staff;
  },
  async invite(input) {
    const { data, error } = await supabase.functions.invoke('invite-staff', {
      body: { email: input.email.trim().toLowerCase(), full_name: input.full_name.trim(), role: input.role },
    });
    if (error) {
      // FunctionsHttpError: a resposta da função traz { error, message } (ver invite-staff).
      const ctx = (error as { context?: Response }).context;
      let body: { error?: string; message?: string } | null = null;
      try {
        body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      } catch {
        body = null;
      }
      const code = body?.error;
      if (code === 'forbidden' || code === 'last_admin') throw new ApiError(code, body?.message);
      if ((code === 'validation' || code === 'auth') && body?.message) throw new ApiError(code, body.message, body.message);
      if (body?.message) throw new ApiError('unknown', code, body.message);
      if ((error as { name?: string }).name === 'FunctionsFetchError') throw new ApiError('network', error.message);
      throw toApiError(error);
    }
    if (!(data as { ok?: boolean } | null)?.ok) throw new ApiError('unknown', 'invite-staff');
  },
};
