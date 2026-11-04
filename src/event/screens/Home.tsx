import { Link } from 'react-router';
import { Bell, CalendarDays, ChevronRight, Mic, QrCode, Users } from 'lucide-react';
import { DAYS, EVENT, GALLERY, PARTNERS, QUOTES, SESSIONS } from '../data/event';
import { NEWS } from '../data/news';
import { SessionCard } from '../components/SessionCard';
import { InviteCard } from '../components/InviteCard';
import { SectionTitle, TopBar } from '../components/ui';
import { fmtDate, fmtShortDay } from '../lib/format';
import { useI18n, type I18nKey } from '../lib/i18n';
import { pendingCount, useStore } from '../lib/store';
import { useCountdown } from '../lib/useCountdown';
import { asset } from '../lib/asset';
import { FlapDigit } from '../components/SplitFlap';
import { InstallCard } from '../components/InstallApp';

/** Contagem decrescente em painel de partidas: cada algarismo é uma placa (ver SplitFlap). */
function Countdown() {
  const { t } = useI18n();
  const c = useCountdown(EVENT.start);
  if (c.done) return <p className="countdown-live">{t('home.live')}</p>;
  let order = 0;
  const group = (v: number, label: string) => {
    const s = String(v).padStart(2, '0');
    return (
      <div className="cd-group">
        <span className="cd-digits">
          {/* Chave pela posição a contar da direita: de 100 para 99 dias, as unidades continuam na mesma placa. */}
          {[...s].map((d, i) => <FlapDigit key={s.length - i} digit={d} delay={order++ * 60} />)}
        </span>
        <span className="cd-label">{label}</span>
      </div>
    );
  };
  return (
    <div className="countdown" role="timer" aria-label={t('home.countdown')}>
      <span className="visually-hidden">
        {c.days} {t('home.days')}, {c.hours} {t('home.hours')}, {c.minutes} {t('home.min')}
      </span>
      <div className="cd-board" aria-hidden>
        {group(c.days, t('home.days'))}
        {group(c.hours, t('home.hours'))}
        {group(c.minutes, t('home.min'))}
        {group(c.seconds, t('home.sec'))}
      </div>
    </div>
  );
}

export default function Home() {
  const { t, locale } = useI18n();
  const { state } = useStore();
  const pending = pendingCount(state);
  const mine = SESSIONS.filter((s) => state.favorites.includes(s.id)).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <TopBar
        right={
          <Link to="/news" className="icon-btn" aria-label={t('home.news')}>
            <Bell size={22} />
          </Link>
        }
      />
      <main className="screen home">
        {/* O convite primeiro: responder, aguardar a aprovação ou a credencial. */}
        <div className="pad-x home-invite">
          <InviteCard />
          <InstallCard />
        </div>

        <section className="hero">
          <img src={asset('images/world-map.webp')} alt="" className="hero-map" />
          <img src={asset('images/logo-liga-portugal.webp')} alt="ion — International Business & Sports Conference · Liga Portugal" className="hero-logo" />
          <img src={asset('images/march-27.webp')} alt="March ’27" className="hero-date" />
        </section>

        <img src={asset('images/markets-strip.webp')} alt="PT Portugal · UAE United Arab Emirates · WW Worldwide · HK Hong Kong" className="markets-strip" />

        <section className="pad">
          <p className="kicker">{t('home.countdown')}</p>
          <Countdown />
        </section>

        {pending > 0 && (
          <Link to="/networking?tab=connections" className="alert pad-x">
            <span className="alert-num">{pending}</span>
            <span>{t('home.requests')}</span>
            <ChevronRight size={18} />
          </Link>
        )}

        <section className="quick pad">
          <Link to="/credential" className="quick-card">
            <QrCode size={26} />
            <span>{t('home.quick.credential')}</span>
          </Link>
          <Link to="/agenda" className="quick-card">
            <CalendarDays size={26} />
            <span>{t('home.quick.agenda')}</span>
          </Link>
          <Link to="/networking" className="quick-card">
            <Users size={26} />
            <span>{t('home.quick.networking')}</span>
          </Link>
          <Link to="/speakers" className="quick-card">
            <Mic size={26} />
            <span>{t('home.quick.speakers')}</span>
          </Link>
        </section>

        <section className="pad">
          <p className="about">{t('home.about')}</p>
        </section>

        <section className="pad">
          <SectionTitle>{t('home.twoDays')}</SectionTitle>
          <div className="days">
            {DAYS.map((d) => (
              <Link key={d.id} to={`/agenda?day=${d.id}`} className="day-card">
                <img src={asset(d.image)} alt={fmtShortDay(`${d.id}T12:00:00Z`, locale)} className="day-num" />
                <div className="day-box">
                  <img src={asset('images/march-27.webp')} alt="" className="day-march" />
                  {d.highlights.map((h) => (
                    <strong key={h}>{h}</strong>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="stats pad">
          {EVENT.stats.map((s) => (
            <div key={s.key} className="stat">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{t(s.key as I18nKey)}</span>
            </div>
          ))}
        </section>

        <section className="pad">
          <SectionTitle action={<Link to="/agenda?mine=1" className="link">{t('common.seeAll')}</Link>}>{t('home.mySessions')}</SectionTitle>
          {mine.length === 0 ? (
            <p className="muted">{t('home.mySessionsEmpty')}</p>
          ) : (
            <div className="list">
              {mine.slice(0, 3).map((s) => (
                <SessionCard key={s.id} session={s} showDay={fmtShortDay(s.start, locale)} />
              ))}
            </div>
          )}
        </section>

        <section className="quotes">
          {QUOTES.map((q) => (
            <figure key={q.author} className="quote">
              <img src={asset(q.image)} alt={`“${q.text}” — ${q.author}`} />
            </figure>
          ))}
        </section>

        <section className="pad">
          <SectionTitle action={<Link to="/news" className="link">{t('common.seeAll')}</Link>}>{t('home.news')}</SectionTitle>
          <div className="news-row">
            {NEWS.map((n) => (
              <Link key={n.id} to={`/news/${n.id}`} className="news-card">
                <img src={asset(n.image)} alt="" />
                <span className="muted small">{fmtDate(n.date, locale)}</span>
                <strong>{n.title}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="pad-x">
            <SectionTitle>
              <span className="gradient-text">{t('home.pieces')}</span>
            </SectionTitle>
          </div>
          <div className="gallery">
            {GALLERY.map((g, i) => (
              <img key={g} src={asset(g)} alt={`ion 2026 — ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </section>

        <section className="pad partner-strip">
          <p className="kicker">{t('home.partner')}</p>
          {PARTNERS.filter((p) => p.tier === 'institutional').map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="partner-name">
              {p.name}
            </a>
          ))}
          <img src={asset('images/wordmark.webp')} alt="International Business & Sports Conference — PT" className="wordmark" />
        </section>
      </main>
    </>
  );
}
