import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

export function Badge({ tone = 'neutral', dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={['ui-badge', tone !== 'neutral' && `ui-badge--${tone}`, dot && 'ui-badge--dot'].filter(Boolean).join(' ')} title={title}>
      {children}
    </span>
  );
}

const ALERT_ICON = { info: Info, warning: AlertTriangle, danger: XCircle, success: CheckCircle2 };

export function Alert({ tone = 'info', children, className }: { tone?: keyof typeof ALERT_ICON; children: ReactNode; className?: string }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={['ui-alert', `ui-alert--${tone}`, className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon">{icon}</div>}
      <div className="ui-empty__title">{title}</div>
      {children && <div>{children}</div>}
      {actions && <div className="ui-empty__actions">{actions}</div>}
    </div>
  );
}

export function Loader({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="ui-loader" role="status">
      <Loader2 className="ui-spin" size={18} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="ui-skeleton" style={{ width, height, ...style }} aria-hidden />;
}

/** Mostra o erro de um carregamento com opção de tentar outra vez. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Não foi possível carregar.';
  return (
    <div style={{ padding: 24 }}>
      <Alert tone="danger">
        {message}{' '}
        {onRetry && (
          <button type="button" onClick={onRetry} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        )}
      </Alert>
    </div>
  );
}
