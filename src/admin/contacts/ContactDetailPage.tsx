import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BadgeCheck, Ban, CheckCircle2, ChevronLeft, DoorOpen, EyeOff, FileJson, Mail, MailOpen, MailPlus, Pencil, RotateCcw, Send, ShieldAlert,
  ShieldCheck, ShieldOff, ShieldX, StickyNote, Trash2, Undo2, UserPlus, UserRoundX, XCircle,
} from 'lucide-react';
import { api, ApiError, type Activity, type Contact, type Staff } from '../../lib/api';
import { formatDate, formatDateTime, formatRelative, formatShortDate, formatTime, fullName } from '../../lib/format';
import { formatPhone } from '../../lib/phone';
import { ACTIVITY, CHANNEL, INVITATION_STATUS } from '../../lib/status';
import { useAsync, type AsyncState } from '../../lib/useAsync';
import { usePermissions } from '../../app/AuthProvider';
import {
  ActionMenu, Alert, Avatar, Badge, Button, ButtonLink, Card, DefinitionList, EmptyState, LoadError, Skeleton, Textarea,
  useConfirm, useToast, type MenuItem, type Tone,
} from '../../ui';
import { ContactFormDialog } from './ContactFormDialog';
import { InviteToEventDialog } from './InviteToEventDialog';
import { ConsentBadge, TagList, datedName, downloadFile, languageLabel, slugify } from './shared';
import { ApprovalBadge } from '../passes';
import { approvalApplies } from '../invitations/approval';
import { deadlineLabel, deadlineState, erasureDeadline } from './erasure';
import './contacts.css';

const SOURCE: Record<string, string> = { manual: 'Registo manual', 'importação': 'Importação de ficheiro' };

const KIND_ICON: Record<string, [typeof Mail, Tone | 'note' | null]> = {
  'contact.created': [UserPlus, 'accent'],
  'contact.anonymized': [EyeOff, null],
  'invitation.created': [MailPlus, null],
  'invitation.sent': [Send, 'accent'],
  'invitation.resent': [Send, 'accent'],
  'invitation.opened': [MailOpen, null],
  'invitation.accepted': [CheckCircle2, 'success'],
  'invitation.declined': [XCircle, 'danger'],
  'invitation.cancelled': [Ban, null],
  'invitation.reopened': [RotateCcw, null],
  'invitation.approved': [BadgeCheck, 'success'],
  'invitation.rejected': [ShieldX, 'danger'],
  'invitation.approval_reset': [RotateCcw, null],
  checkin: [DoorOpen, 'success'],
  'checkin.undone': [Undo2, null],
  'consent.granted': [ShieldCheck, 'success'],
  'consent.revoked': [ShieldOff, null],
  'privacy.erasure_requested': [ShieldAlert, 'danger'],
  note: [StickyNote, 'note'],
};

const TIMELINE_STEP = 15;

