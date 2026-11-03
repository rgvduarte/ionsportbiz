import { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { GuestView } from '../lib/api/types';
import { formalName } from '../lib/format';
import { useGuestStrings } from './i18n';
import { differentTimeZone, eventTimes, mapsUrl, safeUrl, timeZoneName } from './utils';

/** O convite propriamente dito, com o aspeto de um cartão impresso. */
export function InvitationCard({ view }: { view: GuestView }) {
  const t = useGuestStrings();
  const { event: e, contact: c } = view;
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = safeUrl(e.branding?.logo_url);
  const { weekday, day, start, end } = eventTimes(e, t.locale);
  const map = mapsUrl(e);
  const showZone = differentTimeZone(e.starts_at, e.timezone);

  return (
    <article className="gi-card" aria-labelledby="gi-event-name">
      <div className="gi-card__inner">
        {logo && !logoFailed && (
          <img className="gi-card__logo" src={logo} alt="" onError={() => setLogoFailed(true)} />
        )}
        <p className="gi-card__greeting">{formalName(c)}</p>
        {e.host_name && <p className="gi-card__host">{e.host_name}</p>}
        {e.invitation_text && <p className="gi-card__text">{e.invitation_text}</p>}
        <h1 id="gi-event-name" className="gi-card__name">{e.name}</h1>
        <span className="gi-card__rule" aria-hidden><span /></span>
        <p className="gi-card__date">
          <time dateTime={e.starts_at}>
            <span className="gi-card__weekday">{weekday}</span>
            <span className="visually-hidden">, </span>
            <span className="gi-card__day">{day}</span>
          </time>
        </p>
        <p className="gi-card__time">{t.timeRange(start, end)}</p>
        {showZone && <p className="gi-card__zone">{t.timezoneNote(timeZoneName(e.starts_at, e.timezone, t.locale))}</p>}
        {(e.venue_name || e.venue_address) && (
          <address className="gi-card__venue">
            {e.venue_name && <span className="gi-card__venue-name">{e.venue_name}</span>}
            {e.venue_address && <span className="gi-card__address">{e.venue_address}</span>}
          </address>
        )}
        {map && (
          <a className="gi-card__map" href={map} target="_blank" rel="noopener noreferrer">
            <MapPin aria-hidden />
            {t.viewMap}
          </a>
        )}
        {e.dress_code && (
          <p className="gi-card__dress">
            <span className="gi-card__dress-label">{t.dressCode}</span>
            <span>{e.dress_code}</span>
          </p>
        )}
      </div>
    </article>
  );
}
