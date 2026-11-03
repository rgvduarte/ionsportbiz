import type { Session } from '../data/types';
import { EVENT, stageById } from '../data/event';

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export function sessionToIcs(s: Session): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ion//event app//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${s.id}@ionsportsbiz.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.start)}`,
    `DTEND:${stamp(s.end)}`,
    `SUMMARY:${esc(`ion — ${s.title}`)}`,
    `DESCRIPTION:${esc(s.description)}`,
    `LOCATION:${esc(`${stageById(s.stageId).name}, ${EVENT.location}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(s: Session) {
  const blob = new Blob([sessionToIcs(s)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ion-${s.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