export function ContactDetailPage() {
  const { contactId = '' } = useParams();
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const contact = useAsync(() => api.contacts.get(contactId), [contactId]);
  const invitations = useAsync(() => api.contacts.invitations(contactId), [contactId]);
  const activities = useAsync(() => api.contacts.activities(contactId), [contactId]);
  // A equipa só serve para mostrar nomes: se falhar, mostra "—".
  const staff = useAsync(() => api.staff.list().catch(() => [] as Staff[]), []);

  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<null | 'export' | 'anonymize' | 'remove'>(null);

  const staffName = useMemo(() => {
    const map = new Map((staff.data ?? []).map((s) => [s.user_id, s.full_name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? null : null);
  }, [staff.data]);

  if (contact.error && !contact.data) {
    if (contact.error instanceof ApiError && contact.error.code === 'not_found') {
      return (
        <EmptyState icon={<UserRoundX />} title="Contacto não encontrado"
          actions={<ButtonLink to="/admin/contactos" icon={<ChevronLeft />}>Voltar aos contactos</ButtonLink>}>
          O contacto pode ter sido eliminado ou o endereço está incorreto.
        </EmptyState>
      );
    }
    return <LoadError error={contact.error} onRetry={contact.reload} />;
  }
  if (!contact.data) return <DetailSkeleton />;

  const c = contact.data;
  const anonymized = !!c.anonymized_at;
  const name = anonymized ? 'Contacto anonimizado' : fullName(c);
  // O prazo conta do primeiro pedido (a linha do tempo vem do mais recente para o mais antigo).
  const erasureRequest = !anonymized ? activities.data?.findLast((a) => a.kind === 'privacy.erasure_requested') : undefined;
  const erasureState = erasureRequest ? deadlineState(erasureRequest.created_at) : null;
  const invitationCount = invitations.data?.length ?? 0;

  const onExport = async () => {
    setBusy('export');
    try {
      const data = await api.contacts.exportData(c.id);
      const payload = { exported_at: new Date().toISOString(), ...(data as object) };
      downloadFile(datedName(`dados-${slugify(fullName(c))}`, 'json'), JSON.stringify(payload, null, 2), 'application/json');
      toast.success('Ficheiro com os dados pessoais descarregado.');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const onAnonymize = async () => {
    const ok = await confirm({
      title: `Apagar os dados pessoais de ${fullName(c)}?`,
      message: (
        <div className="ui-stack" style={{ gap: 10 }}>
          <p>
            O nome, email, telemóvel, entidade, cargo, etiquetas e notas são apagados, tal como as respostas aos convites e os
            acompanhantes indicados. <strong>Esta ação é irreversível.</strong>
          </p>
          <p>Mantém-se apenas o registo anónimo dos convites, para as estatísticas dos eventos não mudarem. Use esta opção para responder a um pedido de apagamento (artigo 17.º do RGPD).</p>
        </div>
      ),
      confirmLabel: 'Apagar dados pessoais',
      danger: true,
    });
    if (!ok) return;
    setBusy('anonymize');
    try {
      await api.contacts.anonymize(c.id);
      toast.success('Dados pessoais apagados.');
      contact.reload();
      activities.reload();
      invitations.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async () => {
    const ok = await confirm({
      title: `Eliminar ${name}?`,
      message: (
        <div className="ui-stack" style={{ gap: 10 }}>
          <p>
            O contacto é eliminado definitivamente,{' '}
            {invitationCount === 0
              ? 'juntamente com o seu histórico.'
              : <>juntamente com {invitationCount === 1 ? 'o convite' : `os ${invitationCount} convites`} (incluindo respostas e registos de entrada) e o histórico.</>}
          </p>
          {invitationCount > 0 && !anonymized && (
            <p>As estatísticas dos eventos deixam de o contar. Para cumprir um pedido de apagamento mantendo os números, use «Apagar dados pessoais».</p>
          )}
        </div>
      ),
      confirmLabel: 'Eliminar contacto',
      danger: true,
    });
    if (!ok) return;
    setBusy('remove');
    try {
      await api.contacts.remove(c.id);
      toast.success(`${name} foi eliminado.`);
      navigate('/admin/contactos', { replace: true });
    } catch (err) {
      toast.error(err);
      setBusy(null);
    }
  };

  const menu: MenuItem[] = [
    ...(can.edit ? [{ label: 'Exportar dados (RGPD)', icon: <FileJson />, onSelect: () => void onExport(), disabled: !!busy }] : []),
    ...(can.admin && !anonymized ? [{ label: 'Apagar dados pessoais', icon: <EyeOff />, onSelect: () => void onAnonymize(), danger: true, separator: true, disabled: !!busy }] : []),
    ...(can.edit ? [{ label: 'Eliminar contacto', icon: <Trash2 />, onSelect: () => void onRemove(), danger: true, separator: !can.admin || anonymized, disabled: !!busy }] : []),
  ];

  const roleLine = [c.job_title, c.organization].filter(Boolean).join(' · ');

  return (
    <>
      <header className={['ct-head', anonymized && 'ct-head--anon'].filter(Boolean).join(' ')}>
        <div style={{ minWidth: 0 }}>
          <Link to="/admin/contactos" className="ct-head__back"><ChevronLeft aria-hidden />Contactos</Link>
          <div className="ct-head__id">
            {anonymized
              ? <span className="ui-avatar ui-avatar--lg ct-avatar-anon" aria-hidden><EyeOff /></span>
              : <Avatar name={fullName(c)} size="lg" />}
            <div style={{ minWidth: 0 }}>
              {c.salutation && <div className="ct-head__salutation">{c.salutation}</div>}
              <h1 className="ct-head__name">{name}</h1>
              {roleLine && <div className="ct-head__role">{roleLine}</div>}
              <div className="ct-head__badges">
                {c.segment && <Badge tone="info">{c.segment}</Badge>}
                {c.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
                <ConsentBadge contact={c} long />
                {c.language === 'en' && <Badge>English</Badge>}
              </div>
            </div>
          </div>
        </div>
        {(can.edit || menu.length > 0) && (
          <div className="ct-head__actions">
            {can.edit && !anonymized && <Button icon={<MailPlus />} onClick={() => setInviting(true)}>Convidar</Button>}
            {can.edit && !anonymized && <Button variant="primary" icon={<Pencil />} onClick={() => setEditing(true)}>Editar</Button>}
            {menu.length > 0 && <ActionMenu items={menu} label="Mais ações" />}
          </div>
        )}
      </header>

      <div className="ui-stack">
        {anonymized && (
          <Alert tone="info">
            Os dados pessoais deste contacto foram apagados a {formatDate(c.anonymized_at)} (direito ao apagamento, RGPD).
            Mantém-se apenas o registo anónimo dos convites, para as estatísticas dos eventos.
          </Alert>
        )}
        {erasureRequest && erasureState && (
          <Alert tone={erasureState.kind === 'overdue' ? 'danger' : 'warning'}>
            <strong>Pedido de eliminação de dados</strong> feito pelo próprio a {formatDateTime(erasureRequest.created_at)}, através do convite.{' '}
            {erasureState.kind === 'overdue'
              ? <>O prazo de resposta terminou a {formatDate(erasureDeadline(erasureRequest.created_at).toISOString())}.{' '}</>
              : <>Prazo de resposta: até {formatDate(erasureDeadline(erasureRequest.created_at).toISOString())} ({deadlineLabel(erasureState).toLowerCase()}).{' '}</>}
            {can.admin
              ? <>Depois de verificar o pedido, use <button type="button" className="ct-link-btn" onClick={() => void onAnonymize()}>Apagar dados pessoais</button>.</>
              : 'Um administrador deve tratar o pedido.'}
          </Alert>
        )}

        <div className="ui-grid-sidebar">
          <div className="ui-stack ui-stack--lg ct-col">
            <Card title="Dados do contacto">
              <DefinitionList items={[
                ['Tratamento', c.salutation],
                ['Nome', anonymized ? null : fullName(c)],
                ['Email', c.email && <a href={`mailto:${c.email}`}>{c.email}</a>],
                ['Telemóvel', c.phone && <a href={`tel:${c.phone}`} className="tabular">{formatPhone(c.phone)}</a>],
                ['Entidade', c.organization],
                ['Cargo', c.job_title],
                ['Segmento', c.segment],
                ['Etiquetas', c.tags.length ? <TagList tags={c.tags} max={20} /> : null],
                ['Idioma dos convites', languageLabel(c.language)],
                ['Responsável', staff.loading ? <Skeleton width={120} /> : staffName(c.owner_id)],
                ['Origem', c.source ? SOURCE[c.source] ?? c.source : null],
                ['Notas', c.notes && <div className="ct-notes">{c.notes}</div>],
                ['Criado', <span title={formatDateTime(c.created_at)}>{formatDate(c.created_at)}</span>],
                ['Atualizado', <span title={formatDateTime(c.updated_at)}>{formatRelative(c.updated_at)}</span>],
              ]} />
            </Card>

            <Card
              title="Convites"
              subtitle={invitations.data ? (invitationCount === 0 ? 'Sem convites' : invitationCount === 1 ? '1 evento' : `${invitationCount} eventos`) : undefined}
              actions={can.edit && !anonymized && invitationCount > 0 ? <Button size="sm" icon={<MailPlus />} onClick={() => setInviting(true)}>Convidar para evento</Button> : undefined}
              padded={false}
            >
              {invitations.error && !invitations.data ? (
                <LoadError error={invitations.error} onRetry={invitations.reload} />
              ) : !invitations.data ? (
                <div className="ui-card__body ui-stack"><Skeleton height={18} /><Skeleton height={18} width="70%" /></div>
              ) : invitationCount === 0 ? (
                <EmptyState icon={<Mail />} title="Ainda não foi convidado para nenhum evento"
                  actions={can.edit && !anonymized ? <Button icon={<MailPlus />} onClick={() => setInviting(true)}>Convidar para evento</Button> : undefined}>
                  Os convites que lhe forem feitos aparecem aqui, com o estado da resposta e a entrada no dia.
                </EmptyState>
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table ct-inv-table">
                    <caption className="visually-hidden">Convites deste contacto</caption>
                    <thead>
                      <tr>
                        <th scope="col">Evento</th>
                        <th scope="col">Data</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Resposta</th>
                        <th scope="col">Entrada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.data.map((inv) => {
                        const st = INVITATION_STATUS[inv.status];
                        return (
                          <tr key={inv.id}>
                            <td className="ct-inv-event">
                              <Link to={`/admin/eventos/${inv.event.id}`} className="primary">{inv.event.name}</Link>
                              {(inv.wave || inv.plus_ones_allowed > 0) && (
                                <div className="secondary">
                                  {[inv.wave, inv.plus_ones_allowed > 0 && `+${inv.plus_ones_allowed} acompanhante${inv.plus_ones_allowed > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </td>
                            <td className="tabular">{formatShortDate(inv.event.starts_at)}</td>
                            <td>
                              <span className="ui-row" style={{ gap: 6 }}>
                                <Badge tone={st.tone} dot>{st.label}</Badge>
                                {approvalApplies(inv) && <ApprovalBadge status={inv.approval_status} />}
                              </span>
                            </td>
                            <td className="tabular" title={formatDateTime(inv.responded_at)}>
                              {inv.responded_at ? formatShortDate(inv.responded_at) : <span className="muted">—</span>}
                            </td>
                            <td className="tabular" title={formatDateTime(inv.checked_in_at)}>
                              {inv.checked_in_at
                                ? <span className="ui-row" style={{ gap: 6 }}><DoorOpen size={14} aria-hidden style={{ color: 'var(--c-success)' }} />{formatTime(inv.checked_in_at)}</span>
                                : <span className="muted">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="ui-stack ui-stack--lg ct-col">
            <ConsentCard contact={c} />
            <TimelineCard
              contact={c}
              activities={activities}
              eventName={(id) => invitations.data?.find((i) => i.event.id === id)?.event.name ?? null}
              staffName={staffName}
              canWrite={can.edit && !anonymized}
            />
          </div>
        </div>
      </div>

      <ContactFormDialog
        open={editing}
        contact={c}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          contact.setData(saved);
          setEditing(false);
        }}
      />
      <InviteToEventDialog
        open={inviting}
        contactIds={[c.id]}
        onClose={() => setInviting(false)}
        onDone={() => {
          invitations.reload();
          activities.reload();
        }}
      />
    </>
  );
}

function ConsentCard({ contact: c }: { contact: Contact }) {
  const yes = c.marketing_consent && !c.anonymized_at;
  return (
    <Card title="Comunicações futuras">
      <div className="ct-consent">
        <div className="ct-consent__status">
          <span className={['ct-consent__icon', yes && 'ct-consent__icon--yes'].filter(Boolean).join(' ')}>
            {yes ? <ShieldCheck aria-hidden /> : <ShieldOff aria-hidden />}
          </span>
          <div>
            <div className="ct-consent__title">
              {c.anonymized_at ? 'Dados apagados' : yes ? 'Aceita receber comunicações' : 'Sem consentimento'}
            </div>
            <div className="ct-consent__date">
              {c.anonymized_at
                ? 'Já não existem dados para contactar esta pessoa.'
                : yes && c.marketing_consent_at
                  ? <>Desde <span title={formatDateTime(c.marketing_consent_at)}>{formatDate(c.marketing_consent_at)}</span></>
                  : 'Só pode receber convites para eventos.'}
            </div>
          </div>
        </div>
        {yes && c.marketing_consent_text && <blockquote className="ct-quote">«{c.marketing_consent_text}»</blockquote>}
        <p className="ct-help">
          O consentimento é dado ou retirado pelo próprio, na página do seu convite, e fica registado com o texto aceite e a data.
          A equipa não o pode alterar.
        </p>
      </div>
    </Card>
  );
}

function TimelineCard({ contact, activities, eventName, staffName, canWrite }: {
  contact: Contact;
  activities: AsyncState<Activity[]>;
  eventName: (id: string) => string | null;
  staffName: (id: string | null) => string | null;
  canWrite: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(TIMELINE_STEP);

  const submit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await api.contacts.addNote(contact.id, text);
      setText('');
      toast.success('Nota acrescentada.');
      activities.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const items = activities.data ?? [];

  return (
    <Card title="Linha do tempo" subtitle="Convites, respostas, entradas e notas da equipa.">
      {canWrite && (
        <div className="ct-composer">
          <label htmlFor="ct-note" className="visually-hidden">Nova nota</label>
          <Textarea id="ct-note" value={text} rows={2} maxLength={2000} placeholder="Escreva uma nota interna…" onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
          <div className="ct-composer__foot">
            <small>Ctrl + Enter para guardar</small>
            <Button size="sm" variant="primary" onClick={() => void submit()} loading={saving} disabled={!text.trim()}>Acrescentar nota</Button>
          </div>
        </div>
      )}
      {activities.error && !activities.data ? (
        <LoadError error={activities.error} onRetry={activities.reload} />
      ) : !activities.data ? (
        <div className="ui-stack"><Skeleton height={16} /><Skeleton height={16} width="80%" /><Skeleton height={16} width="60%" /></div>
      ) : !items.length ? (
        <p className="ct-help">Sem registos.</p>
      ) : (
        <>
          <ol className="ui-timeline ct-timeline">
            {items.slice(0, limit).map((a) => {
              const [Icon, tone] = KIND_ICON[a.kind] ?? [StickyNote, null];
              const event = a.event_id ? eventName(a.event_id) : null;
              const actor = staffName(a.actor_id);
              const wave = a.kind === 'invitation.created' && typeof a.detail.wave === 'string' ? a.detail.wave : null;
              const context = [event, wave, a.channel && CHANNEL[a.channel]].filter(Boolean).join(' · ');
              const note = a.kind === 'note' && typeof a.detail.text === 'string' ? a.detail.text : null;
              return (
                <li key={a.id}>
                  <span className={['ui-timeline__icon', tone && `ui-timeline__icon--${tone}`].filter(Boolean).join(' ')}><Icon aria-hidden /></span>
                  <div className="ct-timeline__body">
                    <div className="ui-timeline__text">
                      <span className="ct-timeline__title">{a.kind === 'note' ? `Nota${actor ? ` de ${actor}` : ''}` : ACTIVITY[a.kind] ?? a.kind}</span>
                      {context && <span className="ct-timeline__ctx"> · {context}</span>}
                    </div>
                    {note && <div className="ct-timeline__note">{note}</div>}
                    <div className="ui-timeline__time">
                      <time dateTime={a.created_at} title={formatDateTime(a.created_at)}>{formatRelative(a.created_at)}</time>
                      {a.kind !== 'note' && actor && <> · {actor}</>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {items.length > limit && (
            <Button variant="ghost" size="sm" block onClick={() => setLimit((l) => l + TIMELINE_STEP * 2)}>
              Mostrar mais ({items.length - limit})
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="ui-stack ui-stack--lg" aria-busy="true" aria-label="A carregar o contacto">
      <div className="ct-head__id">
        <Skeleton width={64} height={64} style={{ borderRadius: '50%' }} />
        <div className="ui-stack" style={{ gap: 8, flex: 1 }}>
          <Skeleton width={240} height={26} />
          <Skeleton width={180} height={14} />
        </div>
      </div>
      <div className="ui-grid-sidebar">
        <Card title="Dados do contacto" className="ct-col"><div className="ui-stack">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={16} width={`${55 + i * 7}%`} />)}</div></Card>
        <Card title="Linha do tempo"><div className="ui-stack"><Skeleton height={16} /><Skeleton height={16} width="70%" /></div></Card>
      </div>
    </div>
  );
}
