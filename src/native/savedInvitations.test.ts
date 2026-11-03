import { beforeEach, describe, expect, it } from 'vitest';
import { savedInvitations } from './savedInvitations';

// No Node não há localStorage: um substituto simples em memória.
const store = new Map<string, string>();
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, v),
};

const A = 'A'.repeat(22);
const B = 'B'.repeat(21) + '-';

beforeEach(() => store.clear());

describe('savedInvitations', () => {
  it('começa vazio e ignora dados corrompidos', async () => {
    expect(await savedInvitations.list()).toEqual([]);
    store.set('convites.saved.v1', '{nope');
    expect(await savedInvitations.list()).toEqual([]);
    store.set('convites.saved.v1', JSON.stringify([{ token: 'curto', eventName: 'X', startsAt: '2027-01-01' }, 3]));
    expect(await savedInvitations.list()).toEqual([]);
  });

  it('acrescenta, atualiza a cópia local sem duplicar e remove', async () => {
    await savedInvitations.add({ token: A, eventName: 'Encontro', startsAt: '2027-01-04T18:00:00Z', timezone: 'Europe/Lisbon' });
    await savedInvitations.add({ token: B, eventName: 'Conferência', startsAt: '2026-06-16T17:30:00Z' });
    const first = await savedInvitations.list();
    expect(first.map((s) => s.token)).toEqual([A, B]);
    const savedAt = first[0].savedAt;

    await savedInvitations.add({ token: A, eventName: 'Encontro Anual 2027', startsAt: '2027-01-04T18:00:00Z' });
    const second = await savedInvitations.list();
    expect(second).toHaveLength(2);
    expect(second[0]).toMatchObject({ token: A, eventName: 'Encontro Anual 2027', timezone: 'Europe/Lisbon', savedAt });

    await savedInvitations.remove(A);
    expect((await savedInvitations.list()).map((s) => s.token)).toEqual([B]);
  });

  it('não aceita tokens inválidos', async () => {
    await savedInvitations.add({ token: 'abc', eventName: 'X', startsAt: '2027-01-01T00:00:00Z' });
    expect(await savedInvitations.list()).toEqual([]);
  });

  it('adições em paralelo não se perdem', async () => {
    const tokens = Array.from({ length: 6 }, (_, i) => String(i).repeat(22));
    await Promise.all(tokens.map((token, i) => savedInvitations.add({ token, eventName: `E${i}`, startsAt: `2027-01-0${i + 1}T00:00:00Z` })));
    expect((await savedInvitations.list()).map((s) => s.token).sort()).toEqual([...tokens].sort());
  });
});
