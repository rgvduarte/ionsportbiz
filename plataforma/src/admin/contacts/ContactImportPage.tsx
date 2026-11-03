import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function ContactImportPage() {
  return (
    <>
      <PageHeader title="Importar contactos" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
