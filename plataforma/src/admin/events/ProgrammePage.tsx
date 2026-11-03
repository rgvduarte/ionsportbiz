import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarClock, MapPin, Mic, Pencil, Plus, Trash2 } from 'lucide-react';
import './events.css';
import { api, type EventRecord, type EventSession } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatLongDate, formatTime, fromLocalInput, toLocalInput } from '../../lib/format';
import { usePermissions } from '../../app/AuthProvider';
import { ActionMenu, Button, Card, Dialog, EmptyState, Field, Input, LoadError, Skeleton, Textarea, useConfirm, useToast } from '../../ui';
import { useEventContext } from './EventLayout';
import { timezoneCity } from './eventForm';

const ts = (iso: string) => new Date(iso).getTime();
const byStart = (a: EventSession, b: EventSession) => ts(a.starts_at) - ts(b.starts_at);

interface Day {
  key: string;
  label: string;
  sessions: EventSession[];
}

function groupByDay(sessions: EventSession[], tz: string): Day[] {
  const days = new Map<string, Day>();
  for (const s of [...sessions].sort(byStart)) {
    const key = toLocalInput(s.starts_at, tz).slice(0, 10);
    const label = formatLongDate(s.starts_at, tz);
    const day = days.get(key) ?? { key, label: label.charAt(0).toUpperCase() + label.slice(1), sessions: [] };
    day.sessions.push(s);
    days.set(key, day);
  }
  return [...days.values()];
}

