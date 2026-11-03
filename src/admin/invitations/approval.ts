// Aprovação da equipa (sem React): quando se mostra, filtros da lista e o que cada ação em lote altera.
// As regras seguem as funções SQL approve_invitations, reject_invitations e reset_approval.

import type { ApprovalStatus, Invitation, InvitationRow } from '../../lib/api';

type ApprovalFields = Pick<Invitation, 'status' | 'approval_status'>;

/**
 * A aprovação só interessa a quem confirmou presença ou já foi decidido antes de responder (pré-aprovação).
 * Convites cancelados ou recusados pelo convidado ficam de fora.
 */
export function approvalApplies(r: ApprovalFields): boolean {
  if (r.status === 'cancelled' || r.status === 'declined') return false;
  return r.status === 'accepted' || r.approval_status !== 'pending';
}

/** Aprovado antes de o convidado confirmar: recebe a credencial assim que confirmar. */
export function isPreApproved(r: ApprovalFields): boolean {
  return r.approval_status === 'approved' && r.status !== 'accepted' && r.status !== 'declined' && r.status !== 'cancelled';
}

export type ApprovalFilter = ApprovalStatus | 'all';

/** Filtros de aprovação da lista; `param` é o valor em ?aprovacao= (para ligar do painel). */
export const APPROVAL_FILTERS: { value: ApprovalFilter; label: string; param: string | null }[] = [
  { value: 'all', label: 'Todos', param: null },
  { value: 'pending', label: 'Por aprovar', param: 'por-aprovar' },
  { value: 'approved', label: 'Aprovados', param: 'aprovados' },
  { value: 'rejected', label: 'Não aprovados', param: 'nao-aprovados' },
];

export const APPROVAL_PARAM = 'aprovacao';

export function approvalFromParam(value: string | null): ApprovalFilter {
  return APPROVAL_FILTERS.find((f) => f.param && f.param === value)?.value ?? 'all';
}

export function approvalToParam(filter: ApprovalFilter): string | null {
  return APPROVAL_FILTERS.find((f) => f.value === filter)?.param ?? null;
}

/** Lista de convidados de um evento com o filtro de aprovação. */
export function approvalListUrl(eventId: string, filter: ApprovalFilter): string {
  const param = approvalToParam(filter);
  return `/admin/eventos/${eventId}${param ? `?${APPROVAL_PARAM}=${param}` : ''}`;
}

/** "Por aprovar": confirmou e aguarda a equipa. Aprovados e não aprovados: só onde a aprovação se aplica. */
export function matchesApproval(r: ApprovalFields, filter: ApprovalFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return r.status === 'accepted' && r.approval_status === 'pending';
  return approvalApplies(r) && r.approval_status === filter;
}

// ───────── Ações em lote ─────────

export interface ApprovePlan {
  /** Convites que mudam (os enviados à função). */
  change: InvitationRow[];
  /** Destes: confirmados que passam a aprovados. */
  confirmed: number;
  /** Destes: ainda sem resposta (ficam pré-aprovados). */
  preApproved: number;
  /** Destes: já aprovados com outro tipo de acesso. */
  retyped: number;
  /** Já aprovados com este tipo: ficam como estão. */
  unchanged: number;
  /** Recusados pelo convidado ou cancelados: ficam de fora. */
  skipped: number;
}

export function approvePlan(rows: InvitationRow[], passTypeId: string | null): ApprovePlan {
  const plan: ApprovePlan = { change: [], confirmed: 0, preApproved: 0, retyped: 0, unchanged: 0, skipped: 0 };
  for (const r of rows) {
    if (r.status === 'cancelled' || r.status === 'declined') plan.skipped++;
    else if (r.approval_status === 'approved' && passTypeId && r.pass_type_id === passTypeId) plan.unchanged++;
    else {
      plan.change.push(r);
      if (r.approval_status === 'approved') plan.retyped++;
      else if (r.status === 'accepted') plan.confirmed++;
      else plan.preApproved++;
    }
  }
  return plan;
}

export interface DecisionPlan {
  change: InvitationRow[];
  /** Já estavam neste estado. */
  already: number;
  /** Já entraram no evento: não mudam. */
  checkedIn: number;
  /** Destes, quantos estavam aprovados (perdem o tipo de acesso e o código QR). */
  wasApproved: number;
}

function decisionPlan(rows: InvitationRow[], target: ApprovalStatus): DecisionPlan {
  const plan: DecisionPlan = { change: [], already: 0, checkedIn: 0, wasApproved: 0 };
  for (const r of rows) {
    if (r.approval_status === target) plan.already++;
    else if (r.checked_in_at) plan.checkedIn++;
    else {
      plan.change.push(r);
      if (r.approval_status === 'approved') plan.wasApproved++;
    }
  }
  return plan;
}

/** "Não aprovar": quem já entrou ou já não estava aprovado fica como está. */
export const rejectPlan = (rows: InvitationRow[]) => decisionPlan(rows, 'rejected');

/** "Repor aprovação": volta a "por aprovar"; quem já entrou fica como está. */
export const resetPlan = (rows: InvitationRow[]) => decisionPlan(rows, 'pending');
