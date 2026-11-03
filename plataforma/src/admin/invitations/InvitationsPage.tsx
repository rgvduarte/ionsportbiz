import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function InvitationsPage() {
  return (
    <>
      <PageHeader title="Convidados" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
