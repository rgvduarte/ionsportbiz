import type { Api } from '../types';
import { ApiError } from '../errors';
import { currentStaff, delay, getDb, save } from './store';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Modo demonstração: qualquer palavra-passe serve. O email escolhe o papel
// (admin@demo.pt, editor@demo.pt, porta@demo.pt, leitura@demo.pt); outro email entra como admin.
export const auth: Api['auth'] = {
  async session() {
    const d = getDb();
    const staff = currentStaff();
    if (!d.currentUserId || !staff) return delay(null, 0);
    return delay({ user: { id: staff.user_id, email: staff.email }, staff }, 0);
  },
  async signIn(email) {
    const d = getDb();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) throw new ApiError('auth');
    const staff = d.staff.find((s) => s.email === normalized && s.active) ?? d.staff.find((s) => s.role === 'admin' && s.active);
    d.currentUserId = staff?.user_id ?? null;
    save();
    await delay(null, 250);
    notify();
  },
  async sendMagicLink() {
    await delay(null, 250);
  },
  async signOut() {
    getDb().currentUserId = null;
    save();
    notify();
  },
  onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
