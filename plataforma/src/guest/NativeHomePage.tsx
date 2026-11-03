import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../ui';

// Provisório: substituído na implementação do módulo.
export function NativeHomePage() {
  return (
    <>
      <PageHeader title="Os meus convites" />
      <EmptyState icon={<Construction />} title="Em construção" />
    </>
  );
}
