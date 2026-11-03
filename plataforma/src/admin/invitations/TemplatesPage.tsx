import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function TemplatesPage() {
  return (
    <>
      <PageHeader title="Mensagens" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
