// Ficheiros de calendário (iCalendar, RFC 5545) e link para o Google Calendar.
// Gerados no browser a partir dos dados do convite: não passam pelo servidor.

import { isNative } from '../native/platform';

export interface CalendarEvent {
  /** Identificador estável: o mesmo convite gera sempre o mesmo UID (reimportar atualiza, não duplica). */
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  start: string | Date;
  /** Sem fim indicado: duas horas depois do início. */
  end?: string | Date | null;
  organizerName?: string | null;
  /** O ORGANIZER exige um endereço; sem email o organizador não é incluído. */
  organizerEmail?: string | null;
  /** Momento de criação (DTSTAMP). Por omissão, agora. */
  now?: Date;
}

const CRLF = '\r\n';
const DEFAULT_DURATION_MS = 2 * 3_600_000;
const MAX_OCTETS = 75;

function toDate(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Data inválida: ${String(value)}`);
  return d;
}

/** 2027-01-07T18:00:00.000Z → 20270107T180000Z */
export function icsDate(value: string | Date): string {
  return toDate(value).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

/** Valores TEXT: escapa \ ; , e mudanças de linha (RFC 5545, 3.3.11). Remove outros caracteres de controlo. */
export function escapeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Valor de parâmetro (ex.: CN): entre aspas, sem aspas nem caracteres de controlo lá dentro. */
function paramValue(text: string): string {
  return `"${text.replace(/["\u0000-\u001f\u007f]/g, '').trim()}"`;
}

const encoder = new TextEncoder();
const octets = (s: string) => encoder.encode(s).length;

/**
 * Dobra uma linha em linhas de 75 octetos no máximo (RFC 5545, 3.1).
 * Nunca corta a meio de um carácter UTF-8 nem a meio de uma sequência de escape (\n, \, …).
 */
export function foldLine(line: string): string {
  if (octets(line) <= MAX_OCTETS) return line;
  // Unidades indivisíveis: pontos de código, com "\x" agrupado.
  const units = line.match(/\\.|[\s\S]/gu) ?? [];
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const unit of units) {
    const n = octets(unit);
    // A primeira linha tem 75 octetos; as seguintes começam por um espaço, que também conta.
    const limit = out.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (size + n > limit && current) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += unit;
    size += n;
  }
  out.push(current);
  return out.join(`${CRLF} `);
}

/** Conteúdo de um ficheiro .ics com um único evento. */
export function buildIcs(event: CalendarEvent): string {
  const start = toDate(event.start);
  let end = event.end ? toDate(event.end) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  if (end.getTime() < start.getTime()) end = new Date(start.getTime() + DEFAULT_DURATION_MS);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plataforma de Convites//Convite//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${icsDate(event.now ?? new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  // URL é do tipo URI: não leva escapes de TEXT, mas não pode ter espaços nem quebras.
  if (event.url) lines.push(`URL:${event.url.replace(/\s+/g, '')}`);
  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${paramValue(event.organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail.trim()}`);
  }
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Nome de ficheiro seguro a partir do nome do evento: "Encontro Anual 2027" → "encontro-anual-2027.ics". */
export function icsFilename(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'evento'}.ics`;
}

const ICS_TYPE = 'text/calendar;charset=utf-8';

/**
 * true quando é possível entregar um .ics. No browser, sempre (descarrega o ficheiro).
 * Na app nativa a WebView não descarrega ficheiros: só com a partilha do sistema (Web Share com ficheiros).
 */
export function canDownloadIcs(): boolean {
  if (!isNative) return true;
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'evento.ics', { type: ICS_TYPE })] });
  } catch {
    return false;
  }
}

/**
 * Entrega o ficheiro ao utilizador. No browser descarrega-o (o sistema propõe abrir no calendário);
 * na app nativa abre a partilha do sistema, onde o utilizador escolhe o calendário.
 */
export async function downloadIcs(filename: string, content: string): Promise<void> {
  const type = ICS_TYPE;
  if (isNative) {
    try {
      await navigator.share({ files: [new File([content], filename, { type })], title: filename });
    } catch (err) {
      // Cancelar a partilha não é um erro.
      if ((err as { name?: string })?.name !== 'AbortError') throw err;
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Link "adicionar ao Google Calendar" (abre o formulário de novo evento já preenchido).
 * Não aceita URL: tudo o que vai neste link fica no histórico do browser e nos servidores da Google,
 * por isso nunca deve levar o link pessoal do convite (que dá acesso ao código de entrada).
 */
export function googleCalendarUrl(event: Pick<CalendarEvent, 'title' | 'description' | 'location' | 'start' | 'end'> & { timezone?: string }): string {
  const start = toDate(event.start);
  let end = event.end ? toDate(event.end) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  if (end.getTime() < start.getTime()) end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${icsDate(start)}/${icsDate(end)}` });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  if (event.timezone) params.set('ctz', event.timezone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
