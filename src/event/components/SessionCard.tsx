import { Link } from 'react-router';
import { Star } from 'lucide-react';
import type { Session } from '../data/types';
import { speakerById, stageById } from '../data/event';
import { fmtTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { Avatar } from './ui';

export function SessionCard({ session, showDay }: { session: Session; showDay?: string }) {
  const { locale, t } = useI18n();
  const { state, dispatch } = useStore();
  const stage = stageById(session.stageId);
  const fav = state.favorites.includes(session.id);
  const speakers = session.speakerIds.map(speakerById).filter(Boolean);
  return (
    <article className="session-card" style={{ ['--stage' as string]: stage.color }}>
      <Link to={`/agenda/${session.id}`} className="session-main">
        <div className="session-time">
          {showDay && <span className="session-day">{showDay}</span>}
          {fmtTime(session.start, locale)} – {fmtTime(session.end, locale)}
        </div>
        <h3>{session.title}</h3>
        <div className="session-meta">
          <span className="stage-tag">
            <span className="dot" /> {stage.name}
          </span>
          {session.access === 'vip' && <span className="vip-tag">{t('common.vipOnly')}</span>}
        </div>
        {speakers.length > 0 && (
          <div className="session-speakers">
            {speakers.map((s) => (
              <Avatar key={s!.id} name={s!.name} size={28} />
            ))}
            <span className="muted small">{speakers.map((s) => s!.name).join(', ')}</span>
          </div>
        )}
      </Link>
      <button
        className={`fav-btn${fav ? ' on' : ''}`}
        onClick={() => dispatch({ type: 'toggleFav', id: session.id })}
        aria-label={fav ? t('agenda.unfav') : t('agenda.fav')}
        aria-pressed={fav}
      >
        <Star size={22} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
