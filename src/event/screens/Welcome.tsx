import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { ArrowLeft, ArrowRight, CircleAlert, KeyRound, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { EVENT } from '../data/event';
import { Boot } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { parseInviteToken } from '../lib/invite';
import { entryPath } from '../lib/rsvp';
import { useStore } from '../lib/store';
import { asset } from '../lib/asset';
import { KineticText } from '../components/KineticText';

/**
 * Entrada da app: só para convidados. Entra-se com o link pessoal do convite (o mesmo do email ou do WhatsApp).
 * Com um convite já guardado neste dispositivo, a app abre diretamente.
 */
export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { state, ready, signIn } = useStore();
  const [step, setStep] = useState<'intro' | 'link'>('intro');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Com convite: a resposta, se ainda faltar, ou o início (como ao abrir o link pessoal).
  if (state.token) return <Navigate to={state.view && !state.preview ? entryPath(state.view) : '/'} replace />;
  if (!ready) return <Boot />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const token = parseInviteToken(value);
    if (!token) {
      setError(t('welcome.errInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const view = await api.guest.view(token, { track: false });
      if (!view) setError(t('welcome.errNotFound'));
      else await signIn(token, view); // a seguir, state.token leva ao início
    } catch {
      setError(t('welcome.errOffline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-lang">
        <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')} aria-pressed={lang === 'pt'}>PT</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
      </div>
      <div className={`welcome-hero${step === 'link' ? ' compact' : ''}`}>
        <img src={asset('images/world-map.webp')} alt="" className="welcome-map" />
        <img src={asset('images/logo-bubble.webp')} alt="ion — International Business & Sports Conference" className="welcome-logo" />
      </div>
      <img src={asset('images/markets-strip.webp')} alt="PT Portugal · UAE United Arab Emirates · WW Worldwide · HK Hong Kong" className="markets-strip" />

      {step === 'intro' ? (
        <div className="welcome-body">
          <img src={asset('images/march-27.webp')} alt="March ’27" className="welcome-date" />
          <h1 className="display"><KineticText text={t('welcome.title')} delay={0.15} /></h1>
          <div className="invite-only">
            <span className="invite-only-icon" aria-hidden><LockKeyhole size={20} /></span>
            <div>
              <strong>{t('welcome.exclusive')}</strong>
              <p className="muted">{t('welcome.intro')}</p>
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setStep('link')}>
            <Mail size={20} /> {t('welcome.cta')}
          </button>
          <p className="muted small center">
            {t('welcome.noInvite')}{' '}
            <a href={EVENT.contact} target="_blank" rel="noreferrer" className="link">{t('welcome.contact')}</a>
          </p>
        </div>
      ) : (
        <div className="welcome-body">
          <button type="button" className="back-link" onClick={() => { setStep('intro'); setError(null); }}>
            <ArrowLeft size={18} /> {t('common.back')}
          </button>
          <div>
            <h1 className="display-sm">{t('welcome.cta')}</h1>
            <p className="muted">{t('welcome.linkIntro')}</p>
          </div>
          <form className="form" onSubmit={submit} noValidate>
            <label>
              <span>{t('welcome.linkLabel')}</span>
              <input
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
                placeholder={t('welcome.linkPlaceholder')}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? 'welcome-error' : 'welcome-help'}
              />
            </label>
            {error ? (
              <p id="welcome-error" className="form-error" role="alert">
                <CircleAlert size={18} /> {error}
              </p>
            ) : (
              <p id="welcome-help" className="muted small">{t('welcome.linkHelp')}</p>
            )}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !value.trim()} aria-busy={busy}>
              {busy ? <><LoaderCircle size={20} className="spin" /> {t('welcome.checking')}</> : <>{t('welcome.submit')} <ArrowRight size={20} /></>}
            </button>
          </form>
          <p className="muted small center">{t('welcome.legal')}</p>
        </div>
      )}

      <footer className="welcome-foot">
        <Link to="/entrar" className="staff-link">
          <KeyRound size={14} /> {t('welcome.staff')}
        </Link>
      </footer>
    </div>
  );
}
