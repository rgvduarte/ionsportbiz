// Formatação em português de Portugal. As datas dos eventos mostram-se no fuso do evento.

const LOCALE = 'pt-PT';
const DEFAULT_TZ = 'Europe/Lisbon';

function fmt(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions, timeZone = DEFAULT_TZ, locale = LOCALE): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(d);
}

/** 15 de outubro de 2027 */
export const formatDate = (iso: string | null | undefined, tz?: string, locale?: string) =>
  fmt(iso, { day: 'numeric', month: 'long', year: 'numeric' }, tz, locale);

/** quinta-feira, 15 de outubro de 2027 */
export const formatLongDate = (iso: string | null | undefined, tz?: string, locale?: string) =>
  fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, tz, locale);

/** 15/10/2027 */
export const formatShortDate = (iso: string | null | undefined, tz?: string) => fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }, tz);

/** 19:30 */
export const formatTime = (iso: string | null | undefined, tz?: string, locale?: string) =>
  fmt(iso, { hour: '2-digit', minute: '2-digit', hour12: false }, tz, locale);

/** 15/10/2027, 19:30 */
export const formatDateTime = (iso: string | null | undefined, tz?: string) =>
  fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }, tz);

/** "há 3 dias", "daqui a 2 meses" */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 864e5], ['month', 30 * 864e5], ['week', 7 * 864e5], ['day', 864e5], ['hour', 36e5], ['minute', 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'agora mesmo';
}

/** Valor para <input type="datetime-local"> no fuso do evento. */
export function toLocalInput(iso: string | null | undefined, timeZone = DEFAULT_TZ): string {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Converte o valor de <input type="datetime-local"> (hora do fuso do evento) para ISO em UTC. */
export function fromLocalInput(value: string, timeZone = DEFAULT_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Diferença entre a hora pretendida e a mesma hora lida no fuso: duas iterações resolvem a mudança de hora.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const local = toLocalInput(new Date(ts).toISOString(), timeZone);
    const [, ly, lmo, ld, lh, lmi] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)!.map(Number);
    ts += guess - Date.UTC(ly, lmo - 1, ld, lh, lmi);
  }
  return new Date(ts).toISOString();
}

export function fullName(p: { first_name: string; last_name?: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ');
}

/** "Exmo. Senhor Pedro Costa" */
export function formalName(p: { salutation?: string | null; first_name: string; last_name?: string | null }): string {
  return [p.salutation, fullName(p)].filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

export function formatPercent(part: number, total: number): string {
  if (!total) return '0%';
  return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 }).format(part / total);
}
