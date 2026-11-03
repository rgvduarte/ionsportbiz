import { describe, expect, it } from 'vitest';
import type { PassType } from '../../lib/api/types';
import {
  accessSuggestions, cleanAccesses, moveItem, nextSort, splitAccesses, SUGGESTED_PASS_TYPES, toPassTypeForm, toPassTypeInput, unusedColor,
  validatePassType,
} from './passTypes';

const VIP: PassType = {
  id: 'p1', event_id: 'e1', name: 'VIP Pass', description: 'Tudo incluído.',
  accesses: ['VIP Gala Dinner', 'ion Conference'], color: '#ccff00', sort: 0, created_at: '',
};

describe('formulário de tipo de acesso', () => {
  it('valores de um tipo existente e de um novo', () => {
    expect(toPassTypeForm(VIP)).toEqual({ name: 'VIP Pass', description: 'Tudo incluído.', accesses: ['VIP Gala Dinner', 'ion Conference'], color: '#ccff00', sort: '0' });
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
    const input = toPassTypeInput({ name: ' VIP ', description: ' ', accesses: [' Gala ', '', 'gala', 'Conferência'], color: '#CCFF00', sort: '2' }, 'e1', 'p1');
    expect(input).toEqual({ id: 'p1', event_id: 'e1', name: 'VIP', description: null, accesses: ['Gala', 'Conferência'], color: '#ccff00', sort: 2 });
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
