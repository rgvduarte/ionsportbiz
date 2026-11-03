import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CalendarCheck, Check, Hourglass, Search, Sparkles, UserCheck, UserPlus, X } from 'lucide-react';
import { ATTENDEES, MEETING_SLOTS, SECTORS, attendeeById } from '../data/people';
import type { Attendee } from '../data/types';
import { Avatar, Chip, Empty, Segmented, TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { fmtShortDay, fmtTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useStore, type Meeting } from '../lib/store';

type Tab = 'people' | 'connections' | 'meetings';

function ConnectButton({ a, compact }: { a: Attendee; compact?: boolean }) {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const status = state.connections[a.id];
  if (status === 'connected')
    return (
      <span className="pill pill-on">
        <UserCheck size={16} /> {!compact && t('net.connected')}
      </span>
    );
  if (status === 'outgoing')
    return (
      <span className="pill">
        <Hourglass size={16} /> {!compact && t('net.pending')}
      </span>
    );
  if (status === 'incoming')
    return (
      <span className="row-actions">
        <button
          className={`btn btn-primary btn-sm${compact ? ' btn-icon' : ''}`}
          onClick={() => { dispatch({ type: 'acceptConn', id: a.id }); toast(t('net.toastAccepted')); }}
          aria-label={t('net.accept')}
        >
          <Check size={16} /> {!compact && t('net.accept')}
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => dispatch({ type: 'declineConn', id: a.id })} aria-label={t('net.decline')}>
          <X size={16} />
        </button>
      </span>
    );
  return (
    <button className="btn btn-outline btn-sm" onClick={() => { dispatch({ type: 'connect', id: a.id }); toast(t('net.toastConnect')); }}>
      <UserPlus size={16} /> {t('net.connect')}
    </button>
  );
}

function PersonRow({ a, note }: { a: Attendee; note?: string }) {
  return (
    <div className="row-card">
      <Link to={`/networking/${a.id}`} className="row-link">
        <Avatar name={a.name} tone={a.id.length % 2 ? 'lime' : 'grad'} />
        <div className="row-body">
          <strong>{a.name}</strong>
          <span className="muted small">
            {a.role} · {a.company}
          </span>
          {note && <span className="small lime">{note}</span>}
        </div>
      </Link>
      <ConnectButton a={a} compact />
    </div>
  );
}

