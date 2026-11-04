import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import QRCode from 'qrcode';
import {
  AtSign, BadgeCheck, Ban, Check, ChevronRight, Copy, DoorOpen, Download, ExternalLink, FileText, History, Mail, MailCheck, MailOpen,
  MessageCircle, Pencil, Phone, Plus, RotateCcw, Send, ShieldCheck, ShieldOff, ShieldX, Ticket, Trash2, Undo2, UserCheck, UserX,
} from 'lucide-react';
import { api, toApiError, type Activity, type EventRecord, type InvitationRow, type MessageTemplate, type Companion, type InvitationStatus } from '../../lib/api';
import { inviteUrl } from '../../lib/config';
import { formalName, formatDateTime, formatRelative, formatTime, fullName } from '../../lib/format';
import { formatPhone } from '../../lib/phone';
import { ACTIVITY, CHANNEL } from '../../lib/status';
import { whatsappUrl } from '../../lib/whatsapp';
import { useAsync } from '../../lib/useAsync';
import { usePermissions } from '../../app/AuthProvider';
import {
  Alert, Avatar, Badge, Button, ButtonAnchor, Checkbox, Drawer, EmptyState, Field, Input, LoadError, Select, Skeleton, Textarea,
  useConfirm, useToast,
} from '../../ui';
import { capacityExcess, hasCredential, personalMessage, pickTemplate, whatsappBody } from './guestList';
import { ChannelIcon, copyText, plural, StatusBadge, When } from './parts';
import { approvalApplies, isPreApproved } from './approval';
import { ApproveDialog, RejectDialog } from './ApprovalDialogs';
import { AccessList, ApprovalBadge, passColor, PassChip } from '../passes';

interface Props {
  id: string;
  event: EventRecord;
  templates: MessageTemplate[] | undefined;
  waves: string[];
  onClose: () => void;
  /** Algo mudou: a lista deve recarregar. */
  onChanged: () => void;
  onRemoved: () => void;
}

type Detail = InvitationRow & { companions: Companion[] };

