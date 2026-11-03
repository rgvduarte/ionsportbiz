import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalStatus, InvitationStatus, RsvpField } from '../../lib/api/types';
import { ApiError } from '../../lib/api/errors';
// Só no teste: garante que a credencial e a porta mostram o código da mesma forma.
import { formatCode } from '../../admin/checkin/code';
import { groupCode } from './invite';
import {
  calendarUid, canRespond, cleanAnswers, consentToSend, dayKey, entryPath, eventDays, eventIsPast, initialAnswers, mapsUrl,
  rsvpErrorCode, rsvpFields, safeUrl, validateRsvp,
} from './rsvp';

const TOKEN = 'AbCdEfGhIjKlMnOpQr_-12';

type V = Parameters<typeof canRespond>[0];
const view = (status: InvitationStatus, approval_status: ApprovalStatus, extra: { open?: boolean; code?: string; checkedIn?: string } = {}): V => ({
  invitation: { status, approval_status, checkin_code: extra.code ?? null, checked_in_at: extra.checkedIn ?? null },
  event: { rsvp_open: extra.open ?? true },
});

describe('canRespond e entryPath', () => {
  it('pode responder com o prazo aberto, sem entrada registada e sem recusa da equipa', () => {
    expect(canRespond(view('opened', 'pending'))).toBe(true);
    expect(canRespond(view('accepted', 'approved', { code: 'X' }))).toBe(true);
    expect(canRespond(view('declined', 'rejected'))).toBe(true);
    expect(canRespond(view('opened', 'pending', { open: false }))).toBe(false);
    expect(canRespond(view('accepted', 'approved', { code: 'X', checkedIn: '2027-03-22T19:00:00Z' }))).toBe(false);
    expect(canRespond(view('accepted', 'rejected'))).toBe(false);
    expect(canRespond(view('opened', 'rejected'))).toBe(false);
  });

  it('o link pessoal abre a resposta enquanto faltar responder, senão o início', () => {
    expect(entryPath(view('sent', 'pending'))).toBe('/convite');
    expect(entryPath(view('opened', 'approved'))).toBe('/convite');
    // Prazo fechado sem resposta: abre o convite na mesma (mostra que as respostas fecharam).
    expect(entryPath(view('opened', 'pending', { open: false }))).toBe('/convite');
    expect(entryPath(view('declined', 'pending'))).toBe('/convite');
    expect(entryPath(view('declined', 'pending', { open: false }))).toBe('/');
    expect(entryPath(view('accepted', 'pending'))).toBe('/');
    expect(entryPath(view('accepted', 'approved', { code: 'X' }))).toBe('/');
    expect(entryPath(view('opened', 'rejected'))).toBe('/');
  });
});

describe('eventDays', () => {
  const two = { starts_at: '2027-03-22T19:00:00Z', ends_at: '2027-03-23T18:00:00Z', timezone: 'Europe/Lisbon' };

  it('mostra os dois dias de um evento de dois dias, com a hora de início e o ano no fim', () => {
    expect(eventDays(two, 'pt-PT')).toEqual(['Segunda-feira, 22 de março · 19:00', 'Terça-feira, 23 de março de 2027']);
    const en = eventDays(two, 'en-GB');
    expect(en).toHaveLength(2);
    expect(en[0]).toMatch(/^Monday,? 22 March · 19:00$/);
    expect(en[1]).toMatch(/^Tuesday,? 23 March 2027$/);
  });

  it('um só dia: data com ano e horas de início e fim', () => {
    expect(eventDays({ starts_at: '2027-01-07T18:00:00Z', ends_at: '2027-01-07T23:00:00Z', timezone: 'Europe/Lisbon' }, 'pt-PT'))
      .toEqual(['Quinta-feira, 7 de janeiro de 2027 · 18:00 – 23:00']);
    expect(eventDays({ starts_at: '2027-01-07T18:00:00Z', ends_at: null, timezone: 'Atlantic/Azores' }, 'pt-PT'))
      .toEqual(['Quinta-feira, 7 de janeiro de 2027 · 17:00']);
  });

  it('usa o fuso do evento e encurta eventos longos', () => {
    expect(dayKey('2027-07-07T23:30:00Z', 'Europe/Lisbon')).toBe('2027-07-08');
    const long = eventDays({ starts_at: '2027-03-01T09:00:00Z', ends_at: '2027-03-10T18:00:00Z', timezone: 'Europe/Lisbon' }, 'pt-PT');
    expect(long).toEqual(['Segunda-feira, 1 de março · 09:00', 'Quarta-feira, 10 de março de 2027']);
  });
});

describe('eventIsPast', () => {
  const e = { starts_at: '2027-01-07T18:00:00Z', ends_at: '2027-01-07T23:00:00Z' };
  it('depois do fim, ou 12 horas depois do início', () => {
    const at = (iso: string) => new Date(iso).getTime();
    expect(eventIsPast(e, at('2027-01-07T22:00:00Z'))).toBe(false);
    expect(eventIsPast(e, at('2027-01-07T23:00:01Z'))).toBe(true);
    expect(eventIsPast({ ...e, ends_at: null }, at('2027-01-08T05:59:00Z'))).toBe(false);
    expect(eventIsPast({ ...e, ends_at: null }, at('2027-01-08T06:01:00Z'))).toBe(true);
  });
});

