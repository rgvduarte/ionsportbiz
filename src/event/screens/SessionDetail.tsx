import { Link, useParams } from 'react-router';
import { CalendarPlus, Check, ChevronRight, Clock, Lock, MapPin, Star } from 'lucide-react';
import { sessionById, speakerById, stageById } from '../data/event';
import { Avatar, Empty, TopBar } from '../components/ui';
import { downloadIcs } from '../lib/ics';
import { fmtDay, fmtTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { sessionAccess } from '../lib/invite';
import { usePass, useStore } from '../lib/store';

export default function SessionDetail() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const { state, dispatch } = useStore();
  const pass = usePass();
  const s = sessionById(id);
  if (!s) return (<><TopBar back /><main className="screen pad"><Empty>404</Empty></main></>);
  const stage = stageById(s.stageId);
  const fav = state.favorites.includes(s.id);
  const speakers = s.speakerIds.map(speakerById).filter(Boolean);
  const access = sessionAccess(s, pass);

  return (
    <>
      <TopBar back />
      <main className="screen pad detail" style={{ ['--stage' as string]: stage.color }}>
        <div className="session-meta">
          <span className="stage-tag">
            <span className="dot" /> {stage.name}
          </span>
          {s.access === 'vip' && <span className="vip-tag">{t('common.vipOnly')}</span>}
        </div>
        <h1 className="display-sm">{s.title}</h1>
        <ul className="facts">
          <li>
            <Clock size={18} /> {fmtDay(s.start, locale)} · {fmtTime(s.start, locale)} – {fmtTime(s.end, locale)}
          </li>
          <li>
            <MapPin size={18} /> {stage.name}
          </li>
        </ul>
        <p className="lead">{s.description}</p>
        {access === 'included' && (
          <p className="access-note ok">
            <Check size={18} /> <span>{t('agenda.includedIn')} <strong>{pass!.name}</strong>.</span>
          </p>
        )}
        {access === 'notIncluded' && (
          <p className="access-note">
            <Lock size={18} /> <span>{t('agenda.notIncludedIn')} <strong>{pass!.name}</strong>.</span>
          </p>
        )}
        {access === 'unknown' && (
          <p className="access-note">
            <Lock size={18} /> <span>{t('agenda.vipNote')}</span>
          </p>
        )}

        <div className="actions">
          <button className={`btn ${fav ? 'btn-primary' : 'btn-outline'}`} onClick={() => dispatch({ type: 'toggleFav', id: s.id })} aria-pressed={fav}>
            <Star size={18} fill={fav ? 'currentColor' : 'none'} /> {fav ? t('agenda.unfav') : t('agenda.fav')}
          </button>
          <button className="btn btn-outline" onClick={() => downloadIcs(s)}>
            <CalendarPlus size={18} /> {t('agenda.addCal')}
          </button>
        </div>

        {speakers.length > 0 && (
          <>
            <h2 className="h2">{t('agenda.speakers')}</h2>
            <div className="list">
              {speakers.map((sp) => (
                <Link key={sp!.id} to={`/speakers/${sp!.id}`} className="row-card">
                  <Avatar name={sp!.name} />
                  <div className="row-body">
                    <strong>{sp!.name}</strong>
                    <span className="muted small">
                      {sp!.role}, {sp!.company}
                    </span>
                  </div>
                  <ChevronRight size={18} className="muted" />
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
