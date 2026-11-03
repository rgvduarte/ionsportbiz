// Resposta ao convite dentro da app do evento (funções puras, testadas em rsvp.test.ts).
// O convidado abre o link pessoal (/c/<token>) e responde aqui: não há página de convite intermédia.

import type { GuestView, RsvpField } from '../../lib/api/types';
import { credentialState } from './invite';

type Inv = GuestView['invitation'];
type Ev = GuestView['event'];

/** O convidado ainda pode responder (ou mudar a resposta): prazo aberto, sem entrada registada e sem recusa da equipa. */
export function canRespond(v: { invitation: Pick<Inv, 'status' | 'approval_status' | 'checkin_code' | 'checked_in_at'>; event: Pick<Ev, 'rsvp_open'> }): boolean {
  return v.event.rsvp_open && !v.invitation.checked_in_at && credentialState(v.invitation) !== 'rejected';
}

/** Para onde vai quem abre o link pessoal: a resposta ao convite se ainda faltar (ou se recusou e ainda pode mudar), senão o início. */
export function entryPath(v: Parameters<typeof canRespond>[0]): '/convite' | '/' {
  const cs = credentialState(v.invitation);
  if (cs === 'unconfirmed') return '/convite';
  if (cs === 'declined' && canRespond(v)) return '/convite';
  return '/';
}

/** Chave do dia no fuso do evento (AAAA-MM-DD). */
export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);
const MAX_DAYS = 4;

/**
 * Os dias do evento, no fuso do evento e na língua da app, ex.:
 *   ["Segunda-feira, 22 de março · 19:00", "Terça-feira, 23 de março de 2027"]
 * O ano aparece só no último dia; a hora de início no primeiro (e a de fim, se acabar no mesmo dia).
 * Eventos com mais de quatro dias: só o primeiro e o último.
 */
export function eventDays(e: Pick<Ev, 'starts_at' | 'ends_at' | 'timezone'>, locale: string): string[] {
  const tz = e.timezone;
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const first = dayKey(e.starts_at, tz);
  const last = e.ends_at ? dayKey(e.ends_at, tz) : first;
  const keys: string[] = [];
  for (let d = new Date(`${first}T12:00:00Z`); keys.length < 60; d = new Date(d.getTime() + 86_400_000)) {
    const k = d.toISOString().slice(0, 10);
    if (k > last) break;
    keys.push(k);
  }
  if (keys.length === 0) keys.push(first);
  const shown = keys.length > MAX_DAYS ? [keys[0]!, keys[keys.length - 1]!] : keys;
  return shown.map((k, i) => {
    const isLast = i === shown.length - 1;
    const label = cap(new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', ...(isLast ? { year: 'numeric' } : {}),
    }).format(new Date(`${k}T12:00:00Z`)));
    if (i !== 0) return label;
    const sameDayEnd = e.ends_at && last === first ? ` – ${time(e.ends_at)}` : '';
    return `${label} · ${time(e.starts_at)}${sameDayEnd}`;
  });
}

/** O evento já terminou (ou, sem hora de fim, começou há mais de 12 horas). */
export function eventIsPast(e: Pick<Ev, 'starts_at' | 'ends_at'>, now = Date.now()): boolean {
  const end = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 12 * 3_600_000;
  return now > end;
}

/** Link para o mapa: o do evento, ou uma pesquisa pelo local e morada. */
export function mapsUrl(e: Pick<Ev, 'venue_maps_url' | 'venue_name' | 'venue_address'>): string | null {
  if (e.venue_maps_url && /^https?:\/\//i.test(e.venue_maps_url)) return e.venue_maps_url;
  const q = [e.venue_name, e.venue_address].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/** Só links http(s) vindos da base de dados (ex.: política de privacidade). */
export function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** FNV-1a de 64 bits: só para quando o browser não tem crypto.subtle (páginas servidas sem HTTPS). */
function fnv1a64(bytes: Uint8Array): string {
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, '0');
}

/**
 * UID do evento de calendário: derivado do token sem o revelar (o calendário é muitas vezes partilhado
 * e o token dá acesso ao código de entrada). Estável, para que reimportar atualize em vez de duplicar.
 */
export async function calendarUid(token: string): Promise<string> {
  const data = new TextEncoder().encode(`calendar:${token}`);
  let digest: string;
  try {
    digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).slice(0, 16);
  } catch {
    digest = fnv1a64(data);
  }
  return `convite-${digest}@convites`;
}

