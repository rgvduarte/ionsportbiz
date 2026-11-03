import { describe, expect, it } from 'vitest';
import type { CheckinRecord } from '../../lib/api';
import { capitalize, cleanCode, createDedupe, foreignRecentKeys, formatCode, isLookupInput, recentKey, verdict } from './code';

const base: CheckinRecord = {
  invitation_id: 'i', event_id: 'e', event_name: 'E', salutation: null, first_name: 'Ana', last_name: 'Costa',
  organization: null, status: 'accepted', wave: null, plus_ones_allowed: 1, checked_in_at: null, companions: [],
};

describe('código de check-in', () => {
  it('limpa e formata', () => {
    expect(cleanCode(' abcde - fghjk ')).toBe('ABCDEFGHJK');
    expect(formatCode('abcdefghjk')).toBe('ABCDE-FGHJK');
    expect(formatCode('abc')).toBe('ABC');
  });

  it('reconhece código de 10 caracteres ou link pessoal', () => {
    expect(isLookupInput('ABCDE FGHJK')).toBe(true);
    expect(isLookupInput('abcde-fghjk')).toBe(true);
    expect(isLookupInput('ABCDEFGHJ')).toBe(false);
    expect(isLookupInput(`https://convites.exemplo.pt/c/${'a'.repeat(22)}`)).toBe(true);
    expect(isLookupInput('https://convites.exemplo.pt/c/curto')).toBe(false);
  });
});

describe('verdict', () => {
  it('pronto, já entrou (com acompanhantes em falta) ou bloqueado', () => {
    expect(verdict(base)).toEqual({ kind: 'ready' });
    expect(verdict({
      ...base, checked_in_at: '2027-01-01T19:00:00Z',
      companions: [{ id: 'a', full_name: 'X', checked_in_at: null }, { id: 'b', full_name: 'Y', checked_in_at: '2027-01-01T19:00:00Z' }],
    })).toEqual({ kind: 'already', at: '2027-01-01T19:00:00Z', pending: 1 });
    expect(verdict({ ...base, status: 'opened' })).toEqual({ kind: 'blocked', status: 'opened', severe: false });
    expect(verdict({ ...base, status: 'declined' })).toMatchObject({ severe: true });
    // Entrada forçada: conta como já registada, mesmo sem confirmação.
    expect(verdict({ ...base, status: 'sent', checked_in_at: '2027-01-01T19:00:00Z' }).kind).toBe('already');
  });
});

describe('createDedupe', () => {
  it('ignora o mesmo valor durante 3 s após a última leitura', () => {
    const accept = createDedupe(3000);
    expect(accept('A', 0)).toBe(true);
    expect(accept('A', 1000)).toBe(false);
    expect(accept('A', 3500)).toBe(false); // continua a ser lido: a janela renova-se
    expect(accept('B', 3600)).toBe(true);
    expect(accept('A', 3700)).toBe(true);
    expect(accept('A', 7000)).toBe(true);
  });
});

describe('apresentação', () => {
  it('põe a primeira letra em maiúscula', () => {
    expect(capitalize('segunda-feira, 4 de janeiro de 2027')).toBe('Segunda-feira, 4 de janeiro de 2027');
    expect(capitalize('édito')).toBe('Édito');
    expect(capitalize('')).toBe('');
  });
});

describe('últimas entradas', () => {
  it('separa as chaves por utilizador', () => {
    const mine = recentKey('u1', 'e1');
    const keys = [mine, recentKey('u1', 'e2'), recentKey('u2', 'e1'), 'convites.checkin.recent.e1', 'outra.chave', recentKey('u10', 'e1')];
    expect(foreignRecentKeys(keys, 'u1')).toEqual([recentKey('u2', 'e1'), 'convites.checkin.recent.e1', recentKey('u10', 'e1')]);
    expect(foreignRecentKeys([], 'u1')).toEqual([]);
  });
});
