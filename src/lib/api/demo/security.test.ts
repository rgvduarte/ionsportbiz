// Regras de segurança que o modo demonstração tem de imitar (ver supabase/tests/core.test.sql).
import { beforeEach, describe, expect, it } from 'vitest';
import { auth } from './auth';
import { contacts } from './contacts';
import { events } from './events';
import { guest } from './guest';
import { invitations } from './invitations';
import { getDb, resetDemo } from './store';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};
const accepted = () => getDb().invitations.find((i) => i.event_id === MAIN && i.status === 'accepted')!;

beforeEach(() => {
  resetDemo();
  as('admin@demo.pt');
});

describe('link pessoal e código de entrada', () => {
  it('só chegam a quem edita', async () => {
    const inv = accepted();
    as('editor@demo.pt');
    expect((await invitations.get(inv.id)).token).toBe(inv.token);
    expect((await contacts.invitations(inv.contact_id)).find((x) => x.id === inv.id)!.checkin_code).toBe(inv.checkin_code);

    as('leitura@demo.pt');
    const rows = await invitations.list(MAIN);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.token === null && r.checkin_code === null)).toBe(true);
    const one = await invitations.get(inv.id);
    expect([one.token, one.checkin_code]).toEqual([null, null]);
    const mine = await contacts.invitations(inv.contact_id);
    expect(mine.every((x) => x.token === null && x.checkin_code === null)).toBe(true);
    // Os dados guardados não mudam.
    expect(getDb().invitations.find((i) => i.id === inv.id)!.token).toHaveLength(22);
  });
});

describe('apagar dados pessoais (RGPD)', () => {
  it('o link e o código antigos deixam de funcionar', async () => {
    const inv = accepted();
    const { token, checkin_code: code } = inv;
    await contacts.anonymize(inv.contact_id);

    const stored = getDb().invitations.find((i) => i.id === inv.id)!;
    expect(stored.token).not.toBe(token);
    expect(stored.checkin_code).not.toBe(code);
    expect(stored.status).toBe('accepted');

    expect(await guest.view(token)).toBeNull();
    expect(await guest.view(stored.token)).toBeNull();
    await expect(guest.respond(token, { accept: true, answers: {}, companions: [], note: 'x', marketingConsent: true }))
      .rejects.toMatchObject({ code: 'not_found' });
    await expect(guest.respond(stored.token, { accept: false, answers: {}, companions: [], marketingConsent: null }))
      .rejects.toMatchObject({ code: 'not_found' });
    await expect(guest.requestErasure(token)).rejects.toMatchObject({ code: 'not_found' });
    expect(getDb().contacts.find((c) => c.id === inv.contact_id)!.marketing_consent).toBe(false);
  });
});

describe('eventos', () => {
  it('só o administrador elimina', async () => {
    as('editor@demo.pt');
    await expect(events.remove(MAIN)).rejects.toMatchObject({ code: 'forbidden' });
    as('admin@demo.pt');
    await expect(events.remove(MAIN)).resolves.toBeUndefined();
  });

  it('a receção recebe os totais, sem vagas nem segmentos', async () => {
    const full = await events.stats(MAIN);
    expect(full.by_segment.length).toBeGreaterThan(0);
    expect(full.by_wave.length).toBeGreaterThan(0);
    as('porta@demo.pt');
    const door = await events.stats(MAIN);
    expect(door.by_segment).toEqual([]);
    expect(door.by_wave).toEqual([]);
    expect(door.invited).toBe(full.invited);
    expect(door.checked_in).toBe(full.checked_in);
  });
});

describe('entrada no modo demonstração', () => {
  it('um membro desativado entra sem acesso ao back-office', async () => {
    const d = getDb();
    d.staff.find((s) => s.email === 'editor@demo.pt')!.active = false;
    await auth.signIn('editor@demo.pt', 'x');
    const session = await auth.session();
    expect(session?.user.email).toBe('editor@demo.pt');
    expect(session?.staff).toBeNull();
  });

  it('um email fora da equipa entra como administrador', async () => {
    await auth.signIn('visitante@exemplo.pt', 'x');
    expect((await auth.session())?.staff?.role).toBe('admin');
  });
});
