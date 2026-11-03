// Funções puras da área do convidado (testadas em utils.test.ts).

import type { GuestView, RsvpField } from '../lib/api/types';
import { formatDate, formatLongDate, formatTime } from '../lib/format';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_ACCENT = '#ccff00';

function parseHex(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Luminância relativa (WCAG 2.1). */
function luminance([r, g, b]: number[]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export interface AccentPalette {
  accent: string;
  /** Mais escuro, para hover. */
  strong: string;
  /** Fundo suave. */
  soft: string;
  /** Texto sobre o acento. */
  on: string;
  /** Acento legível sobre o fundo da página (para texto e links). */
  text: string;
}

/**
 * Paleta a partir da cor da marca do evento. Cores inválidas usam o verde-lima da ion
 * (o valor vem da base de dados e entra em CSS: só se aceitam #rgb ou #rrggbb).
 * No tema escuro o texto do acento é aclarado até ter contraste sobre o papel preto.
 */
export function accentPalette(input: string | null | undefined, theme: 'light' | 'dark' = 'light'): AccentPalette {
  const accent = input && HEX.test(input.trim()) ? input.trim().toLowerCase() : DEFAULT_ACCENT;
  const rgb = parseHex(accent);
  const on = contrast(accent, '#ffffff') >= 4.5 ? '#ffffff' : '#101828';
  if (theme === 'dark') {
    let text = accent;
    for (let t = 0.1; contrast(text, '#0b0b0b') < 4.5 && t <= 1; t += 0.1) text = toHex(mix(rgb, [255, 255, 255], t));
    const light = luminance(rgb) > 0.4;
    return {
      accent,
      strong: toHex(mix(rgb, light ? [0, 0, 0] : [255, 255, 255], 0.14)),
      soft: toHex(mix(rgb, [11, 11, 11], 0.86)),
      on: on === '#101828' ? '#000000' : on,
      text,
    };
  }
  // Acentos claros (ex.: amarelo) não se leem como texto sobre branco: escurece até ter contraste.
  let text = accent;
  for (let t = 0.1; contrast(text, '#ffffff') < 4.5 && t <= 1; t += 0.1) text = toHex(mix(rgb, [16, 24, 40], t));
  return {
    accent,
    strong: toHex(mix(rgb, [0, 0, 0], 0.22)),
    soft: toHex(mix(rgb, [255, 255, 255], 0.9)),
    on,
    text,
  };
}

/**
 * "V54BGGQFFT" → "V54BG-GQFFT": blocos de 5, como a equipa os vê na porta (formatCode do check-in),
 * para que o convidado dite o código pelos mesmos grupos que a equipa escreve.
 */
export function groupCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.match(/.{1,5}/g)?.join('-') ?? '';
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

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Token a partir do que o convidado colou ou do que o leitor de QR devolveu:
 * o link completo (com ou sem protocolo, parâmetros ou barra final) ou só o token.
 */
export function parseInvitationInput(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (TOKEN.test(value)) return value;
  const m = /(?:^|\/)c\/([A-Za-z0-9_-]{22})(?=$|[/?#\s])/.exec(value);
  return m ? m[1] : null;
}

/** Link para o mapa: o do evento, ou uma pesquisa pelo local e morada. */
export function mapsUrl(e: { venue_maps_url: string | null; venue_name: string | null; venue_address: string | null }): string | null {
  if (e.venue_maps_url && /^https?:\/\//i.test(e.venue_maps_url)) return e.venue_maps_url;
  const q = [e.venue_name, e.venue_address].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

/** Só links http(s) vindos da base de dados (logótipo, política de privacidade). */
export function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

export const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** Chave do dia no fuso do evento (para agrupar o programa por dia). */
export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** Nome do fuso horário, ex.: "hora da Europa Ocidental" / "Western European Time". */
export function timeZoneName(iso: string, timeZone: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'long' }).formatToParts(new Date(iso));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** true quando o fuso do dispositivo dá horas diferentes das do evento nessa data. */
export function differentTimeZone(iso: string, eventTz: string, deviceTz?: string): boolean {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit' };
  try {
    const a = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: eventTz }).format(new Date(iso));
    const b = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: deviceTz }).format(new Date(iso));
    return a !== b;
  } catch {
    return false;
  }
}

export interface EventTimes {
  /** "Quinta-feira, 7 de janeiro de 2027" */
  date: string;
  /** "Quinta-feira" */
  weekday: string;
  /** "7 de janeiro de 2027" */
  day: string;
  start: string;
  /** Só quando termina no mesmo dia. */
  end: string | null;
}

/** Data por extenso e horas de início e, se terminar no mesmo dia, de fim (no fuso do evento). */
export function eventTimes(e: Pick<GuestView['event'], 'starts_at' | 'ends_at' | 'timezone'>, locale: string): EventTimes {
  const tz = e.timezone;
  const sameDay = !!e.ends_at && dayKey(e.ends_at, tz) === dayKey(e.starts_at, tz);
  return {
    date: capitalize(formatLongDate(e.starts_at, tz, locale)),
    weekday: capitalize(new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long' }).format(new Date(e.starts_at))),
    day: formatDate(e.starts_at, tz, locale),
    start: formatTime(e.starts_at, tz, locale),
    end: sameDay ? formatTime(e.ends_at, tz, locale) : null,
  };
}

/** O evento já terminou (ou, sem hora de fim, começou há mais de 12 horas). */
export function eventIsPast(e: Pick<GuestView['event'], 'starts_at' | 'ends_at'>, now = Date.now()): boolean {
  const end = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 12 * 3_600_000;
  return now > end;
}

// ───────── Formulário de resposta ─────────

export type AnswerValue = string | boolean;
export type FormErrors = Record<string, string>;

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
