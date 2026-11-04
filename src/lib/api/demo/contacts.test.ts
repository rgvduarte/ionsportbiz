import { beforeEach, describe, expect, it } from 'vitest';
import { contacts } from './contacts';
import { guest } from './guest';
import { getDb, resetDemo } from './store';

const MAIN = '00000000-0000-4000-8000-0000000000e1';
const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};

describe('contactos (modo demonstração)', () => {
  beforeEach(() => {
    resetDemo();
    as('admin@demo.pt');
  });

  it('lista com pesquisa sem acentos, filtros, ordenação e paginação', async () => {
    const all = await contacts.list({ page: 0, pageSize: 1000 });
    expect(all.total).toBe(getDb().contacts.length);
    const names = all.rows.map((c) => c.last_name ?? '');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-PT', { sensitivity: 'base' })));

    const target = all.rows.find((c) => /[çãéíóú]/i.test(c.first_name)) ?? all.rows[0];
    const folded = target.first_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const found = await contacts.list({ search: `${folded} ${target.last_name!.split(' ')[0]}`, page: 0, pageSize: 100 });
    expect(found.rows.map((c) => c.id)).toContain(target.id);

    const page = await contacts.list({ page: 1, pageSize: 10 });
    expect(page.rows).toHaveLength(10);
    expect(page.rows[0].id).toBe(all.rows[10].id);

    const consent = await contacts.list({ consent: true, page: 0, pageSize: 1000 });
    expect(consent.rows.every((c) => c.marketing_consent)).toBe(true);
    const tag = (await contacts.tags())[0];
    const tagged = await contacts.list({ tag, page: 0, pageSize: 1000 });
    expect(tagged.rows.length).toBeGreaterThan(0);
    expect(tagged.rows.every((c) => c.tags.includes(tag))).toBe(true);
  });

  it('cria e edita com normalização e regista na linha do tempo', async () => {
    const c = await contacts.create({
      salutation: ' Dra. ', first_name: ' Ana ', last_name: '', email: ' Ana@Exemplo.PT ', phone: '912 345 678',
      organization: null, job_title: null, segment: ' Clientes ', tags: ['vip', ' vip', ''], language: 'pt', notes: null, source: 'manual',
    });
    expect(c).toMatchObject({ salutation: 'Dra.', first_name: 'Ana', last_name: null, email: 'ana@exemplo.pt', phone: '+351912345678', segment: 'Clientes', tags: ['vip'] });
    const updated = await contacts.update(c.id, { job_title: 'Diretora' });
    expect(updated.job_title).toBe('Diretora');
    const acts = await contacts.activities(c.id);
    expect(acts.map((a) => a.kind)).toEqual(['contact.created']);
    await expect(contacts.create({ ...c, email: 'sem-arroba' })).rejects.toMatchObject({ code: 'validation' });
  });

  it('respeita os papéis', async () => {
    as('leitura@demo.pt');
    await expect(contacts.list({ page: 0, pageSize: 5 })).resolves.toBeTruthy();
    await expect(contacts.addNote(getDb().contacts[0].id, 'x')).rejects.toMatchObject({ code: 'forbidden' });
    as('porta@demo.pt');
    await expect(contacts.list({ page: 0, pageSize: 5 })).rejects.toMatchObject({ code: 'forbidden' });
    as('editor@demo.pt');
    await expect(contacts.anonymize(getDb().contacts[0].id)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('importa: junta por email e depois por telefone, só preenche vazios e cria convites', async () => {
    const existing = getDb().contacts.find((c) => c.email && c.job_title)!;
    const before = getDb().contacts.length;
    const r = await contacts.import([
      { first_name: 'Outro', email: existing.email!.toUpperCase(), job_title: 'Novo cargo', tags: ['importado'] },
      { first_name: 'Nova', last_name: 'Pessoa', phone: '+351911111111' },
      { first_name: 'Nova', phone: '+351 911 111 111', organization: 'Entidade X' },
      { first_name: '' },
    ], { eventId: MAIN, wave: ' 3.ª vaga ' });
    expect(r).toMatchObject({ inserted: 1, updated: 2, errors: [{ row: 4, message: 'Falta o nome' }] });
    expect(getDb().contacts.length).toBe(before + 1);
    const merged = getDb().contacts.find((c) => c.id === existing.id)!;
    expect(merged.first_name).toBe(existing.first_name);
    expect(merged.job_title).toBe(existing.job_title);
    expect(merged.tags).toContain('importado');
    const nova = getDb().contacts.find((c) => c.phone === '+351911111111')!;
    expect(nova.organization).toBe('Entidade X');
    expect(nova.source).toBe('importação');
    const inv = getDb().invitations.find((i) => i.contact_id === nova.id && i.event_id === MAIN)!;
    expect(inv).toMatchObject({ wave: '3.ª vaga', plus_ones_allowed: 1, status: 'draft' });
    expect(inv.token).toHaveLength(22);
    expect(inv.checkin_code).toHaveLength(10);

    // Repetir não cria convites novos.
    const again = await contacts.import([{ first_name: 'Nova', phone: '+351911111111' }], { eventId: MAIN, plusOnes: 0 });
    expect(again).toMatchObject({ inserted: 0, updated: 1, invited: 0 });
  });

  it('importa com pré-aprovação; se a quota não chegar, nada fica importado', async () => {
    const VIP = '00000000-0000-4000-8000-0000000009a1';
    const r = await contacts.import([{ first_name: 'Vera', email: 'vera@exemplo.pt' }], { eventId: MAIN, passTypeId: VIP });
    expect(r.invited).toBe(1);
    const vera = getDb().contacts.find((c) => c.email === 'vera@exemplo.pt')!;
    expect(getDb().invitations.find((i) => i.contact_id === vera.id)).toMatchObject({ approval_status: 'approved', pass_type_id: VIP });

    const pass = getDb().passTypes.find((p) => p.id === VIP)!;
    pass.capacity = getDb().invitations.filter((i) => i.pass_type_id === VIP && i.approval_status === 'approved'
      && i.status !== 'declined' && i.status !== 'cancelled').length;
    const before = getDb().contacts.length;
    await expect(contacts.import([{ first_name: 'Rui', email: 'rui@exemplo.pt' }], { eventId: MAIN, passTypeId: VIP }))
      .rejects.toMatchObject({ code: 'pass_quota' });
    expect(getDb().contacts.length).toBe(before);
    await expect(contacts.import([{ first_name: 'Rui' }], { passTypeId: VIP })).rejects.toMatchObject({ code: 'invalid_pass_type' });
  });

  it('apaga os dados pessoais como a função anonymize_contact', async () => {
    const inv = getDb().invitations.find((i) => i.event_id === MAIN && i.status === 'accepted')!;
    const id = inv.contact_id;
    await contacts.addNote(id, 'Nota interna');
    await contacts.anonymize(id);
    const c = await contacts.get(id);
    expect(c).toMatchObject({ first_name: 'Anónimo', last_name: null, email: null, phone: null, tags: [], marketing_consent: false });
    expect(c.anonymized_at).not.toBeNull();
    const acts = await contacts.activities(id);
    expect(acts[0].kind).toBe('contact.anonymized');
    expect(acts.some((a) => a.kind === 'note')).toBe(false);
    expect(acts.every((a) => Object.keys(a.detail).length === 0)).toBe(true);
    expect(getDb().companions.some((m) => m.invitation_id === inv.id)).toBe(false);
  });

  it('lista os pedidos de apagamento por tratar, um por contacto, até o contacto ser anonimizado', async () => {
    const [a, b] = getDb().invitations.filter((i) => i.event_id === MAIN && i.token);
    expect(await contacts.erasureRequests()).toEqual([]);
    await guest.requestErasure(a.token!);
    await guest.requestErasure(b.token!);
    await guest.requestErasure(a.token!);
    const pending = await contacts.erasureRequests();
    expect(pending.map((r) => r.contact_id)).toEqual([a.contact_id, b.contact_id]);
    // O prazo conta do primeiro pedido.
    const first = getDb().activities.find((x) => x.kind === 'privacy.erasure_requested' && x.contact_id === a.contact_id)!;
    expect(pending[0].requested_at).toBe(first.created_at);
    expect(pending[0].contact.id).toBe(a.contact_id);

    as('leitura@demo.pt');
    expect(await contacts.erasureRequests()).toHaveLength(2);
    as('porta@demo.pt');
    await expect(contacts.erasureRequests()).rejects.toMatchObject({ code: 'forbidden' });

    as('admin@demo.pt');
    await contacts.anonymize(a.contact_id);
    expect((await contacts.erasureRequests()).map((r) => r.contact_id)).toEqual([b.contact_id]);
    await contacts.remove(b.contact_id);
    expect(await contacts.erasureRequests()).toEqual([]);
  });

  it('elimina o contacto com os convites e exporta os dados sem token', async () => {
    const inv = getDb().invitations[0];
    const data = await contacts.exportData(inv.contact_id) as { contact: { id: string }; invitations: Record<string, unknown>[] };
    expect(data.contact.id).toBe(inv.contact_id);
    expect(data.invitations[0]).not.toHaveProperty('token');
    expect(data.invitations[0]).not.toHaveProperty('checkin_code');
    expect(data.invitations[0].event).toBeTypeOf('string');

    await contacts.remove(inv.contact_id);
    expect(getDb().invitations.some((i) => i.contact_id === inv.contact_id)).toBe(false);
    expect(getDb().activities.some((a) => a.contact_id === inv.contact_id)).toBe(false);
    await expect(contacts.get(inv.contact_id)).rejects.toMatchObject({ code: 'not_found' });
  });
});
