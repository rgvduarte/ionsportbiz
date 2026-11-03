import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { ChevronLeft } from 'lucide-react';

export function Card({ title, subtitle, actions, footer, children, className, padded = true }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** false: o conteúdo ocupa o cartão todo (tabelas). */
  padded?: boolean;
}) {
  return (
    <section className={['ui-card', className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="ui-card__header">
          <div>
            {title && <h2 className="ui-card__title">{title}</h2>}
            {subtitle && <div className="ui-card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="ui-row">{actions}</div>}
        </header>
      )}
      {padded ? <div className="ui-card__body">{children}</div> : children}
      {footer && <footer className="ui-card__footer">{footer}</footer>}
    </section>
  );
}

export function PageHeader({ title, description, actions, back }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="ui-page-header">
      <div>
        {back && (
          <Link to={back.to} className="ui-page-header__back">
            <ChevronLeft aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="ui-page-header__title">{title}</h1>
        {description && <p className="ui-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
}

/** Separadores ligados a rotas. */
export function RouteTabs({ tabs }: { tabs: { to: string; label: string; icon?: ReactNode; end?: boolean }[] }) {
  return (
    <nav className="ui-tabs" aria-label="Secções">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => ['ui-tab', isActive && 'active'].filter(Boolean).join(' ')}>
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Separadores locais (sem mudar de rota). */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className="ui-tab" onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, progress }: { label: ReactNode; value: ReactNode; hint?: ReactNode; progress?: number }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat__label">{label}</div>
      <div className="ui-stat__value">{value}</div>
      {progress !== undefined && <Progress value={progress} style={{ marginTop: 10 }} />}
      {hint && <div className="ui-stat__hint">{hint}</div>}
    </div>
  );
}

/** value entre 0 e 1. */
export function Progress({ value, color, style }: { value: number; color?: string; style?: React.CSSProperties }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="ui-progress" style={style} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="ui-progress__bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Avatar({ name, size }: { name: string; size?: 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((c) => /\p{L}/u.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <span className={['ui-avatar', size && `ui-avatar--${size}`].filter(Boolean).join(' ')} aria-hidden>{initials || '·'}</span>;
}

/** Lista de pares rótulo/valor; valores vazios mostram "—". */
export function DefinitionList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="ui-dl">
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
