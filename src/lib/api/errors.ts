// Erros com código estável. As funções SQL levantam exceções com estes códigos
// (ex.: raise exception 'capacity_full'); o modo demonstração usa os mesmos.

export type ApiErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'rsvp_closed'
  | 'capacity_full'
  | 'too_many_companions'
  | 'invalid_companions'
  | 'invalid_answers'
  | 'invalid_note'
  | 'already_checked_in'
  | 'not_accepted'
  | 'not_approved'
  | 'invalid_pass_type'
  | 'pass_quota'
  | 'last_admin'
  | 'duplicate'
  | 'validation'
  | 'network'
  | 'auth'
  | 'unknown';

const MESSAGES: Record<ApiErrorCode, string> = {
  not_found: 'Não encontrado.',
  forbidden: 'Não tem permissão para esta ação.',
  rsvp_closed: 'O prazo de resposta terminou.',
  capacity_full: 'A lotação do evento está completa.',
  too_many_companions: 'Indicou mais acompanhantes do que os permitidos.',
  invalid_companions: 'Indique o nome de cada acompanhante.',
  invalid_answers: 'Há respostas inválidas no formulário.',
  invalid_note: 'A mensagem é demasiado longa.',
  already_checked_in: 'A entrada já foi registada.',
  not_accepted: 'Este convidado não confirmou presença.',
  not_approved: 'Presença ainda não aprovada pela equipa.',
  invalid_pass_type: 'O tipo de acesso não pertence a este evento.',
  pass_quota: 'A quota deste tipo de acesso não chega para todos os convites.',
  last_admin: 'Tem de existir pelo menos um administrador ativo.',
  duplicate: 'Já existe um registo igual.',
  validation: 'Verifique os dados introduzidos.',
  network: 'Sem ligação. Tente novamente.',
  auth: 'Email ou palavra-passe incorretos.',
  unknown: 'Ocorreu um erro inesperado.',
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly detail?: string;

  constructor(code: ApiErrorCode, detail?: string, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
  }
}

const KNOWN = new Set(Object.keys(MESSAGES));

/** Converte um erro do Supabase/PostgREST (ou qualquer outro) num ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as { message?: string; code?: string; details?: string; status?: number; name?: string } | null;
  const message = e?.message ?? String(err);
  const first = message.split(/[\s:]/)[0];
  if (KNOWN.has(first)) return new ApiError(first as ApiErrorCode, message);
  if (e?.code === '23505') return new ApiError('duplicate', message);
  if (e?.code === '42501' || e?.code === 'PGRST301' || /row-level security|permission denied/i.test(message)) {
    return new ApiError('forbidden', message);
  }
  if (e?.code === 'PGRST116') return new ApiError('not_found', message);
  if (e?.code?.startsWith('23') || e?.code === '22P02') return new ApiError('validation', message);
  if (e?.name === 'AuthApiError' || e?.name === 'AuthError') return new ApiError('auth', message);
  if (e?.name === 'TypeError' && /fetch/i.test(message)) return new ApiError('network', message);
  return new ApiError('unknown', message);
}

/** Mensagem para mostrar ao utilizador. */
export function errorMessage(err: unknown): string {
  return toApiError(err).message;
}
