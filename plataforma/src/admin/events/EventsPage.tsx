import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function EventsPage() {
  return (
    <>
      <PageHeader title="Eventos" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
