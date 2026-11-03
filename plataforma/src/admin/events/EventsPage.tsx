import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Archive, CalendarDays, CalendarPlus, ChevronRight, History, MapPin, Plus, SearchX } from 'lucide-react';
import './events.css';
import { api, type EventRecord } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatLongDate, formatNumber, formatPercent, formatTime } from '../../lib/format';
import { EVENT_STATUS } from '../../lib/status';
import { usePermissions } from '../../app/AuthProvider';
import { Badge, Button, ButtonLink, EmptyState, LoadError, PageHeader, Progress, SearchInput, Skeleton, Tabs } from '../../ui';

type View = 'proximos' | 'anteriores' | 'arquivados';

// Sem hora de fim, o evento conta como "próximo" até 6 horas depois do início.
const OPEN_ENDED_MS = 6 * 3_600_000;

function viewOf(e: EventRecord, now: number): View {
  if (e.status === 'archived') return 'arquivados';
  const end = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + OPEN_ENDED_MS;
  return end >= now ? 'proximos' : 'anteriores';
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function EventsPage() {
  const can = usePermissions();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useAsync(() => api.events.list(), []);

  const groups = useMemo(() => {
    const now = Date.now();
    const g: Record<View, EventRecord[]> = { proximos: [], anteriores: [], arquivados: [] };
    for (const e of data ?? []) g[viewOf(e, now)].push(e);
    // Próximos: o mais perto primeiro. Restantes: o mais recente primeiro.
    g.proximos.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return g;
  }, [data]);

  const requested = params.get('vista') as View | null;
  const view: View = requested && requested in groups
    ? requested
    : groups.proximos.length || !groups.anteriores.length ? 'proximos' : 'anteriores';
  const setView = useCallback((v: View) => setParams({ vista: v }, { replace: true }), [setParams]);

  const term = normalize(search.trim());
  const rows = groups[view].filter((e) => !term || normalize(`${e.name} ${e.venue_name ?? ''} ${e.slug}`).includes(term));
  const total = data?.length ?? 0;

  const newButton = can.edit && (
    <ButtonLink to="/admin/eventos/novo" variant="primary" icon={<Plus />}>Novo evento</ButtonLink>
  );

  let body: React.ReactNode;
  if (error) {
    body = <LoadError error={error} onRetry={reload} />;
  } else if (loading && !data) {
    body = <ul className="evl-list" aria-busy="true" aria-label="A carregar eventos">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</ul>;
  } else if (!total) {
    body = (
      <div className="evl-empty">
        <EmptyState
          icon={<CalendarPlus />}
          title="Ainda não há eventos"
          actions={can.edit && <ButtonLink to="/admin/eventos/novo" variant="primary" icon={<Plus />}>Criar primeiro evento</ButtonLink>}
        >
          <span className="ev-measure">
            {can.edit
              ? 'Crie um evento para definir a data, o local e o formulário de resposta. Depois, convide os contactos do CRM.'
              : 'Quando a equipa criar um evento, este aparece aqui.'}
          </span>
        </EmptyState>
      </div>
    );
  } else if (!rows.length && term) {
    body = (
      <div className="evl-empty">
        <EmptyState icon={<SearchX />} title="Nenhum evento encontrado" actions={<Button onClick={() => setSearch('')}>Limpar pesquisa</Button>}>
          Não há eventos {VIEW_LABEL[view].toLowerCase()} com “{search.trim()}”.
        </EmptyState>
      </div>
    );
  } else if (!rows.length) {
    body = <div className="evl-empty"><ViewEmpty view={view} canEdit={can.edit} onView={setView} /></div>;
  } else {
    body = (
      <ul className="evl-list">
        {rows.map((e) => <EventRow key={e.id} event={e} />)}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="Eventos"
        description="Datas, locais, estado e respostas de todos os eventos."
        actions={newButton}
      />
      {(total > 0 || loading) && (
        <div className="evl-toolbar">
          <Tabs<View>
            value={view}
            onChange={setView}
            tabs={(Object.keys(VIEW_LABEL) as View[]).map((v) => ({
              value: v,
              label: <>{VIEW_LABEL[v]}{data && <span className="evl-count">{groups[v].length}</span>}</>,
            }))}
          />
          {total > 5 && (
            <SearchInput value={search} onSearch={setSearch} placeholder="Pesquisar eventos…" className="evl-search" />
          )}
        </div>
      )}
      {body}
    </>
  );
}

const VIEW_LABEL: Record<View, string> = { proximos: 'Próximos', anteriores: 'Anteriores', arquivados: 'Arquivados' };

function ViewEmpty({ view, canEdit, onView }: { view: View; canEdit: boolean; onView: (v: View) => void }) {
  if (view === 'proximos') {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Sem eventos agendados"
        actions={<>
          {canEdit && <ButtonLink to="/admin/eventos/novo" variant="primary" icon={<Plus />}>Novo evento</ButtonLink>}
          <Button onClick={() => onView('anteriores')}>Ver anteriores</Button>
        </>}
      >
        Não há eventos com data futura.
      </EmptyState>
    );
  }
  if (view === 'anteriores') {
    return (
      <EmptyState icon={<History />} title="Sem eventos anteriores">
        Os eventos passam para esta lista depois da hora de fim.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={<Archive />} title="Sem eventos arquivados">
      <span className="ev-measure">
        Arquive um evento nas definições quando já não precisar dele no dia a dia. Os links dos convidados deixam de funcionar,
        mas o histórico mantém-se.
      </span>
    </EmptyState>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function monthShort(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: tz }).format(new Date(iso)).replace('.', '');
}

function dayOfMonth(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', timeZone: tz }).format(new Date(iso));
}

function yearOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('pt-PT', { year: 'numeric', timeZone: tz }).format(new Date(iso));
}

function EventRow({ event }: { event: EventRecord }) {
  const stats = useAsync(() => api.events.stats(event.id), [event.id]);
  const status = EVENT_STATUS[event.status];
  const tz = event.timezone;
  const s = stats.data;
  const capacity = s?.capacity ?? event.capacity;
  return (
    <li>
      <Link to={`/admin/eventos/${event.id}`} className="evl-row">
        <div className="evl-date" aria-hidden>
          <span className="evl-date__month">{monthShort(event.starts_at, tz)}</span>
          <span className="evl-date__day">{dayOfMonth(event.starts_at, tz)}</span>
          <span className="evl-date__year">{yearOf(event.starts_at, tz)}</span>
        </div>
        <div className="evl-main">
          <div className="evl-title">
            <span className="evl-name">{event.name}</span>
            <Badge tone={status.tone} dot title={status.hint}>{status.label}</Badge>
          </div>
          <div className="evl-meta">
            <span><CalendarDays aria-hidden />{capitalize(formatLongDate(event.starts_at, tz))}, {formatTime(event.starts_at, tz)}</span>
            {event.venue_name && <span><MapPin aria-hidden />{event.venue_name}</span>}
          </div>
        </div>
        <div className="evl-numbers">
          <div className="evl-num">
            <span className="evl-num__label">Convidados</span>
            {s ? <span className="evl-num__value">{formatNumber(s.invited)}</span>
              : stats.error ? <span className="evl-num__value muted">—</span> : <Skeleton width={36} height={20} />}
          </div>
          <div className="evl-num">
            <span className="evl-num__label" title="Convidados que já aceitaram ou recusaram, em relação aos convites enviados">Responderam</span>
            {s ? (
              <span className="evl-num__value">
                {formatNumber(s.responded)}
                {s.delivered > 0 && <small> · {formatPercent(s.responded, s.delivered)}</small>}
              </span>
            ) : stats.error ? <span className="evl-num__value muted">—</span> : <Skeleton width={56} height={20} />}
          </div>
          <div className="evl-num evl-num--capacity">
            <span className="evl-num__label" title="Lugares ocupados: pessoas confirmadas, incluindo acompanhantes">Lugares</span>
            {s ? (
              <>
                <span className="evl-num__value">
                  {formatNumber(s.expected_attendees)}
                  <small>{capacity ? ` / ${formatNumber(capacity)}` : ' · sem lotação'}</small>
                </span>
                {capacity ? <Progress value={s.expected_attendees / capacity} color={s.expected_attendees > capacity ? 'var(--c-danger)' : undefined} /> : null}
              </>
            ) : stats.error ? <span className="evl-num__value muted">—</span> : (
              <><Skeleton width={64} height={20} /><Skeleton height={8} style={{ marginTop: 8 }} /></>
            )}
          </div>
        </div>
        <ChevronRight className="evl-chevron" aria-hidden />
      </Link>
    </li>
  );
}

function RowSkeleton() {
  return (
    <li className="evl-row evl-row--skeleton">
      <Skeleton width={56} height={64} />
      <div className="evl-main">
        <Skeleton width="45%" height={18} />
        <Skeleton width="70%" style={{ marginTop: 10 }} />
      </div>
      <div className="evl-numbers">
        <Skeleton width={70} height={36} />
        <Skeleton width={70} height={36} />
        <Skeleton width={120} height={36} />
      </div>
    </li>
  );
}
