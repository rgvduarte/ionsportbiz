import { useEffect, useRef, useState } from 'react';
import { Download, EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
import { inviteUrl } from '../../lib/config';
import { prepareIosInstall, usePwaInstall } from '../../lib/pwa';
import { useI18n } from '../lib/i18n';
import { storage } from '../lib/storage';
import { useStore } from '../lib/store';
import { useToast } from './Toast';
import { asset } from '../lib/asset';

const DISMISSED = 'installDismissed';

/**
 * Instalar a app: no Android abre o instalador do Chrome; no iPhone (e quando o Chrome não o oferece)
 * mostra os passos. Devolve a ação e a folha de instruções a colocar no ecrã.
 */
export function useInstallApp() {
  const pwa = usePwaInstall();
  const { state } = useStore();
  const { t } = useI18n();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  // Na pré-visualização da equipa o convite não é de quem está a ver: não se instala.
  const available = pwa.available && !state.preview;

  const install = async () => {
    if (pwa.canPrompt) {
      if (await pwa.prompt()) toast(t('install.done'));
      return;
    }
    if (pwa.platform === 'ios') prepareIosInstall(state.token ? inviteUrl(state.token) : null);
    setSheet(true);
  };

  const node = sheet ? <InstallSheet platform={pwa.platform} onClose={() => setSheet(false)} /> : null;
  return { available, install, sheet: node };
}

/** Cartão no início: aparece até o convidado instalar ou fechar. */
export function InstallCard() {
  const { t } = useI18n();
  const { available, install, sheet } = useInstallApp();
  const [dismissed, setDismissed] = useState(() => storage.get<boolean>(DISMISSED) === true);
  if (!available || dismissed) return sheet;
  return (
    <>
      <section className="install-card" aria-label={t('install.title')}>
        <img src={asset('icons/icon-192.png')} alt="" className="install-icon" width={48} height={48} />
        <div className="install-text">
          <strong>{t('install.title')}</strong>
          <span>{t('install.body')}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => void install()}>
          <Download size={16} /> {t('install.cta')}
        </button>
        <button
          className="install-close"
          aria-label={t('install.dismiss')}
          onClick={() => { storage.set(DISMISSED, true); setDismissed(true); }}
        >
          <X size={18} />
        </button>
      </section>
      {sheet}
    </>
  );
}

/** Passos para instalar à mão: iPhone (Safari) ou o menu do browser no Android. */
function InstallSheet({ platform, onClose }: { platform: 'ios' | 'android' | 'other'; onClose: () => void }) {
  const { t } = useI18n();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const ios = platform === 'ios';
  const steps = ios
    ? [
        { icon: <Share size={20} />, text: t('install.ios1') },
        { icon: <SquarePlus size={20} />, text: t('install.ios2') },
        { icon: <Download size={20} />, text: t('install.ios3') },
      ]
    : [
        { icon: <EllipsisVertical size={20} />, text: t('install.android1') },
        { icon: <Download size={20} />, text: t('install.android2') },
      ];
  return (
    <div className="install-sheet-backdrop" onClick={onClose}>
      <div className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-sheet-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="install-sheet-title">{t('install.title')}</h2>
        <ol className="install-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="install-step-icon" aria-hidden>{s.icon}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        {ios && <p className="muted small">{t('install.iosNote')}</p>}
        <button ref={close} className="btn btn-primary btn-block" onClick={onClose}>{t('install.ok')}</button>
      </div>
    </div>
  );
}
