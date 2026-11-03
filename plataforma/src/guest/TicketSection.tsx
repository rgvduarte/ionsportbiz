import { useEffect, useState } from 'react';
import { CalendarDays, CalendarPlus, CheckCircle2, Navigation } from 'lucide-react';
import type { GuestView } from '../lib/api/types';
import { inviteUrl } from '../lib/config';
import { formalName, formatDate, formatTime } from '../lib/format';
import { buildIcs, canDownloadIcs, downloadIcs, googleCalendarUrl, icsFilename, type CalendarEvent } from '../lib/ics';
import { Button, ButtonAnchor, useToast } from '../ui';
import { useGuestStrings } from './i18n';
import { QrCode } from './QrCode';
import { Section } from './parts';
import { calendarUid, eventIsPast, eventTimes, groupCode, mapsUrl } from './utils';

/** "O seu acesso": bilhete com o código QR, só depois de confirmar presença. */
export function TicketSection({ view, token }: { view: GuestView; token: string }) {
  const t = useGuestStrings();
  const toast = useToast();
  // Calculado de antemão: na app, a partilha do sistema tem de abrir logo a seguir ao toque.
  const [uid, setUid] = useState<{ token: string; value: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void calendarUid(token).then((value) => { if (alive) setUid({ token, value }); });
    return () => { alive = false; };
  }, [token]);
  const { invitation: inv, contact: c, event: e } = view;
  const code = inv.checkin_code;
  if (inv.status !== 'accepted' || !code) return null;
  const past = eventIsPast(e);

  const { date, start, end } = eventTimes(e, t.locale);
  const checkedIn = inv.checked_in_at
    ? past
      ? t.checkedInPast(formatDate(inv.checked_in_at, e.timezone, t.locale), formatTime(inv.checked_in_at, e.timezone, t.locale))
      : t.checkedIn(formatTime(inv.checked_in_at, e.timezone, t.locale))
    : null;
  const map = mapsUrl(e);
  const location = [e.venue_name, e.venue_address].filter(Boolean).join(', ');
  const details = [t.calendarDescription(e.host_name), e.dress_code && `${t.dressCode}: ${e.dress_code}`].filter(Boolean).join('\n');
  // O link pessoal dá acesso ao código de entrada: vai só no ficheiro .ics, que fica no dispositivo do convidado
  // (útil no dia para abrir o bilhete a partir do calendário), e nunca no link da Google.
  const googleUrl = googleCalendarUrl({ title: e.name, description: details, location, start: e.starts_at, end: e.ends_at, timezone: e.timezone });

  const addToCalendar = async () => {
    try {
      const link = inviteUrl(token);
      const calendar: CalendarEvent = {
        uid: uid?.token === token ? uid.value : await calendarUid(token),
        title: e.name,
        description: `${details}\n${t.calendarLink}: ${link}`,
        location,
        url: link,
        start: e.starts_at,
        end: e.ends_at,
        organizerName: e.host_name,
        organizerEmail: e.contact_email,
      };
      await downloadIcs(icsFilename(e.name), buildIcs(calendar));
    } catch {
      toast.error(t.calendarError);
    }
  };

  return (
    <Section id="gi-ticket" eyebrow={t.ticketEyebrow} title={t.ticketTitle} intro={past ? undefined : t.ticketIntro}>
      <div className="gi-ticket">
        <div className="gi-ticket__head">
          <p className="gi-ticket__event">{e.name}</p>
          <p className="gi-ticket__when">
            <time dateTime={e.starts_at}>{date}</time>
            <span className="gi-ticket__time">{t.timeRange(start, end)}</span>
          </p>
        </div>
        <div className="gi-ticket__body">
          {checkedIn && (
            <p className="gi-ticket__stamp">
              <CheckCircle2 aria-hidden />
              {checkedIn}
            </p>
          )}
          <div className="gi-ticket__qr-wrap">
            <QrCode value={code} label={t.qrLabel(code)} className="gi-ticket__qr" />
          </div>
          <p className="gi-ticket__code">
            <span className="visually-hidden">{t.ticketCode}: </span>
            <span aria-hidden>{groupCode(code)}</span>
            <span className="visually-hidden">{code.split('').join(' ')}</span>
          </p>
          {!past && <p className="gi-ticket__hint">{t.ticketHint}</p>}
        </div>
        <div className="gi-ticket__tear" aria-hidden />
        <dl className="gi-ticket__meta">
          <div>
            <dt>{t.ticketGuest}</dt>
            <dd>{formalName(c)}</dd>
          </div>
          {inv.companions.length > 0 && (
            <div>
              <dt>{t.ticketCompanions}</dt>
              <dd>{inv.companions.map((m) => m.full_name).join(', ')}</dd>
            </div>
          )}
          {location && (
            <div>
              <dt>{t.ticketWhere}</dt>
              <dd>
                {e.venue_name && <span className="gi-ticket__venue">{e.venue_name}</span>}
                {e.venue_address && <span className="gi-ticket__address">{e.venue_address}</span>}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {!past && (
        <div className="gi-ticket__actions">
          {canDownloadIcs() && <Button size="lg" icon={<CalendarPlus />} onClick={addToCalendar}>{t.addToCalendar}</Button>}
          <ButtonAnchor size="lg" href={googleUrl} icon={<CalendarDays />}>{t.googleCalendar}</ButtonAnchor>
          {map && (
            <ButtonAnchor size="lg" href={map} icon={<Navigation />}>{t.directions}</ButtonAnchor>
          )}
        </div>
      )}
    </Section>
  );
}
