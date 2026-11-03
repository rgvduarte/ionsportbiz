import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function DashboardPage() {
  return (
    <>
      <PageHeader title="Painel" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
