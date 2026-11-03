import type { Api } from '../types';
import { ApiError } from '../errors';
import { currentStaff, delay, getDb, save } from './store';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Modo demonstração: qualquer palavra-passe serve. O email escolhe o papel
// (admin@demo.pt, editor@demo.pt, porta@demo.pt, leitura@demo.pt); um email fora da equipa entra como admin.
// Um membro desativado entra sem acesso ao back-office, como em produção.
export const auth: Api['auth'] = {
  async session() {
    const d = getDb();
    const user = d.staff.find((s) => s.user_id === d.currentUserId);
    if (!user) return delay(null, 0);
    return delay({ user: { id: user.user_id, email: user.email }, staff: currentStaff() }, 0);
  },
  async signIn(email) {
    const d = getDb();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) throw new ApiError('auth');
    const staff = d.staff.find((s) => s.email === normalized) ?? d.staff.find((s) => s.role === 'admin' && s.active);
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
