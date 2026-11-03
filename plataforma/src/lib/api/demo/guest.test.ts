import { beforeEach, describe, expect, it } from 'vitest';
import { guest } from './guest';
import { getDb, resetDemo } from './store';
import type { GuestResponse, InvitationStatus } from '../types';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const PAST = '00000000-0000-4000-8000-0000000000e2';

const inv = (eventId: string, status: InvitationStatus) =>
  getDb().invitations.find((i) => i.event_id === eventId && i.status === status)!;

const accept = (extra: Partial<GuestResponse> = {}): GuestResponse => ({
  accept: true, answers: {}, companions: [], note: null, marketingConsent: null, ...extra,
});

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);

beforeEach(() => {
  resetDemo();
  // O convidado não tem sessão.
  getDb().currentUserId = null;
});

describe('demo guest.view', () => {
  it('devolve null para tokens inválidos, convites cancelados e eventos indisponíveis', async () => {
    expect(await guest.view('curto')).toBeNull();
    expect(await guest.view('x'.repeat(22))).toBeNull();
    expect(await guest.view(inv(MAIN, 'cancelled').token)).toBeNull();
    const t = inv(MAIN, 'sent').token;
    getDb().events.find((e) => e.id === MAIN)!.status = 'draft';
    expect(await guest.view(t)).toBeNull();
    getDb().events.find((e) => e.id === MAIN)!.status = 'archived';
    expect(await guest.view(t)).toBeNull();
  });

  it('regista a abertura e passa de enviado a aberto, sem ator', async () => {
    const i = inv(MAIN, 'sent');
    const before = getDb().activities.length;
    const v = await guest.view(i.token);
    expect(v?.invitation.status).toBe('opened');
    expect(i.status).toBe('opened');
    expect(i.open_count).toBe(1);
    expect(i.first_opened_at).not.toBeNull();
    expect(i.last_opened_at).toBe(i.first_opened_at);
    const log = getDb().activities.slice(before);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'invitation.opened', actor_id: null, invitation_id: i.id });

    await guest.view(i.token);
    expect(i.open_count).toBe(2);
    expect(getDb().activities.length).toBe(before + 1);
  });

  it('pré-visualização não regista nada', async () => {
    const i = inv(MAIN, 'draft');
    const v = await guest.view(i.token, { track: false });
    expect(v?.invitation.status).toBe('draft');
    expect(i.status).toBe('draft');
    expect(i.open_count).toBe(0);
    expect(i.first_opened_at).toBeNull();
  });

  it('não muda o estado de quem já respondeu', async () => {
    const i = inv(MAIN, 'accepted');
    await guest.view(i.token);
    expect(i.status).toBe('accepted');
  });

  it('payload sem dados internos; código só depois de confirmar', async () => {
    const opened = await guest.view(inv(MAIN, 'opened').token);
    expect(opened!.invitation.checkin_code).toBeNull();
    const acc = inv(MAIN, 'accepted');
    const v = await guest.view(acc.token);
    expect(v!.invitation.checkin_code).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    expect(Object.keys(v!.contact).sort()).toEqual(['first_name', 'language', 'last_name', 'marketing_consent', 'salutation']);
    expect(v!.event).not.toHaveProperty('id');
    expect(v!.event).not.toHaveProperty('capacity');
    expect(v!.event.rsvp_open).toBe(true);
    expect(v!.sessions.map((s) => s.starts_at)).toEqual([...v!.sessions.map((s) => s.starts_at)].sort());
    expect(v!.sessions[0]).not.toHaveProperty('event_id');
    const json = JSON.stringify(v);
    const c = getDb().contacts.find((x) => x.id === acc.contact_id)!;
    expect(json).not.toContain(c.email!);
    if (c.phone) expect(json).not.toContain(c.phone);
    expect(json).not.toContain('"notes"');
    expect(json).not.toContain('"tags"');
  });

  it('evento fechado continua visível, mas sem respostas', async () => {
    const v = await guest.view(inv(PAST, 'accepted').token);
    expect(v!.event.status).toBe('closed');
    expect(v!.event.rsvp_open).toBe(false);
    expect(v!.invitation.checkin_code).not.toBeNull();
  });

  it('prazo ultrapassado fecha as respostas', async () => {
    const t = inv(MAIN, 'opened').token;
    getDb().events.find((e) => e.id === MAIN)!.rsvp_deadline = new Date(Date.now() - 60_000).toISOString();
    expect((await guest.view(t))!.event.rsvp_open).toBe(false);
  });

  it('devolve cópias: mexer no resultado não altera a base de dados', async () => {
    const i = inv(MAIN, 'accepted');
    const v = await guest.view(i.token);
    v!.invitation.answers.hack = true;
    expect(i.answers).not.toHaveProperty('hack');
  });
});

