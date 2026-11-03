// Peças comuns da área do convidado: secção com título, mensagens de estado e esqueleto de carregamento.

import type { CSSProperties, ReactNode } from 'react';
import { accentPalette } from './utils';

export function Section({ id, eyebrow, title, intro, children, className }: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={['gi-section', className].filter(Boolean).join(' ')} aria-labelledby={`${id}-title`}>
      <header className="gi-section__head">
        <p className="gi-eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`} className="gi-section__title">{title}</h2>
        {intro && <p className="gi-section__intro">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

/** Mensagem calma para estados sem convite (link inválido, erro de rede). */
export function StateMessage({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="gi-state" role="status">
      <div className="gi-state__icon" aria-hidden>{icon}</div>
      <h1 className="gi-state__title">{title}</h1>
      <p className="gi-state__body">{children}</p>
      {actions && <div className="gi-state__actions">{actions}</div>}
    </div>
  );
}

/** Esqueleto com a forma do cartão do convite. */
export function InvitationSkeleton({ label }: { label: string }) {
  const line = (w: string, h = 12, mt = 0) => <span className="gi-skel" style={{ width: w, height: h, marginTop: mt }} />;
  return (
    <div className="gi-card gi-card--skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className="gi-card__inner" aria-hidden>
        {line('44%', 14)}
        {line('62%', 10, 28)}
        {line('80%', 12, 14)}
        {line('70%', 12, 8)}
        {line('76%', 30, 30)}
        {line('48%', 30, 10)}
        <span className="gi-card__rule"><span /></span>
        {line('58%', 14)}
        {line('30%', 12, 10)}
        {line('46%', 12, 22)}
        {line('64%', 12, 8)}
      </div>
    </div>
  );
}

/** Variáveis CSS com a cor da marca do evento (ou o azul institucional). */
export function accentStyle(accent: string | null | undefined): CSSProperties {
  const p = accentPalette(accent);
  return {
    '--gi-accent': p.accent,
    '--gi-accent-strong': p.strong,
    '--gi-accent-soft': p.soft,
    '--gi-on-accent': p.on,
    '--gi-accent-text': p.text,
  } as CSSProperties;
}
