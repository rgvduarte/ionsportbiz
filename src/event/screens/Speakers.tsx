import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronRight, Search } from 'lucide-react';
import { SPEAKERS, sessionsForSpeaker, speakerById } from '../data/event';
import { SessionCard } from '../components/SessionCard';
import { Avatar, DemoNote, Empty, TopBar } from '../components/ui';
import { fmtShortDay } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function SpeakerList() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = SPEAKERS.filter((s) => !term || `${s.name} ${s.company} ${s.role}`.toLowerCase().includes(term));
  return (
    <>
      <TopBar back title={t('speakers.title')} />
      <main className="screen pad">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
        </label>
        <DemoNote />
        <div className="speaker-grid">
          {list.map((s) => (
            <Link key={s.id} to={`/speakers/${s.id}`} className="speaker-card">
              <Avatar name={s.name} size={72} />
              <strong>{s.name}</strong>
              <span className="muted small">{s.role}</span>
              <span className="small lime">{s.company}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export function SpeakerDetail() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const s = speakerById(id);
  if (!s) return (<><TopBar back /><main className="screen pad"><Empty>404</Empty></main></>);
  const sessions = sessionsForSpeaker(s.id);
  return (
    <>
      <TopBar back />
      <main className="screen pad detail">
        <div className="profile-head">
          <Avatar name={s.name} size={96} />
          <div>
            <h1 className="display-sm">{s.name}</h1>
            <p className="muted">
              {s.role}
              <br />
              <span className="lime">{s.company}</span> · {s.country}
            </p>
          </div>
        </div>
        <p className="lead">{s.bio}</p>
        <h2 className="h2">{t('speakers.sessions')}</h2>
        <div className="list">
          {sessions.map((x) => (
            <SessionCard key={x.id} session={x} showDay={fmtShortDay(x.start, locale)} />
          ))}
        </div>
        <Link to="/speakers" className="link-row">
          {t('speakers.title')} <ChevronRight size={16} />
        </Link>
      </main>
    </>
  );
}
