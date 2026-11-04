import type { CSSProperties } from 'react';
import { api, type ApprovalStatus, type InvitationRow, type PassType } from '../lib/api';
import { APPROVAL_STATUS } from '../lib/status';
import { useAsync } from '../lib/useAsync';
import { formatNumber } from '../lib/format';
import { Badge, Field, Select } from '../ui';
import { quotaLeft, quotaShortMessage } from './events/passTypes';
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

// ───────── Pré-aprovação ao convidar (com quota) ─────────

type QuotaRow = Pick<InvitationRow, 'status' | 'approval_status' | 'pass_type_id'>;

export interface PassQuota {
  types: PassType[] | null;
  /** Convites do evento, para contar a quota (null enquanto carrega ou se falhar). */
  rows: QuotaRow[] | null;
  error: unknown;
}

/** Tipos de acesso do evento e os convites que ocupam as quotas. `rows`: os convites já carregados (evita outro pedido). */
export function usePassQuota(eventId: string | null, rows?: QuotaRow[] | null): PassQuota {
  const types = useAsync(() => (eventId ? api.passTypes.list(eventId) : Promise.resolve([])), [eventId]);
  const own = useAsync(
    () => (eventId && rows === undefined ? api.invitations.list(eventId) : Promise.resolve(null as InvitationRow[] | null)),
    [eventId, rows === undefined],
  );
  return { types: types.data ?? null, rows: rows === undefined ? own.data ?? null : rows, error: types.error };
}

/** Motivo para não deixar pré-aprovar `needed` convites com o tipo escolhido (quota sem lugares), ou null. */
export function preApproveProblem(q: PassQuota, passTypeId: string, needed: number): string | null {
  const pass = q.types?.find((t) => t.id === passTypeId);
  if (!pass || !q.rows || needed <= 0) return null;
  const left = quotaLeft(pass, q.rows);
  return left !== null && needed > left ? quotaShortMessage(pass, left, needed) : null;
}

/** Texto de cada opção: nome e lugares livres. */
function optionLabel(pass: PassType, rows: QuotaRow[] | null): string {
  if (pass.capacity == null) return `${pass.name} · sem quota`;
  if (!rows) return `${pass.name} · quota ${formatNumber(pass.capacity)}`;
  const left = Math.max(0, quotaLeft(pass, rows) ?? 0);
  return `${pass.name} · ${left === 0 ? 'quota esgotada' : `${left === 1 ? 'resta 1' : `restam ${formatNumber(left)}`} de ${formatNumber(pass.capacity)}`}`;
}

/**
 * "Pré-aprovar como": tipo de acesso atribuído logo ao convidar. O convidado recebe a credencial
 * assim que confirmar presença, sem passar por «Por aprovar».
 */
export function PreApproveField({ quota, value, onChange, needed, className }: {
  quota: PassQuota;
  value: string;
  onChange: (passTypeId: string) => void;
  /** Quantos convites novos ficariam com o tipo (para avisar se a quota não chega). */
  needed: number;
  className?: string;
}) {
  const types = quota.types ?? [];
  if (!types.length) return null;
  const problem = preApproveProblem(quota, value, needed);
  return (
    <Field
      label="Pré-aprovar como"
      className={className}
      error={problem}
      hint={value ? 'Recebem a credencial com este acesso assim que confirmarem presença.' : 'Ficam «Por aprovar» depois de confirmarem. Pode aprovar mais tarde.'}
    >
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: 'Não pré-aprovar' }, ...types.map((t) => ({ value: t.id, label: optionLabel(t, quota.rows) }))]}
      />
    </Field>
  );
}
