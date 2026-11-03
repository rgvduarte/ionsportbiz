import { Link, Outlet, useOutletContext, useParams } from 'react-router';
import { CalendarDays, ChevronLeft, Mail, MapPin, Settings, ListChecks, Users } from 'lucide-react';
import { api, type EventRecord } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatLongDate, formatTime } from '../../lib/format';
import { EVENT_STATUS } from '../../lib/status';
import { Badge, LoadError, Loader, RouteTabs } from '../../ui';
import { usePermissions } from '../../app/AuthProvider';

export interface EventContext {
  event: EventRecord;
  /** Atualiza o evento no cabeçalho depois de gravar. */
  setEvent: (e: EventRecord) => void;
  reload: () => void;
}

/** Dados do evento para as páginas dentro de /admin/eventos/:eventId. */
export function useEventContext(): EventContext {
  return useOutletContext<EventContext>();
}

export function EventLayout() {
  const { eventId = '' } = useParams();
  const can = usePermissions();
  const { data: event, error, loading, reload, setData } = useAsync(() => api.events.get(eventId), [eventId]);

  if (loading && !event) return <Loader />;
  if (error || !event) return <LoadError error={error} onRetry={reload} />;

  const base = `/admin/eventos/${event.id}`;
  const status = EVENT_STATUS[event.status];
  return (
    <>
      <div className="evt-head">
        <div>
          <Link to="/admin/eventos" className="ui-page-header__back"><ChevronLeft aria-hidden />Eventos</Link>
          <h1 className="ui-page-header__title">{event.name}</h1>
          <div className="evt-head__meta">
            <span><CalendarDays aria-hidden />{formatLongDate(event.starts_at, event.timezone)}, {formatTime(event.starts_at, event.timezone)}</span>
            {event.venue_name && <span><MapPin aria-hidden />{event.venue_name}</span>}
            <Badge tone={status.tone} dot title={status.hint}>{status.label}</Badge>
          </div>
        </div>
      </div>
      <RouteTabs
        tabs={[
          { to: base, label: 'Convidados', icon: <Users />, end: true },
          { to: `${base}/programa`, label: 'Programa', icon: <ListChecks /> },
          { to: `${base}/mensagens`, label: 'Mensagens', icon: <Mail /> },
          ...(can.edit ? [{ to: `${base}/definicoes`, label: 'Definições', icon: <Settings /> }] : []),
        ]}
      />
      <Outlet context={{ event, setEvent: setData, reload } satisfies EventContext} />
    </>
  );
}