describe('demo guest.respond', () => {
  it('aceita com acompanhantes, respostas e mensagem', async () => {
    const i = inv(MAIN, 'opened');
    const before = getDb().activities.length;
    const v = await guest.respond(i.token, accept({
      answers: { dieta: 'Vegetariana' }, companions: [{ full_name: '  Paulo Reis ' }], note: '  Chego um pouco mais tarde. ',
    }));
    expect(v.invitation.status).toBe('accepted');
    expect(v.invitation.checkin_code).toBe(i.checkin_code);
    expect(v.invitation.companions).toEqual([{ full_name: 'Paulo Reis' }]);
    expect(v.invitation.answers).toEqual({ dieta: 'Vegetariana' });
    expect(v.invitation.guest_note).toBe('Chego um pouco mais tarde.');
    expect(i.responded_at).not.toBeNull();
    const log = getDb().activities.slice(before);
    expect(log.map((a) => a.kind)).toEqual(['invitation.accepted']);
    expect(log[0].actor_id).toBeNull();
  });

  it('substitui os acompanhantes ao alterar a resposta', async () => {
    const i = inv(MAIN, 'opened');
    await guest.respond(i.token, accept({ companions: [{ full_name: 'Paulo Reis' }] }));
    await guest.respond(i.token, accept({ companions: [{ full_name: 'Sara Cunha' }] }));
    expect(getDb().companions.filter((m) => m.invitation_id === i.id).map((m) => m.full_name)).toEqual(['Sara Cunha']);
  });

  it('recusar apaga acompanhantes e respostas, mas guarda a mensagem', async () => {
    const i = inv(MAIN, 'opened');
    await guest.respond(i.token, accept({ answers: { dieta: 'x' }, companions: [{ full_name: 'Paulo Reis' }] }));
    const v = await guest.respond(i.token, { accept: false, answers: { dieta: 'x' }, companions: [{ full_name: 'Paulo Reis' }], note: 'Lamento.', marketingConsent: null });
    expect(v.invitation.status).toBe('declined');
    expect(v.invitation.companions).toEqual([]);
    expect(v.invitation.answers).toEqual({});
    expect(v.invitation.checkin_code).toBeNull();
    expect(v.invitation.guest_note).toBe('Lamento.');
  });

  it('valida como a função SQL', async () => {
    const i = inv(MAIN, 'opened');
    expect(await code(guest.respond('curto', accept()))).toBe('not_found');
    expect(await code(guest.respond(inv(MAIN, 'cancelled').token, accept()))).toBe('not_found');
    expect(await code(guest.respond(i.token, accept({ answers: [] as unknown as Record<string, unknown> })))).toBe('invalid_answers');
    expect(await code(guest.respond(i.token, accept({ answers: { big: 'x'.repeat(9000) } })))).toBe('invalid_answers');
    expect(await code(guest.respond(i.token, accept({ note: 'x'.repeat(1001) })))).toBe('invalid_note');
    expect(await code(guest.respond(i.token, accept({ note: 'ç'.repeat(1000) })))).toBe('ok');
    expect(await code(guest.respond(i.token, accept({ companions: null as unknown as [] })))).toBe('invalid_companions');
    expect(await code(guest.respond(i.token, accept({ companions: [{ full_name: 'A' }, { full_name: 'B' }] })))).toBe('too_many_companions');
    expect(await code(guest.respond(i.token, accept({ companions: [{ full_name: '   ' }] })))).toBe('invalid_companions');
    expect(await code(guest.respond(i.token, accept({ companions: [{} as { full_name: string }] })))).toBe('invalid_companions');
    // Ao recusar, os acompanhantes são ignorados antes de contar.
    expect(await code(guest.respond(i.token, { ...accept({ companions: [{ full_name: 'A' }, { full_name: 'B' }] }), accept: false }))).toBe('ok');
  });

  it('respostas fechadas: evento fechado ou prazo ultrapassado', async () => {
    expect(await code(guest.respond(inv(PAST, 'opened').token, accept()))).toBe('rsvp_closed');
    const t = inv(MAIN, 'opened').token;
    getDb().events.find((e) => e.id === MAIN)!.rsvp_deadline = new Date(Date.now() - 1000).toISOString();
    expect(await code(guest.respond(t, accept()))).toBe('rsvp_closed');
    getDb().events.find((e) => e.id === MAIN)!.status = 'draft';
    expect(await code(guest.respond(t, accept()))).toBe('not_found');
  });

  it('não deixa alterar depois da entrada', async () => {
    const i = inv(MAIN, 'accepted');
    i.checked_in_at = new Date().toISOString();
    expect(await code(guest.respond(i.token, accept()))).toBe('already_checked_in');
  });

  it('lotação: conta confirmados e acompanhantes, sem contar o próprio convite', async () => {
    const d = getDb();
    const event = d.events.find((e) => e.id === MAIN)!;
    const others = d.invitations.filter((i) => i.event_id === MAIN && i.status === 'accepted');
    const taken = others.reduce((n, i) => n + 1 + d.companions.filter((m) => m.invitation_id === i.id).length, 0);
    const i = inv(MAIN, 'opened');
    event.capacity = taken + 1;
    expect(await code(guest.respond(i.token, accept({ companions: [{ full_name: 'Paulo Reis' }] })))).toBe('capacity_full');
    expect(await code(guest.respond(i.token, accept()))).toBe('ok');
    // Já confirmado: alterar a resposta não conta o próprio lugar duas vezes.
    expect(await code(guest.respond(i.token, accept()))).toBe('ok');
    // Recusar nunca esbarra na lotação.
    event.capacity = 1;
    expect(await code(guest.respond(inv(MAIN, 'sent').token, { ...accept(), accept: false }))).toBe('ok');
  });

  it('consentimento: só muda quando indicado, com registo', async () => {
    const d = getDb();
    const i = inv(MAIN, 'opened');
    const c = d.contacts.find((x) => x.id === i.contact_id)!;
    c.marketing_consent = false;
    c.marketing_consent_at = null;
    c.marketing_consent_text = null;

    await guest.respond(i.token, accept());
    expect(c.marketing_consent).toBe(false);

    let before = d.activities.length;
    const v = await guest.respond(i.token, accept({ marketingConsent: true }));
    expect(v.contact.marketing_consent).toBe(true);
    expect(c.marketing_consent_at).not.toBeNull();
    expect(c.marketing_consent_text).toBe(d.events.find((e) => e.id === MAIN)!.marketing_consent_text);
    expect(d.activities.slice(before)).toMatchObject([{ kind: 'consent.granted', channel: 'link', actor_id: null }]);

    before = d.activities.length;
    await guest.respond(i.token, accept({ marketingConsent: true }));
    expect(d.activities.length).toBe(before);

    await guest.respond(i.token, accept({ marketingConsent: false }));
    expect(c.marketing_consent).toBe(false);
    expect(c.marketing_consent_at).toBeNull();
    expect(c.marketing_consent_text).toBeNull();
    expect(d.activities.at(-1)).toMatchObject({ kind: 'consent.revoked', channel: 'link', actor_id: null });
  });
});

describe('demo guest.requestErasure', () => {
  it('regista o pedido sem ator', async () => {
    const i = inv(MAIN, 'accepted');
    await guest.requestErasure(i.token);
    expect(getDb().activities.at(-1)).toMatchObject({
      kind: 'privacy.erasure_requested', invitation_id: i.id, contact_id: i.contact_id, channel: 'link', actor_id: null,
    });
  });

  it('funciona mesmo com o convite cancelado; token desconhecido dá not_found', async () => {
    expect(await code(guest.requestErasure(inv(MAIN, 'cancelled').token))).toBe('ok');
    expect(await code(guest.requestErasure('y'.repeat(22)))).toBe('not_found');
    expect(await code(guest.requestErasure('curto'))).toBe('not_found');
  });
});
