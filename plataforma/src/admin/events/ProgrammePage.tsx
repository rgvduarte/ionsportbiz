import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function ProgrammePage() {
  return (
    <>
      <PageHeader title="Programa" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
