import { createClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { toApiError } from '../errors';

export const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseKey || 'demo', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Devolve `data` ou lança ApiError. Uso: `const rows = must(await supabase.from(...).select())`. */
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw toApiError(res.error);
  if (res.data === null || res.data === undefined) throw toApiError({ code: 'PGRST116', message: 'not_found' });
  return res.data as NonNullable<T>;
}

/** Como `must`, para operações que não devolvem dados. */
export function check(res: { error: unknown }): void {
  if (res.error) throw toApiError(res.error);
}

/** Escapa texto do utilizador para filtros `ilike` do PostgREST (vírgulas e parênteses partem o .or()). */
export function ilikeTerm(text: string): string {
  return `*${text.replace(/[,()*%\\]/g, ' ').trim()}*`;
}
