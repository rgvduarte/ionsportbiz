import { useMemo, useState } from 'react';
import { CopyPlus, FileText, Mail, MessageCircle, MessageSquare, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import './invitations.css';
import { api, type MessageTemplate } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatRelative } from '../../lib/format';
import { usePermissions } from '../../app/AuthProvider';
import { ActionMenu, Button, Card, EmptyState, LoadError, Skeleton, useConfirm, useToast } from '../../ui';
import { useEventContext } from '../events/EventLayout';
import { TEMPLATE_VARIABLES } from '@shared/template';
import { missingDefaults } from './guestList';
import { TemplateEditor, type EditorTarget } from './TemplateEditor';
import { plural } from './parts';

const GROUPS: { channel: MessageTemplate['channel']; title: string; icon: React.ReactNode; empty: string }[] = [
  { channel: 'email', title: 'Email', icon: <Mail aria-hidden />, empty: 'Sem modelos de email. Sem um modelo não é possível enviar convites por email.' },
  { channel: 'whatsapp', title: 'WhatsApp', icon: <MessageCircle aria-hidden />, empty: 'Sem modelos de WhatsApp. É usado o texto sugerido pela plataforma.' },
  { channel: 'sms', title: 'SMS', icon: <MessageSquare aria-hidden />, empty: '' },
];

const LABELS = new Map(TEMPLATE_VARIABLES.map((v) => [v.key, v.label]));

/** Texto numa linha, com as variáveis como etiquetas legíveis ({{nome}} → «Nome»). */
function Tokens({ text, max = 220 }: { text: string; max?: number }) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const clipped = flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
  const parts = clipped.split(/(\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const key = p.replace(/[{}\s]/g, '').toLowerCase();
        return <span key={i} className="tpl-token" title={`{{${key}}}`}>{LABELS.get(key) ?? key}</span>;
      })}
    </>
  );
}

