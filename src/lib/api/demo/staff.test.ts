import { beforeEach, describe, expect, it } from 'vitest';
import { staff } from './staff';
import { getDb, resetDemo } from './store';

const as = (email: string) => {
  const d = getDb();
  d.currentUserId = d.staff.find((s) => s.email === email)!.user_id;
};
const idOf = (email: string) => getDb().staff.find((s) => s.email === email)!.user_id;

beforeEach(() => {
  resetDemo();
  as('admin@demo.pt');
});

describe('demo staff', () => {
  it('lista por nome; toda a equipa lê', async () => {
    as('porta@demo.pt');
    const rows = await staff.list();
    expect(rows.map((s) => s.full_name)).toEqual(['Equipa de Receção', 'Isabel Morais', 'Marta Lencastre', 'Tomás Valadares']);
  });

  it('só admin altera e convida', async () => {
    as('editor@demo.pt');
    await expect(staff.update(idOf('leitura@demo.pt'), { role: 'editor' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(staff.invite({ email: 'novo@demo.pt', full_name: 'Novo', role: 'viewer' })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('altera papel e estado', async () => {
    const r = await staff.update(idOf('leitura@demo.pt'), { role: 'editor', active: false });
    expect(r).toMatchObject({ role: 'editor', active: false });
  });

  it('não deixa a plataforma sem administrador ativo', async () => {
    const me = idOf('admin@demo.pt');
    await expect(staff.update(me, { role: 'editor' })).rejects.toMatchObject({ code: 'last_admin' });
    await expect(staff.update(me, { active: false })).rejects.toMatchObject({ code: 'last_admin' });
    await staff.update(idOf('editor@demo.pt'), { role: 'admin' });
    const r = await staff.update(me, { role: 'viewer' });
    expect(r.role).toBe('viewer');
  });

  it('convida: valida, cria ou reativa (upsert pelo email)', async () => {
    await expect(staff.invite({ email: 'sem-arroba', full_name: 'X', role: 'viewer' })).rejects.toMatchObject({ code: 'validation' });
    await expect(staff.invite({ email: 'a@b.pt', full_name: '  ', role: 'viewer' })).rejects.toMatchObject({ code: 'validation' });
    await staff.invite({ email: ' Joana.Reis@Exemplo.pt ', full_name: 'Joana Reis', role: 'checkin' });
    const row = getDb().staff.find((s) => s.email === 'joana.reis@exemplo.pt')!;
    expect(row).toMatchObject({ full_name: 'Joana Reis', role: 'checkin', active: true });
    expect(row.user_id).toMatch(/^[0-9a-f-]{36}$/);

    await staff.update(idOf('leitura@demo.pt'), { active: false });
    await staff.invite({ email: 'leitura@demo.pt', full_name: 'Isabel Morais', role: 'editor' });
    expect(getDb().staff.find((s) => s.email === 'leitura@demo.pt')).toMatchObject({ role: 'editor', active: true });
    expect(getDb().staff).toHaveLength(5);
  });
});
