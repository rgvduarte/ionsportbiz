import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SECTORS } from '../data/people';
import type { Sector } from '../data/types';
import { useI18n } from '../lib/i18n';
import { newCredentialId, useStore, type Profile, type Ticket } from '../lib/store';
import { asset } from '../lib/asset';

export function ProfileForm({ initial, submitLabel, onSubmit, showTicket }: { initial?: Profile; submitLabel: string; onSubmit: (p: Profile) => void; showTicket?: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [sector, setSector] = useState<Sector>(initial?.sector ?? 'clubs');
  const [ticket, setTicket] = useState<Ticket>(initial?.ticket ?? 'vip');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ id: initial?.id ?? newCredentialId(), name: name.trim(), email: email.trim(), company: company.trim(), role: role.trim(), sector, ticket });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        <span>{t('welcome.name')}</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label>
        <span>{t('welcome.email')}</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
      </label>
      <div className="form-row">
        <label>
          <span>{t('welcome.company')}</span>
          <input required value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
        </label>
        <label>
          <span>{t('welcome.role')}</span>
          <input required value={role} onChange={(e) => setRole(e.target.value)} autoComplete="organization-title" />
        </label>
      </div>
      <label>
        <span>{t('welcome.sector')}</span>
        <select value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {t(`sector.${s}`)}
            </option>
          ))}
        </select>
      </label>
      {showTicket && (
        <label>
          <span>{t('welcome.ticket')}</span>
          <select value={ticket} onChange={(e) => setTicket(e.target.value as Ticket)}>
            <option value="vip">{t('cred.vip')}</option>
            <option value="conference">{t('cred.conference')}</option>
          </select>
        </label>
      )}
      <button className="btn btn-primary btn-block" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<'intro' | 'form'>('intro');

  return (
    <div className="welcome">
      <div className="welcome-lang">
        <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')}>PT</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
      </div>
      <div className="welcome-hero">
        <img src={asset('images/world-map.webp')} alt="" className="welcome-map" />
        <img src={asset('images/logo-bubble.webp')} alt="ion — International Business & Sports Conference" className="welcome-logo" />
      </div>
      <img src={asset('images/markets-strip.webp')} alt="PT Portugal · UAE United Arab Emirates · WW Worldwide · HK Hong Kong" className="markets-strip" />
      {step === 'intro' ? (
        <div className="welcome-body">
          <img src={asset('images/march-27.webp')} alt="March ’27" className="welcome-date" />
          <h1 className="display">{t('welcome.title')}</h1>
          <button className="btn btn-primary btn-block" onClick={() => setStep('form')}>
            {t('welcome.cta')}
          </button>
        </div>
      ) : (
        <div className="welcome-body">
          <ProfileForm
            showTicket
            submitLabel={t('welcome.submit')}
            onSubmit={(profile) => {
              dispatch({ type: 'signIn', profile });
              navigate('/', { replace: true });
            }}
          />
          <p className="muted small center">{t('welcome.legal')}</p>
        </div>
      )}
    </div>
  );
}