export function TemplatesPage() {
  const { event } = useEventContext();
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useAsync(() => api.templates.list(event.id), [event.id]);
  // Um convidado real para a pré-visualização (se a lista não carregar, usa-se um exemplo fictício).
  const guests = useAsync(() => api.invitations.list(event.id).catch(() => []), [event.id]);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const templates = useMemo(() => list.data ?? [], [list.data]);
  const previewGuests = useMemo(() => (guests.data ?? []).filter((g) => g.status !== 'cancelled').slice(0, 40), [guests.data]);

  const onSaved = (saved: MessageTemplate, isNew: boolean) => {
    list.setData((prev) => {
      const rest = (prev ?? []).filter((t) => t.id !== saved.id);
      return [...rest, saved];
    });
    list.reload();
    setEditing(null);
    toast.success(isNew ? 'Modelo criado.' : 'Modelo guardado.');
  };

  const onDelete = async (t: MessageTemplate) => {
    const ok = await confirm({
      title: 'Eliminar modelo?',
      message: <>O modelo <strong>{t.name}</strong> deixa de estar disponível para envios. Os convites já enviados não são afetados.</>,
      confirmLabel: 'Eliminar modelo',
      danger: true,
    });
    if (!ok) return false;
    try {
      await api.templates.remove(t.id);
      list.setData((prev) => (prev ?? []).filter((x) => x.id !== t.id));
      toast.success('Modelo eliminado.');
      setEditing(null);
      return true;
    } catch (err) {
      toast.error(err);
      return false;
    }
  };

  const onDuplicate = async (t: MessageTemplate) => {
    try {
      const copy = await api.templates.save({ event_id: t.event_id, channel: t.channel, name: `${t.name} (cópia)`.slice(0, 120), subject: t.subject, body: t.body });
      list.setData((prev) => [...(prev ?? []), copy]);
      list.reload();
      toast.success('Modelo duplicado.');
      setEditing({ template: copy });
    } catch (err) {
      toast.error(err);
    }
  };

  const createDefaults = async () => {
    setCreating(true);
    try {
      const missing = missingDefaults(templates, event);
      for (const t of missing) await api.templates.save({ ...t, event_id: event.id });
      toast.success(missing.length === 1 ? 'Modelo sugerido criado.' : 'Modelos sugeridos criados. Reveja-os antes do primeiro envio.');
      list.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setCreating(false);
    }
  };

  const groups = GROUPS.filter((g) => g.channel !== 'sms' || templates.some((t) => t.channel === 'sms'));
  const missingSuggested = missingDefaults(templates, event).length;

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <Card><LoadError error={list.error} onRetry={list.reload} /></Card>;
  } else if (!list.data) {
    body = (
      <Card>
        <div className="ui-stack" aria-busy="true" aria-label="A carregar os modelos">
          {[0, 1, 2].map((i) => <div key={i}><Skeleton width="30%" height={16} /><Skeleton width="80%" style={{ marginTop: 8 }} /></div>)}
        </div>
      </Card>
    );
  } else if (!templates.length) {
    body = (
      <Card>
        <EmptyState
          icon={<FileText />}
          title="Ainda não há modelos de mensagem"
          actions={can.edit && (
            <>
              <Button variant="primary" icon={<Sparkles />} loading={creating} onClick={() => void createDefaults()}>Criar modelos sugeridos</Button>
              <Button icon={<Plus />} onClick={() => setEditing({ channel: 'email', blank: true })}>Escrever de raiz</Button>
            </>
          )}
        >
          <span className="inv-measure">
            {can.edit
              ? 'Comece pelos modelos sugeridos — o convite (email e WhatsApp) e o aviso «Credencial pronta», para quando a equipa aprova — já adaptados aos dados deste evento. Pode revê-los e alterá-los antes de enviar.'
              : 'A equipa ainda não preparou as mensagens deste evento.'}
          </span>
        </EmptyState>
      </Card>
    );
  } else {
    body = (
      <div className="tpl-groups">
        {groups.map((g) => {
          const items = templates.filter((t) => t.channel === g.channel);
          return (
            <Card
              key={g.channel}
              padded={false}
              title={<span className="tpl-group__title">{g.icon}{g.title}</span>}
              subtitle={plural(items.length, 'modelo', 'modelos')}
              actions={can.edit && g.channel !== 'sms' && (
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setEditing({ channel: g.channel })}>Novo</Button>
              )}
            >
              {items.length ? (
                <ul className="tpl-list">
                  {items.map((t) => (
                    <li key={t.id} className="tpl-item">
                      <button type="button" className="tpl-item__main" onClick={() => setEditing({ template: t })}>
                        <span className="tpl-item__name">{t.name}</span>
                        {t.subject && <span className="tpl-item__subject"><Tokens text={t.subject} /></span>}
                        <span className="tpl-item__excerpt"><Tokens text={t.body} /></span>
                        <span className="tpl-item__meta">Atualizado {formatRelative(t.updated_at)}</span>
                      </button>
                      {can.edit && (
                        <ActionMenu
                          label={`Ações do modelo ${t.name}`}
                          items={[
                            { label: 'Editar', icon: <Pencil />, onSelect: () => setEditing({ template: t }) },
                            { label: 'Duplicar', icon: <CopyPlus />, onSelect: () => void onDuplicate(t) },
                            { label: 'Eliminar', icon: <Trash2 />, onSelect: () => void onDelete(t), danger: true, separator: true },
                          ]}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="tpl-empty">
                  <p>{g.empty}</p>
                  {can.edit && <Button size="sm" icon={<Plus />} onClick={() => setEditing({ channel: g.channel })}>Criar modelo de {g.title}</Button>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="inv-head">
        <div className="inv-head__text">
          <h2>Mensagens</h2>
          <p>Modelos dos envios deste evento. As variáveis, como {'{{nome}}'} ou {'{{link}}'}, são substituídas pelos dados de cada convidado.</p>
        </div>
        {can.edit && list.data && templates.length > 0 && (
          <div className="inv-head__actions">
            {missingSuggested > 0 && (
              <Button icon={<Sparkles />} loading={creating} onClick={() => void createDefaults()}>{missingSuggested === 1 ? 'Criar modelo sugerido' : `Criar ${missingSuggested} modelos sugeridos`}</Button>
            )}
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ channel: 'email' })}>Novo modelo</Button>
          </div>
        )}
      </div>

      <div className="tpl-channels">
        <div className="tpl-channel">
          <span className="tpl-channel__icon"><Mail aria-hidden /></span>
          <div>
            <h3>Email</h3>
            <p>Enviado pela plataforma, a partir do remetente institucional, em lote ou individualmente. Cada convidado recebe o seu link pessoal num botão «Abrir o convite».</p>
          </div>
        </div>
        <div className="tpl-channel">
          <span className="tpl-channel__icon tpl-channel__icon--wa"><MessageCircle aria-hidden /></span>
          <div>
            <h3>WhatsApp</h3>
            <p>Abre o WhatsApp de quem envia, com a mensagem já escrita, um convidado de cada vez, a partir da ficha do convidado. O envio é confirmado no próprio WhatsApp.</p>
          </div>
        </div>
      </div>

      {body}

      {editing && (
        <TemplateEditor
          target={editing}
          event={event}
          guests={previewGuests}
          readOnly={!can.edit}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
