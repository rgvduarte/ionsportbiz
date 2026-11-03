import { EVENT } from '../data/event';

// All event times are shown in the venue's time zone, whatever the device's.
const tz = EVENT.timeZone;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

export const fmtDay = (iso: string, locale: string) =>
  cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date(iso)));

export const fmtShortDay = (iso: string, locale: string) =>
  cap(new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(iso)));

export const fmtDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(new Date(iso));

export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
