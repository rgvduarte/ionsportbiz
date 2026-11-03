import { describe, expect, it } from 'vitest';
import type { InvitationRow } from '../../lib/api';
import {
  approvalApplies, approvalFromParam, approvalListUrl, approvalToParam, approvePlan, isPreApproved, matchesApproval, rejectPlan, resetPlan,
} from './approval';

let n = 0;
function row(p: Partial<InvitationRow>): InvitationRow {
  n++;
  return {
    id: `id-${n}`, event_id: 'e', contact_id: `c-${n}`, token: null, checkin_code: null,
    status: 'accepted', wave: null, plus_ones_allowed: 0, invited_by: null, sent_at: null, sent_channel: null,
    first_opened_at: null, last_opened_at: null, open_count: 0, responded_at: null, answers: {}, guest_note: null,
    checked_in_at: null, checked_in_by: null, created_at: '', updated_at: '',
    approval_status: 'pending', pass_type_id: null, approved_at: null, approved_by: null, pass_type_name: null, pass_type_color: null,
    salutation: null, first_name: 'Ana', last_name: 'Costa', email: null, phone: null, organization: null,
    job_title: null, segment: null, tags: [], language: 'pt', marketing_consent: false, companions_count: 0, companions_checked_in: 0,
    ...p,
  };
}

describe('approvalApplies', () => {
  it('só para quem confirmou ou já foi decidido antes de responder', () => {
    expect(approvalApplies({ status: 'accepted', approval_status: 'pending' })).toBe(true);
    expect(approvalApplies({ status: 'sent', approval_status: 'pending' })).toBe(false);
    expect(approvalApplies({ status: 'opened', approval_status: 'approved' })).toBe(true);
    expect(approvalApplies({ status: 'draft', approval_status: 'rejected' })).toBe(true);
    expect(approvalApplies({ status: 'declined', approval_status: 'approved' })).toBe(false);
    expect(approvalApplies({ status: 'cancelled', approval_status: 'approved' })).toBe(false);
    expect(isPreApproved({ status: 'sent', approval_status: 'approved' })).toBe(true);
    expect(isPreApproved({ status: 'accepted', approval_status: 'approved' })).toBe(false);
  });

  it('filtros', () => {
    expect(matchesApproval({ status: 'accepted', approval_status: 'pending' }, 'pending')).toBe(true);
    expect(matchesApproval({ status: 'sent', approval_status: 'pending' }, 'pending')).toBe(false);
    expect(matchesApproval({ status: 'sent', approval_status: 'approved' }, 'approved')).toBe(true);
    expect(matchesApproval({ status: 'declined', approval_status: 'approved' }, 'approved')).toBe(false);
    expect(matchesApproval({ status: 'declined', approval_status: 'approved' }, 'all')).toBe(true);
  });

  it('parâmetro do endereço', () => {
    expect(approvalFromParam('por-aprovar')).toBe('pending');
    expect(approvalFromParam('nao-aprovados')).toBe('rejected');
    expect(approvalFromParam('outra-coisa')).toBe('all');
    expect(approvalFromParam(null)).toBe('all');
    expect(approvalToParam('approved')).toBe('aprovados');
    expect(approvalToParam('all')).toBeNull();
    expect(approvalListUrl('e1', 'pending')).toBe('/admin/eventos/e1?aprovacao=por-aprovar');
    expect(approvalListUrl('e1', 'all')).toBe('/admin/eventos/e1');
  });
});

describe('planos das ações em lote', () => {
  const rows = [
    row({ status: 'accepted' }),
    row({ status: 'opened' }),
    row({ status: 'accepted', approval_status: 'approved', pass_type_id: 'vip' }),
    row({ status: 'accepted', approval_status: 'approved', pass_type_id: 'conf' }),
    row({ status: 'declined' }),
    row({ status: 'cancelled' }),
    row({ status: 'accepted', approval_status: 'rejected', checked_in_at: '2027-01-01T19:00:00Z' }),
  ];

  it('aprovar: confirmados, pré-aprovados, mudança de tipo, sem alteração e de fora', () => {
    const p = approvePlan(rows, 'vip');
    expect(p).toMatchObject({ confirmed: 2, preApproved: 1, retyped: 1, unchanged: 1, skipped: 2 });
    expect(p.change).toHaveLength(4);
    // Sem tipo escolhido, os já aprovados contam como mudança de tipo.
    expect(approvePlan(rows, null)).toMatchObject({ retyped: 2, unchanged: 0 });
  });

  it('não aprovar e repor: quem já entrou fica como está', () => {
    expect(rejectPlan(rows)).toMatchObject({ already: 1, checkedIn: 0, wasApproved: 2 });
    expect(rejectPlan(rows).change).toHaveLength(6);
    const reset = resetPlan(rows);
    expect(reset).toMatchObject({ already: 4, checkedIn: 1, wasApproved: 2 });
    expect(reset.change).toHaveLength(2);
  });
});
