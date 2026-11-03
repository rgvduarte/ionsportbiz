import { MapPin, Mic } from 'lucide-react';
import type { GuestView } from '../lib/api/types';
import { formatDate, formatLongDate, formatTime } from '../lib/format';
import { useGuestStrings } from './i18n';
import { Section } from './parts';
import { capitalize, dayKey } from './utils';

/** Programa do evento, por hora; com cabeçalhos de dia quando dura mais de um dia. */
export function ProgrammeSection({ view }: { view: GuestView }) {
  const t = useGuestStrings();
  const { sessions, event: e } = view;
  if (!sessions.length) return null;
  const tz = e.timezone;

  const days: { key: string; label: string; items: GuestView['sessions'] }[] = [];
  for (const s of sessions) {
    const key = dayKey(s.starts_at, tz);
    let day = days.find((d) => d.key === key);
    if (!day) {
      day = { key, label: capitalize(formatLongDate(s.starts_at, tz, t.locale)), items: [] };
      days.push(day);
    }
    day.items.push(s);
  }

  return (
    <Section id="gi-programme" eyebrow={days.length === 1 ? formatDate(sessions[0].starts_at, tz, t.locale) : t.programmeEyebrow} title={t.programmeTitle}>
      {days.map((day) => (
        <div key={day.key} className="gi-programme__day">
          {days.length > 1 && <h3 className="gi-programme__date">{day.label}</h3>}
          <ol className="gi-programme">
            {day.items.map((s) => (
              <li key={s.id} className="gi-programme__item">
                <div className="gi-programme__time">
                  <time dateTime={s.starts_at}>{formatTime(s.starts_at, tz, t.locale)}</time>
                  {s.ends_at && <span className="gi-programme__end">{t.until} <time dateTime={s.ends_at}>{formatTime(s.ends_at, tz, t.locale)}</time></span>}
                </div>
                <div className="gi-programme__body">
                  <p className="gi-programme__title">{s.title}</p>
                  {(s.location || s.speakers) && (
                    <p className="gi-programme__meta">
                      {s.location && <span><MapPin aria-hidden />{s.location}</span>}
                      {s.speakers && <span><Mic aria-hidden />{s.speakers}</span>}
                    </p>
                  )}
                  {s.description && <p className="gi-programme__desc">{s.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </Section>
  );
}