function MeetingRow({ m }: { m: Meeting }) {
  const { t, locale } = useI18n();
  const { dispatch } = useStore();
  const toast = useToast();
  const a = attendeeById(m.attendeeId)!;
  return (
    <div className={`meeting-card m-${m.status}`}>
      <div className="meeting-when">
        <span className="meeting-time">{fmtTime(m.slot, locale)}</span>
        <span className="muted small">{fmtShortDay(m.slot, locale)}</span>
      </div>
      <div className="row-body">
        <span className="small muted">{m.status === 'incoming' ? t('net.meetingIncoming') : t('net.meetingWith')}</span>
        <Link to={`/networking/${a.id}`}>
          <strong>{a.name}</strong>
        </Link>
        <span className="muted small">{a.company} · Networking Lounge</span>
        {m.status === 'outgoing' && <span className="small"><Hourglass size={14} /> {t('net.meetingPending')}</span>}
        {m.status === 'confirmed' && <span className="small lime"><CalendarCheck size={14} /> {t('net.meetingConfirmed')}</span>}
      </div>
      {m.status === 'incoming' && (
        <div className="row-actions col">
          <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'acceptMeeting', id: m.id }); toast(t('net.toastAccepted')); }}>
            {t('net.accept')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'declineMeeting', id: m.id })}>
            {t('net.decline')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Networking() {
  const { t } = useI18n();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'people';
  const [q, setQ] = useState('');
  const [sector, setSector] = useState<string>('all');

  const term = q.trim().toLowerCase();
  // Primeiro quem partilha interesses (ou o setor) com o participante: escolhem-se no perfil.
  const { interests: mine, sector: mySector } = state.prefs;
  const common = (a: Attendee) => a.interests.filter((i) => mine.includes(i));
  const score = (a: Attendee) => common(a).length * 2 + (a.sector === mySector ? 1 : 0);
  const people = ATTENDEES.filter((a) => sector === 'all' || a.sector === sector)
    .filter((a) => !term || `${a.name} ${a.company} ${a.role} ${a.interests.join(' ')}`.toLowerCase().includes(term))
    .map((a, i) => ({ a, i, score: score(a) }))
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .map((x) => x.a);
  const incoming = ATTENDEES.filter((a) => state.connections[a.id] === 'incoming');
  const others = ATTENDEES.filter((a) => state.connections[a.id] === 'connected' || state.connections[a.id] === 'outgoing');
  const meetings = [...state.meetings].sort((a, b) => a.slot.localeCompare(b.slot));

  return (
    <>
      <TopBar title={t('net.title')} />
      <main className="screen">
        <div className="pad-x">
          <Segmented<Tab>
            value={tab}
            onChange={(v) => setParams({ tab: v }, { replace: true })}
            options={[
              { value: 'people', label: t('net.people') },
              { value: 'connections', label: <>{t('net.connections')}{incoming.length > 0 && <span className="seg-badge">{incoming.length}</span>}</> },
              { value: 'meetings', label: <>{t('net.meetings')}{meetings.some((m) => m.status === 'incoming') && <span className="seg-badge">!</span>}</> },
            ]}
          />
        </div>

        {tab === 'people' && (
          <>
            <div className="pad-x">
              <label className="search">
                <Search size={18} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
              </label>
            </div>
            <div className="chips pad-x">
              <Chip active={sector === 'all'} onClick={() => setSector('all')}>{t('common.all')}</Chip>
              {SECTORS.map((s) => (
                <Chip key={s} active={sector === s} onClick={() => setSector(s)}>{t(`sector.${s}`)}</Chip>
              ))}
            </div>
            {mine.length === 0 && (
              <Link to="/more/profile" className="net-hint pad-x">
                <Sparkles size={16} /> {t('net.pickInterests')}
              </Link>
            )}
            <div className="list pad-x">
              {people.map((a) => {
                const shared = common(a);
                return <PersonRow key={a.id} a={a} note={shared.length ? `${t('net.common')}: ${shared.join(', ')}` : undefined} />;
              })}
            </div>
          </>
        )}

        {tab === 'connections' && (
          <div className="list pad-x">
            {incoming.map((a) => <PersonRow key={a.id} a={a} note={t('net.incoming')} />)}
            {others.map((a) => <PersonRow key={a.id} a={a} />)}
            {incoming.length + others.length === 0 && <Empty>{t('net.noConnections')}</Empty>}
          </div>
        )}

        {tab === 'meetings' && (
          <div className="list pad-x">
            {meetings.map((m) => <MeetingRow key={m.id} m={m} />)}
            {meetings.length === 0 && <Empty>{t('net.noMeetings')}</Empty>}
          </div>
        )}
      </main>
    </>
  );
}

export function AttendeeDetail() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [slot, setSlot] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const a = attendeeById(id);
  if (!a) return (<><TopBar back /><main className="screen pad"><Empty>404</Empty></main></>);
  const taken = new Set(state.meetings.map((m) => m.slot));
  const mine = state.meetings.filter((m) => m.attendeeId === a.id);

  return (
    <>
      <TopBar back />
      <main className="screen pad detail">
        <div className="profile-head">
          <Avatar name={a.name} size={96} tone="lime" />
          <div>
            <h1 className="display-sm">{a.name}</h1>
            <p className="muted">
              {a.role}
              <br />
              <span className="lime">{a.company}</span> · {a.country}
            </p>
          </div>
        </div>
        <span className="pill">{t(`sector.${a.sector}`)}</span>
        <p className="lead">{a.bio}</p>
        <h2 className="h2">{t('net.interests')}</h2>
        <div className="tags">
          {a.interests.map((i) => <span key={i} className="tag">{i}</span>)}
        </div>

        <div className="actions">
          <ConnectButton a={a} />
          <button className="btn btn-primary" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
            <CalendarCheck size={18} /> {t('net.requestMeeting')}
          </button>
        </div>

        {picking && (
          <div className="slot-picker">
            <p className="small muted">{t('net.pickSlot')}</p>
            <div className="slots">
              {MEETING_SLOTS.map((s) => (
                <button key={s} className={`slot${slot === s ? ' on' : ''}`} disabled={taken.has(s)} onClick={() => setSlot(s)}>
                  {fmtTime(s, locale)}
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="btn btn-ghost" onClick={() => setPicking(false)}>{t('common.cancel')}</button>
              <button
                className="btn btn-primary"
                disabled={!slot}
                onClick={() => {
                  dispatch({ type: 'requestMeeting', attendeeId: a.id, slot: slot! });
                  toast(t('net.toastMeeting'));
                  setPicking(false);
                  setSlot(null);
                }}
              >
                {t('net.send')}
              </button>
            </div>
          </div>
        )}

        {mine.length > 0 && (
          <>
            <h2 className="h2">{t('net.meetings')}</h2>
            <div className="list">{mine.map((m) => <MeetingRow key={m.id} m={m} />)}</div>
          </>
        )}
      </main>
    </>
  );
}
