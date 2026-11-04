import { describe, expect, it } from 'vitest';
import type { PassType } from '../../lib/api/types';
import {
  accessSuggestions, cleanAccesses, moveItem, nextSort, quotaLeft, quotaNeeded, quotaShortMessage, quotaUsed, splitAccesses,
  SUGGESTED_PASS_TYPES, toPassTypeForm, toPassTypeInput, unusedColor, validatePassType,
} from './passTypes';

const VIP: PassType = {
  id: 'p1', event_id: 'e1', name: 'VIP Pass', description: 'Tudo incluído.',
  accesses: ['VIP Gala Dinner', 'ion Conference'], color: '#ccff00', sort: 0, capacity: null, created_at: '',
};

describe('formulário de tipo de acesso', () => {
  it('valores de um tipo existente e de um novo', () => {
    expect(toPassTypeForm(VIP)).toEqual({ name: 'VIP Pass', description: 'Tudo incluído.', accesses: ['VIP Gala Dinner', 'ion Conference'], color: '#ccff00', sort: '0', capacity: '' });
    const fresh = toPassTypeForm(null, [VIP]);
    expect(fresh.sort).toBe('1');
    expect(fresh.color).not.toBe('#ccff00');
    expect(nextSort([])).toBe(0);
    expect(unusedColor([])).toBe('#ccff00');
  });

  it('valida nome (único no evento), cor e ordem', () => {
    const v = toPassTypeForm(null);
    expect(validatePassType({ ...v, name: '' }, []).name).toBeTruthy();
    expect(validatePassType({ ...v, name: ' vip pass ' }, [VIP]).name).toMatch(/Já existe/);
    expect(validatePassType({ ...v, name: 'Conference Pass' }, [VIP])).toEqual({});
    expect(validatePassType({ ...v, name: 'X', color: '#12' }, []).color).toBeTruthy();
    expect(validatePassType({ ...v, name: 'X', color: '' }, []).color).toBeUndefined();
    expect(validatePassType({ ...v, name: 'X', sort: '1.5' }, []).sort).toBeTruthy();
    expect(validatePassType({ ...v, name: 'X', accesses: ['a'.repeat(121)] }, []).accesses).toBeTruthy();
  });

  it('converte para gravar: limpa acessos, cor em minúsculas, vazios a null', () => {
    const input = toPassTypeInput({ name: ' VIP ', description: ' ', accesses: [' Gala ', '', 'gala', 'Conferência'], color: '#CCFF00', sort: '2', capacity: ' ' }, 'e1', 'p1');
    expect(input).toEqual({ id: 'p1', event_id: 'e1', name: 'VIP', description: null, accesses: ['Gala', 'Conferência'], color: '#ccff00', sort: 2, capacity: null });
    expect(toPassTypeInput({ ...toPassTypeForm(VIP), capacity: '80' }, 'e1').capacity).toBe(80);
    expect(toPassTypeInput({ ...toPassTypeForm(VIP), color: '' }, 'e1')).not.toHaveProperty('id');
    expect(toPassTypeInput({ ...toPassTypeForm(VIP), color: '' }, 'e1').color).toBeNull();
  });
});

describe('acessos', () => {
  it('limpa, separa texto colado e sugere os que faltam', () => {
    expect(cleanAccesses(['  ion   Conference ', 'ION conference', 'Cerimónia', 'cerimonia'])).toEqual(['ion Conference', 'Cerimónia']);
    expect(splitAccesses('VIP Gala Dinner\nion Conference; VIP Lunch\n\n')).toEqual(['VIP Gala Dinner', 'ion Conference', 'VIP Lunch']);
    const s = accessSuggestions([VIP], ['ion Conference']);
    expect(s[0]).toBe('VIP Gala Dinner');
    expect(s).not.toContain('ion Conference');
    expect(s).toContain('VIP Lunch');
  });

  it('muda a ordem sem sair dos limites', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const same = ['a'];
    expect(moveItem(same, 0, -1)).toBe(same);
  });

  it('sugestões do ion são válidas', () => {
    for (const s of SUGGESTED_PASS_TYPES) {
      expect(validatePassType({ ...toPassTypeForm(null), name: s.name, color: s.color ?? '', accesses: s.accesses }, [])).toEqual({});
    }
    expect(SUGGESTED_PASS_TYPES.map((s) => s.name)).toEqual(['VIP Pass', 'Conference Pass']);
  });
});

describe('quota por tipo de acesso', () => {
  const row = (status: string, approval: string, pass: string | null) =>
    ({ status, approval_status: approval, pass_type_id: pass }) as Parameters<typeof quotaUsed>[0][number];
  const rows = [
    row('accepted', 'approved', 'p1'), // conta
    row('sent', 'approved', 'p1'), // pré-aprovado: conta
    row('declined', 'approved', 'p1'), // recusou: não conta
    row('cancelled', 'approved', 'p1'), // cancelado: não conta
    row('accepted', 'pending', null),
    row('accepted', 'approved', 'p2'),
  ];

  it('conta aprovados ativos, pré-aprovados incluídos', () => {
    expect(quotaUsed(rows, 'p1')).toBe(2);
    expect(quotaLeft({ id: 'p1', capacity: 3 }, rows)).toBe(1);
    expect(quotaLeft({ id: 'p1', capacity: null }, rows)).toBeNull();
    expect(quotaLeft({ id: 'p1', capacity: 1 }, rows)).toBe(-1);
  });

  it('só contam os que mudam para este tipo', () => {
    expect(quotaNeeded(rows, 'p1')).toBe(2); // o pendente e o do p2; os do p1 e os recusados/cancelados não
    expect(quotaNeeded(rows, 'p2')).toBe(3);
  });

  it('valida a quota no formulário', () => {
    const v = { ...toPassTypeForm(null), name: 'X' };
    expect(validatePassType({ ...v, capacity: '' }, []).capacity).toBeUndefined();
    expect(validatePassType({ ...v, capacity: '0' }, []).capacity).toBeTruthy();
    expect(validatePassType({ ...v, capacity: '2.5' }, []).capacity).toBeTruthy();
    expect(validatePassType({ ...v, capacity: '80' }, []).capacity).toBeUndefined();
  });

  it('mensagem quando não chega', () => {
    expect(quotaShortMessage({ name: 'VIP Pass', capacity: 80 }, 0, 3)).toBe('VIP Pass tem quota de 80: não há lugares livres e precisa de 3.');
    expect(quotaShortMessage({ name: 'VIP Pass', capacity: 80 }, 1, 2)).toBe('VIP Pass tem quota de 80: resta 1 lugar e precisa de 2.');
  });
});