export function ProgrammePage() {
  const { event } = useEventContext();
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload, setData } = useAsync(() => api.events.sessions(event.id), [event.id]);
  const [editing, setEditing] = useState<EventSession | 'new' | null>(null);
  const tz = event.timezone;
  const city = timezoneCity(tz);

  const sessions = data ?? [];
  const days = useMemo(() => groupByDay(data ?? [], tz), [data, tz]);

  const onSaved = (saved: EventSession, isNew: boolean) => {
    setData((prev) => [...(prev ?? []).filter((s) => s.id !== saved.id), saved].sort(byStart));
    setEditing(null);
    toast.success(isNew ? 'Sessão adicionada ao programa.' : 'Sessão atualizada.');
  };

  const onDelete = async (s: EventSession) => {
    const ok = await confirm({
      title: 'Eliminar sessão?',
      message: <>A sessão <strong>{s.title}</strong> deixa de aparecer no programa do convite. Esta ação não pode ser anulada.</>,
      confirmLabel: 'Eliminar sessão',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.events.removeSession(s.id);
      setData((prev) => (prev ?? []).filter((x) => x.id !== s.id));
      toast.success('Sessão eliminada.');
    } catch (err) {
      toast.error(err);
    }
  };

  const first = sessions[0];
  const lastEnd = sessions.reduce<string | null>((max, s) => {
    const end = s.ends_at ?? s.starts_at;
    return !max || ts(end) > ts(max) ? end : max;
  }, null);

  let body: React.ReactNode;
  if (error) {
    body = <Card><LoadError error={error} onRetry={reload} /></Card>;
  } else if (loading && !data) {
    body = (
      <Card>
        <div className="ui-stack" aria-busy="true" aria-label="A carregar o programa">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 20 }}>
              <Skeleton width={80} height={18} />
              <div style={{ flex: 1 }}><Skeleton width="50%" height={18} /><Skeleton width="30%" style={{ marginTop: 8 }} /></div>
            </div>
          ))}
        </div>
      </Card>
    );
  } else if (!sessions.length) {
    body = (
      <Card>
        <EmptyState
          icon={<CalendarClock />}
          title="O programa ainda não tem sessões"
          actions={can.edit && <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>Adicionar primeira sessão</Button>}
        >
          <span className="ev-measure">
            O programa aparece na página do convite, por ordem cronológica e com a hora de {city}.
            {can.edit && ' Indique a receção, os momentos principais e o encerramento.'}
          </span>
        </EmptyState>
      </Card>
    );
  } else {
    body = (
      <div className="prg-days">
        {days.map((day) => (
          <Card
            key={day.key}
            padded={false}
            title={<span className="prg-day__title">{day.label}<span className="prg-day__count">{day.sessions.length === 1 ? '1 sessão' : `${day.sessions.length} sessões`}</span></span>}
          >
            <ol className="prg-list">
              {day.sessions.map((s, i) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  event={event}
                  previous={i > 0 ? day.sessions[i - 1] : undefined}
                  canEdit={can.edit}
                  onEdit={() => setEditing(s)}
                  onDelete={() => void onDelete(s)}
                />
              ))}
            </ol>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="prg-head">
        <div className="prg-head__text">
          <h2>Programa</h2>
          <p>
            {first && lastEnd
              ? `${sessions.length === 1 ? '1 sessão' : `${sessions.length} sessões`} · ${formatTime(first.starts_at, tz)}–${formatTime(lastEnd, tz)} (hora de ${city}) · visível na página do convite`
              : 'As sessões aparecem na página do convite de cada convidado.'}
          </p>
        </div>
        {can.edit && sessions.length > 0 && (
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>Adicionar sessão</Button>
        )}
      </div>
      {body}
      {editing && (
        <SessionDialog
          event={event}
          session={editing === 'new' ? null : editing}
          sessions={sessions}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function SessionItem({ session: s, event, previous, canEdit, onEdit, onDelete }: {
  session: EventSession;
  event: EventRecord;
  previous?: EventSession;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tz = event.timezone;
  const overlaps = previous?.ends_at && ts(s.starts_at) < ts(previous.ends_at);
  return (
    <li className="prg-item">
      <div className="prg-item__time">
        <time dateTime={s.starts_at}>{formatTime(s.starts_at, tz)}</time>
        {s.ends_at && <small>até <time dateTime={s.ends_at}>{formatTime(s.ends_at, tz)}</time></small>}
      </div>
      <div className="prg-item__rail" aria-hidden><span className="prg-item__dot" /></div>
      <div className="prg-item__body">
        <div className="prg-item__title">{s.title}</div>
        {(s.location || s.speakers) && (
          <div className="prg-item__meta">
            {s.location && <span><MapPin aria-hidden /><span className="visually-hidden">Local: </span>{s.location}</span>}
            {s.speakers && <span><Mic aria-hidden /><span className="visually-hidden">Oradores: </span>{s.speakers}</span>}
          </div>
        )}
        {s.description && <p className="prg-item__desc">{s.description}</p>}
        {canEdit && overlaps && (
          <div className="prg-warn"><AlertTriangle aria-hidden />Começa antes do fim da sessão anterior ({previous!.title}).</div>
        )}
      </div>
      <div className="prg-item__actions">
        {canEdit && (
          <ActionMenu
            label={`Ações para ${s.title}`}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: onEdit },
              { label: 'Eliminar', icon: <Trash2 />, onSelect: onDelete, danger: true, separator: true },
            ]}
          />
        )}
      </div>
    </li>
  );
}

const plusMinutes = (iso: string, minutes: number) => new Date(ts(iso) + minutes * 60_000).toISOString();

function SessionDialog({ event, session, sessions, onClose, onSaved }: {
  event: EventRecord;
  session: EventSession | null;
  sessions: EventSession[];
  onClose: () => void;
  onSaved: (s: EventSession, isNew: boolean) => void;
}) {
  const tz = event.timezone;
  const [values, setValues] = useState(() => {
    if (session) {
      return {
        title: session.title,
        starts_at: toLocalInput(session.starts_at, tz),
        ends_at: toLocalInput(session.ends_at, tz),
        location: session.location ?? '',
        speakers: session.speakers ?? '',
        description: session.description ?? '',
      };
    }
    // Por omissão: logo a seguir à última sessão, ou à hora de início do evento.
    const last = [...sessions].sort((a, b) => ts(b.ends_at ?? b.starts_at) - ts(a.ends_at ?? a.starts_at))[0];
    const start = last ? (last.ends_at ?? plusMinutes(last.starts_at, 30)) : event.starts_at;
    return { title: '', starts_at: toLocalInput(start, tz), ends_at: toLocalInput(plusMinutes(start, 30), tz), location: '', speakers: '', description: '' };
  });
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const startIso = values.starts_at ? fromLocalInput(values.starts_at, tz) : null;
  const endIso = values.ends_at ? fromLocalInput(values.ends_at, tz) : null;
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = 'Indique o título da sessão.';
  else if (values.title.trim().length > 200) errors.title = 'O título pode ter no máximo 200 caracteres.';
  if (!startIso) errors.starts_at = 'Indique a hora de início.';
  if (startIso && endIso && ts(endIso) < ts(startIso)) errors.ends_at = 'O fim não pode ser anterior ao início.';
  const show = (k: string) => (submitted ? errors[k] : undefined);

  let notice: string | null = null;
  if (startIso && ts(startIso) < ts(event.starts_at)) notice = 'Esta sessão começa antes do início do evento.';
  else if (startIso && event.ends_at && ts(startIso) > ts(event.ends_at)) notice = 'Esta sessão começa depois do fim do evento.';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const saved = await api.events.saveSession({
        ...(session ? { id: session.id } : {}),
        event_id: event.id,
        title: values.title.trim(),
        starts_at: startIso!,
        ends_at: endIso,
        location: values.location.trim() || null,
        speakers: values.speakers.trim() || null,
        description: values.description.trim() || null,
      });
      onSaved(saved, !session);
    } catch (err) {
      // O diálogo continua aberto para não perder o que foi escrito.
      setSaving(false);
      toast.error(err);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={session ? 'Editar sessão' : 'Nova sessão'}
      description={`Horas de ${timezoneCity(tz)}, o fuso do evento.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="prg-session-form" loading={saving}>
            {session ? 'Guardar alterações' : 'Adicionar sessão'}
          </Button>
        </>
      }
    >
      <form id="prg-session-form" className="prg-form" onSubmit={onSubmit} noValidate>
        <Field label="Título" required error={show('title')} className="span-2">
          <Input value={values.title} onChange={set('title')} maxLength={200} placeholder="Ex.: Receção e cocktail de boas-vindas" autoFocus />
        </Field>
        <Field label="Início" required error={show('starts_at')}>
          <Input type="datetime-local" value={values.starts_at} onChange={set('starts_at')} />
        </Field>
        <Field label="Fim" error={show('ends_at')} hint="Opcional.">
          <Input type="datetime-local" value={values.ends_at} onChange={set('ends_at')} min={values.starts_at || undefined} />
        </Field>
        {notice && <div className="span-2 prg-warn" role="status"><AlertTriangle aria-hidden />{notice}</div>}
        <Field label="Local" hint="Sala ou espaço, se o evento tiver vários.">
          <Input value={values.location} onChange={set('location')} placeholder="Ex.: Salão Nobre" />
        </Field>
        <Field label="Oradores" hint="Separe os nomes por vírgulas.">
          <Input value={values.speakers} onChange={set('speakers')} placeholder="Ex.: Prof.ª Helena Barros" />
        </Field>
        <Field label="Descrição" className="span-2" hint="Aparece por baixo do título, na página do convite.">
          <Textarea value={values.description} onChange={set('description')} rows={3} />
        </Field>
      </form>
    </Dialog>
  );
}
