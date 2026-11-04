import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Mail, MailX, MessageCircle, RefreshCw } from 'lucide-react';
import { api, type EventRecord, type InvitationRow, type MessageTemplate } from '../../lib/api';
import { inviteUrl } from '../../lib/config';
import { formalName } from '../../lib/format';
import { renderTemplate, buildTemplateVars } from '@shared/template';
import { Alert, Button, Dialog, Field, LoadError, Select, useToast } from '../../ui';
import { personalMessage, pickTemplate, recipients, templateKind, type TemplateKind } from './guestList';
import { plural } from './parts';

type Scope = 'selection' | 'drafts';

export function SendDialog({ event, rows, selectedIds, templates, templatesError, blocked, purpose = 'invite', onClose, onSent }: {
  event: EventRecord;
  rows: InvitationRow[];
  /** null: sem seleção (envia os que estão por enviar). */
  selectedIds: ReadonlySet<string> | null;
  templates: MessageTemplate[] | undefined;
  templatesError: unknown;
  /** O evento está em rascunho ou arquivado: os links não abrem. */
  blocked: boolean;
  /** 'credential': aviso de credencial pronta aos aprovados (propõe o modelo «Credencial pronta»). */
  purpose?: TemplateKind;
  onClose: () => void;
  onSent: () => void;
}) {
  const credential = purpose === 'credential';
  const toast = useToast();
  const emailTemplates = useMemo(() => (templates ?? []).filter((t) => t.channel === 'email'), [templates]);
  const [scope, setScope] = useState<Scope>(selectedIds || credential ? 'selection' : 'drafts');
  const [templateId, setTemplateId] = useState('');
  const [sending, setSending] = useState(false);

  const template = emailTemplates.find((t) => t.id === templateId) ?? pickTemplate(emailTemplates, purpose);
  const missingCredentialTemplate = credential && !!templates && !emailTemplates.some((t) => templateKind(t) === 'credential');
  const r = useMemo(() => recipients(rows, scope === 'selection' ? selectedIds : null), [rows, scope, selectedIds]);
  const draftsTotal = useMemo(() => recipients(rows, null).targets.length, [rows]);
  const sample = r.withEmail[0];

  const preview = useMemo(() => {
    if (!template || !sample) return null;
    const link = inviteUrl(sample.token ?? '');
    const vars = buildTemplateVars({ event, contact: sample, link });
    return {
      to: sample,
      subject: renderTemplate(template.subject ?? '', vars).replace(/\s+/g, ' ').trim() || event.name,
      body: personalMessage(template.body, event, sample, link),
    };
  }, [template, sample, event]);

  const canSend = !blocked && !!template && r.withEmail.length > 0 && !sending;

  const submit = async () => {
    if (!template) return;
    setSending(true);
    try {
      const result = await api.invitations.sendEmail(r.withEmail.map((x) => x.id), template.id);
      const what = credential ? ['aviso enviado', 'avisos enviados'] : ['convite enviado', 'convites enviados'];
      if (result.sent) toast.success(`${plural(result.sent, what[0], what[1])} por email.`);
      if (result.failed) toast.error(`${plural(result.failed, credential ? 'aviso não foi enviado' : 'convite não foi enviado', credential ? 'avisos não foram enviados' : 'convites não foram enviados')}. Verifique os endereços de email na ficha de cada convidado.`);
      if (!result.sent && !result.failed) toast.info('Nenhum convite foi enviado.');
      onSent();
    } catch (err) {
      toast.error(err);
      setSending(false);
    }
  };

  const mensagensUrl = `/admin/eventos/${event.id}/mensagens`;

  return (
    <Dialog
      open
      onClose={sending ? () => undefined : onClose}
      size="lg"
      title={credential ? 'Avisar: credencial pronta' : 'Enviar convites por email'}
      description={credential
        ? 'Cada convidado aprovado recebe um email com o link pessoal, onde já está a credencial com o código QR. O envio fica no histórico.'
        : 'Cada convidado recebe um email com o seu link pessoal. O envio fica registado no histórico de cada convite.'}
      footer={
        <>
          <Button onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button variant="primary" icon={<Mail />} loading={sending} disabled={!canSend} onClick={() => void submit()}>
            {r.withEmail.length ? `Enviar ${plural(r.withEmail.length, 'email', 'emails')}` : 'Enviar'}
          </Button>
        </>
      }
    >
      <div className="inv-send">
        {blocked && (
          <Alert tone="danger">
            {event.status === 'archived'
              ? 'O evento está arquivado: os links pessoais já não abrem e não é possível enviar convites.'
              : <>O evento está em rascunho: os links pessoais ainda não abririam. Mude o estado do evento para «Aberto»
                em <Link to={`/admin/eventos/${event.id}/definicoes`} className="inv-alert-link">Definições</Link> antes de enviar.</>}
          </Alert>
        )}
        {!blocked && event.status === 'closed' && (
          <Alert tone="warning">O evento está fechado: os convidados veem o convite, mas já não podem responder.</Alert>
        )}

        {selectedIds && !credential && (
          <fieldset className="inv-send__scope">
            <legend className="visually-hidden">Destinatários</legend>
            <label className={['inv-radio-card', scope === 'selection' && 'is-active'].filter(Boolean).join(' ')}>
              <input type="radio" name="scope" checked={scope === 'selection'} onChange={() => setScope('selection')} />
              <span>
                <strong>Convidados selecionados</strong>
                <span>{plural(selectedIds.size, 'convidado', 'convidados')}</span>
              </span>
            </label>
            <label className={['inv-radio-card', scope === 'drafts' && 'is-active'].filter(Boolean).join(' ')}>
              <input type="radio" name="scope" checked={scope === 'drafts'} onChange={() => setScope('drafts')} />
              <span>
                <strong>Todos os convites por enviar</strong>
                <span>{plural(draftsTotal, 'convidado', 'convidados')}</span>
              </span>
            </label>
          </fieldset>
        )}

        {templatesError && !templates ? (
          <LoadError error={templatesError} />
        ) : !templates ? null : emailTemplates.length === 0 ? (
          <Alert tone="info">
            Ainda não há modelos de email para este evento. Crie um em{' '}
            <Link to={mensagensUrl} className="inv-alert-link">Mensagens</Link>
            {' '}— pode partir do modelo «Convite formal» sugerido.
          </Alert>
        ) : (
          <>
          {missingCredentialTemplate && (
            <Alert tone="warning">
              Falta o modelo «Credencial pronta». Crie-o em <Link to={mensagensUrl} className="inv-alert-link">Mensagens</Link> com
              «Criar modelos sugeridos», ou escolha outro modelo abaixo.
            </Alert>
          )}
          <Field label="Modelo de email" hint={<>Os modelos editam-se no separador <Link to={mensagensUrl}>Mensagens</Link>.</>}>
            <Select
              value={template?.id ?? ''}
              onChange={(e) => setTemplateId(e.target.value)}
              options={emailTemplates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
          </>
        )}

        <div className="inv-send__figures" aria-live="polite">
          <Figure icon={<Mail />} value={r.withEmail.length} label={credential ? (r.withEmail.length === 1 ? 'recebe o aviso por email' : 'recebem o aviso por email') : r.withEmail.length === 1 ? 'recebe o convite por email' : 'recebem o convite por email'} tone="accent" />
          <Figure icon={<MailX />} value={r.withoutEmail.length} label="sem email registado" tone={r.withoutEmail.length ? 'warning' : 'neutral'} />
          {!credential && <Figure icon={<RefreshCw />} value={r.resend} label={r.resend === 1 ? 'já tinha recebido (reenvio)' : 'já tinham recebido (reenvio)'} tone="neutral" />}
        </div>

        {r.targets.length === 0 && (
          <Alert tone="info">
            {scope === 'drafts' ? 'Não há convites por enviar. Para reenviar, selecione os convidados na lista.' : 'Os convidados selecionados estão cancelados.'}
          </Alert>
        )}

        {r.withoutEmail.length > 0 && (
          <div className="inv-send__noemail">
            <MessageCircle aria-hidden />
            <div>
              <strong>{plural(r.withoutEmail.length, 'convidado sem email', 'convidados sem email')}</strong>
              <p>
                {r.withoutEmail.slice(0, 4).map((x) => formalName(x)).join(', ')}{r.withoutEmail.length > 4 ? ` e mais ${r.withoutEmail.length - 4}` : ''}.
                {credential
                  ? ' Avise-os por WhatsApp, a partir da ficha de cada um (a mensagem «Credencial pronta» já vem escrita).'
                  : ' Envie-lhes o convite por WhatsApp, a partir da ficha de cada um, ou entregue-o em mão e marque-o como enviado.'}
              </p>
            </div>
          </div>
        )}

        {preview && (
          <section className="inv-send__preview" aria-label="Pré-visualização">
            <div className="inv-send__preview-head">
              <span>Pré-visualização para <strong>{formalName(preview.to)}</strong></span>
              <span className="muted">{preview.to.email}</span>
            </div>
            <div className="inv-send__subject">{preview.subject}</div>
            <div className="inv-send__body">{preview.body}</div>
          </section>
        )}

        {api.mode === 'demo' && (
          <p className="inv-send__demo"><AlertTriangle aria-hidden />Modo de demonstração: o envio é simulado e nenhum email sai da plataforma.</p>
        )}
      </div>
    </Dialog>
  );
}

function Figure({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: 'accent' | 'warning' | 'neutral' }) {
  return (
    <div className={['inv-figure', `inv-figure--${tone}`, value === 0 && 'inv-figure--zero'].filter(Boolean).join(' ')}>
      <span className="inv-figure__icon">{icon}</span>
      <span className="inv-figure__value tabular">{value.toLocaleString('pt-PT')}</span>
      <span className="inv-figure__label">{label}</span>
    </div>
  );
}
