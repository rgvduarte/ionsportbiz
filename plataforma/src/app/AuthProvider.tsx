import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type SessionInfo, type StaffRole } from '../lib/api';

export interface Permissions {
  role: StaffRole | null;
  /** Vê contactos, convites e respostas (admin, editor, leitura). */
  readCrm: boolean;
  /** Cria e altera (admin, editor). */
  edit: boolean;
  admin: boolean;
  /** Faz check-in (admin, editor, receção). */
  checkIn: boolean;
}

interface AuthState {
  session: SessionInfo | null;
  loading: boolean;
  can: Permissions;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function permissionsFor(role: StaffRole | null): Permissions {
  return {
    role,
    readCrm: role === 'admin' || role === 'editor' || role === 'viewer',
    edit: role === 'admin' || role === 'editor',
    admin: role === 'admin',
    checkIn: role === 'admin' || role === 'editor' || role === 'checkin',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.auth.session());
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return api.auth.onChange(() => void refresh());
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    loading,
    can: permissionsFor(session?.staff?.role ?? null),
    refresh,
    signOut,
  }), [session, loading, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

/** Atalho para as permissões do utilizador atual. */
export function usePermissions(): Permissions {
  return useAuth().can;
}
