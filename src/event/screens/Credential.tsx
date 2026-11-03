import { QRCodeSVG } from 'qrcode.react';
import { Check, SunMedium } from 'lucide-react';
import { EVENT } from '../data/event';
import { TopBar } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { asset } from '../lib/asset';

export default function Credential() {
  const { t } = useI18n();
  const { state } = useStore();
  const p = state.profile!;
  const access =
    p.ticket === 'vip'
      ? ['VIP Gala Dinner · 22/03', 'Awards Ceremony · 22/03', 'ion Conference · 23/03', 'VIP Lunch · 23/03', 'Closing Cocktail · 23/03']
      : ['ion Conference · 23/03', 'Networking Lunch · 23/03', 'Closing Cocktail · 23/03'];

  return (
    <>
      <TopBar title={t('cred.title')} />
      <main className="screen pad credential">
        <div className={`pass pass-${p.ticket}`}>
          <div className="pass-top">
            <img src={asset('images/logo-full.webp')} alt="ion" className="pass-logo" />
            <img src={asset('images/pt-27.webp')} alt="PT ’27" className="pass-edition" />
          </div>
          <div className="pass-type">{p.ticket === 'vip' ? t('cred.vip') : t('cred.conference')}</div>
          <div className="pass-qr">
            <QRCodeSVG value={`${p.id}|${p.email}`} size={208} level="M" bgColor="#FFFFFF" fgColor="#000000" marginSize={2} title={p.id} />
          </div>
          <div className="pass-name">{p.name}</div>
          <div className="pass-company">
            {p.role} · {p.company}
          </div>
          <div className="pass-id">
            <span>{t('cred.id')}</span>
            <code>{p.id}</code>
          </div>
        </div>

        <p className="hint">
          <SunMedium size={18} /> {t('cred.brightness')}
        </p>

        <h2 className="h2">{t('cred.access')}</h2>
        <ul className="access-list">
          {access.map((a) => (
            <li key={a}>
              <Check size={16} /> {a}
            </li>
          ))}
        </ul>
        <p className="muted small">
          {t('cred.nominal')} {EVENT.fullName}.
        </p>
      </main>
    </>
  );
}