export function InvitationDrawer({ id, event, templates, waves, onClose, onChanged, onRemoved }: Props) {
  const can = usePermissions();
  const detail = useAsync(() => api.invitations.get(id), [id]);
  const history = useAsync(
    () => api.invitations.activities(event.id, 500).then((rows) => rows.filter((a) => a.invitation_id === id)),
    [event.id, id],
  );
  // Nomes da equipa para o histórico; se não estiver disponível, o histórico mostra-se sem eles.
  const staff = useAsync(() => api.staff.list().then((s) => new Map(s.map((x) => [x.user_id, x.full_name]))).catch(() => new Map<string, string>()), []);

  const refresh = () => {
    detail.reload();
    history.reload();
    onChanged();
  };

  const row = detail.data;
  const title = row ? formalName(row) : 'Convidado';
  const meta = row ? [row.job_title, row.organization].filter(Boolean).join(' · ') : undefined;

  return (
    <Drawer open onClose={onClose} title={title} description={meta || undefined}>
      {detail.error && !row ? (
        toApiError(detail.error).code === 'not_found'
          ? <EmptyState icon={<UserX />} title="Convite não encontrado">Pode ter sido removido da lista de convidados.</EmptyState>
          : <LoadError error={detail.error} onRetry={detail.reload} />
      ) : !row ? (
        <DrawerSkeleton />
      ) : (
        <div className="inv-drawer">
          <Identity row={row} showApproval={event.requires_approval || row.approval_status !== 'pending'} />
          {/* O link e o código de entrada são credenciais do convidado: só para quem pode enviar. */}
          {can.edit && <PersonalLink row={row} event={event} />}
          {can.edit && <SendSection row={row} event={event} templates={templates} onSent={refresh} />}
          <ResponseSection row={row} event={event} canEdit={can.edit} onSaved={refresh} />
          <ApprovalSection row={row} event={event} canEdit={can.edit} history={history.data} staff={staff.data} onChanged={refresh} />
          <SettingsSection row={row} waves={waves} canEdit={can.edit} onSaved={refresh} />
          <CheckinSection row={row} tz={event.timezone} showCode={can.edit && !!row.checkin_code} />
          <HistorySection items={history.data} error={history.error} onRetry={history.reload} tz={event.timezone} staff={staff.data} />
          {can.edit && <DangerSection row={row} onChanged={refresh} onRemoved={onRemoved} />}
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, icon, actions, children }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="inv-section" aria-label={title}>
      <header className="inv-section__head">
        <h3>{icon}{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

function DrawerSkeleton() {
  return (
    <div className="inv-drawer" aria-busy="true" aria-label="A carregar o convite">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Skeleton width={56} height={56} style={{ borderRadius: '50%' }} />
        <div style={{ flex: 1 }}><Skeleton width="60%" height={18} /><Skeleton width="40%" style={{ marginTop: 8 }} /></div>
      </div>
      <Skeleton height={120} />
      <Skeleton height={160} />
    </div>
  );
}

// ───────── Identificação ─────────

function Identity({ row, showApproval }: { row: Detail; showApproval: boolean }) {
  return (
    <div className="inv-identity">
      <Avatar name={fullName(row)} size="lg" />
      <div className="inv-identity__text">
        <div className="ui-row">
          <StatusBadge status={row.status} />
          {showApproval && approvalApplies(row) && (row.approval_status === 'approved' && row.pass_type_name
            ? <PassChip name={row.pass_type_name} color={row.pass_type_color} title={isPreApproved(row) ? 'Pré-aprovado' : 'Aprovado'} />
            : <ApprovalBadge status={row.approval_status} />)}
          {row.wave && <Badge tone="accent">{row.wave}</Badge>}
          {row.language === 'en' && <Badge title="Os emails e o convite aparecem em inglês">EN</Badge>}
        </div>
        <ul className="inv-identity__contacts">
          <li>
            <AtSign aria-hidden />
            {row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : <span className="muted">Sem email</span>}
          </li>
          <li>
            <Phone aria-hidden />
            {row.phone ? <a href={`tel:${row.phone}`}>{formatPhone(row.phone)}</a> : <span className="muted">Sem telemóvel</span>}
          </li>
        </ul>
        <Link to={`/admin/contactos/${row.contact_id}`} className="inv-identity__link">
          Ver ficha do contacto<ChevronRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}

// ───────── Link pessoal ─────────

function PersonalLink({ row, event }: { row: Detail; event: EventRecord }) {
  const toast = useToast();
  const url = inviteUrl(row.token ?? '');
  // O convite só abre (mesmo em pré-visualização) com o evento Aberto ou Fechado e o convite ativo.
  const previewBlocked = row.status === 'cancelled'
    ? 'O convite está cancelado: reative-o para o pré-visualizar.'
    : event.status === 'draft'
      ? 'Mude o estado do evento para «Aberto», em Definições, para pré-visualizar o convite.'
      : event.status === 'archived'
        ? 'O evento está arquivado: o convite já não abre.'
        : null;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#13294b', light: '#ffffff' } })
      .then((data) => alive && setQr(data), () => alive && setQr(null));
    return () => { alive = false; };
  }, [url]);

  const onCopy = async () => {
    try {
      await copyText(url);
      toast.success('Link pessoal copiado.');
    } catch (err) {
      toast.error(err);
    }
  };

  const fileName = `convite-${fullName(row).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'convidado'}.png`;

  return (
    <Section title="Link pessoal">
      <div className="inv-link">
        <div className="inv-link__main">
          <p className="inv-help">Abre o convite deste convidado, onde confirma a presença. É pessoal: não deve ser partilhado.</p>
          <div className="inv-link__field">
            <input className="ui-input mono" value={url} readOnly aria-label="Link pessoal" onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="ui-row">
            <Button size="sm" icon={<Copy />} onClick={() => void onCopy()}>Copiar</Button>
            {previewBlocked ? (
              <Button size="sm" icon={<ExternalLink />} disabled aria-describedby={`inv-preview-hint-${row.id}`}>Pré-visualizar</Button>
            ) : (
              <ButtonAnchor size="sm" icon={<ExternalLink />} href={`${url}?preview=1`} title="Abre o convite sem contar como aberto pelo convidado">
                Pré-visualizar
              </ButtonAnchor>
            )}
          </div>
          {previewBlocked && <p className="inv-help" id={`inv-preview-hint-${row.id}`}>{previewBlocked}</p>}
        </div>
        <div className="inv-link__qr">
          {qr ? <img src={qr} alt={`Código QR do convite de ${fullName(row)}`} width={112} height={112} /> : <Skeleton width={112} height={112} />}
          {qr && (
            <a href={qr} download={fileName} className="inv-link__download">
              <Download size={14} aria-hidden />QR para impressão
            </a>
          )}
        </div>
      </div>
    </Section>
  );
}

// ───────── Envio ─────────

function SendSection({ row, event, templates, onSent }: { row: Detail; event: EventRecord; templates: MessageTemplate[] | undefined; onSent: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const emailTemplates = useMemo(() => (templates ?? []).filter((t) => t.channel === 'email'), [templates]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState<'email' | 'whatsapp' | 'manual' | null>(null);
  // Já tem a credencial (confirmou e foi aprovado): propõe-se o aviso «Credencial pronta» em vez do convite.
  const credential = hasCredential(row);
  const kind = credential ? 'credential' : 'invite';
  const template = emailTemplates.find((t) => t.id === templateId) ?? pickTemplate(emailTemplates, kind);
  const unpublished = event.status === 'draft' || event.status === 'archived';
  const cancelled = row.status === 'cancelled';
  // Entregue por outra via só faz sentido antes de o convidado responder.
  const canMarkManual = row.status === 'draft' || row.status === 'sent' || row.status === 'opened';
  const resend = row.status !== 'draft';
  const link = inviteUrl(row.token ?? '');
  const waText = useMemo(() => personalMessage(whatsappBody(templates, event, kind), event, row, link), [templates, event, kind, row, link]);

  const sendEmail = async () => {
    if (!template) return;
    setBusy('email');
    try {
      const r = await api.invitations.sendEmail([row.id], template.id);
      if (r.sent) toast.success(`${credential ? 'Mensagem enviada' : 'Convite enviado'} para ${row.email}.`);
      else toast.error('O email não foi enviado. Verifique o endereço na ficha do contacto.');
      onSent();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const sendWhatsapp = async () => {
    if (!row.phone) return;
    // Abre já, no próprio clique: depois de um await o browser bloquearia a nova janela.
    window.open(whatsappUrl(row.phone, waText), '_blank', 'noopener,noreferrer');
    setBusy('whatsapp');
    try {
      await api.invitations.markSent([row.id], 'whatsapp');
      toast.success(credential ? 'WhatsApp aberto com a mensagem pronta. O envio ficou no histórico.' : 'WhatsApp aberto com a mensagem pronta. O convite ficou marcado como enviado por WhatsApp.');
      onSent();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const markManual = async () => {
    const ok = await confirm(resend ? {
      title: 'Registar reenvio por outra via?',
      message: 'Use quando o convite voltou a ser entregue em mão, por telefone ou pelo secretariado. O reenvio fica no histórico.',
      confirmLabel: 'Registar reenvio',
    } : {
      title: 'Marcar como enviado?',
      message: 'Use quando o convite foi entregue por outra via — em mão, por telefone ou pelo secretariado.',
      confirmLabel: 'Marcar como enviado',
    });
    if (!ok) return;
    setBusy('manual');
    try {
      await api.invitations.markSent([row.id], 'manual');
      toast.success(resend ? 'Reenvio por outra via registado.' : 'Convite marcado como enviado.');
      onSent();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title={credential ? 'Avisar: credencial pronta' : 'Enviar convite'} icon={<Send aria-hidden />}>
      {(row.sent_at || row.open_count > 0) && (
        <ul className="inv-facts">
          {row.sent_at && (
            <li>
              {row.sent_channel && <ChannelIcon channel={row.sent_channel} />}
              <span>Último envio{row.sent_channel ? ` por ${row.sent_channel === 'manual' ? 'outra via' : CHANNEL[row.sent_channel]}` : ''}</span>
              <When iso={row.sent_at} tz={event.timezone} />
            </li>
          )}
          {row.open_count > 0 && (
            <li>
              <MailOpen size={14} aria-hidden />
              <span>Visto {row.open_count === 1 ? '1 vez' : `${row.open_count} vezes`}</span>
              <When iso={row.last_opened_at} tz={event.timezone}>última </When>
            </li>
          )}
        </ul>
      )}

      {cancelled ? (
        <p className="inv-help">Este convite está cancelado. Reative-o para o voltar a enviar.</p>
      ) : event.status === 'draft' ? (
        <Alert tone="warning">
          O evento está em rascunho: os links pessoais ainda não abrem. Para enviar, mude o estado do evento para «Aberto»
          em <Link to={`/admin/eventos/${event.id}/definicoes`} className="inv-alert-link">Definições</Link>.
        </Alert>
      ) : unpublished ? (
        <Alert tone="info">O evento está arquivado: os links pessoais já não abrem e não é possível enviar convites.</Alert>
      ) : (
        <div className="inv-send-grid">
          <div className="inv-channel">
            <div className="inv-channel__head"><Mail aria-hidden />Email</div>
            {!row.email ? (
              <p className="inv-help">Sem email registado. Acrescente-o na <Link to={`/admin/contactos/${row.contact_id}`}>ficha do contacto</Link>.</p>
            ) : emailTemplates.length === 0 ? (
              <p className="inv-help">Ainda não há modelos de email. Crie um em <Link to={`/admin/eventos/${event.id}/mensagens`}>Mensagens</Link>.</p>
            ) : (
              <>
                {emailTemplates.length > 1 && (
                  <Select
                    aria-label="Modelo de email"
                    value={template?.id ?? ''}
                    onChange={(e) => setTemplateId(e.target.value)}
                    options={emailTemplates.map((t) => ({ value: t.id, label: t.name }))}
                  />
                )}
                <Button size="sm" icon={<Mail />} loading={busy === 'email'} disabled={!!busy} onClick={() => void sendEmail()}>
                  {credential ? 'Enviar email' : row.sent_at ? 'Reenviar email' : 'Enviar email'}
                </Button>
              </>
            )}
          </div>
          <div className="inv-channel">
            <div className="inv-channel__head"><MessageCircle aria-hidden />WhatsApp</div>
            {!row.phone ? (
              <p className="inv-help">Sem telemóvel registado.</p>
            ) : (
              <>
                <details className="inv-wa-preview">
                  <summary>Ver mensagem</summary>
                  <div className="inv-wa-bubble">{waText}</div>
                </details>
                <Button size="sm" icon={<MessageCircle />} loading={busy === 'whatsapp'} disabled={!!busy} onClick={() => void sendWhatsapp()}>
                  {credential ? 'Avisar por WhatsApp' : 'Enviar por WhatsApp'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {canMarkManual && !unpublished && (
        <button type="button" className="inv-link-btn inv-manual" onClick={() => void markManual()} disabled={!!busy}>
          <MailCheck size={14} aria-hidden />{resend ? 'Reenviado por outra via? Registar' : 'Entregue por outra via? Marcar como enviado'}
        </button>
      )}
    </Section>
  );
}

// ───────── Resposta ─────────

function answerText(value: unknown): string {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined) return '';
  return String(value);
}

function ResponseSection({ row, event, canEdit, onSaved }: { row: Detail; event: EventRecord; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const responded = row.status === 'accepted' || row.status === 'declined';
  const fieldKeys = new Set(event.rsvp_fields.map((f) => f.key));
  const answers: [string, string][] = [
    ...event.rsvp_fields.map((f) => [f.label, answerText(row.answers[f.key])] as [string, string]),
    // Respostas a campos que entretanto foram retirados do formulário.
    ...Object.entries(row.answers).filter(([k]) => !fieldKeys.has(k)).map(([k, v]) => [k, answerText(v)] as [string, string]),
  ].filter(([, v]) => v !== '');

  const canRegister = canEdit && row.status !== 'cancelled';

  return (
    <Section
      title="Resposta"
      icon={<UserCheck aria-hidden />}
      actions={canRegister && !editing && (
        <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(true)}>
          {responded ? 'Alterar resposta' : 'Registar resposta'}
        </Button>
      )}
    >
      {editing ? (
        <ResponseForm row={row} event={event} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} />
      ) : (
        <>
          <p className="inv-response">
            {row.status === 'accepted' && <><Check className="inv-ok" aria-hidden />Confirmou presença <When iso={row.responded_at} tz={event.timezone} /></>}
            {row.status === 'declined' && <><UserX className="inv-no" aria-hidden />Não poderá estar presente · <When iso={row.responded_at} tz={event.timezone} /></>}
            {!responded && row.status !== 'cancelled' && <span className="muted">Ainda sem resposta.{canRegister ? ' Se a resposta chegou por telefone ou email, registe-a aqui.' : ''}</span>}
            {row.status === 'cancelled' && <span className="muted">Convite cancelado.</span>}
          </p>
          {(row.companions.length > 0 || (row.status === 'accepted' && row.plus_ones_allowed > 0)) && (
            <div className="inv-companions">
              <div className="inv-subtitle">
                Acompanhantes <span className="muted">· {row.companions.length} de {row.plus_ones_allowed}</span>
              </div>
              {row.companions.length > 0 && (
                <ul>
                  {row.companions.map((m) => (
                    <li key={m.id}>
                      <span>{m.full_name}</span>
                      {m.checked_in_at && <Badge tone="success" title={formatDateTime(m.checked_in_at, event.timezone)}>Entrou às {formatTime(m.checked_in_at, event.timezone)}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="inv-help">
                {row.companions.length ? 'Indicados pelo convidado, no convite pessoal.' : 'Não indicou acompanhantes. Os nomes são indicados pelo convidado, no convite pessoal.'}
              </p>
            </div>
          )}
          {answers.length > 0 && (
            <dl className="inv-answers">
              {answers.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          {row.guest_note && (
            <blockquote className="inv-note">
              <FileText aria-hidden />
              <p>{row.guest_note}</p>
            </blockquote>
          )}
        </>
      )}
    </Section>
  );
}

function ResponseForm({ row, event, onCancel, onSaved }: { row: Detail; event: EventRecord; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  // Quem já entrou não pode passar a «não estará presente» (os acompanhantes que entraram seriam apagados).
  const checkedIn = !!row.checked_in_at;
  const [choice, setChoice] = useState<'accepted' | 'declined'>(row.status === 'declined' && !checkedIn ? 'declined' : 'accepted');
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({ ...row.answers }));
  const [note, setNote] = useState(row.guest_note ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Lotação: o convite pessoal recusa (capacity_full); aqui a equipa é avisada e decide.
  const stats = useAsync(() => api.events.stats(event.id), [event.id]);
  const overbooking = choice === 'accepted' && row.status !== 'accepted' && stats.data
    ? capacityExcess(stats.data.expected_attendees, stats.data.capacity, 1 + row.companions.length)
    : null;

  const set = (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    if (choice === 'accepted') {
      for (const f of event.rsvp_fields) {
        const v = answers[f.key];
        if (f.required && (v === undefined || v === null || v === '' || v === false)) missing[f.key] = 'Campo obrigatório.';
      }
    }
    setErrors(missing);
    if (Object.keys(missing).length) return;
    if (overbooking) {
      const ok = await confirm({
        title: 'Exceder a lotação?',
        message: <>O evento tem <strong>{plural(overbooking.capacity, 'lugar', 'lugares')}</strong> e, com esta confirmação, passam a ser <strong>{plural(overbooking.total, 'pessoa esperada', 'pessoas esperadas')}</strong>. No convite pessoal, o convidado não conseguiria confirmar.</>,
        confirmLabel: 'Confirmar mesmo assim',
        cancelLabel: 'Voltar',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== '' && v !== undefined && v !== null));
      await api.invitations.update(row.id, {
        status: choice,
        answers: choice === 'accepted' ? clean : {},
        guest_note: note.trim() || null,
      });
      toast.success(choice === 'accepted' ? 'Presença confirmada registada.' : 'Recusa registada.');
      onSaved();
    } catch (err) {
      toast.error(err);
      setSaving(false);
    }
  };

  return (
    <form className="inv-form" onSubmit={(e) => void submit(e)}>
      <fieldset className="inv-choice">
        <legend className="inv-subtitle">Resposta recebida por telefone, email ou pessoalmente</legend>
        <label className={['inv-radio-card', choice === 'accepted' && 'is-active'].filter(Boolean).join(' ')}>
          <input type="radio" name="rsvp" checked={choice === 'accepted'} onChange={() => setChoice('accepted')} />
          <span><strong>Confirma presença</strong></span>
        </label>
        <label className={['inv-radio-card', choice === 'declined' && 'is-active', checkedIn && 'is-disabled'].filter(Boolean).join(' ')}>
          <input type="radio" name="rsvp" checked={choice === 'declined'} onChange={() => setChoice('declined')} disabled={checkedIn} />
          <span><strong>Não estará presente</strong>{checkedIn && <span>Já entrou no evento</span>}</span>
        </label>
      </fieldset>

      {overbooking && (
        <Alert tone="warning">
          Com esta confirmação a lotação ({plural(overbooking.capacity, 'lugar', 'lugares')}) fica excedida:
          passam a ser {plural(overbooking.total, 'pessoa esperada', 'pessoas esperadas')}
          {row.companions.length > 0 ? `, contando ${row.companions.length === 1 ? 'o acompanhante indicado' : `os ${row.companions.length} acompanhantes indicados`}` : ''}.
        </Alert>
      )}
      {choice === 'accepted' && row.status !== 'accepted' && row.approval_status === 'pending' && (
        <Alert tone="info">
          A presença fica por aprovar: depois de registar, aprove-a na secção Aprovação e escolha o tipo de acesso. Só então o convidado
          recebe o código QR.
        </Alert>
      )}
      {choice === 'declined' && row.companions.length > 0 && (
        <Alert tone="info">
          {row.companions.length === 1 ? 'O acompanhante indicado é retirado' : `Os ${row.companions.length} acompanhantes indicados são retirados`}, como
          quando o convidado recusa no convite pessoal.
        </Alert>
      )}

      {choice === 'accepted' && event.rsvp_fields.map((f) => {
        const value = answers[f.key];
        const error = errors[f.key] ?? null;
        if (f.type === 'checkbox') {
          return <Checkbox key={f.key} label={f.label} checked={value === true} onChange={(e) => set(f.key, e.target.checked)} />;
        }
        return (
          <Field key={f.key} label={f.label} required={f.required} error={error}>
            {f.type === 'textarea' ? (
              <Textarea rows={3} value={typeof value === 'string' ? value : ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <Select value={typeof value === 'string' ? value : ''} onChange={(e) => set(f.key, e.target.value)} placeholder="Escolha…"
                options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
            ) : (
              <Input value={typeof value === 'string' ? value : ''} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        );
      })}

      <Field label="Nota do convidado" hint="Opcional. Visível para a equipa e, no convite, para o próprio convidado.">
        <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="ui-row inv-form__actions">
        <Button onClick={onCancel} disabled={saving}>Cancelar</Button>
        {/* Espera pelos números da lotação para poder avisar antes de gravar. */}
        <Button variant="primary" type="submit" loading={saving} disabled={choice === 'accepted' && !stats.data && !stats.error}>Registar resposta</Button>
      </div>
    </form>
  );
}

// ───────── Aprovação ─────────

function ApprovalSection({ row, event, canEdit, history, staff, onChanged }: {
  row: Detail;
  event: EventRecord;
  canEdit: boolean;
  history: Activity[] | undefined;
  staff: Map<string, string> | undefined;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);
  const passes = useAsync(() => api.passTypes.list(event.id), [event.id]);
  const pass = passes.data?.find((p) => p.id === row.pass_type_id);
  const closed = row.status === 'cancelled' || row.status === 'declined';
  const applies = approvalApplies(row);
  const pre = isPreApproved(row);
  const checkedIn = !!row.checked_in_at;
  const decidedBy = row.approved_by ? staff?.get(row.approved_by) : null;
  const reason = row.approval_status === 'rejected'
    ? (history?.find((a) => a.kind === 'invitation.rejected')?.detail as { reason?: unknown } | undefined)?.reason
    : undefined;

  const reset = async () => {
    const ok = await confirm({
      title: 'Repor a aprovação?',
      message: row.approval_status === 'approved'
        ? 'O convite volta a «Por aprovar» e perde o tipo de acesso. O convidado deixa de ver o código QR até nova aprovação.'
        : 'O convite volta a «Por aprovar», para a equipa decidir de novo.',
      confirmLabel: 'Repor aprovação',
      cancelLabel: 'Voltar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.invitations.resetApproval([row.id]);
      toast.success('O convite voltou a «Por aprovar».');
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  let text: ReactNode;
  if (closed) {
    text = row.status === 'declined' ? 'O convidado recusou o convite: não há aprovação a decidir.' : 'Convite cancelado: não há aprovação a decidir.';
  } else if (row.approval_status === 'approved') {
    text = pre
      ? 'Pré-aprovado: recebe o código QR e a lista de acessos assim que confirmar presença.'
      : 'Vê o código QR e a lista de acessos no convite pessoal.';
  } else if (row.approval_status === 'rejected') {
    text = 'Não aprovado: não recebe o código QR e não conta para a lotação.';
  } else if (row.status === 'accepted') {
    text = 'Confirmou presença e aguarda a decisão da equipa. Ainda não vê o código QR.';
  } else {
    text = event.requires_approval
      ? 'Ainda sem resposta. Pode aprovar já (ex.: convidados de honra): recebe a credencial assim que confirmar.'
      : 'Este evento não exige aprovação: quem confirma recebe logo a credencial. Pode, ainda assim, atribuir já um tipo de acesso.';
  }

  return (
    <Section title="Aprovação" icon={<BadgeCheck aria-hidden />}>
      <div className="inv-approval">
        {(applies || closed) && (
          <div className="inv-approval__state">
            {pre ? <Badge tone="success" dot>Pré-aprovado</Badge> : applies && <ApprovalBadge status={row.approval_status} />}
          </div>
        )}
        <p className="inv-help">{text}</p>

        {row.approval_status === 'approved' && !closed && (
          <div className="inv-approval__pass" style={{ '--pass-color': passColor(pass?.color ?? row.pass_type_color) } as CSSProperties}>
            {row.pass_type_name ? (
              <>
                <PassChip name={row.pass_type_name} color={row.pass_type_color} size="lg" />
                {pass?.description && <p className="inv-help">{pass.description}</p>}
                {pass ? <AccessList accesses={pass.accesses} /> : passes.error ? null : <Skeleton width="60%" />}
              </>
            ) : (
              <>
                <span className="inv-subtitle" style={{ marginBottom: 0 }}><Ticket size={14} aria-hidden style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />Sem tipo de acesso</span>
                <p className="inv-help">
                  {canEdit ? 'Atribua um tipo para o convidado ver a lista de acessos e a receção o identificar à porta.' : 'O convidado não vê lista de acessos.'}
                </p>
              </>
            )}
          </div>
        )}

        {(row.approved_at || (row.approval_status === 'rejected' && row.approved_by)) && !closed && (
          <p className="inv-approval__meta">
            {row.approval_status === 'approved' ? 'Aprovado' : 'Decidido'}
            {row.approved_at && <> <When iso={row.approved_at} tz={event.timezone} /></>}
            {decidedBy && <> por {decidedBy}</>}
            {!row.approved_by && row.approval_status === 'approved' && !event.requires_approval && ' automaticamente, ao confirmar'}
          </p>
        )}
        {typeof reason === 'string' && reason && <p className="inv-approval__reason">Motivo: «{reason}»</p>}

        {canEdit && !closed && (
          <div className="inv-approval__actions">
            {row.approval_status !== 'approved' && (
              <Button size="sm" variant="primary" icon={<BadgeCheck />} onClick={() => setDialog('approve')} disabled={busy}>
                {row.status === 'accepted' ? 'Aprovar…' : 'Pré-aprovar…'}
              </Button>
            )}
            {row.approval_status === 'approved' && (
              <Button size="sm" icon={<Ticket />} onClick={() => setDialog('approve')} disabled={busy}>
                {row.pass_type_id ? 'Mudar tipo de acesso…' : 'Atribuir tipo de acesso…'}
              </Button>
            )}
            {row.approval_status !== 'rejected' && (row.status === 'accepted' || row.approval_status === 'approved') && (
              <Button size="sm" variant="danger-ghost" icon={<ShieldX />} onClick={() => setDialog('reject')} disabled={busy || checkedIn}>Não aprovar…</Button>
            )}
            {row.approval_status !== 'pending' && (
              <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void reset()} disabled={busy || checkedIn}>Repor</Button>
            )}
          </div>
        )}
        {canEdit && !closed && checkedIn && row.approval_status !== 'pending' && (
          <p className="inv-help">Já entrou no evento: a aprovação já não pode ser retirada.</p>
        )}
      </div>
      {dialog === 'approve' && (
        <ApproveDialog
          event={event}
          rows={[row]}
          onClose={() => setDialog(null)}
          onDone={(n, p) => {
            setDialog(null);
            toast.success(n ? `${row.approval_status === 'approved' ? 'Tipo de acesso alterado para' : 'Aprovado com'} ${p.name}.` : 'Sem alterações.');
            onChanged();
          }}
        />
      )}
      {dialog === 'reject' && (
        <RejectDialog
          rows={[row]}
          onClose={() => setDialog(null)}
          onDone={(n) => {
            setDialog(null);
            toast.success(n ? 'Presença marcada como não aprovada.' : 'Sem alterações.');
            onChanged();
          }}
        />
      )}
    </Section>
  );
}

// ───────── Definições do convite ─────────

function SettingsSection({ row, waves, canEdit, onSaved }: { row: Detail; waves: string[]; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [wave, setWave] = useState(row.wave ?? '');
  const [plus, setPlus] = useState(String(row.plus_ones_allowed));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWave(row.wave ?? '');
    setPlus(String(row.plus_ones_allowed));
  }, [row.wave, row.plus_ones_allowed]);

  const plusNumber = Number(plus);
  const plusValid = plus.trim() !== '' && Number.isInteger(plusNumber) && plusNumber >= 0 && plusNumber <= 10;
  const dirty = (wave.trim() || null) !== row.wave || (plusValid && plusNumber !== row.plus_ones_allowed);

  if (!canEdit) {
    return (
      <Section title="Convite">
        <dl className="inv-answers">
          <div><dt>Vaga</dt><dd>{row.wave ?? <span className="muted">—</span>}</dd></div>
          <div><dt>Acompanhantes permitidos</dt><dd>{row.plus_ones_allowed}</dd></div>
        </dl>
      </Section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plusValid || !dirty) return;
    setSaving(true);
    try {
      await api.invitations.update(row.id, { wave: wave.trim() || null, plus_ones_allowed: plusNumber });
      toast.success('Convite atualizado.');
      onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const listId = `inv-waves-${row.id}`;
  return (
    <Section title="Convite">
      <form className="inv-settings" onSubmit={(e) => void submit(e)}>
        <Field label="Vaga">
          <Input value={wave} onChange={(e) => setWave(e.target.value)} list={listId} maxLength={80} placeholder="Sem vaga" />
        </Field>
        <datalist id={listId}>{waves.map((w) => <option key={w} value={w} />)}</datalist>
        <Field
          label="Acompanhantes permitidos"
          error={plusValid ? null : 'Entre 0 e 10.'}
          hint={plusValid && plusNumber < row.companions.length ? `Já indicou ${row.companions.length}.` : undefined}
        >
          <Input type="number" inputMode="numeric" min={0} max={10} step={1} value={plus} onChange={(e) => setPlus(e.target.value)} />
        </Field>
        <Button type="submit" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || !plusValid} loading={saving} className="inv-settings__save">
          Guardar
        </Button>
      </form>
    </Section>
  );
}

// ───────── Entrada ─────────

function CheckinSection({ row, tz, showCode }: { row: Detail; tz: string; showCode: boolean }) {
  const companionsIn = row.companions.filter((m) => m.checked_in_at).length;
  return (
    <Section title="Entrada" icon={<DoorOpen aria-hidden />}>
      <div className="inv-checkin">
        {showCode ? (
          <div>
            <div className="inv-subtitle">Código de entrada</div>
            <div className="inv-code mono" aria-label={`Código ${(row.checkin_code ?? '').split('').join(' ')}`}>{row.checkin_code}</div>
            <p className="inv-help">
              {row.status === 'accepted' && row.approval_status !== 'approved'
                ? 'O convidado ainda não vê este código: falta a aprovação da equipa.'
                : 'Aparece no convite depois de confirmar presença e de a equipa aprovar; a receção lê-o no QR ou escreve-o.'}
            </p>
          </div>
        ) : (
          <p className="inv-help">O código de entrada aparece no convite depois de o convidado confirmar presença e de a equipa aprovar.</p>
        )}
        <div className="inv-checkin__state">
          {row.checked_in_at ? (
            <>
              <Badge tone="success" dot>Entrou às {formatTime(row.checked_in_at, tz)}</Badge>
              {companionsIn > 0 && <span className="inv-help">+ {plural(companionsIn, 'acompanhante', 'acompanhantes')}</span>}
            </>
          ) : (
            <Badge dot>Ainda não entrou</Badge>
          )}
        </div>
      </div>
    </Section>
  );
}

// ───────── Histórico ─────────

const KIND_ICON: Record<string, typeof Send> = {
  'invitation.created': Plus,
  'invitation.sent': Send,
  'invitation.resent': Send,
  'invitation.opened': MailOpen,
  'invitation.accepted': UserCheck,
  'invitation.declined': UserX,
  'invitation.cancelled': Ban,
  'invitation.reopened': RotateCcw,
  'invitation.approved': BadgeCheck,
  'invitation.rejected': ShieldX,
  'invitation.approval_reset': RotateCcw,
  checkin: DoorOpen,
  'checkin.undone': Undo2,
  'consent.granted': ShieldCheck,
  'consent.revoked': ShieldOff,
  'privacy.erasure_requested': ShieldOff,
  note: FileText,
};

const TONE: Record<string, string> = {
  'invitation.accepted': 'success',
  'invitation.approved': 'success',
  'invitation.rejected': 'danger',
  'invitation.approval_reset': 'warning',
  checkin: 'success',
  'invitation.declined': 'danger',
  'invitation.cancelled': 'danger',
  'privacy.erasure_requested': 'danger',
};

/** Ações do próprio convidado (sem membro da equipa associado). */
const GUEST_KINDS = new Set(['invitation.opened', 'invitation.accepted', 'invitation.declined', 'consent.granted', 'consent.revoked', 'privacy.erasure_requested']);

function describe(a: Activity): string {
  const label = ACTIVITY[a.kind] ?? a.kind;
  const parts = [label];
  if (a.channel && (a.kind === 'invitation.sent' || a.kind === 'invitation.resent')) {
    parts[0] = `${label} ${a.channel === 'manual' ? 'por outra via' : `por ${CHANNEL[a.channel]}`}`;
  }
  const wave = (a.detail as { wave?: unknown }).wave;
  if (a.kind === 'invitation.created' && typeof wave === 'string' && wave) parts.push(`vaga «${wave}»`);
  const detail = a.detail as { forced?: unknown; status?: unknown; pass_type?: unknown; reason?: unknown };
  if (a.kind === 'checkin' && detail.forced) {
    // Entrada forçada: sem confirmação de presença ou, com presença confirmada, sem aprovação da equipa.
    parts.push(detail.status && detail.status !== 'accepted' ? 'sem confirmação prévia' : 'sem aprovação da equipa');
  }
  if (a.kind === 'invitation.approved' && typeof detail.pass_type === 'string' && detail.pass_type) parts.push(detail.pass_type);
  if (a.kind === 'invitation.rejected' && typeof detail.reason === 'string' && detail.reason) parts.push(`«${detail.reason}»`);
  return parts.join(' · ');
}

function HistorySection({ items, error, onRetry, tz, staff }: {
  items: Activity[] | undefined;
  error: unknown;
  onRetry: () => void;
  tz: string;
  staff: Map<string, string> | undefined;
}) {
  return (
    <Section title="Histórico" icon={<History aria-hidden />}>
      {error && !items ? (
        <LoadError error={error} onRetry={onRetry} />
      ) : !items ? (
        <div className="ui-stack"><Skeleton width="70%" /><Skeleton width="55%" /><Skeleton width="62%" /></div>
      ) : !items.length ? (
        <p className="inv-help">Sem registos.</p>
      ) : (
        <ol className="ui-timeline inv-timeline">
          {items.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? History;
            const who = a.actor_id ? staff?.get(a.actor_id) : GUEST_KINDS.has(a.kind) ? 'pelo convidado' : null;
            return (
              <li key={a.id}>
                <span className={['ui-timeline__icon', TONE[a.kind] && `inv-tl--${TONE[a.kind]}`].filter(Boolean).join(' ')}><Icon aria-hidden /></span>
                <div>
                  <div className="ui-timeline__text">{describe(a)}</div>
                  <div className="ui-timeline__time">
                    <time dateTime={a.created_at} title={formatRelative(a.created_at)}>{formatDateTime(a.created_at, tz)}</time>
                    {who && <> · {a.actor_id ? who : <em>{who}</em>}</>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// ───────── Ações ─────────

function DangerSection({ row, onChanged, onRemoved }: { row: Detail; onChanged: () => void; onRemoved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const cancelled = row.status === 'cancelled';
  const name = fullName(row);

  const setStatus = async (status: InvitationStatus, done: string) => {
    setBusy(true);
    try {
      await api.invitations.update(row.id, { status });
      toast.success(done);
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: 'Cancelar este convite?',
      message: <>O link pessoal de <strong>{name}</strong> deixa de funcionar e o convite deixa de contar para o evento. Pode reativá-lo mais tarde.</>,
      confirmLabel: 'Cancelar convite',
      cancelLabel: 'Voltar',
      danger: true,
    });
    if (ok) await setStatus('cancelled', 'Convite cancelado.');
  };

  const onReactivate = async () => {
    const ok = await confirm({
      title: 'Reativar este convite?',
      message: 'O convite volta a «Por enviar» e o link pessoal volta a funcionar. Envie-o de novo para avisar o convidado.',
      confirmLabel: 'Reativar convite',
    });
    if (ok) await setStatus('draft', 'Convite reativado.');
  };

  const onRemove = async () => {
    const ok = await confirm({
      title: 'Remover da lista de convidados?',
      message: <>São eliminados o convite de <strong>{name}</strong>, as respostas, os acompanhantes e o histórico neste evento. O contacto mantém-se no CRM. Esta ação não pode ser anulada.</>,
      confirmLabel: 'Remover da lista',
      cancelLabel: 'Voltar',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.invitations.remove(row.id);
      toast.success(`${name} foi removido da lista.`);
      onRemoved();
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <section className="inv-danger" aria-label="Ações sobre o convite">
      {cancelled ? (
        <Button size="sm" icon={<RotateCcw />} onClick={() => void onReactivate()} disabled={busy}>Reativar convite</Button>
      ) : (
        <Button size="sm" variant="danger-ghost" icon={<Ban />} onClick={() => void onCancel()} disabled={busy}>Cancelar convite</Button>
      )}
      <Button size="sm" variant="danger-ghost" icon={<Trash2 />} onClick={() => void onRemove()} disabled={busy}>Remover da lista</Button>
    </section>
  );
}
