import { beforeEach, describe, expect, it } from 'vitest';
import { invitations } from './invitations';
import { templates } from './templates';
import { getDb, resetDemo } from './store';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const EMAIL_TEMPLATE = '00000000-0000-4000-8000-0000000007a1';
const WHATSAPP_TEMPLATE = '00000000-0000-4000-8000-0000000007a2';
const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};
const kindsOf = (invitationId: string) => getDb().activities.filter((a) => a.invitation_id === invitationId).map((a) => a.kind);

beforeEach(() => {
  resetDemo();
  as('admin@demo.pt');
});

describe('demo invitations.list / get', () => {
  it('junta os dados do contacto e ordena por apelido e nome', async () => {
    const rows = await invitations.list(MAIN);
    expect(rows).toHaveLength(getDb().invitations.filter((i) => i.event_id === MAIN).length);
    const names = rows.map((r) => `${r.last_name} ${r.first_name}`);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-PT', { sensitivity: 'base' })));
    expect(rows[0]).toHaveProperty('email');
    expect(rows[0]).toHaveProperty('companions_count');
  });

  it('filtra por estado, vaga e pesquisa', async () => {
    const accepted = await invitations.list(MAIN, { status: 'accepted' });
    expect(accepted.every((r) => r.status === 'accepted')).toBe(true);
    const wave = await invitations.list(MAIN, { wave: 'Convidados de honra' });
    expect(wave).toHaveLength(12);
    const any = (await invitations.list(MAIN))[3];
    const found = await invitations.list(MAIN, { search: any.organization!.toUpperCase() });
    expect(found.some((r) => r.id === any.id)).toBe(true);
  });

  it('a leitura exige acesso ao CRM', async () => {
    as('porta@demo.pt');
    await expect(invitations.list(MAIN)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('get devolve os acompanhantes', async () => {
    const d = getDb();
    const withCompanion = d.companions[0];
    const row = await invitations.get(withCompanion.invitation_id);
    expect(row.companions.map((m) => m.id)).toContain(withCompanion.id);
    expect(row.companions_count).toBe(row.companions.length);
  });
});

describe('demo invitations.create', () => {
  it('ignora quem já está convidado e usa os acompanhantes por omissão do evento', async () => {
    const d = getDb();
    const invited = new Set(d.invitations.filter((i) => i.event_id === MAIN).map((i) => i.contact_id));
    const fresh = d.contacts.filter((c) => !invited.has(c.id)).slice(0, 2).map((c) => c.id);
    const already = [...invited][0];
    const n = await invitations.create(MAIN, [...fresh, already, fresh[0]], { wave: '  3.ª vaga ' });
    expect(n).toBe(2);
    const created = getDb().invitations.filter((i) => i.event_id === MAIN && fresh.includes(i.contact_id));
    expect(created).toHaveLength(2);
    for (const inv of created) {
      expect(inv.status).toBe('draft');
      expect(inv.wave).toBe('3.ª vaga');
      expect(inv.plus_ones_allowed).toBe(1);
      expect(inv.token).toHaveLength(22);
      expect(inv.checkin_code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
      expect(kindsOf(inv.id)).toEqual(['invitation.created']);
    }
  });

  it('só quem edita pode convidar', async () => {
    as('leitura@demo.pt');
    await expect(invitations.create(MAIN, [getDb().contacts[60].id])).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('demo invitations.markSent', () => {
  it('imita mark_sent: rascunho passa a enviado, reenvio fica registado, cancelado não muda', async () => {
    const d = getDb();
    const draft = d.invitations.find((i) => i.event_id === MAIN && i.status === 'draft')!;
    const opened = d.invitations.find((i) => i.event_id === MAIN && i.status === 'opened')!;
    const cancelled = d.invitations.find((i) => i.event_id === MAIN && i.status === 'cancelled')!;
    const cancelledSentAt = cancelled.sent_at;

    const n = await invitations.markSent([draft.id, opened.id, cancelled.id], 'manual');
    expect(n).toBe(2);
    const after = getDb();
    const draftNow = after.invitations.find((i) => i.id === draft.id)!;
    const openedNow = after.invitations.find((i) => i.id === opened.id)!;
    const cancelledNow = after.invitations.find((i) => i.id === cancelled.id)!;
    expect(draftNow.status).toBe('sent');
    expect(draftNow.sent_channel).toBe('manual');
    expect(openedNow.status).toBe('opened');
    expect(openedNow.sent_channel).toBe('manual');
    expect(cancelledNow.status).toBe('cancelled');
    expect(cancelledNow.sent_at).toBe(cancelledSentAt);

    const sentLog = after.activities.filter((a) => a.invitation_id === draft.id).at(-1)!;
    expect(sentLog).toMatchObject({ kind: 'invitation.sent', channel: 'manual' });
    expect(kindsOf(opened.id).at(-1)).toBe('invitation.resent');
    expect(kindsOf(cancelled.id)).not.toContain('invitation.resent');
  });
});

describe('demo invitations.sendEmail', () => {
  it('envia a quem tem email, falha quem não tem e regista os envios', async () => {
    const d = getDb();
    const drafts = d.invitations.filter((i) => i.event_id === MAIN && i.status === 'draft');
    const noEmail = drafts[0];
    d.contacts.find((c) => c.id === noEmail.contact_id)!.email = null;

    const result = await invitations.sendEmail(drafts.map((i) => i.id), EMAIL_TEMPLATE);
    expect(result).toEqual({ sent: drafts.length - 1, failed: 1 });
    const after = getDb();
    expect(after.invitations.find((i) => i.id === noEmail.id)!.status).toBe('draft');
    expect(after.invitations.find((i) => i.id === drafts[1].id)!).toMatchObject({ status: 'sent', sent_channel: 'email' });
    expect(after.deliveries.filter((x) => x.status === 'sent')).toHaveLength(drafts.length - 1);
    expect(after.deliveries.find((x) => x.invitation_id === noEmail.id)?.status).toBe('failed');
  });

  it('recusa modelos que não são de email e eventos por publicar', async () => {
    const id = getDb().invitations.find((i) => i.event_id === MAIN)!.id;
    await expect(invitations.sendEmail([id], WHATSAPP_TEMPLATE)).rejects.toMatchObject({ code: 'validation' });
    getDb().events.find((e) => e.id === MAIN)!.status = 'draft';
    await expect(invitations.sendEmail([id], EMAIL_TEMPLATE)).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('demo invitations.update / remove', () => {
  it('regista a resposta, a mudança de estado e valida os acompanhantes', async () => {
    const inv = getDb().invitations.find((i) => i.event_id === MAIN && i.status === 'sent')!;
    await invitations.update(inv.id, { status: 'accepted', answers: { dieta: 'Vegetariana' }, guest_note: '  Por telefone ' });
    const now = getDb().invitations.find((i) => i.id === inv.id)!;
    expect(now.status).toBe('accepted');
    expect(now.responded_at).not.toBeNull();
    expect(now.guest_note).toBe('Por telefone');
    expect(kindsOf(inv.id).at(-1)).toBe('invitation.accepted');
    await expect(invitations.update(inv.id, { plus_ones_allowed: 11 })).rejects.toMatchObject({ code: 'validation' });
    await invitations.update(inv.id, { wave: '' });
    expect(getDb().invitations.find((i) => i.id === inv.id)!.wave).toBeNull();
  });

  it('reativar um cancelado regista "reaberto"', async () => {
    const inv = getDb().invitations.find((i) => i.event_id === MAIN && i.status === 'cancelled')!;
    await invitations.update(inv.id, { status: 'draft' });
    expect(kindsOf(inv.id).at(-1)).toBe('invitation.reopened');
  });

  it('remover apaga em cascata', async () => {
    const d = getDb();
    const withCompanion = d.companions[0].invitation_id;
    await invitations.remove(withCompanion);
    const after = getDb();
    expect(after.invitations.some((i) => i.id === withCompanion)).toBe(false);
    expect(after.companions.some((m) => m.invitation_id === withCompanion)).toBe(false);
    expect(after.activities.some((a) => a.invitation_id === withCompanion)).toBe(false);
    await expect(invitations.remove(withCompanion)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('demo invitations.waves / activities', () => {
  it('lista as vagas distintas, ordenadas', async () => {
    expect(await invitations.waves(MAIN)).toEqual(['1.ª vaga', '2.ª vaga', 'Convidados de honra']);
  });

  it('devolve a atividade do evento, da mais recente para a mais antiga', async () => {
    const rows = await invitations.activities(MAIN, 10);
    expect(rows).toHaveLength(10);
    expect(rows.every((a) => a.event_id === MAIN)).toBe(true);
    const times = rows.map((a) => a.created_at);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe('demo templates', () => {
  it('lista por canal (ordem do enum) e nome', async () => {
    const rows = await templates.list(MAIN);
    expect(rows.map((t) => `${t.channel}:${t.name}`)).toEqual(['email:Convite formal', 'email:Lembrete', 'whatsapp:Convite WhatsApp']);
  });

  it('grava, atualiza e elimina; o assunto só fica no email', async () => {
    const created = await templates.save({ event_id: MAIN, channel: 'whatsapp', name: ' Lembrete ', subject: 'ignorado', body: 'Olá {{nome}}' });
    expect(created.name).toBe('Lembrete');
    expect(created.subject).toBeNull();
    const updated = await templates.save({ ...created, body: 'Bom dia {{nome}}' });
    expect(updated.id).toBe(created.id);
    expect(updated.body).toBe('Bom dia {{nome}}');
    await templates.remove(created.id);
    expect((await templates.list(MAIN)).some((t) => t.id === created.id)).toBe(false);
    await expect(templates.save({ event_id: MAIN, channel: 'email', name: '', subject: null, body: 'x' })).rejects.toMatchObject({ code: 'validation' });
  });

  it('quem só consulta não altera modelos', async () => {
    as('leitura@demo.pt');
    await expect(templates.list(MAIN)).resolves.toHaveLength(3);
    await expect(templates.remove(EMAIL_TEMPLATE)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
