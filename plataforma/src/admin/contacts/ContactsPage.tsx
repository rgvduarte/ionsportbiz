import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function ContactsPage() {
  return (
    <>
      <PageHeader title="Contactos" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
