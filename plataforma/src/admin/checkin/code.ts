// Regras puras do ecrã de check-in (testadas em code.test.ts).

import type { CheckinRecord, InvitationStatus } from '../../lib/api';

export const CODE_LENGTH = 10;
const TOKEN_AT_END = /[A-Za-z0-9_-]{22}\/?$/;

/** Como a função SQL: só letras e algarismos, em maiúsculas. */
export function cleanCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** "ABCDEFGHJK" → "ABCDE-FGHJK" (mais fácil de ler em voz alta). */
export function formatCode(code: string): string {
  const c = cleanCode(code);
  return c.length === CODE_LENGTH ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

/** O texto introduzido pode ser procurado: um código de 10 caracteres ou um link pessoal. */
export function isLookupInput(raw: string): boolean {
  const t = raw.trim();
  if (/^https?:\/\/|^convites:\/\//i.test(t)) return TOKEN_AT_END.test(t);
  return cleanCode(t).length === CODE_LENGTH;
}

export type Verdict =
  | { kind: 'ready' }
  | { kind: 'already'; at: string; pending: number }
  | { kind: 'blocked'; status: Exclude<InvitationStatus, 'accepted'>; severe: boolean };

/** O que a porta deve fazer com este convite. */
export function verdict(r: CheckinRecord): Verdict {
  if (r.checked_in_at) {
    return { kind: 'already', at: r.checked_in_at, pending: r.companions.filter((c) => !c.checked_in_at).length };
  }
  if (r.status === 'accepted') return { kind: 'ready' };
  return { kind: 'blocked', status: r.status, severe: r.status === 'declined' || r.status === 'cancelled' };
}

export const BLOCKED_TEXT: Record<Exclude<InvitationStatus, 'accepted'>, { title: string; text: string }> = {
  draft: { title: 'Convite por enviar', text: 'O convite ainda não foi enviado a esta pessoa.' },
  sent: { title: 'Presença não confirmada', text: 'O convite foi enviado, mas não foi aberto nem respondido.' },
  opened: { title: 'Presença não confirmada', text: 'O convidado abriu o convite, mas não respondeu.' },
  declined: { title: 'Convite recusado', text: 'O convidado informou que não estaria presente.' },
  cancelled: { title: 'Convite cancelado', text: 'A organização cancelou este convite.' },
};

/** Ignora o mesmo código lido de novo dentro de `windowMs` (a câmara lê várias vezes por segundo). */
export function createDedupe(windowMs = 3000) {
  let last: { value: string; at: number } | null = null;
  return (value: string, now = Date.now()): boolean => {
    if (last && last.value === value && now - last.at < windowMs) {
      last = { value, at: now };
      return false;
    }
    last = { value, at: now };
    return true;
  };
}

export function personName(r: Pick<CheckinRecord, 'first_name' | 'last_name'>): string {
  return [r.first_name, r.last_name].filter(Boolean).join(' ');
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "segunda-feira, 4 de janeiro" → "Segunda-feira, 4 de janeiro" (como no resto do back-office). */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('pt-PT') + s.slice(1) : s;
}

const RECENT_PREFIX = 'convites.checkin.recent.';

/** Chave das "Últimas entradas": por utilizador e por evento, para não passarem de uma pessoa para outra. */
export function recentKey(userId: string, eventId: string): string {
  return `${RECENT_PREFIX}${userId}.${eventId}`;
}

/** Chaves de "Últimas entradas" que não são deste utilizador (outra pessoa no mesmo separador, formato antigo). */
export function foreignRecentKeys(keys: Iterable<string>, userId: string): string[] {
  const own = `${RECENT_PREFIX}${userId}.`;
  return [...keys].filter((k) => k.startsWith(RECENT_PREFIX) && !k.startsWith(own));
}
