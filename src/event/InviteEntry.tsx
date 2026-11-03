import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Link2Off, Mail, RefreshCw, WifiOff } from 'lucide-react';
import { api } from '../lib/api';
import type { GuestView } from '../lib/api/types';
import { useI18n } from './lib/i18n';
import { entryPath } from './lib/rsvp';
import { useStore } from './lib/store';
import { asset } from './lib/asset';

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Link pessoal do convite (/c/<token>): abre a app do evento diretamente, sem página intermédia.
 * O convite fica guardado neste dispositivo e passa a ser o ativo; quem ainda não respondeu vai
 * para a resposta (/convite), os restantes para o início.
 * Com ?preview=1 (botão "Pré-visualizar" do back-office) o convite fica só nesta janela, sem
 * registar a abertura nem guardar nada no dispositivo.
 */
export default function InviteEntry() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const { t } = useI18n();
  const { state, signIn, enterPreview } = useStore();
  const navigate = useNavigate();
  const [result, setResult] = useState<'loading' | 'invalid' | 'offline'>(TOKEN.test(token) ? 'loading' : 'invalid');
  // Um só pedido por abertura (o StrictMode corre os efeitos duas vezes; a abertura conta uma vez).
  const request = useRef<{ key: string; run: Promise<GuestView | null> } | null>(null);

  const open = useCallback(async (alive: () => boolean) => {
    const key = `${token}:${preview}`;
    if (request.current?.key !== key) request.current = { key, run: api.guest.view(token, { track: !preview }) };
    try {
      const view = await request.current.run;
      if (!alive()) return;
      if (!view) {
        setResult('invalid');
        return;
      }
      if (preview) enterPreview(token, view);
      else await signIn(token, view);
      if (alive()) navigate(entryPath(view), { replace: true });
    } catch {
      request.current = null;
      if (alive()) setResult('offline');
    }
  }, [token, preview, signIn, enterPreview, navigate]);

  useEffect(() => {
    if (!TOKEN.test(token)) return;
    let alive = true;
    void open(() => alive);
    return () => { alive = false; };
  }, [token, open]);

  if (result === 'loading') {
    return (
      <div className="entry" aria-busy>
        <img src={asset('images/logo-bubble.webp')} alt="ion" className="entry-logo pulse" />
        <p className="muted">{t('entry.loading')}</p>
      </div>
    );
  }

  // O convite deste dispositivo (se houver) diz a quem pedir ajuda; sem ele, uma indicação geral.
  const known = state.preview ? null : state.view?.event.contact_email;
  return (
    <div className="entry">
      <img src={asset('images/logo-bubble.webp')} alt="ion" className="entry-logo" />
      <section className="cred-state">
        <span className="cred-state-icon" aria-hidden>{result === 'offline' ? <WifiOff size={28} /> : <Link2Off size={28} />}</span>
        <h1 className="entry-title">{result === 'offline' ? t('cred.offlineTitle') : t('entry.invalidTitle')}</h1>
        <div className="cred-state-body">
          <p>{result === 'offline' ? t('welcome.errOffline') : t('entry.invalidBody')}</p>
          {result === 'invalid' && !known && <p className="muted small">{t('entry.invalidHelp')}</p>}
        </div>
        <div className="cred-state-actions">
          {result === 'offline' ? (
            <button className="btn btn-primary" onClick={() => { setResult('loading'); void open(() => true); }}>
              <RefreshCw size={18} /> {t('common.retry')}
            </button>
          ) : (
            <>
              {state.token && <Link to="/" replace className="btn btn-primary">{t('entry.openApp')}</Link>}
              {known && (
                <a className="btn btn-outline" href={`mailto:${known}`}>
                  <Mail size={18} /> {t('cred.contact')}
                </a>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
