import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle, BadgeCheck, Ban, CalendarDays, CalendarPlus, CheckCircle2, Clock, Eye, Info, ListChecks, MailPlus,
  MapPin, RotateCcw, ScanLine, Send, Settings, ShieldCheck, ShieldOff, ShieldX, StickyNote, Ticket, Upload, UserPlus, Users, XCircle,
} from 'lucide-react';
import './dashboard.css';
import { api, type Activity, type EventRecord, type EventStats } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatDateTime, formatLongDate, formatNumber, formatPercent, formatRelative, formatShortDate, formatTime, fullName, toLocalInput } from '../../lib/format';
import { ACTIVITY, EVENT_STATUS, INVITATION_STATUS } from '../../lib/status';
import { usePermissions } from '../../app/AuthProvider';
import { Badge, ButtonLink, Card, EmptyState, LoadError, PageHeader, Select, Skeleton, Stat } from '../../ui';
import { AnimatedCounter } from '../../lib/motion/AnimatedCounter';
import { useCurrentEvent } from '../useCurrentEvent';
import { passColor, PassDot } from '../passes';
import { approvalListUrl } from '../invitations/approval';
import {
  attendeesLine, breakdownLines, breakdownTotal, calendarDaysUntil, channelPhrase, eventPhase, funnel, passTypeLines, showCheckins,
  type ActiveStatus, type BreakdownLine,
} from './metrics';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function DashboardPage() {
  const can = usePermissions();
  const { events, loading, error, reload, current, select } = useCurrentEvent();

  if (error) {
    return (
      <>
        <PageHeader title="Painel" />
        <LoadError error={error} onRetry={reload} />
      </>
    );
  }
  if (loading && !events.length) {
    return (
      <>
        <PageHeader title="Painel" description="Respostas, envios e entradas do evento em foco." />
        <DashboardSkeleton />
      </>
    );
  }
  if (!current) {
    return (
      <>
        <PageHeader title="Painel" />
        <Card>
          <EmptyState
            icon={<CalendarPlus />}
            title="Bem-vindo à plataforma de convites"
            actions={can.edit && (
              <>
                <ButtonLink to="/admin/eventos/novo" variant="primary" icon={<CalendarPlus />}>Criar primeiro evento</ButtonLink>
                <ButtonLink to="/admin/contactos/importar" icon={<Upload />}>Importar contactos</ButtonLink>
              </>
            )}
          >
            <span className="dash-measure">
              {can.edit
                ? 'Comece por criar um evento — data, local, texto do convite e formulário de resposta. Depois escolha os contactos a convidar e acompanhe aqui as respostas.'
                : 'Ainda não há eventos. Quando a equipa criar um evento, o resumo aparece aqui.'}
            </span>
          </EmptyState>
        </Card>
      </>
    );
  }

  const options = events
    .filter((e) => e.status !== 'archived' || e.id === current.id)
    .map((e) => ({ value: e.id, label: `${e.name} · ${formatShortDate(e.starts_at, e.timezone)}` }));
  // No dia do evento a ação principal é o check-in; antes e depois, a lista de convidados.
  const phase = eventPhase(current);
  const doorDay = phase === 'today' || phase === 'live';

  return (
    <>
      <div className="dash-head">
        <div className="dash-head__title">
          <h1 className="ui-page-header__title">Painel</h1>
          <p className="ui-page-header__desc">Respostas, envios e entradas do evento em foco.</p>
        </div>
        <div className="dash-head__actions">
          <label className="dash-switch">
            <span className="visually-hidden">Evento em foco</span>
            <CalendarDays aria-hidden />
            <Select value={current.id} options={options} onChange={(e) => select(e.target.value)} />
          </label>
          {can.checkIn && !doorDay && <ButtonLink to="/admin/check-in" icon={<ScanLine />}>Abrir check-in</ButtonLink>}
          <ButtonLink to={`/admin/eventos/${current.id}`} variant={doorDay && can.checkIn ? 'secondary' : 'primary'} icon={<Users />}>
            Ver convidados
          </ButtonLink>
          {can.checkIn && doorDay && <ButtonLink to="/admin/check-in" variant="primary" icon={<ScanLine />}>Abrir check-in</ButtonLink>}
        </div>
      </div>
      <EventDashboard key={current.id} event={current} />
    </>
  );
}

