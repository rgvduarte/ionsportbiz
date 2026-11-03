import { isRouteErrorResponse, useRouteError } from 'react-router';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '../ui';

/**
 * Erro ao abrir uma página (ex.: ficheiro da app que não carregou por falha de rede ou por uma publicação nova).
 * Substitui o ecrã técnico do React Router por uma mensagem simples com "Tentar novamente".
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : null;
  return (
    <main className="ui-standalone">
      <div className="ui-standalone__card">
        <span className="ui-standalone__mark" aria-hidden><WifiOff /></span>
        <h1>{notFound ? 'Página não encontrada' : 'Não foi possível abrir esta página'}</h1>
        <p>
          {notFound
            ? 'O endereço não existe ou foi alterado.'
            : 'A ligação pode ter falhado ou a app foi atualizada entretanto. Tente novamente.'}
        </p>
        {detail && <p className="mono" style={{ fontSize: 'var(--text-xs)' }}>{detail}</p>}
        <div className="ui-standalone__actions">
          <Button variant="primary" icon={<RefreshCw />} onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      </div>
    </main>
  );
}
