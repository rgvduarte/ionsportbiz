import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accentPalette, calendarUid, cleanAnswers, contrast, dayKey, differentTimeZone, eventIsPast, eventTimes, groupCode, guestPhase,
  initialAnswers, mapsUrl, parseInvitationInput, reservedPass, safeUrl, validateRsvp,
} from './utils';
import { guestStatusKey } from './i18n';
import type { ApprovalStatus, GuestView, InvitationStatus, RsvpField } from '../lib/api/types';
// Só no teste: garante que o bilhete e a porta mostram o código da mesma forma.
import { formatCode } from '../admin/checkin/code';

const TOKEN = 'AbCdEfGhIjKlMnOpQr_-12';

describe('parseInvitationInput', () => {
  it('aceita o token sozinho', () => {
    expect(parseInvitationInput(TOKEN)).toBe(TOKEN);
    expect(parseInvitationInput(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('aceita o link completo em várias formas', () => {
    expect(parseInvitationInput(`https://convites.exemplo.pt/c/${TOKEN}`)).toBe(TOKEN);
    expect(parseInvitationInput(`https://convites.exemplo.pt/eventos/c/${TOKEN}/`)).toBe(TOKEN);
    expect(parseInvitationInput(`convites.exemplo.pt/c/${TOKEN}?preview=1`)).toBe(TOKEN);
    expect(parseInvitationInput(`https://x.pt/c/${TOKEN}#programa`)).toBe(TOKEN);
    expect(parseInvitationInput(`Pode confirmar aqui: https://x.pt/c/${TOKEN} Obrigado`)).toBe(TOKEN);
  });

  it('recusa o resto', () => {
    expect(parseInvitationInput('')).toBeNull();
    expect(parseInvitationInput('olá')).toBeNull();
    expect(parseInvitationInput(`https://x.pt/c/${TOKEN}X`)).toBeNull();
    expect(parseInvitationInput(`https://x.pt/c/${TOKEN.slice(1)}`)).toBeNull();
    expect(parseInvitationInput(`https://x.pt/abc/${TOKEN}`)).toBeNull();
    expect(parseInvitationInput('A'.repeat(21) + '!')).toBeNull();
  });
});

describe('groupCode', () => {
  it('agrupa em blocos de 5 separados por hífen', () => {
    expect(groupCode('V54BGGQFFT')).toBe('V54BG-GQFFT');
    expect(groupCode('v54bg gqfft')).toBe('V54BG-GQFFT');
    expect(groupCode('ABCD')).toBe('ABCD');
    expect(groupCode('')).toBe('');
  });

  it('coincide com o formato do ecrã de check-in', () => {
    for (const code of ['V54BGGQFFT', '7KQ2M9XAPH', 'abcde-fghjk', 'AB CD EF GH JK']) {
      expect(groupCode(code)).toBe(formatCode(code));
    }
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

describe('accentPalette', () => {
  it('usa o verde-lima da ion para valores inválidos', () => {
    expect(accentPalette(undefined).accent).toBe('#ccff00');
    expect(accentPalette('red; background: url(x)').accent).toBe('#ccff00');
    expect(accentPalette('#12345').accent).toBe('#ccff00');
  });

  it('tema escuro: texto do acento legível sobre preto e texto preto sobre o acento claro', () => {
    const p = accentPalette('#ccff00', 'dark');
    expect(p.text).toBe('#ccff00');
    expect(p.on).toBe('#000000');
    const navy = accentPalette('#13294b', 'dark');
    expect(contrast(navy.text, '#0b0b0b')).toBeGreaterThanOrEqual(4.5);
  });

  it('aceita #rgb e #rrggbb e calcula derivados', () => {
    const p = accentPalette('#13294B');
    expect(p.accent).toBe('#13294b');
    expect(p.on).toBe('#ffffff');
    expect(p.text).toBe('#13294b');
    expect(p.soft).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.strong).toMatch(/^#[0-9a-f]{6}$/);
    expect(accentPalette('#fff').accent).toBe('#fff');
  });

  it('acentos claros: texto escuro por cima e versão escurecida para texto', () => {
    const p = accentPalette('#f5c518');
    expect(p.on).toBe('#101828');
    expect(contrast(p.text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
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

describe('fusos horários', () => {
  it('agrupa por dia no fuso do evento', () => {
    expect(dayKey('2027-01-07T23:30:00Z', 'Europe/Lisbon')).toBe('2027-01-07');
    expect(dayKey('2027-07-07T23:30:00Z', 'Europe/Lisbon')).toBe('2027-07-08');
  });

  it('deteta quando o dispositivo mostraria outra hora', () => {
    expect(differentTimeZone('2027-01-07T18:00:00Z', 'Europe/Lisbon', 'Europe/London')).toBe(false);
    expect(differentTimeZone('2027-01-07T18:00:00Z', 'Europe/Lisbon', 'Europe/Madrid')).toBe(true);
    expect(differentTimeZone('2027-01-07T18:00:00Z', 'Atlantic/Azores', 'Europe/Lisbon')).toBe(true);
  });
});

describe('datas do evento', () => {
  const e = { starts_at: '2027-01-07T18:00:00Z', ends_at: '2027-01-07T23:00:00Z', timezone: 'Europe/Lisbon' };

  it('data por extenso com maiúscula e horas no fuso do evento', () => {
    expect(eventTimes(e, 'pt-PT')).toEqual({
      date: 'Quinta-feira, 7 de janeiro de 2027', weekday: 'Quinta-feira', day: '7 de janeiro de 2027', start: '18:00', end: '23:00',
    });
    expect(eventTimes({ ...e, timezone: 'Atlantic/Azores' }, 'pt-PT').start).toBe('17:00');
    expect(eventTimes(e, 'en-GB').date).toMatch(/^Thursday,? 7 January 2027$/);
  });

  it('sem fim no mesmo dia, só a hora de início', () => {
    expect(eventTimes({ ...e, ends_at: '2027-01-08T01:00:00Z' }, 'pt-PT').end).toBeNull();
    expect(eventTimes({ ...e, ends_at: null }, 'pt-PT').end).toBeNull();
  });

  it('evento passado: depois do fim, ou 12 horas depois do início', () => {
    const at = (iso: string) => new Date(iso).getTime();
    expect(eventIsPast(e, at('2027-01-07T22:00:00Z'))).toBe(false);
    expect(eventIsPast(e, at('2027-01-07T23:00:01Z'))).toBe(true);
    expect(eventIsPast({ ...e, ends_at: null }, at('2027-01-08T05:59:00Z'))).toBe(false);
    expect(eventIsPast({ ...e, ends_at: null }, at('2027-01-08T06:01:00Z'))).toBe(true);
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
});

describe('aprovação pela equipa', () => {
  const VIP: NonNullable<GuestView['invitation']['pass_type']> = {
    name: 'VIP Pass', description: null, accesses: ['VIP Gala Dinner', 'ion Conference'], color: '#ccff00',
  };
  const inv = (status: InvitationStatus, approval_status: ApprovalStatus, extra: Partial<GuestView['invitation']> = {}) => ({
    status, approval_status, checkin_code: null, pass_type: null, checked_in_at: null, ...extra,
  });

  it('guestPhase: só há credencial com presença confirmada e aprovada', () => {
    expect(guestPhase(inv('accepted', 'pending'))).toBe('awaiting_approval');
    expect(guestPhase(inv('accepted', 'approved', { checkin_code: 'V54BGGQFFT' }))).toBe('approved');
    // Aprovado sem código (não devia acontecer): continua sem credencial.
    expect(guestPhase(inv('accepted', 'approved'))).toBe('awaiting_approval');
    expect(guestPhase(inv('accepted', 'rejected'))).toBe('rejected');
    expect(guestPhase(inv('opened', 'rejected'))).toBe('rejected');
    expect(guestPhase(inv('sent', 'approved'))).toBe('unanswered');
    expect(guestPhase(inv('opened', 'pending'))).toBe('unanswered');
    // A recusa do convidado prevalece sobre a decisão da equipa.
    expect(guestPhase(inv('declined', 'rejected'))).toBe('declined');
    expect(guestPhase(inv('declined', 'approved'))).toBe('declined');
  });

  it('reservedPass: acesso reservado antes de o convidado confirmar', () => {
    expect(reservedPass(inv('sent', 'approved', { pass_type: VIP }))).toEqual(VIP);
    expect(reservedPass(inv('opened', 'approved'))).toBeNull();
    expect(reservedPass(inv('declined', 'approved', { pass_type: VIP }))).toEqual(VIP);
    expect(reservedPass(inv('accepted', 'approved', { pass_type: VIP }))).toBeUndefined();
    expect(reservedPass(inv('opened', 'pending'))).toBeUndefined();
    expect(reservedPass(inv('opened', 'rejected'))).toBeUndefined();
  });

  it('guestStatusKey: estado na lista "Os meus convites"', () => {
    expect(guestStatusKey(inv('accepted', 'pending'), true)).toBe('awaitingApproval');
    expect(guestStatusKey(inv('accepted', 'approved'), true)).toBe('accepted');
    expect(guestStatusKey(inv('accepted', 'rejected'), true)).toBe('notConfirmed');
    expect(guestStatusKey(inv('opened', 'rejected'), true)).toBe('notConfirmed');
    expect(guestStatusKey(inv('declined', 'rejected'), true)).toBe('declined');
    expect(guestStatusKey(inv('opened', 'approved'), true)).toBe('pending');
    expect(guestStatusKey(inv('opened', 'pending'), false)).toBe('closed');
    expect(guestStatusKey(inv('accepted', 'approved', { checked_in_at: '2027-03-22T19:10:00Z' }), false)).toBe('checkedIn');
    // Sem estado de aprovação (dados antigos): como antes.
    expect(guestStatusKey({ status: 'accepted', checked_in_at: null }, true)).toBe('accepted');
  });
});
