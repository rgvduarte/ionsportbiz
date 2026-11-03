import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../ui';

// Provisório: substituído na implementação do módulo.
export function GuestInvitationPage() {
  return (
    <>
      <PageHeader title="Convite" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
