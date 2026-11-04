import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronRight, CircleHelp, Download, ExternalLink, Handshake, Languages, LogOut, Mail, MailCheck, Mic, Newspaper, Pencil, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { EVENT, PARTNERS } from '../data/event';
import { INTERESTS, SECTORS } from '../data/people';
import type { Sector } from '../data/types';
import { NEWS, newsById } from '../data/news';
import { Avatar, Empty, TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { fmtDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useAccessLabel } from '../lib/access';
import { credentialState } from '../lib/invite';
import { canRespond, safeUrl } from '../lib/rsvp';
import { useProfile, useStore } from '../lib/store';
import { asset } from '../lib/asset';
import { useInstallApp } from '../components/InstallApp';

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

/** Confirmação dentro do menu, trazida para cima da barra de separadores (fica muitas vezes no fim da página). */
function useScrollIntoView(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const tabbar = document.querySelector('.ev .tabbar')?.getBoundingClientRect().height ?? 0;
    const overflow = el.getBoundingClientRect().bottom - (window.innerHeight - tabbar - 16);
    if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'smooth' });
  }, [open]);
  return ref;
}

/** Proteção de dados: responsável, política e pedido de eliminação dos dados pessoais. */
function Privacy() {
  const { t } = useI18n();
  const { state, requestErasure } = useStore();
  const toast = useToast();
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const ref = useScrollIntoView(step === 'confirm');
  const e = state.view?.event;
  if (!e) return null;
  const policy = safeUrl(e.privacy_policy_url);
  const preview = !!state.preview;

  const send = async () => {
    setStep('busy');
    try {
      await requestErasure();
      setStep('done');
    } catch {
      setStep('confirm');
      toast(t('more.eraseError'), 'error');
    }
  };

  return (
    <section className="menu privacy" aria-labelledby="privacy-title">
      <div className="privacy-head">
        <h2 id="privacy-title"><ShieldCheck size={20} /> {t('more.privacy')}</h2>
        <p className="muted small">{t('more.privacyText')}</p>
        {e.privacy_controller && (
          <p className="small"><span className="muted">{t('more.controller')}:</span> {e.privacy_controller}</p>
        )}
      </div>
      {policy && <Item href={policy} icon={<ShieldCheck size={20} />}>{t('more.policy')}</Item>}
      {step === 'done' ? (
        <p className="menu-confirm privacy-done" role="status">{t('more.eraseDone')}</p>
      ) : step === 'idle' ? (
        <Item icon={<Trash2 size={20} />} onClick={() => setStep('confirm')}>{t('more.erase')}</Item>
      ) : (
        <div className="menu-confirm" role="group" aria-label={t('more.erase')} ref={ref}>
          <p>{preview ? t('preview.noSubmit') : t('more.eraseConfirm')}</p>
          <div className="actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('idle')} disabled={step === 'busy'}>{t('common.cancel')}</button>
            <button className="btn btn-danger btn-sm" onClick={() => void send()} disabled={preview || step === 'busy'} aria-busy={step === 'busy'}>
              {t('more.eraseYes')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function More() {
  const { t, lang, setLang } = useI18n();
  const { state, signOut } = useStore();
  const navigate = useNavigate();
  const p = useProfile();
  const access = useAccessLabel();
  const [confirmOut, setConfirmOut] = useState(false);
  const confirmRef = useScrollIntoView(confirmOut);
  const sub = [p.role, p.company].filter(Boolean).join(' · ');
  const view = state.view;
  // Responder (ou mudar a resposta) enquanto o prazo estiver aberto e a entrada não estiver registada.
  const reply = view && canRespond(view) ? (credentialState(view.invitation) === 'unconfirmed' ? t('more.respond') : t('more.change')) : null;
  const installer = useInstallApp();
  return (
    <>
      <TopBar title={t('more.title')} />
      <main className="screen pad">
        <Link to="/more/profile" className="me-card">
          <Avatar name={p.name || '?'} size={64} />
          <div className="row-body">
            <strong>{p.name}</strong>
            {sub && <span className="muted small">{sub}</span>}
            {access && <span className={`small${access.approved ? ' lime' : ' amber'}`}>{access.label}</span>}
          </div>
          <Pencil size={18} className="muted" />
        </Link>

        {reply && (
          <nav className="menu">
            <Item to="/convite" icon={<MailCheck size={20} />}>{reply}</Item>
          </nav>
        )}

        {installer.available && (
          <nav className="menu">
            <Item icon={<Download size={20} />} onClick={() => void installer.install()}>{t('install.menu')}</Item>
          </nav>
        )}
        {installer.sheet}

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
              <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')} aria-pressed={lang === 'pt'}>PT</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
            </div>
          </div>
        </div>

        <Privacy />

        <nav className="menu">
          <Item href={EVENT.website} icon={<img src={asset('images/logo-bubble.webp')} alt="" width={20} height={20} />}>{t('more.website')}</Item>
          <Item href={EVENT.contact} icon={<Mail size={20} />}>{t('more.contact')}</Item>
          {confirmOut ? (
            <div className="menu-confirm" role="group" aria-label={t('more.logout')} ref={confirmRef}>
              <p>{t('more.logoutConfirm')}</p>
              <div className="actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmOut(false)}>{t('common.cancel')}</button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => void signOut().then(() => navigate('/welcome', { replace: true }))}
                >
                  <LogOut size={16} /> {t('more.logoutYes')}
                </button>
              </div>
            </div>
          ) : (
            <Item icon={<LogOut size={20} />} onClick={() => setConfirmOut(true)}>
              {t('more.logout')}
            </Item>
          )}
        </nav>

        <img src={asset('images/wordmark.webp')} alt="International Business & Sports Conference — PT" className="wordmark" />
        <p className="muted small center">v{__APP_VERSION__}</p>
      </main>
    </>
  );
}

/** Perfil: nome, empresa e cargo vêm do convite (só leitura); setor e interesses são do participante. */
export function EditProfile() {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  const p = useProfile();
  const navigate = useNavigate();
  const toast = useToast();
  const [sector, setSector] = useState<Sector>(state.prefs.sector);
  const [interests, setInterests] = useState<string[]>(state.prefs.interests);
  const toggle = (i: string) => setInterests((all) => (all.includes(i) ? all.filter((x) => x !== i) : [...all, i]));

  return (
    <>
      <TopBar back title={t('more.profile')} />
      <main className="screen pad">
        <section className="invite-card">
          <p className="kicker">{t('profile.fromInvite')}</p>
          <dl>
            <div><dt>{t('profile.name')}</dt><dd>{p.name || '—'}</dd></div>
            <div><dt>{t('profile.role')}</dt><dd>{p.role || '—'}</dd></div>
            <div><dt>{t('profile.company')}</dt><dd>{p.company || '—'}</dd></div>
          </dl>
          <p className="muted small">{t('profile.fromInviteNote')}</p>
        </section>

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'updatePrefs', prefs: { sector, interests: INTERESTS.filter((i) => interests.includes(i)) } });
            toast(t('common.saved'));
            navigate(-1);
          }}
        >
          <div>
            <h2 className="h2 flush">{t('profile.networking')}</h2>
            <p className="muted small">{t('profile.networkingNote')}</p>
          </div>
          <label>
            <span>{t('profile.sector')}</span>
            <select value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {t(`sector.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="interest-picker">
            <legend>{t('profile.interests')}</legend>
            <div className="tags">
              {INTERESTS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`tag tag-toggle${interests.includes(i) ? ' on' : ''}`}
                  aria-pressed={interests.includes(i)}
                  onClick={() => toggle(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="btn btn-primary btn-block" type="submit">
            {t('common.save')}
          </button>
        </form>
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
