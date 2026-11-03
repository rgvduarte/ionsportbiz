import type { Api, Staff, StaffRole } from '../types';
import { ApiError } from '../errors';
import { ALL_STAFF, delay, getDb, nowIso, requireRole, save, uid } from './store';

// Imita a tabela staff (RLS: toda a equipa lê, só admin altera), o trigger keep_one_admin
// e a função invite-staff (que cria a conta e a linha na equipa).

const ROLES: StaffRole[] = ['admin', 'editor', 'checkin', 'viewer'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const collator = new Intl.Collator('pt-PT');

/** Trigger keep_one_admin: nunca deixar a plataforma sem um administrador ativo. */
function keepOneAdmin(old: Staff, next: Pick<Staff, 'role' | 'active'>): void {
  if (old.role !== 'admin' || !old.active || (next.role === 'admin' && next.active)) return;
  const others = getDb().staff.some((s) => s.role === 'admin' && s.active && s.user_id !== old.user_id);
  if (!others) throw new ApiError('last_admin');
}

function checkName(name: string): string {
  if (name.length < 1 || name.length > 120) {
    throw new ApiError('validation', 'staff_full_name_check', 'O nome tem de ter entre 1 e 120 caracteres.');
  }
  return name;
}

export const staff: Api['staff'] = {
  async list() {
    requireRole(...ALL_STAFF);
    return delay([...getDb().staff].sort((a, b) => collator.compare(a.full_name, b.full_name)));
  },

  async update(userId, patch) {
    requireRole('admin');
    const row = getDb().staff.find((s) => s.user_id === userId);
    if (!row) throw new ApiError('not_found');
    const next = {
      full_name: patch.full_name !== undefined ? checkName(patch.full_name.trim()) : row.full_name,
      role: patch.role ?? row.role,
      active: patch.active ?? row.active,
    };
    if (!ROLES.includes(next.role)) throw new ApiError('validation', 'role');
    keepOneAdmin(row, next);
    Object.assign(row, next);
    save();
    return delay(row);
  },

  async invite(input) {
    requireRole('admin');
    const email = input.email.trim().toLowerCase();
    const fullName = checkName(input.full_name.trim());
    if (!EMAIL.test(email)) throw new ApiError('validation', 'email', 'Indique um email válido.');
    if (!ROLES.includes(input.role)) throw new ApiError('validation', 'role');
    const d = getDb();
    const existing = d.staff.find((s) => s.email === email);
    if (existing) {
      // A função faz upsert pela conta: quem já existe é reativado com o papel indicado.
      const next = { full_name: fullName, role: input.role, active: true };
      keepOneAdmin(existing, next);
      Object.assign(existing, next);
    } else {
      d.staff.push({ user_id: uid(), full_name: fullName, email, role: input.role, active: true, created_at: nowIso() });
    }
    save();
    await delay(null, 400);
  },
};
