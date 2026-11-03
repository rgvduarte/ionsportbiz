import { describe, expect, it } from 'vitest';
import { deadlineLabel, deadlineState, erasureDeadline } from './erasure';

const local = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 30);
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('erasureDeadline', () => {
  it('soma um mês de calendário', () => {
    expect(ymd(erasureDeadline(local(2026, 10, 12)))).toEqual([2026, 11, 12]);
    expect(ymd(erasureDeadline(local(2026, 12, 15)))).toEqual([2027, 1, 15]);
  });

  it('usa o último dia do mês seguinte quando o dia não existe', () => {
    expect(ymd(erasureDeadline(local(2026, 1, 31)))).toEqual([2026, 2, 28]);
    expect(ymd(erasureDeadline(local(2028, 1, 30)))).toEqual([2028, 2, 29]);
    expect(ymd(erasureDeadline(local(2026, 3, 31)))).toEqual([2026, 4, 30]);
  });

  it('aceita datas ISO', () => {
    const iso = local(2026, 5, 20).toISOString();
    expect(ymd(erasureDeadline(iso))).toEqual([2026, 6, 20]);
  });
});

describe('deadlineState', () => {
  const requested = local(2026, 10, 12, 18);

  it('conta dias de calendário até ao fim do prazo', () => {
    expect(deadlineState(requested, local(2026, 10, 13, 9))).toEqual({ kind: 'ok', days: 30 });
    expect(deadlineState(requested, local(2026, 11, 5, 23))).toEqual({ kind: 'soon', days: 7 });
    expect(deadlineState(requested, local(2026, 11, 12, 23))).toEqual({ kind: 'soon', days: 0 });
  });

  it('marca como ultrapassado a partir do dia seguinte ao prazo', () => {
    expect(deadlineState(requested, local(2026, 11, 13, 0))).toEqual({ kind: 'overdue', days: 1 });
    expect(deadlineState(requested, local(2026, 11, 20))).toEqual({ kind: 'overdue', days: 8 });
  });
});

describe('deadlineLabel', () => {
  it('escreve o estado do prazo', () => {
    expect(deadlineLabel({ kind: 'ok', days: 12 })).toBe('Faltam 12 dias');
    expect(deadlineLabel({ kind: 'soon', days: 1 })).toBe('Termina amanhã');
    expect(deadlineLabel({ kind: 'soon', days: 0 })).toBe('Termina hoje');
    expect(deadlineLabel({ kind: 'overdue', days: 1 })).toBe('Ultrapassado há 1 dia');
    expect(deadlineLabel({ kind: 'overdue', days: 3 })).toBe('Ultrapassado há 3 dias');
  });
});
