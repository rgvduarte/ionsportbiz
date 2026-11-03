import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Check, Ticket, X } from 'lucide-react';
import { api, type EventRecord, type InvitationRow, type PassType } from '../../lib/api';
import { formalName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { Alert, Button, ButtonLink, Dialog, Field, LoadError, Skeleton, Textarea, useToast } from '../../ui';
import { AccessList, passColor, PassChip } from '../passes';
import { approvePlan, rejectPlan } from './approval';
import { plural } from './parts';

// Aprovar (com tipo de acesso) e não aprovar: para a seleção da lista e para a ficha de um convidado.

const who = (rows: InvitationRow[]) => (rows.length === 1 ? formalName(rows[0]) : plural(rows.length, 'convidado', 'convidados'));

/** Tipo a propor: o atual (se todos o partilham) ou o único que existe. */
function initialPass(rows: InvitationRow[], types: PassType[]): string | null {
  const current = rows[0]?.pass_type_id;
  if (current && rows.every((r) => r.pass_type_id === current) && types.some((t) => t.id === current)) return current;
  return types.length === 1 ? types[0].id : null;
}

export function ApproveDialog({ event, rows, onClose, onDone }: {
  event: EventRecord;
  rows: InvitationRow[];
  onClose: () => void;
  onDone: (changed: number, pass: PassType) => void;
}) {
  const toast = useToast();
  const types = useAsync(() => api.passTypes.list(event.id), [event.id]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (types.data) setChosen((c) => c ?? initialPass(rows, types.data!));
  }, [types.data, rows]);

  const list = types.data ?? [];
  const pass = list.find((t) => t.id === chosen) ?? null;
  const plan = approvePlan(rows, chosen);
  const single = rows.length === 1 ? rows[0] : null;
  const retype = single?.approval_status === 'approved';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pass || !plan.change.length) return;
    setSaving(true);
    try {
      const n = await api.invitations.approve(plan.change.map((r) => r.id), pass.id);
      onDone(n, pass);
    } catch (err) {
      setSaving(false);
      toast.error(err);
    }
  };

  const summary: string[] = [];
  if (!single) {
    if (plan.confirmed) summary.push(plural(plan.confirmed, 'confirmado passa a aprovado', 'confirmados passam a aprovados'));
    if (plan.retyped) summary.push(plural(plan.retyped, 'já aprovado muda de tipo de acesso', 'já aprovados mudam de tipo de acesso'));
    if (plan.preApproved) summary.push(plural(plan.preApproved, 'ainda sem resposta fica pré-aprovado', 'ainda sem resposta ficam pré-aprovados'));
    if (plan.unchanged) summary.push(plural(plan.unchanged, 'já tem este tipo de acesso', 'já têm este tipo de acesso'));
    if (plan.skipped) summary.push(plural(plan.skipped, 'recusado ou cancelado fica de fora', 'recusados ou cancelados ficam de fora'));
  }

  let body: React.ReactNode;
  if (types.error && !types.data) {
    body = <LoadError error={types.error} onRetry={types.reload} />;
  } else if (!types.data) {
    body = <div className="ui-stack"><Skeleton height={88} /><Skeleton height={88} /></div>;
  } else if (!list.length) {
    body = (
      <div className="apv-empty">
        <Ticket aria-hidden />
        <div>
          <strong>Este evento ainda não tem tipos de acesso</strong>
          <p>Para aprovar, crie primeiro os tipos de acesso (ex.: VIP Pass, Conference Pass) no separador Acessos.</p>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <fieldset className="apv-options">
          <legend className="inv-subtitle">Tipo de acesso</legend>
          {list.map((t) => (
            <label
              key={t.id}
              className={['apv-option', chosen === t.id && 'is-active'].filter(Boolean).join(' ')}
              style={{ '--pass-color': passColor(t.color) } as CSSProperties}
            >
              <input type="radio" name="apv-pass" checked={chosen === t.id} onChange={() => setChosen(t.id)} />
              <span className="apv-option__body">
                <PassChip name={t.name} color={t.color} />
                {t.description && <span className="apv-option__desc">{t.description}</span>}
                <AccessList accesses={t.accesses} />
              </span>
            </label>
          ))}
        </fieldset>
        {single?.status !== undefined && single.status !== 'accepted' && single.status !== 'declined' && single.status !== 'cancelled' && (
          <Alert tone="info">Ainda não respondeu: fica pré-aprovado e recebe a credencial assim que confirmar presença.</Alert>
        )}
        {(single?.status === 'declined' || single?.status === 'cancelled') && (
          <Alert tone="warning">{single.status === 'declined' ? 'Este convidado recusou o convite.' : 'Este convite está cancelado.'} Não é possível aprová-lo.</Alert>
        )}
        {summary.length > 0 && (
          <ul className="apv-summary" aria-live="polite">
            {summary.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
        <Alert tone="info">
          O convidado só vê o código QR e a lista de acessos no convite pessoal depois de aprovado. Não é enviada nenhuma mensagem
          automática: para o avisar, envie um email ou WhatsApp com um modelo de{' '}
          <Link to={`/admin/eventos/${event.id}/mensagens`} className="inv-alert-link">Mensagens</Link>.
        </Alert>
      </>
    );
  }

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={retype ? 'Mudar tipo de acesso' : `Aprovar ${who(rows)}`}
      description={single
        ? retype ? formalName(single) : 'Escolha o tipo de acesso. O convidado não escolhe: vê apenas o que lhe for atribuído.'
        : `${plural(rows.length, 'convite selecionado', 'convites selecionados')}. Escolha o tipo de acesso a atribuir.`}
      footer={!list.length && types.data ? (
        <>
          <Button onClick={onClose}>Fechar</Button>
          <ButtonLink to={`/admin/eventos/${event.id}/acessos`} variant="primary" icon={<Ticket />}>Criar tipos de acesso</ButtonLink>
        </>
      ) : (
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="apv-form" icon={<Check />} loading={saving} disabled={!pass || !plan.change.length}>
            {pass
              ? plan.change.length
                ? `${retype ? 'Mudar para' : 'Aprovar com'} ${pass.name}${!single && plan.change.length !== rows.length ? ` (${plan.change.length})` : ''}`
                : 'Sem alterações'
              : 'Escolha o tipo de acesso'}
          </Button>
        </>
      )}
    >
      <form id="apv-form" className="apv" onSubmit={(e) => void submit(e)}>{body}</form>
    </Dialog>
  );
}

export function RejectDialog({ rows, onClose, onDone }: {
  rows: InvitationRow[];
  onClose: () => void;
  onDone: (changed: number) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const plan = rejectPlan(rows);
  const single = rows.length === 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan.change.length) return;
    setSaving(true);
    try {
      const n = await api.invitations.reject(plan.change.map((r) => r.id), reason.trim() || null);
      onDone(n);
    } catch (err) {
      setSaving(false);
      toast.error(err);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Não aprovar ${who(rows)}?`}
      description="O convidado não recebe o código QR nem a lista de acessos, e a presença deixa de contar para a lotação."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" type="submit" form="apv-reject-form" icon={<X />} loading={saving} disabled={!plan.change.length}>
            {plan.change.length ? (single ? 'Não aprovar' : `Não aprovar (${plan.change.length})`) : 'Sem alterações'}
          </Button>
        </>
      }
    >
      <form id="apv-reject-form" className="apv" onSubmit={(e) => void submit(e)}>
        {plan.wasApproved > 0 && (
          <Alert tone="warning">
            {single ? 'Estava aprovado: perde' : `${plural(plan.wasApproved, 'estava aprovado e perde', 'estavam aprovados e perdem')}`} o tipo de acesso,
            e o código QR deixa de aparecer no convite.
          </Alert>
        )}
        {(plan.checkedIn > 0 || plan.already > 0) && (
          <ul className="apv-summary">
            {plan.checkedIn > 0 && <li>{single ? 'Já entrou no evento: fica como está.' : `${plural(plan.checkedIn, 'já entrou', 'já entraram')} no evento e fica${plan.checkedIn === 1 ? '' : 'm'} como está.`}</li>}
            {plan.already > 0 && <li>{single ? 'Já estava como não aprovado.' : `${plural(plan.already, 'já estava', 'já estavam')} como não aprovado${plan.already === 1 ? '' : 's'}.`}</li>}
          </ul>
        )}
        <Field label="Motivo" hint="Opcional. Fica no histórico do convite e só a equipa o vê. O convidado não é avisado automaticamente.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Ex.: lotação reservada a parceiros" autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