// ───────── Painel de um evento ─────────

function EventDashboard({ event }: { event: EventRecord }) {
  const stats = useAsync(() => api.events.stats(event.id), [event.id]);
  const s = stats.data;

  return (
    <div className="dash">
      <Hero event={event} />
      {stats.error && !s ? (
        <Card><LoadError error={stats.error} onRetry={stats.reload} /></Card>
      ) : !s ? (
        <StatsSkeleton />
      ) : (
        <>
          <Kpis event={event} s={s} />
          <div className="dash-grid">
            <div className="dash-col">
              <FunnelCard s={s} />
              <BreakdownCard title="Por vaga" empty="Sem vaga" lines={breakdownLines(s.by_wave.map((w) => ({ ...w, name: w.wave })))} column="Vaga" />
              <BreakdownCard title="Por segmento" empty="Sem segmento" lines={breakdownLines(s.by_segment.map((w) => ({ ...w, name: w.segment })))} column="Segmento" />
            </div>
            <div className="dash-col">
              <ApprovalCard event={event} s={s} />
              <AttentionCard event={event} s={s} />
              <ActivityCard event={event} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ───────── Cabeçalho do evento e contagem decrescente ─────────

function Hero({ event }: { event: EventRecord }) {
  const can = usePermissions();
  const tz = event.timezone;
  const status = EVENT_STATUS[event.status];
  const phase = eventPhase(event);
  const days = calendarDaysUntil(event.starts_at, tz);
  const base = `/admin/eventos/${event.id}`;

  let countLabel: string;
  let countValue: string;
  if (phase === 'upcoming') {
    countLabel = days === 1 ? 'Falta' : 'Faltam';
    countValue = days === 1 ? '1 dia' : `${formatNumber(days)} dias`;
  } else if (phase === 'today') {
    countLabel = 'É hoje';
    countValue = `às ${formatTime(event.starts_at, tz)}`;
  } else if (phase === 'live') {
    countLabel = 'A decorrer';
    countValue = `desde as ${formatTime(event.starts_at, tz)}`;
  } else {
    countLabel = 'Realizou-se';
    countValue = formatRelative(event.ends_at ?? event.starts_at);
  }

  return (
    <section className="dash-hero" aria-label="Evento em foco">
      <div className="dash-hero__main">
        <div className="dash-hero__eyebrow">
          <Badge tone={status.tone} dot title={status.hint}>{status.label}</Badge>
          <span>{status.hint}</span>
        </div>
        <h2 className="dash-hero__name"><Link to={base}>{event.name}</Link></h2>
        <div className="dash-hero__meta">
          <span><CalendarDays aria-hidden />{capitalize(formatLongDate(event.starts_at, tz))}, {formatTime(event.starts_at, tz)}
            {event.ends_at && (toLocalInput(event.ends_at, tz).slice(0, 10) === toLocalInput(event.starts_at, tz).slice(0, 10)
              ? `–${formatTime(event.ends_at, tz)}`
              : ` a ${formatLongDate(event.ends_at, tz)}, ${formatTime(event.ends_at, tz)}`)}</span>
          {event.venue_name && <span><MapPin aria-hidden />{event.venue_name}</span>}
        </div>
        <div className="dash-hero__links">
          <Link to={`${base}/programa`}><ListChecks aria-hidden />Programa</Link>
          <Link to={`${base}/acessos`}><Ticket aria-hidden />Acessos</Link>
          <Link to={`${base}/mensagens`}><MailPlus aria-hidden />Mensagens</Link>
          {can.edit && <Link to={`${base}/definicoes`}><Settings aria-hidden />Definições</Link>}
        </div>
      </div>
      <div className="dash-hero__side">
        <div className="dash-count" role="group" aria-label={`${countLabel} ${countValue}`}>
          <div className="dash-count__label" aria-hidden>{countLabel}</div>
          <div className="dash-count__value" aria-hidden>{countValue}</div>
        </div>
        {phase !== 'past' && <Deadline event={event} />}
      </div>
    </section>
  );
}

function Deadline({ event }: { event: EventRecord }) {
  const tz = event.timezone;
  if (!event.rsvp_deadline) {
    return <div className="dash-deadline"><Clock aria-hidden /><span>Sem prazo de resposta definido.</span></div>;
  }
  const passed = new Date(event.rsvp_deadline).getTime() < Date.now();
  const days = calendarDaysUntil(event.rsvp_deadline, tz);
  const when = `${formatDate(event.rsvp_deadline, tz)}, ${formatTime(event.rsvp_deadline, tz)}`;
  if (passed) {
    return <div className="dash-deadline"><Clock aria-hidden /><span>O prazo de resposta terminou a {when}.</span></div>;
  }
  const left = days <= 0 ? 'termina hoje' : days === 1 ? 'termina amanhã' : `faltam ${formatNumber(days)} dias`;
  return (
    <div className={['dash-deadline', days <= 7 && 'is-soon'].filter(Boolean).join(' ')}>
      <Clock aria-hidden />
      <span>Respostas até {when} <strong>· {left}</strong></span>
    </div>
  );
}

// ───────── Indicadores ─────────

/** Percentagem inteira, igual à de formatPercent (arredondada), para o contador animado. */
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function Kpis({ event, s }: { event: EventRecord; s: EventStats }) {
  const draft = s.by_status.draft;
  const capacity = s.capacity;
  const full = capacity !== null && s.expected_attendees >= capacity;
  return (
    <div className="ui-stats dash-kpis">
      <Stat
        label="Convidados"
        value={<AnimatedCounter value={s.invited} />}
        hint={!s.invited ? 'Ainda sem convidados' : draft ? `${formatNumber(draft)} por enviar` : 'Todos os convites enviados'}
      />
      <Stat
        label="Pessoas esperadas"
        value={<><AnimatedCounter value={s.expected_attendees} />{capacity !== null && <span className="dash-of"> / {formatNumber(capacity)}</span>}</>}
        progress={capacity ? s.expected_attendees / capacity : undefined}
        hint={<>
          {attendeesLine(s)} ·{' '}
          {capacity === null
            ? 'sem lotação definida'
            : full ? <strong className="dash-warn">lotação completa</strong> : `${formatPercent(s.expected_attendees, capacity)} da lotação`}
        </>}
      />
      <Stat
        label="Taxa de resposta"
        value={s.delivered ? <AnimatedCounter value={pct(s.responded, s.delivered)} suffix="%" /> : '—'}
        hint={s.delivered ? `${formatNumber(s.responded)} de ${formatNumber(s.delivered)} convites enviados` : 'Ainda sem convites enviados'}
      />
      <Stat
        label="Vistos"
        value={s.delivered ? <AnimatedCounter value={pct(s.opened, s.delivered)} suffix="%" /> : '—'}
        hint={s.delivered ? `${formatNumber(s.opened)} de ${formatNumber(s.delivered)} convites enviados` : 'Ainda sem convites enviados'}
      />
      {showCheckins(event) && (
        <Stat
          label="Entradas"
          value={<><AnimatedCounter value={s.checked_in} /><span className="dash-of"> / {formatNumber(s.expected_attendees)}</span></>}
          progress={s.expected_attendees ? s.checked_in / s.expected_attendees : 0}
          hint={s.expected_attendees ? `${formatPercent(s.checked_in, s.expected_attendees)} das pessoas esperadas` : 'Sem confirmações'}
        />
      )}
    </div>
  );
}

// ───────── Funil e estado dos convites ─────────

const STATUS_COLOR: Record<ActiveStatus, string> = {
  accepted: 'var(--c-success)',
  opened: 'var(--c-gold)',
  sent: '#3b63d4',
  draft: '#808a9c',
  declined: 'var(--c-danger)',
};
// Ordem da barra: do resultado positivo ao negativo (verde e vermelho nunca ficam lado a lado).
const BAR_ORDER: ActiveStatus[] = ['accepted', 'opened', 'sent', 'draft', 'declined'];

function FunnelCard({ s }: { s: EventStats }) {
  const steps = funnel(s);
  const draft = s.by_status.draft;
  const subtitle = draft
    ? `Percentagens sobre o total de convidados, incluindo ${draft === 1 ? 'o convite' : `os ${formatNumber(draft)} convites`} por enviar.`
    : 'Percentagens sobre o total de convidados.';
  return (
    <Card title="Funil de respostas" subtitle={subtitle}>
      {!s.invited ? (
        <p className="muted">Sem convidados. O funil aparece quando houver convites neste evento.</p>
      ) : (
        <table className="dash-funnel">
          <caption className="visually-hidden">Funil de respostas: convites em cada etapa e percentagem dos convidados</caption>
          <thead className="visually-hidden">
            <tr><th scope="col">Etapa</th><th scope="col">Gráfico</th><th scope="col">Convites</th><th scope="col">% dos convidados</th></tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.key}>
                <th scope="row">{step.label}</th>
                <td className="dash-funnel__track" aria-hidden>
                  <span className={`dash-funnel__bar dash-funnel__bar--${step.key}`} style={{ width: `${Math.max(step.share * 100, step.count ? 1.5 : 0)}%` }} />
                </td>
                <td className="num dash-funnel__count">{formatNumber(step.count)}</td>
                <td className="num dash-funnel__pct">{formatPercent(step.count, s.invited)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {s.invited > 0 && (
        <div className="dash-status">
          <div className="dash-status__title">Estado dos convites</div>
          <div className="dash-status__bar" role="img"
            aria-label={BAR_ORDER.map((k) => `${INVITATION_STATUS[k].label}: ${s.by_status[k]}`).join(', ')}>
            {BAR_ORDER.filter((k) => s.by_status[k] > 0).map((k) => (
              <span key={k} style={{ flexGrow: s.by_status[k], background: STATUS_COLOR[k] }}
                title={`${INVITATION_STATUS[k].label}: ${s.by_status[k]} (${formatPercent(s.by_status[k], s.invited)})`} />
            ))}
          </div>
          <ul className="dash-legend">
            {BAR_ORDER.map((k) => (
              <li key={k}>
                <span className="dash-legend__swatch" style={{ background: STATUS_COLOR[k] }} aria-hidden />
                <span className="dash-legend__label">{INVITATION_STATUS[k].label}</span>
                <span className="dash-legend__value">{formatNumber(s.by_status[k])}</span>
                <span className="dash-legend__pct">{formatPercent(s.by_status[k], s.invited)}</span>
              </li>
            ))}
          </ul>
          <p className="dash-note">Os convites cancelados não entram nestas contas.</p>
        </div>
      )}
    </Card>
  );
}

// ───────── Aprovação e tipos de acesso ─────────

function ApprovalCard({ event, s }: { event: EventRecord; s: EventStats }) {
  const can = usePermissions();
  const { pending, approved, rejected } = s.approval;
  const lines = passTypeLines(s);
  // Sem aprovação obrigatória e sem tipos de acesso, o cartão não acrescenta nada.
  if (!event.requires_approval && !s.by_pass_type.length && !pending && !rejected) return null;
  const pendingUrl = approvalListUrl(event.id, 'pending');
  return (
    <Card
      className="dash-approval-card"
      title="Aprovação"
      subtitle={event.requires_approval
        ? 'Quem confirma recebe o código QR só depois de a equipa aprovar e escolher o tipo de acesso.'
        : 'Este evento aprova automaticamente quem confirma.'}
      actions={<Link to={`/admin/eventos/${event.id}/acessos`} className="dash-card-link">Acessos</Link>}
    >
      <div className="dash-approval">
        <Link to={pendingUrl} className={['dash-approval__fig', 'dash-approval__fig--pending', pending > 0 && 'is-active'].filter(Boolean).join(' ')}>
          <span className="dash-approval__label">Por aprovar</span>
          <strong className="dash-approval__value">{formatNumber(pending)}</strong>
        </Link>
        <Link to={approvalListUrl(event.id, 'approved')} className="dash-approval__fig">
          <span className="dash-approval__label">Aprovados</span>
          <strong className="dash-approval__value">{formatNumber(approved)}</strong>
        </Link>
        <Link to={approvalListUrl(event.id, 'rejected')} className="dash-approval__fig">
          <span className="dash-approval__label">Não aprovados</span>
          <strong className="dash-approval__value">{formatNumber(rejected)}</strong>
        </Link>
      </div>
      {pending > 0 && (
        <ButtonLink to={pendingUrl} variant="primary" size="sm" icon={<BadgeCheck />} className="dash-approval__cta">
          {can.edit
            ? `Aprovar ${pending === 1 ? '1 confirmação' : `${formatNumber(pending)} confirmações`}`
            : `Ver ${pending === 1 ? '1 confirmação' : `${formatNumber(pending)} confirmações`} por aprovar`}
        </ButtonLink>
      )}

      <div className="dash-status">
        <div className="dash-status__title">Por tipo de acesso</div>
        {!s.by_pass_type.length ? (
          <p className="dash-quiet">
            Ainda não há tipos de acesso (ex.: VIP Pass, Conference Pass).{' '}
            <Link to={`/admin/eventos/${event.id}/acessos`}>{can.edit ? 'Criar tipos de acesso' : 'Ver Acessos'}</Link>
          </p>
        ) : (
          <>
            {approved > 0 && (
              <div className="dash-status__bar" role="img" aria-label={lines.map((l) => `${l.name}: ${l.approved}`).join(', ')}>
                {lines.filter((l) => l.approved > 0).map((l) => (
                  <span key={l.id ?? 'none'} style={{ flexGrow: l.approved, background: passColor(l.color) }} title={`${l.name}: ${l.approved}`} />
                ))}
              </div>
            )}
            <table className="dash-passes">
              <caption className="visually-hidden">Convidados aprovados e pessoas por tipo de acesso</caption>
              <thead>
                <tr><th scope="col">Tipo</th><th scope="col" className="num">Convidados</th><th scope="col" className="num">Pessoas</th></tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id ?? 'none'}>
                    <th scope="row"><span className="dash-passes__name">{l.id ? <PassDot color={l.color} /> : <span className="dash-passes__none" aria-hidden />}{l.name}</span></th>
                    <td className="num">{formatNumber(l.approved)}</td>
                    <td className="num">{l.id ? formatNumber(l.attendees) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dash-note">Convidados com presença confirmada e aprovada; pessoas inclui acompanhantes.</p>
          </>
        )}
      </div>
    </Card>
  );
}

// ───────── Pontos de atenção ─────────

interface Notice {
  tone: 'danger' | 'warning' | 'info';
  text: ReactNode;
  action?: { to: string; label: string };
}

function AttentionCard({ event, s }: { event: EventRecord; s: EventStats }) {
  const can = usePermissions();
  const base = `/admin/eventos/${event.id}`;
  const notices = useMemo(() => {
    const list: Notice[] = [];
    const settings = can.edit ? { to: `${base}/definicoes`, label: 'Definições' } : undefined;
    const pending = s.invited - s.responded;
    const now = Date.now();
    if (event.status === 'draft') {
      list.push({ tone: 'warning', text: 'O evento está em rascunho: os links dos convidados ainda não abrem.', action: settings });
    }
    if (!event.privacy_controller && event.status !== 'archived') {
      list.push({ tone: 'warning', text: 'Falta indicar o responsável pelo tratamento dos dados (RGPD).', action: settings });
    }
    if (!s.invited) {
      list.push({ tone: 'info', text: 'Ainda não há convidados neste evento.', action: { to: base, label: can.edit ? 'Convidar' : 'Ver lista' } });
    } else if (s.by_status.draft) {
      list.push({
        tone: 'info',
        text: s.by_status.draft === 1 ? 'Há 1 convite por enviar.' : `Há ${formatNumber(s.by_status.draft)} convites por enviar.`,
        action: { to: base, label: 'Ver convidados' },
      });
    }
    if (s.approval.pending) {
      list.push({
        tone: 'warning',
        text: s.approval.pending === 1
          ? 'Há 1 confirmação por aprovar: o convidado ainda não tem código QR.'
          : `Há ${formatNumber(s.approval.pending)} confirmações por aprovar: estes convidados ainda não têm código QR.`,
        action: { to: approvalListUrl(event.id, 'pending'), label: can.edit ? 'Aprovar' : 'Ver' },
      });
      if (!s.by_pass_type.length) {
        list.push({
          tone: 'info',
          text: 'Ainda não há tipos de acesso: são precisos para aprovar.',
          action: { to: `${base}/acessos`, label: can.edit ? 'Criar' : 'Acessos' },
        });
      }
    }
    if (s.capacity) {
      const share = s.expected_attendees / s.capacity;
      if (share >= 1) list.push({ tone: 'danger', text: 'Lotação completa: novas confirmações são recusadas.' });
      else if (share >= 0.9) list.push({ tone: 'warning', text: `Lotação quase completa (${formatPercent(s.expected_attendees, s.capacity)}).` });
    }
    if (event.rsvp_deadline) {
      const deadline = new Date(event.rsvp_deadline).getTime();
      if (deadline >= now && deadline - now <= 7 * 864e5 && pending > 0) {
        list.push({
          tone: 'warning',
          text: `O prazo de resposta termina ${formatRelative(event.rsvp_deadline)} e ${pending === 1 ? 'há 1 convidado' : `há ${formatNumber(pending)} convidados`} sem resposta.`,
          action: { to: base, label: 'Ver convidados' },
        });
      } else if (deadline < now && event.status === 'open' && eventPhase(event) === 'upcoming') {
        list.push({ tone: 'info', text: 'O prazo de resposta terminou: o convite já não aceita respostas.' });
      }
    }
    return list;
  }, [event, s, can.edit, base]);

  const ICON = { danger: XCircle, warning: AlertTriangle, info: Info };
  return (
    <Card title="A acompanhar">
      {notices.length ? (
        <ul className="dash-notices">
          {notices.map((n, i) => {
            const I = ICON[n.tone];
            return (
              <li key={i} className={`dash-notice dash-notice--${n.tone}`}>
                <I aria-hidden />
                <span>{n.text}</span>
                {n.action && <Link to={n.action.to} className="dash-notice__action">{n.action.label}</Link>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dash-ok"><CheckCircle2 aria-hidden />Nada a assinalar neste momento.</div>
      )}
    </Card>
  );
}

// ───────── Atividade recente ─────────

const ACTIVITY_ICON: Record<string, typeof Send> = {
  'invitation.created': UserPlus,
  'invitation.sent': Send,
  'invitation.resent': Send,
  'invitation.opened': Eye,
  'invitation.accepted': CheckCircle2,
  'invitation.declined': XCircle,
  'invitation.cancelled': Ban,
  'invitation.reopened': RotateCcw,
  'invitation.approved': BadgeCheck,
  'invitation.rejected': ShieldX,
  'invitation.approval_reset': RotateCcw,
  checkin: ScanLine,
  'checkin.undone': RotateCcw,
  'consent.granted': ShieldCheck,
  'consent.revoked': ShieldOff,
  'privacy.erasure_requested': ShieldOff,
  note: StickyNote,
};

const ACTIVITY_TONE: Record<string, string> = {
  'invitation.accepted': 'success',
  'invitation.approved': 'success',
  'invitation.rejected': 'danger',
  checkin: 'success',
  'invitation.declined': 'danger',
  'invitation.cancelled': 'danger',
  'invitation.opened': 'gold',
  'invitation.sent': 'info',
  'invitation.resent': 'info',
};

async function loadActivity(eventId: string): Promise<{ items: Activity[]; names: Map<string, string> }> {
  // Os nomes vêm da lista de convidados; se esta falhar, mostra-se a atividade sem nomes.
  const [items, rows] = await Promise.allSettled([api.invitations.activities(eventId, 12), api.invitations.list(eventId)]);
  if (items.status === 'rejected') throw items.reason;
  const names = new Map<string, string>();
  if (rows.status === 'fulfilled') {
    for (const r of rows.value) {
      const name = fullName(r);
      names.set(r.id, name);
      names.set(r.contact_id, name);
    }
  }
  return { items: items.value, names };
}

function ActivityCard({ event }: { event: EventRecord }) {
  const { data, error, loading, reload } = useAsync(() => loadActivity(event.id), [event.id]);
  return (
    <Card title="Atividade recente" actions={<Link to={`/admin/eventos/${event.id}`} className="dash-card-link">Ver convidados</Link>}>
      {error ? (
        <p className="dash-quiet">
          Não foi possível carregar a atividade recente.{' '}
          <button type="button" className="dash-linkbtn" onClick={reload}>Tentar novamente</button>
        </p>
      ) : loading && !data ? (
        <div className="ui-stack" aria-busy="true" aria-label="A carregar a atividade">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <Skeleton width={28} height={28} style={{ borderRadius: '50%' }} />
              <div style={{ flex: 1 }}><Skeleton width="70%" /><Skeleton width="30%" height={10} style={{ marginTop: 6 }} /></div>
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <p className="dash-quiet">Ainda sem atividade neste evento. Os envios, aberturas e respostas aparecem aqui.</p>
      ) : (
        <ul className="ui-timeline dash-activity">
          {data.items.map((a) => {
            const I = ACTIVITY_ICON[a.kind] ?? Info;
            const name = (a.invitation_id && data.names.get(a.invitation_id)) || (a.contact_id && data.names.get(a.contact_id)) || null;
            return (
              <li key={a.id}>
                <span className={['ui-timeline__icon', ACTIVITY_TONE[a.kind] && `dash-tone--${ACTIVITY_TONE[a.kind]}`].filter(Boolean).join(' ')}>
                  <I aria-hidden />
                </span>
                <div className="ui-timeline__text">
                  <div>
                    {name && <strong className="dash-activity__name">{name}</strong>}
                    {name && ' · '}
                    {ACTIVITY[a.kind] ?? a.kind}
                    {a.channel && <span className="muted"> {channelPhrase(a.channel)}</span>}
                  </div>
                  <time className="ui-timeline__time" dateTime={a.created_at} title={formatDateTime(a.created_at, event.timezone)}>
                    {capitalize(formatRelative(a.created_at))}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ───────── Por vaga / por segmento ─────────

function BreakdownCard({ title, column, empty, lines }: { title: string; column: string; empty: string; lines: BreakdownLine[] }) {
  const total = breakdownTotal(lines);
  return (
    <Card title={title} padded={false} className="dash-breakdown">
      {!lines.length ? (
        <div className="ui-card__body"><p className="dash-quiet">Sem convidados neste evento.</p></div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table dash-table">
            <thead>
              <tr>
                <th scope="col">{column}</th>
                <th scope="col" className="num">Convidados</th>
                <th scope="col" className="num">Confirmados</th>
                <th scope="col" className="num">Recusados</th>
                <th scope="col" className="num">Sem resposta</th>
                <th scope="col" className="num">% confirmados</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.name}>
                  <td className="primary dash-table__name" title={l.name || empty}>{l.name || <span className="muted">{empty}</span>}</td>
                  <td className="num">{formatNumber(l.invited)}</td>
                  <td className="num">{formatNumber(l.accepted)}</td>
                  <td className="num">{formatNumber(l.declined)}</td>
                  <td className="num">{formatNumber(l.pending)}</td>
                  <td className="num"><Share value={l.acceptedShare} /></td>
                </tr>
              ))}
            </tbody>
            {lines.length > 1 && (
              <tfoot>
                <tr>
                  <td className="primary">Total</td>
                  <td className="num">{formatNumber(total.invited)}</td>
                  <td className="num">{formatNumber(total.accepted)}</td>
                  <td className="num">{formatNumber(total.declined)}</td>
                  <td className="num">{formatNumber(total.pending)}</td>
                  <td className="num"><Share value={total.acceptedShare} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

function Share({ value }: { value: number }) {
  return (
    <span className="dash-share">
      <span className="dash-share__track" aria-hidden><span style={{ width: `${Math.round(value * 100)}%` }} /></span>
      {formatPercent(value, 1)}
    </span>
  );
}

// ───────── Esqueletos ─────────

function StatsSkeleton() {
  return (
    <>
      <div className="ui-stats dash-kpis" aria-busy="true" aria-label="A carregar indicadores">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ui-stat"><Skeleton width="50%" /><Skeleton width="40%" height={32} style={{ marginTop: 10 }} /><Skeleton width="70%" style={{ marginTop: 10 }} /></div>
        ))}
      </div>
      <div className="dash-grid">
        <Card><Skeleton height={220} /></Card>
        <Card><Skeleton height={220} /></Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash" aria-busy="true">
      <div className="dash-hero"><div className="dash-hero__main"><Skeleton width="30%" /><Skeleton width="55%" height={28} style={{ marginTop: 12 }} /><Skeleton width="45%" style={{ marginTop: 12 }} /></div></div>
      <StatsSkeleton />
    </div>
  );
}
