import { beforeEach, describe, expect, it } from 'vitest';
import { checkin, likeToRegExp, normalizeCode, tokenFromCode } from './checkin';
import { getDb, resetDemo } from './store';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const PAST = '00000000-0000-4000-8000-0000000000e2';
const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};
const accepted = (eventId = MAIN) => getDb().invitations.find((i) => i.event_id === eventId && i.status === 'accepted' && !i.checked_in_at)!;

beforeEach(() => {
  resetDemo();
  as('porta@demo.pt');
});

describe('normalização do código (como checkin_lookup)', () => {
  it('maiúsculas, só letras e algarismos', () => {
    expect(normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
    expect(normalizeCode('AB CD\tEF')).toBe('ABCDEF');
    expect(normalizeCode(null)).toBe('');
  });

  it('extrai o token do fim de um link pessoal', () => {
    const t = 'Ab3_-'.repeat(4) + 'xy';
    expect(tokenFromCode(`https://convites.exemplo.pt/c/${t}`)).toBe(t);
    expect(tokenFromCode(`convites://c/${t}/`)).toBe(t);
    expect(tokenFromCode('ABCDEFGHJK')).toBeNull();
    expect(tokenFromCode(`https://x.pt/c/${t}?utm=1`)).toBeNull();
  });

  it('LIKE: % e _ são curingas, o resto é literal', () => {
    expect(likeToRegExp('%a.b%').test('xxa.byy')).toBe(true);
    expect(likeToRegExp('%a.b%').test('xxaXbyy')).toBe(false);
    expect(likeToRegExp('%a_b%').test('aXb')).toBe(true);
    expect(likeToRegExp('%(%').test('x(y')).toBe(true);
  });
});

describe('demo checkin', () => {
  it('lookup pelo código (com espaços/hífenes/minúsculas) ou pelo link; sem email nem telefone', async () => {
    const inv = accepted();
    const code = inv.checkin_code.toLowerCase();
    const r = await checkin.lookup(MAIN, `${code.slice(0, 5)} - ${code.slice(5)}`);
    expect(r?.invitation_id).toBe(inv.id);
    expect(r).not.toHaveProperty('email');
    expect(r).not.toHaveProperty('phone');
    expect(r?.event_name).toBe('ion Portugal 2027');
    expect((await checkin.lookup(MAIN, `https://convites.exemplo.pt/c/${inv.token}`))?.invitation_id).toBe(inv.id);
    expect(await checkin.lookup(PAST, inv.checkin_code)).toBeNull();
    expect(await checkin.lookup(MAIN, 'ZZZZZZZZZZ')).toBeNull();
  });

  it('pesquisa: mínimo 2 caracteres, confirmados primeiro, máximo 25', async () => {
    expect(await checkin.search(MAIN, ' a ')).toEqual([]);
    const all = await checkin.search(MAIN, 'a');
    expect(all).toEqual([]);
    const rows = await checkin.search(MAIN, 'ra');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(25);
    const ord = (s: string) => (s === 'accepted' ? 0 : s === 'cancelled' ? 2 : 1);
    const ords = rows.map((r) => ord(r.status));
    expect(ords).toEqual([...ords].sort((a, b) => a - b));
    const inv = accepted();
    const c = getDb().contacts.find((x) => x.id === inv.contact_id)!;
    expect((await checkin.search(MAIN, c.organization!.toUpperCase())).some((r) => r.invitation_id === inv.id)).toBe(true);
  });

  it('encontra pelo nome do acompanhante', async () => {
    const d = getDb();
    const m = d.companions.find((x) => d.invitations.find((i) => i.id === x.invitation_id)?.event_id === MAIN)!;
    const rows = await checkin.search(MAIN, m.full_name.slice(0, 5));
    expect(rows.some((r) => r.invitation_id === m.invitation_id)).toBe(true);
  });

  it('dá entrada (idempotente) com acompanhantes e regista na linha do tempo', async () => {
    const d = getDb();
    const m = d.companions.find((x) => d.invitations.find((i) => i.id === x.invitation_id)?.event_id === MAIN)!;
    const inv = d.invitations.find((i) => i.id === m.invitation_id)!;
    const r1 = await checkin.checkIn(inv.id, []);
    expect(r1.checked_in_at).not.toBeNull();
    expect(r1.companions[0].checked_in_at).toBeNull();
    const first = r1.checked_in_at;
    const r2 = await checkin.checkIn(inv.id, [m.id]);
    expect(r2.checked_in_at).toBe(first);
    expect(r2.companions[0].checked_in_at).not.toBeNull();
    const logs = d.activities.filter((a) => a.invitation_id === inv.id && a.kind === 'checkin');
    expect(logs).toHaveLength(1);
    expect(logs[0].detail).toEqual({ status: 'accepted', approval_status: 'approved', forced: false });
    expect(inv.checked_in_by).toBe(d.staff.find((s) => s.email === 'porta@demo.pt')!.user_id);
  });

  it('recusa quem não confirmou, salvo com force', async () => {
    const inv = getDb().invitations.find((i) => i.event_id === MAIN && i.status === 'sent')!;
    await expect(checkin.checkIn(inv.id, [])).rejects.toMatchObject({ code: 'not_accepted' });
    const r = await checkin.checkIn(inv.id, [], true);
    expect(r.checked_in_at).not.toBeNull();
    expect(r.status).toBe('sent');
    expect(getDb().activities.at(-1)).toMatchObject({ kind: 'checkin', detail: { status: 'sent', forced: true } });
  });

  it('anular: só admin/editor; limpa convidado e acompanhantes', async () => {
    const d = getDb();
    const m = d.companions.find((x) => d.invitations.find((i) => i.id === x.invitation_id)?.event_id === MAIN)!;
    await checkin.checkIn(m.invitation_id, [m.id]);
    await expect(checkin.undo(m.invitation_id)).rejects.toMatchObject({ code: 'forbidden' });
    as('editor@demo.pt');
    const r = await checkin.undo(m.invitation_id);
    expect(r.checked_in_at).toBeNull();
    expect(r.companions.every((c) => c.checked_in_at === null)).toBe(true);
    expect(d.activities.at(-1)?.kind).toBe('checkin.undone');
  });

  it('permissões: leitura não faz check-in; convite inexistente dá not_found', async () => {
    as('leitura@demo.pt');
    await expect(checkin.lookup(MAIN, 'X')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(checkin.search(MAIN, 'ana')).rejects.toMatchObject({ code: 'forbidden' });
    as('admin@demo.pt');
    await expect(checkin.checkIn('nada', [])).rejects.toMatchObject({ code: 'not_found' });
  });

  it('devolve cópias (alterar o resultado não mexe na base de dados)', async () => {
    const inv = accepted();
    const r = await checkin.lookup(MAIN, inv.checkin_code);
    r!.first_name = 'X';
    expect(getDb().contacts.find((c) => c.id === inv.contact_id)!.first_name).not.toBe('X');
  });
});
