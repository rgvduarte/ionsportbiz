import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Button, EmptyState, Loader } from '../ui';
import type { StaffRole } from '../lib/api';

/** Exige sessão de um membro ativo da equipa. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  if (!session.staff) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <EmptyState icon={<ShieldAlert />} title="Sem acesso ao back-office"
          actions={<Button onClick={() => void signOut()}>Terminar sessão</Button>}>
          A conta {session.user.email} não pertence à equipa ou foi desativada. Fale com um administrador.
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

/** Limita uma rota a alguns papéis. A receção é enviada para o check-in. */
export function RoleGate({ roles, children }: { roles: StaffRole[]; children: ReactNode }) {
  const { can } = useAuth();
  if (can.role && roles.includes(can.role)) return <>{children}</>;
  if (can.role === 'checkin') return <Navigate to="/admin/check-in" replace />;
  return (
    <EmptyState icon={<ShieldAlert />} title="Sem permissão">
      O seu papel não permite aceder a esta página.
    </EmptyState>
  );
}