// ───────── Formulário de resposta ─────────

export type AnswerValue = string | boolean;
export type FormErrors = Record<string, string>;

/** Perguntas extra do evento (rsvp_fields), tolerando dados antigos que não sejam uma lista. */
export const rsvpFields = (e: Pick<Ev, 'rsvp_fields'>): RsvpField[] => (Array.isArray(e.rsvp_fields) ? e.rsvp_fields : []);

/** Valores iniciais dos campos extra a partir de respostas anteriores. */
export function initialAnswers(fields: RsvpField[], answers: Record<string, unknown>): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const f of fields) {
    const v = answers[f.key];
    if (f.type === 'checkbox') out[f.key] = v === true || v === 'true';
    else out[f.key] = typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
  }
  return out;
}

/** Respostas a enviar: texto sem espaços a mais, campos vazios omitidos, caixas como booleanos. */
export function cleanAnswers(fields: RsvpField[], values: Record<string, AnswerValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === 'checkbox') out[f.key] = v === true;
    else if (typeof v === 'string' && v.trim()) {
      // Numa lista só valem as opções previstas.
      if (f.type === 'select' && f.options && !f.options.includes(v)) continue;
      out[f.key] = v.trim();
    }
  }
  return out;
}

/** Erros por campo (chave do campo, ou "companion-<i>"). */
export function validateRsvp(
  fields: RsvpField[],
  values: Record<string, AnswerValue>,
  companions: string[],
  messages: { required: string; requiredCheck: string; companion: string },
): FormErrors {
  const errors: FormErrors = {};
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.key];
    if (f.type === 'checkbox') {
      if (v !== true) errors[f.key] = messages.requiredCheck;
    } else if (typeof v !== 'string' || !v.trim()) {
      errors[f.key] = messages.required;
    }
  }
  companions.forEach((name, i) => {
    if (!name.trim()) errors[`companion-${i}`] = messages.companion;
  });
  return errors;
}

/**
 * Consentimento para comunicações futuras. A caixa só aparece a quem ainda não o deu e começa sempre
 * desmarcada; marcada, envia o consentimento. Caso contrário null (não mexer): esta resposta nunca o retira.
 */
export function consentToSend(asked: boolean, alreadyGiven: boolean, checked: boolean): true | null {
  return asked && !alreadyGiven && checked ? true : null;
}

/** Erros da resposta com texto próprio; os restantes usam a mensagem genérica. */
export const RSVP_ERRORS = [
  'not_found', 'rsvp_closed', 'capacity_full', 'too_many_companions', 'invalid_companions',
  'invalid_answers', 'invalid_note', 'already_checked_in', 'network',
] as const;
export type RsvpErrorCode = (typeof RSVP_ERRORS)[number] | 'unknown';

export function rsvpErrorCode(err: unknown): RsvpErrorCode {
  const e = err as { code?: string; name?: string; message?: string } | null;
  const code = e?.code;
  if (code && (RSVP_ERRORS as readonly string[]).includes(code)) return code as RsvpErrorCode;
  if (e?.name === 'TypeError' && /fetch|network/i.test(e.message ?? '')) return 'network';
  return 'unknown';
}

/** Erros que significam que o convite mudou entretanto: volta a pedi-lo para mostrar o estado certo. */
export const STALE_ERRORS: ReadonlySet<RsvpErrorCode> = new Set(['rsvp_closed', 'already_checked_in', 'not_found']);
