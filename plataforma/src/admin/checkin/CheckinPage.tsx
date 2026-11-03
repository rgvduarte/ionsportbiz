import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

// Provisório: substituído na implementação do módulo.
export function CheckinPage() {
  return (
    <>
      <PageHeader title="Check-in" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