describe('mapsUrl e safeUrl', () => {
  it('prefere o link do evento e só aceita http(s)', () => {
    expect(mapsUrl({ venue_maps_url: 'https://maps.app/x', venue_name: 'A', venue_address: 'B' })).toBe('https://maps.app/x');
    expect(mapsUrl({ venue_maps_url: 'javascript:alert(1)', venue_name: 'Palácio', venue_address: 'Rua 1, Lisboa' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=Pal%C3%A1cio%2C%20Rua%201%2C%20Lisboa');
    expect(mapsUrl({ venue_maps_url: null, venue_name: null, venue_address: null })).toBeNull();
    expect(safeUrl('https://exemplo.pt/privacidade')).toBe('https://exemplo.pt/privacidade');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe('calendarUid', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('é estável, distinto por convite e não contém o token', async () => {
    const uid = await calendarUid(TOKEN);
    expect(uid).toMatch(/^convite-[0-9a-f]{16}@convites$/);
    expect(await calendarUid(TOKEN)).toBe(uid);
    expect(await calendarUid(TOKEN.replace('A', 'B'))).not.toBe(uid);
    expect(uid.toLowerCase()).not.toContain(TOKEN.toLowerCase().slice(0, 8));
  });

  it('sem crypto.subtle (página sem HTTPS) continua a funcionar', async () => {
    vi.stubGlobal('crypto', {});
    const uid = await calendarUid(TOKEN);
    expect(uid).toMatch(/^convite-[0-9a-f]{16}@convites$/);
    expect(await calendarUid(TOKEN)).toBe(uid);
  });
});

describe('código de entrada', () => {
  it('coincide com o formato do ecrã de check-in', () => {
    for (const code of ['V54BGGQFFT', '7KQ2M9XAPH', 'abcde-fghjk', 'AB CD EF GH JK']) {
      expect(groupCode(code)).toBe(formatCode(code));
    }
  });
});

describe('formulário de resposta', () => {
  const fields: RsvpField[] = [
    { key: 'dieta', label: 'Restrições alimentares', type: 'text' },
    { key: 'mesa', label: 'Mesa', type: 'select', options: ['A', 'B'], required: true },
    { key: 'estacionamento', label: 'Estacionamento', type: 'checkbox' },
    { key: 'termos', label: 'Li as regras', type: 'checkbox', required: true },
    { key: 'obs', label: 'Observações', type: 'textarea' },
  ];

  it('lê as perguntas do evento, mesmo com dados antigos', () => {
    expect(rsvpFields({ rsvp_fields: fields })).toBe(fields);
    expect(rsvpFields({ rsvp_fields: null as unknown as RsvpField[] })).toEqual([]);
  });

  it('preenche a partir de respostas anteriores', () => {
    expect(initialAnswers(fields, { dieta: 'Vegetariana', estacionamento: true, mesa: 3 })).toEqual({
      dieta: 'Vegetariana', mesa: '3', estacionamento: true, termos: false, obs: '',
    });
  });

  it('limpa as respostas antes de enviar', () => {
    expect(cleanAnswers(fields, { dieta: '  Sem glúten ', mesa: 'C', estacionamento: false, termos: true, obs: '   ' })).toEqual({
      dieta: 'Sem glúten', estacionamento: false, termos: true,
    });
  });

  it('valida obrigatórios e acompanhantes', () => {
    const msgs = { required: 'req', requiredCheck: 'check', companion: 'comp' };
    expect(validateRsvp(fields, { mesa: ' ', termos: false }, ['Paulo Reis', '  '], msgs)).toEqual({
      mesa: 'req', termos: 'check', 'companion-1': 'comp',
    });
    expect(validateRsvp(fields, { mesa: 'A', termos: true }, [], msgs)).toEqual({});
  });

  it('consentimento: só se envia quando o convidado marca a caixa (nunca o retira)', () => {
    expect(consentToSend(true, false, false)).toBeNull();
    expect(consentToSend(true, false, true)).toBe(true);
    expect(consentToSend(true, true, false)).toBeNull();
    expect(consentToSend(true, true, true)).toBeNull();
    expect(consentToSend(false, false, true)).toBeNull();
  });

  it('erros com mensagem própria e os restantes como genéricos', () => {
    expect(rsvpErrorCode(new ApiError('capacity_full'))).toBe('capacity_full');
    expect(rsvpErrorCode(new ApiError('rsvp_closed'))).toBe('rsvp_closed');
    expect(rsvpErrorCode(new ApiError('forbidden'))).toBe('unknown');
    expect(rsvpErrorCode(new TypeError('Failed to fetch'))).toBe('network');
    expect(rsvpErrorCode(null)).toBe('unknown');
  });
});
