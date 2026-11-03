import { describe, expect, it } from 'vitest';
import type { EventStats } from '../../lib/api/types';
import {
  attendeesLine, breakdownLines, breakdownTotal, calendarDaysUntil, channelPhrase, eventPhase, funnel, passTypeLines, showCheckins,
} from './metrics';

const STATS: EventStats = {
  invited: 40,
  by_status: { draft: 4, sent: 8, opened: 6, accepted: 18, declined: 4 },
  delivered: 36,
  opened: 28,
  responded: 22,
  expected_attendees: 25,
  checked_in: 0,
  capacity: 100,
  approval: { pending: 6, approved: 12, rejected: 0 },
  by_pass_type: [
    { pass_type_id: 'conf', name: 'Conference Pass', color: '#e27a2c', sort: 1, approved: 8, attendees: 10 },
    { pass_type_id: 'vip', name: 'VIP Pass', color: '#ccff00', sort: 0, approved: 3, attendees: 5 },
  ],
  by_wave: [],
  by_segment: [],
};

describe('funnel', () => {
  it('calcula cada etapa em relação aos convidados', () => {
    const f = funnel(STATS);
    expect(f.map((s) => s.count)).toEqual([40, 36, 28, 22, 18]);
    expect(f[0].share).toBe(1);
    expect(f[4].share).toBeCloseTo(0.45);
  });

  it('não divide por zero', () => {
    const f = funnel({ ...STATS, invited: 0, delivered: 0, opened: 0, responded: 0, by_status: { draft: 0, sent: 0, opened: 0, accepted: 0, declined: 0 } });
    expect(f.every((s) => s.share === 0)).toBe(true);
  });
});

describe('breakdownLines', () => {
  it('calcula pendentes, percentagem e totais', () => {
    const lines = breakdownLines([
      { name: 'VIP', invited: 10, accepted: 6, declined: 1 },
      { name: '', invited: 5, accepted: 0, declined: 0 },
    ]);
    expect(lines[0].pending).toBe(3);
    expect(lines[0].acceptedShare).toBeCloseTo(0.6);
    expect(lines[1].acceptedShare).toBe(0);
    expect(breakdownTotal(lines)).toEqual({ invited: 15, accepted: 6, declined: 1, pending: 8, acceptedShare: 6 / 15 });
  });
});

describe('datas', () => {
  const tz = 'Europe/Lisbon';
  const event = { starts_at: '2027-01-20T18:00:00.000Z', ends_at: '2027-01-20T23:00:00.000Z', timezone: tz };

  it('conta dias de calendário no fuso do evento', () => {
    expect(calendarDaysUntil(event.starts_at, tz, new Date('2027-01-10T23:30:00.000Z'))).toBe(10);
    expect(calendarDaysUntil(event.starts_at, tz, new Date('2027-01-20T08:00:00.000Z'))).toBe(0);
    expect(calendarDaysUntil(event.starts_at, tz, new Date('2027-01-25T08:00:00.000Z'))).toBe(-5);
    // Nos Açores (UTC−1), 00:30 UTC do dia 21 ainda é dia 20.
    expect(calendarDaysUntil('2027-01-21T00:30:00.000Z', 'Atlantic/Azores', new Date('2027-01-20T12:00:00.000Z'))).toBe(0);
  });

  it('fase do evento', () => {
    expect(eventPhase(event, new Date('2027-01-19T12:00:00.000Z'))).toBe('upcoming');
    expect(eventPhase(event, new Date('2027-01-20T09:00:00.000Z'))).toBe('today');
    expect(eventPhase(event, new Date('2027-01-20T19:00:00.000Z'))).toBe('live');
    expect(eventPhase(event, new Date('2027-01-21T09:00:00.000Z'))).toBe('past');
    expect(eventPhase({ ...event, ends_at: null }, new Date('2027-01-20T21:00:00.000Z'))).toBe('live');
    expect(eventPhase({ ...event, ends_at: null }, new Date('2027-01-22T09:00:00.000Z'))).toBe('past');
    expect(showCheckins(event, new Date('2027-01-19T12:00:00.000Z'))).toBe(false);
    expect(showCheckins(event, new Date('2027-01-20T09:00:00.000Z'))).toBe(true);
  });
});

describe('channelPhrase', () => {
  it('evita "por Manual" e "por Link"', () => {
    expect(channelPhrase('manual')).toBe('por outra via');
    expect(channelPhrase('link')).toBe('no convite pessoal');
    expect(channelPhrase('email')).toBe('por Email');
    expect(channelPhrase('whatsapp')).toBe('por WhatsApp');
  });
});

describe('attendeesLine', () => {
  const stats = (accepted: number, expected: number) => ({ ...STATS, by_status: { ...STATS.by_status, accepted }, expected_attendees: expected });
  it('separa convites confirmados e acompanhantes', () => {
    expect(attendeesLine(stats(18, 25))).toBe('18 confirmados + 7 acompanhantes');
    expect(attendeesLine(stats(1, 2))).toBe('1 confirmado + 1 acompanhante');
  });
  it('omite os acompanhantes quando não há', () => {
    expect(attendeesLine(stats(3, 3))).toBe('3 confirmados');
  });
  it('sem confirmações', () => {
    expect(attendeesLine(stats(0, 0))).toBe('Ainda sem confirmações');
  });
  it('exclui os não aprovados pela equipa, como as pessoas esperadas', () => {
    const s = { ...stats(18, 22), approval: { pending: 0, approved: 16, rejected: 2 } };
    expect(attendeesLine(s)).toBe('16 confirmados + 6 acompanhantes (sem 2 não aprovados)');
    expect(attendeesLine({ ...stats(1, 0), approval: { pending: 0, approved: 0, rejected: 1 } })).toBe('Sem confirmações aprovadas');
  });
});

describe('passTypeLines', () => {
  it('ordena pela ordem da equipa e junta os aprovados sem tipo', () => {
    const lines = passTypeLines(STATS);
    expect(lines.map((l) => [l.name, l.approved, l.attendees])).toEqual([
      ['VIP Pass', 3, 5], ['Conference Pass', 8, 10], ['Sem tipo de acesso', 1, 0],
    ]);
    expect(lines[1].share).toBeCloseTo(8 / 12);
  });

  it('sem aprovados nem tipos', () => {
    expect(passTypeLines({ approval: { pending: 0, approved: 0, rejected: 0 }, by_pass_type: [] })).toEqual([]);
  });
});
