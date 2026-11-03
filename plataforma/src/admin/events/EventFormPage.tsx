import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function EventFormPage() {
  return (
    <>
      <PageHeader title="Evento" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
