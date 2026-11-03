import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDate, formatDateTime, formatNumber, formatShortDate, fullName } from '../../lib/format';
import type { AsyncState } from '../../lib/useAsync';
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, LoadError, Skeleton, type Tone } from '../../ui';
import { deadlineLabel, deadlineState, erasureDeadline, type DeadlineState } from './erasure';
import type { ErasureRequest } from './erasureApi';

const TONE: Record<DeadlineState['kind'], Tone> = { overdue: 'danger', soon: 'warning', ok: 'neutral' };
const deadlineIso = (r: ErasureRequest) => erasureDeadline(r.requested_at).toISOString();

/** Aviso no topo da lista de contactos enquanto houver pedidos de eliminação por tratar. */
export function ErasureBanner({ requests, onOpen }: { requests: ErasureRequest[]; onOpen: () => void }) {
  const n = requests.length;
  if (!n) return null;
  // Vêm do mais antigo para o mais recente: o primeiro é o que tem o prazo mais curto.
  const oldest = requests[0];
  const state = deadlineState(oldest.requested_at);
  const whose = n === 1 ? 'O prazo de resposta' : 'O prazo de resposta do mais antigo';
  return (
    <div className={`ui-alert ui-alert--${state.kind === 'overdue' ? 'danger' : 'warning'} ct-erasure`} role="status">
      <ShieldAlert aria-hidden className="ct-erasure__icon" />
      <div className="ct-erasure__text">
        <strong>
          {n === 1 ? '1 pedido de eliminação de dados por tratar.' : `${formatNumber(n)} pedidos de eliminação de dados por tratar.`}
        </strong>
        <span>
          {state.kind === 'overdue'
            ? `${whose} terminou a ${formatDate(deadlineIso(oldest))}.`
            : `${whose} termina a ${formatDate(deadlineIso(oldest))} (${deadlineLabel(state).toLowerCase()}).`}
        </span>
      </div>
      <Button size="sm" onClick={onOpen}>Ver pedidos</Button>
    </div>
  );
}

/** Fila dos pedidos de eliminação feitos pelos próprios na página do convite. */
export function ErasureQueue({ requests, isAdmin, onClose }: {
  requests: AsyncState<ErasureRequest[]>;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const rows = requests.data ?? [];
  const back = <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onClose}>Todos os contactos</Button>;

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/admin/contactos/${id}`);
  };

  return (
    <Card
      padded={false}
      className="ct-list"
      title="Pedidos de eliminação de dados"
      subtitle="Feitos pelos próprios, na página do convite. A resposta deve ser dada no prazo de um mês (artigo 12.º do RGPD)."
      actions={back}
    >
      {requests.error && !requests.data ? (
        <LoadError error={requests.error} onRetry={requests.reload} />
      ) : !requests.data ? (
        <div className="ui-card__body ui-stack" aria-busy="true">
          <Skeleton height={18} /><Skeleton height={18} width="80%" /><Skeleton height={18} width="65%" />
        </div>
      ) : !rows.length ? (
        <EmptyState icon={<ShieldCheck />} title="Não há pedidos por tratar"
          actions={<Button onClick={onClose}>Ver todos os contactos</Button>}>
          Os pedidos de eliminação feitos pelos convidados aparecem aqui até os dados pessoais serem apagados.
        </EmptyState>
      ) : (
        <>
          <div className="ui-table-wrap">
            <table className="ui-table ct-table ct-erasure-table">
              <caption className="visually-hidden">Pedidos de eliminação de dados por tratar</caption>
              <thead>
                <tr>
                  <th scope="col">Contacto</th>
                  <th scope="col" className="ct-hide-md">Entidade</th>
                  <th scope="col" className="ct-hide-md">Pedido</th>
                  <th scope="col" className="ct-hide-md">Prazo</th>
                  <th scope="col" className="ct-hide-md"><span className="visually-hidden">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = r.contact;
                  const state = deadlineState(r.requested_at);
                  return (
                    <tr key={r.contact_id} data-href onClick={(e) => onRowClick(e, c.id)}>
                      <td>
                        <div className="ct-person">
                          <Avatar name={fullName(c)} />
                          <div className="ct-person__text">
                            <Link to={`/admin/contactos/${c.id}`} className="ct-person__name">{fullName(c)}</Link>
                            {c.email && <div className="secondary ct-ellipsis">{c.email}</div>}
                            <div className="ct-deadline ct-deadline--stacked">
                              <Badge tone={TONE[state.kind]} dot={state.kind !== 'ok'}>{deadlineLabel(state)}</Badge>
                              <span className="secondary tabular">Prazo: {formatShortDate(deadlineIso(r))}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="ct-hide-md">{c.organization ?? <span className="muted">—</span>}</td>
                      <td className="ct-hide-md tabular" title={formatDateTime(r.requested_at)}>{formatShortDate(r.requested_at)}</td>
                      <td className="ct-hide-md">
                        <div className="ct-deadline">
                          <span className="tabular">{formatShortDate(deadlineIso(r))}</span>
                          <Badge tone={TONE[state.kind]} dot={state.kind !== 'ok'}>{deadlineLabel(state)}</Badge>
                        </div>
                      </td>
                      <td className="ct-hide-md ct-erasure-table__action">
                        <ButtonLink size="sm" variant={isAdmin ? 'primary' : 'secondary'} to={`/admin/contactos/${c.id}`}>
                          {isAdmin ? 'Tratar pedido' : 'Abrir ficha'}
                        </ButtonLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ct-erasure-foot">
            {isAdmin
              ? 'Para tratar um pedido, abra a ficha, confirme a identidade de quem o fez se houver dúvidas e use «Apagar dados pessoais». O pedido sai desta lista quando os dados são apagados.'
              : 'Só um administrador pode apagar os dados pessoais. O pedido sai desta lista quando os dados são apagados.'}
          </p>
        </>
      )}
    </Card>
  );
}
