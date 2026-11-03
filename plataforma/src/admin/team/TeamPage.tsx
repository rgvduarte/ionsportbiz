import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function TeamPage() {
  return (
    <>
      <PageHeader title="Equipa" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
