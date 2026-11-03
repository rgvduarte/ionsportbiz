import { beforeEach, describe, expect, it } from 'vitest';
import { events } from './events';
import { getDb, resetDemo } from './store';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const PAST = '00000000-0000-4000-8000-0000000000e2';
const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};

beforeEach(() => {
  resetDemo();
  as('admin@demo.pt');
});

describe('demo events.stats', () => {
  it('ignora cancelados e conta acompanhantes como na função SQL', async () => {
    const d = getDb();
    const s = await events.stats(MAIN);
    const inv = d.invitations.filter((i) => i.event_id === MAIN && i.status !== 'cancelled');
    expect(s.invited).toBe(inv.length);
    expect(s.invited).toBe(46); // 47 no plano, 1 cancelado
    expect(Object.values(s.by_status).reduce((a, b) => a + b, 0)).toBe(s.invited);
    expect(s.delivered).toBe(s.invited - s.by_status.draft);
    expect(s.responded).toBe(s.by_status.accepted + s.by_status.declined);
    const accepted = inv.filter((i) => i.status === 'accepted');
    const companions = d.companions.filter((m) => accepted.some((i) => i.id === m.invitation_id)).length;
    expect(s.expected_attendees).toBe(accepted.length + companions);
    expect(s.capacity).toBe(650);
    expect(s.checked_in).toBe(0);
  });

  it('agrupa por vaga e por segmento, ordenado, com "" para vazio', async () => {
    const s = await events.stats(MAIN);
    expect(s.by_wave.map((w) => w.wave)).toEqual(['1.ª vaga', '2.ª vaga', 'Convidados de honra']);
    expect(s.by_wave.reduce((n, w) => n + w.invited, 0)).toBe(s.invited);
    expect(s.by_segment.reduce((n, w) => n + w.accepted, 0)).toBe(s.by_status.accepted);
    const segments = s.by_segment.map((x) => x.segment);
    expect(segments).toEqual([...segments].sort((a, b) => a.localeCompare(b, 'pt')));

    const d = getDb();
    d.invitations.find((i) => i.event_id === MAIN && i.status === 'accepted')!.wave = null;
    const s2 = await events.stats(MAIN);
    expect(s2.by_wave[0].wave).toBe('');
    expect(s2.by_wave[0].invited).toBe(1);
  });

  it('conta entradas de convidados e acompanhantes', async () => {
    const s = await events.stats(PAST);
    const d = getDb();
    const ids = new Set(d.invitations.filter((i) => i.event_id === PAST).map((i) => i.id));
    const expected = d.invitations.filter((i) => ids.has(i.id) && i.checked_in_at).length
      + d.companions.filter((m) => ids.has(m.invitation_id) && m.checked_in_at).length;
    expect(s.checked_in).toBe(expected);
    expect(s.checked_in).toBeGreaterThan(0);
  });

  it('devolve zeros para um evento sem convites', async () => {
    const created = await events.create({ ...(await events.get(MAIN)), slug: 'vazio', name: 'Vazio', capacity: null });
    const s = await events.stats(created.id);
    expect(s).toEqual({
      invited: 0, by_status: { draft: 0, sent: 0, opened: 0, accepted: 0, declined: 0 }, delivered: 0, opened: 0,
      responded: 0, expected_attendees: 0, checked_in: 0, capacity: null,
      approval: { pending: 0, approved: 0, rejected: 0 }, by_pass_type: [], by_wave: [], by_segment: [],
    });
  });
});

describe('demo events: permissões e regras', () => {
  it('a receção lê eventos mas não escreve', async () => {
    as('porta@demo.pt');
    expect((await events.list()).length).toBe(2);
    await expect(events.stats(MAIN)).resolves.toBeTruthy();
    await expect(events.update(MAIN, { name: 'X' })).rejects.toMatchObject({ code: 'forbidden' });
    as('leitura@demo.pt');
    await expect(events.saveSession({ event_id: MAIN, title: 'X', starts_at: new Date().toISOString(), ends_at: null, description: null, location: null, speakers: null }))
      .rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lista por data de início, mais recente primeiro', async () => {
    const list = await events.list();
    expect(list.map((e) => e.id)).toEqual([MAIN, PAST]);
  });

  it('valida o endereço curto e recusa repetidos', async () => {
    const base = await events.get(MAIN);
    await expect(events.create({ ...base })).rejects.toMatchObject({ code: 'duplicate' });
    await expect(events.update(MAIN, { slug: 'Com Espaços' })).rejects.toMatchObject({ code: 'validation' });
    await expect(events.update(MAIN, { ends_at: '2000-01-01T00:00:00.000Z' })).rejects.toMatchObject({ code: 'validation' });
    const updated = await events.update(MAIN, { name: 'Encontro Anual' });
    expect(updated.name).toBe('Encontro Anual');
    updated.name = 'mutado fora';
    expect((await events.get(MAIN)).name).toBe('Encontro Anual');
  });

  it('eliminar um evento apaga em cascata', async () => {
    await events.remove(MAIN);
    const d = getDb();
    expect(d.events.some((e) => e.id === MAIN)).toBe(false);
    expect(d.invitations.some((i) => i.event_id === MAIN)).toBe(false);
    expect(d.sessions.some((s) => s.event_id === MAIN)).toBe(false);
    expect(d.templates.some((t) => t.event_id === MAIN)).toBe(false);
    expect(d.activities.some((a) => a.event_id === MAIN)).toBe(false);
    const ids = new Set(d.invitations.map((i) => i.id));
    expect(d.companions.every((m) => ids.has(m.invitation_id))).toBe(true);
    expect(d.invitations.some((i) => i.event_id === PAST)).toBe(true);
    await expect(events.get(MAIN)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('sessões: cria, ordena, edita e apaga', async () => {
    const before = await events.sessions(MAIN);
    expect(before.length).toBe(7);
    const start = new Date(new Date(before[0].starts_at).getTime() - 3_600_000).toISOString();
    const created = await events.saveSession({ event_id: MAIN, title: 'Credenciação', starts_at: start, ends_at: null, description: null, location: 'Átrio', speakers: null });
    const after = await events.sessions(MAIN);
    expect(after[0].id).toBe(created.id);
    const edited = await events.saveSession({ ...created, title: 'Credenciação e boas-vindas' });
    expect(edited.title).toBe('Credenciação e boas-vindas');
    await expect(events.saveSession({ ...created, ends_at: '2000-01-01T00:00:00.000Z' })).rejects.toMatchObject({ code: 'validation' });
    await events.removeSession(created.id);
    expect((await events.sessions(MAIN)).length).toBe(7);
    await expect(events.removeSession(created.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
