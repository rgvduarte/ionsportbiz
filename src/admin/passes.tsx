import type { CSSProperties } from 'react';
import type { ApprovalStatus } from '../lib/api';
import { APPROVAL_STATUS } from '../lib/status';
import { Badge } from '../ui';
import './passes.css';

// Tipos de acesso e aprovação: peças comuns à lista de convidados, ao painel, ao check-in e ao separador Acessos.

/** Cor do tipo de acesso (neutra quando não tem). */
export const passColor = (color: string | null | undefined) => color || 'var(--c-text-3)';

export function PassDot({ color }: { color: string | null | undefined }) {
  return <span className="pass-dot" style={{ background: passColor(color) }} aria-hidden />;
}

/** Nome do tipo de acesso com a respetiva cor. */
export function PassChip({ name, color, size, title }: { name: string; color: string | null; size?: 'lg'; title?: string }) {
  return (
    <span
      className={['pass-chip', size && `pass-chip--${size}`].filter(Boolean).join(' ')}
      style={{ '--pass-color': passColor(color) } as CSSProperties}
      title={title}
    >
      <PassDot color={color} />
      <span className="pass-chip__name">{name}</span>
    </span>
  );
}

export function ApprovalBadge({ status, title }: { status: ApprovalStatus; title?: string }) {
  const s = APPROVAL_STATUS[status];
  return <Badge tone={s.tone} dot title={title}>{s.label}</Badge>;
}

/** Lista do que o tipo de acesso inclui. */
export function AccessList({ accesses, className }: { accesses: string[]; className?: string }) {
  if (!accesses.length) return <p className="pass-accesses__empty">Sem acessos indicados.</p>;
  return (
    <ul className={['pass-accesses', className].filter(Boolean).join(' ')}>
      {accesses.map((a, i) => <li key={`${i}:${a}`}>{a}</li>)}
    </ul>
  );
}
