import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, googleCalendarUrl, icsDate, icsFilename } from './ics';

const enc = new TextEncoder();
const octets = (s: string) => enc.encode(s).length;
/** Desfaz a dobragem (RFC 5545, 3.1): CRLF seguido de um espaço desaparece. */
const unfold = (s: string) => s.replace(/\r\n /g, '');

const base = {
  uid: 'convite-abc@convites',
  title: 'Encontro Anual 2027',
  start: '2027-01-07T18:00:00.000Z',
  now: new Date('2026-11-03T10:20:30.456Z'),
};

describe('icsDate', () => {
  it('formata em UTC, sem separadores nem milissegundos', () => {
    expect(icsDate('2027-01-07T18:00:00.000Z')).toBe('20270107T180000Z');
    expect(icsDate('2027-07-01T19:30:15+01:00')).toBe('20270701T183015Z');
    expect(icsDate(new Date(Date.UTC(2027, 0, 2, 3, 4, 5)))).toBe('20270102T030405Z');
  });

  it('recusa datas inválidas', () => {
    expect(() => icsDate('amanhã')).toThrow(RangeError);
  });
});

describe('escapeText', () => {
  it('escapa barra, ponto e vírgula, vírgula e mudanças de linha', () => {
    expect(escapeText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
    expect(escapeText('linha 1\nlinha 2\r\nlinha 3\rlinha 4')).toBe('linha 1\\nlinha 2\\nlinha 3\\nlinha 4');
  });

  it('não escapa dois pontos nem aspas e remove caracteres de controlo', () => {
    expect(escapeText('Hora: 18:00 "jantar"')).toBe('Hora: 18:00 "jantar"');
    expect(escapeText('a\u0007b\tc')).toBe('ab\tc');
  });
});

describe('foldLine', () => {
  it('não mexe em linhas até 75 octetos', () => {
    const line = 'X'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('dobra linhas longas com CRLF + espaço e nenhuma excede 75 octetos', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(30)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(octets(p)).toBeLessThanOrEqual(75);
    parts.slice(1).forEach((p) => expect(p.startsWith(' ')).toBe(true));
    expect(unfold(folded)).toBe(line);
  });

  it('conta octetos UTF-8 e nunca corta um carácter a meio', () => {
    const line = `SUMMARY:${'Conceição à noite — ✓ 🎉 '.repeat(12)}`;
    const folded = foldLine(line);
    for (const p of folded.split('\r\n')) {
      expect(octets(p)).toBeLessThanOrEqual(75);
      // Um corte a meio de um par substituto ou de uma sequência UTF-8 daria U+FFFD ao recodificar.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(enc.encode(p))).toBe(p);
      expect(/[\uD800-\uDBFF]$/.test(p)).toBe(false);
    }
    expect(unfold(folded)).toBe(line);
  });

  it('não separa uma sequência de escape', () => {
    // 74 caracteres e depois "\n": o escape tem de passar inteiro para a linha seguinte.
    const line = `${'a'.repeat(74)}\\nb`;
    const [first, second] = foldLine(line).split('\r\n');
    expect(first).toBe('a'.repeat(74));
    expect(second).toBe(' \\nb');
  });
});

describe('buildIcs', () => {
  it('produz um VCALENDAR válido com CRLF e fim de linha final', () => {
    const ics = buildIcs(base);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const lines = ics.trimEnd().split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('END:VEVENT');
    expect(lines).toContain('UID:convite-abc@convites');
    expect(lines).toContain('DTSTAMP:20261103T102030Z');
    expect(lines).toContain('DTSTART:20270107T180000Z');
    expect(lines).toContain('SUMMARY:Encontro Anual 2027');
  });

  it('sem fim: dura duas horas', () => {
    expect(buildIcs(base)).toContain('DTEND:20270107T200000Z');
  });

  it('usa o fim indicado e ignora um fim anterior ao início', () => {
    expect(buildIcs({ ...base, end: '2027-01-07T23:00:00.000Z' })).toContain('DTEND:20270107T230000Z');
    expect(buildIcs({ ...base, end: '2027-01-07T17:00:00.000Z' })).toContain('DTEND:20270107T200000Z');
  });

  it('escapa os campos de texto e omite os vazios', () => {
    const ics = unfold(buildIcs({
      ...base,
      description: 'Relatório anual; prémios, jantar\nTraje: black tie',
      location: 'Palácio da Exemplo, Rua das Janelas Verdes 1, Lisboa',
    }));
    expect(ics).toContain('DESCRIPTION:Relatório anual\\; prémios\\, jantar\\nTraje: black tie\r\n');
    expect(ics).toContain('LOCATION:Palácio da Exemplo\\, Rua das Janelas Verdes 1\\, Lisboa\r\n');
    expect(buildIcs(base)).not.toContain('DESCRIPTION');
    expect(buildIcs(base)).not.toContain('LOCATION');
    expect(buildIcs(base)).not.toContain('URL');
  });

  it('URL sem escapes de texto', () => {
    const ics = unfold(buildIcs({ ...base, url: 'https://convites.exemplo.pt/c/abc,def;ghi' }));
    expect(ics).toContain('URL:https://convites.exemplo.pt/c/abc,def;ghi\r\n');
  });

  it('organizador só com email, nome entre aspas', () => {
    expect(buildIcs({ ...base, organizerName: 'Fundação Exemplo' })).not.toContain('ORGANIZER');
    const ics = unfold(buildIcs({ ...base, organizerName: 'Fundação "Exemplo": Lisboa', organizerEmail: 'eventos@exemplo.pt' }));
    expect(ics).toContain('ORGANIZER;CN="Fundação Exemplo: Lisboa":mailto:eventos@exemplo.pt\r\n');
  });

  it('todas as linhas respeitam os 75 octetos', () => {
    const ics = buildIcs({
      ...base,
      title: 'Cerimónia de entrega dos Prémios Horizonte e jantar de gala da Fundação Exemplo',
      description: 'Ção '.repeat(80),
      location: 'Avenida da Liberdade 100, 1250-000 Lisboa — Auditório Horizonte, piso 2, entrada pela porta lateral',
      url: `https://convites.exemplo.pt/c/${'A'.repeat(22)}?utm_source=calendar&utm_medium=ics&utm_campaign=encontro-anual`,
    });
    for (const line of ics.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
  });
});

describe('icsFilename', () => {
  it('gera um nome simples, sem acentos', () => {
    expect(icsFilename('Encontro Anual 2027')).toBe('encontro-anual-2027.ics');
    expect(icsFilename('Conferência de Primavera — Lisboa')).toBe('conferencia-de-primavera-lisboa.ics');
    expect(icsFilename('***')).toBe('evento.ics');
  });
});

describe('googleCalendarUrl', () => {
  it('preenche título, datas em UTC, local e detalhes', () => {
    const url = new URL(googleCalendarUrl({
      title: 'Encontro Anual 2027',
      start: '2027-01-07T18:00:00.000Z',
      end: '2027-01-07T23:00:00.000Z',
      location: 'Palácio da Exemplo, Lisboa',
      description: 'Jantar',
      timezone: 'Europe/Lisbon',
    }));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Encontro Anual 2027');
    expect(url.searchParams.get('dates')).toBe('20270107T180000Z/20270107T230000Z');
    expect(url.searchParams.get('location')).toBe('Palácio da Exemplo, Lisboa');
    expect(url.searchParams.get('details')).toBe('Jantar');
    expect(url.searchParams.get('ctz')).toBe('Europe/Lisbon');
  });

  it('nunca inclui um URL, mesmo que lhe seja passado', () => {
    const link = 'https://convites.exemplo.pt/c/AbCdEfGhIjKlMnOpQrStUv';
    // O tipo já não aceita `url`; um chamador descuidado (ex.: espalhar o CalendarEvent) não o pode fazer passar.
    const event = { title: 'X', start: '2027-01-07T18:00:00.000Z', description: 'Jantar', url: link };
    const url = googleCalendarUrl(event);
    expect(url).not.toContain(encodeURIComponent(link));
    expect(decodeURIComponent(url)).not.toContain('/c/');
  });

  it('sem fim: duas horas; sem detalhes nem local', () => {
    const url = new URL(googleCalendarUrl({ title: 'X', start: '2027-01-07T18:00:00.000Z' }));
    expect(url.searchParams.get('dates')).toBe('20270107T180000Z/20270107T200000Z');
    expect(url.searchParams.has('details')).toBe(false);
    expect(url.searchParams.has('location')).toBe(false);
  });
});
