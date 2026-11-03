import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronRight, CircleHelp, ExternalLink, Handshake, Languages, LogOut, Mail, Mic, Newspaper, Pencil, Star } from 'lucide-react';
import { EVENT, PARTNERS } from '../data/event';
import { NEWS, newsById } from '../data/news';
import { Avatar, Empty, TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { fmtDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { ProfileForm } from './Welcome';
import { asset } from '../lib/asset';

function Item({ to, href, icon, children, onClick }: { to?: string; href?: string; icon: ReactNode; children: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="menu-icon">{icon}</span>
      <span className="menu-label">{children}</span>
      {href ? <ExternalLink size={16} className="muted" /> : <ChevronRight size={18} className="muted" />}
    </>
  );
  if (to) return <Link to={to} className="menu-item">{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className="menu-item">{inner}</a>;
  return <button className="menu-item" onClick={onClick}>{inner}</button>;
}

export default function More() {
  const { t, lang, setLang } = useI18n();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const p = state.profile!;
  return (
    <>
      <TopBar title={t('more.title')} />
      <main className="screen pad">
        <Link to="/more/profile" className="me-card">
          <Avatar name={p.name} size={64} />
          <div className="row-body">
            <strong>{p.name}</strong>
            <span className="muted small">{p.role} · {p.company}</span>
            <span className="small lime">{p.ticket === 'vip' ? t('cred.vip') : t('cred.conference')}</span>
          </div>
          <Pencil size={18} className="muted" />
        </Link>

        <nav className="menu">
          <Item to="/agenda?mine=1" icon={<Star size={20} />}>{t('more.myAgenda')}</Item>
          <Item to="/speakers" icon={<Mic size={20} />}>{t('speakers.title')}</Item>
          <Item to="/partners" icon={<Handshake size={20} />}>{t('more.partners')}</Item>
          <Item to="/news" icon={<Newspaper size={20} />}>{t('more.news')}</Item>
          <Item to="/info" icon={<CircleHelp size={20} />}>{t('more.info')}</Item>
        </nav>

        <div className="menu">
          <div className="menu-item static">
            <span className="menu-icon"><Languages size={20} /></span>
            <span className="menu-label">{t('more.language')}</span>
            <div className="lang-switch">
              <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')}>PT</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
        </div>

        <nav className="menu">
          <Item href={EVENT.website} icon={<img src={asset('images/logo-bubble.webp')} alt="" width={20} height={20} />}>{t('more.website')}</Item>
          <Item href={EVENT.contact} icon={<Mail size={20} />}>{t('more.contact')}</Item>
          <Item icon={<LogOut size={20} />} onClick={() => { dispatch({ type: 'signOut' }); navigate('/welcome', { replace: true }); }}>
            {t('more.logout')}
          </Item>
        </nav>

        <img src={asset('images/wordmark.webp')} alt="International Business & Sports Conference — PT" className="wordmark" />
        <p className="muted small center">v{__APP_VERSION__}</p>
      </main>
    </>
  );
}

export function EditProfile() {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <>
      <TopBar back title={t('more.profile')} />
      <main className="screen pad">
        <ProfileForm
          initial={state.profile!}
          submitLabel={t('common.save')}
          onSubmit={(profile) => {
            dispatch({ type: 'updateProfile', profile });
            toast(t('common.saved'));
            navigate(-1);
          }}
        />
      </main>
    </>
  );
}

export function Partners() {
  const { t } = useI18n();
  return (
    <>
      <TopBar back title={t('partners.title')} />
      <main className="screen pad">
        {PARTNERS.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="partner-card">
            <p className="kicker">{t('partners.institutional')}</p>
            {p.logo && <img src={asset(p.logo)} alt={`ion × ${p.name}`} />}
            <strong>{p.name}</strong>
          </a>
        ))}
        <div className="tba">
          {[0, 1, 2, 3].map((i) => <div key={i} className="tba-slot" aria-hidden />)}
        </div>
        <p className="muted center">{t('partners.tba')}</p>
      </main>
    </>
  );
}

export function Info() {
  const { t } = useI18n();
  const faqs = [1, 2, 3, 4] as const;
  return (
    <>
      <TopBar back title={t('info.title')} />
      <main className="screen pad">
        <div className="info-grid">
          <div className="info-box">
            <span className="kicker">{t('info.when')}</span>
            <strong>{t('info.whenValue')}</strong>
          </div>
          <div className="info-box">
            <span className="kicker">{t('info.where')}</span>
            <strong>{t('info.whereValue')}</strong>
          </div>
        </div>
        <img src={asset('images/portugal-map.webp')} alt="" className="pt-map" />
        <div className="faq">
          {faqs.map((n) => (
            <details key={n}>
              <summary>{t(`info.faq${n}q`)}</summary>
              <p>{t(`info.faq${n}a`)}</p>
            </details>
          ))}
        </div>
      </main>
    </>
  );
}

export function NewsList() {
  const { t, locale } = useI18n();
  return (
    <>
      <TopBar back title={t('news.title')} />
      <main className="screen pad">
        <div className="list">
          {NEWS.map((n) => (
            <Link key={n.id} to={`/news/${n.id}`} className="news-item">
              <img src={asset(n.image)} alt="" />
              <div>
                <span className="muted small">{fmtDate(n.date, locale)}</span>
                <strong>{n.title}</strong>
                <p className="muted small">{n.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export function NewsDetail() {
  const { id = '' } = useParams();
  const { locale } = useI18n();
  const n = newsById(id);
  if (!n) return (<><TopBar back /><main className="screen pad"><Empty>404</Empty></main></>);
  return (
    <>
      <TopBar back />
      <main className="screen detail">
        <img src={asset(n.image)} alt="" className="news-hero" />
        <div className="pad">
          <span className="muted small">{fmtDate(n.date, locale)}</span>
          <h1 className="display-sm">{n.title}</h1>
          {n.body.map((p, i) => <p key={i} className="lead">{p}</p>)}
        </div>
      </main>
    </>
  );
}
