import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarPlus, Check, CheckCircle2, CircleSlash, Hourglass, MailCheck, Maximize2, Navigation, RefreshCw, SunMedium, TicketX, UserRoundX, WifiOff, X } from 'lucide-react';
import type { GuestView } from '../../lib/api/types';
import { inviteUrl } from '../../lib/config';
import { buildIcs, canDownloadIcs, downloadIcs, icsFilename } from '../../lib/ics';
import { EVENT } from '../data/event';
import { TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { fmtTime } from '../lib/format';
import { useI18n, type I18nKey } from '../lib/i18n';
import { credentialState, groupCode, passColors, passIsVip, type CredentialState } from '../lib/invite';
import { calendarUid, eventIsPast, mapsUrl } from '../lib/rsvp';
import { useProfile, useStore } from '../lib/store';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { asset } from '../lib/asset';
import { ease, motionTokens } from '../../lib/motion/tokens';

const STEPS: I18nKey[] = ['cred.step1', 'cred.step2', 'cred.step3', 'cred.step4'];

/** Do convite ao QR code: o passo atual e os já feitos. */
function Steps({ current, failed }: { current: number; failed?: boolean }) {
  const { t } = useI18n();
  return (
    <ol className="cred-steps">
      {STEPS.map((k, i) => {
        const n = i + 1;
        const cls = n < current ? 'done' : n === current ? (failed ? 'failed' : 'current') : '';
        return (
          <li key={k} className={cls} aria-current={n === current ? 'step' : undefined}>
            <span className="step-dot">{n < current ? <Check size={14} strokeWidth={3} /> : n}</span>
            {t(k)}
          </li>
        );
      })}
    </ol>
  );
}

function StateCard({ tone, icon, title, children, actions }: { tone: 'wait' | 'neutral' | 'warn'; icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`cred-state cred-state-${tone}`}>
      <span className="cred-state-icon" aria-hidden>{icon}</span>
      <h2>{title}</h2>
      <div className="cred-state-body">{children}</div>
      {actions && <div className="cred-state-actions">{actions}</div>}
    </section>
  );
}

function PassSkeleton() {
  const { t } = useI18n();
  return (
    <div className="pass pass-skel" aria-busy aria-label={t('cred.loading')}>
      <div className="pass-top">
        <img src={asset('images/logo-full.webp')} alt="" className="pass-logo" />
        <img src={asset('images/pt-27.webp')} alt="" className="pass-edition" />
      </div>
      <span className="skel skel-pill" />
      <span className="skel skel-qr" />
      <span className="skel skel-line" />
      <span className="skel skel-line short" />
    </div>
  );
}

function contactHref(e: GuestView['event']): string {
  return e.contact_email ? `mailto:${e.contact_email}` : EVENT.contact;
}

/** Hora a contar ao segundo: numa captura de ecrã fica parada, o que denuncia uma credencial copiada. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Faixa "credencial ativa": ponto a pulsar e relógio ao segundo. A equipa à porta vê que é a app, não uma imagem. */
function LiveStrip() {
  const { t, locale } = useI18n();
  const now = useClock();
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  return (
    <div className="pass-live">
      <span className="pass-live-dot" aria-hidden />
      <span>{t('cred.live')}</span>
      <time className="pass-live-clock" dateTime={now.toISOString()}>{time}</time>
    </div>
  );
}

/** QR em ecrã inteiro, em fundo branco (mais brilho e um código maior para o leitor à entrada). */
function QrZoom({ code, name, onClose }: { code: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const size = Math.min(window.innerWidth - 64, 360);
  return (
    <m.div
      className="qr-zoom"
      role="dialog"
      aria-modal="true"
      aria-label={t('cred.code')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionTokens.duration.standard }}
      onClick={onClose}
    >
      <m.div layoutId="pass-qr" className="qr-zoom-code" transition={motionTokens.spring.morph}>
        <QRCodeSVG value={code} size={size} level="H" bgColor="#FFFFFF" fgColor="#000000" marginSize={2} />
      </m.div>
      <p className="qr-zoom-name">{name}</p>
      <p className="qr-zoom-code-id">{groupCode(code)}</p>
      <button ref={close} type="button" className="qr-zoom-close" aria-label={t('cred.closeZoom')} onClick={onClose}>
        <X size={22} />
      </button>
    </m.div>
  );
}

/** Credencial aprovada: o passe com o QR code real e os acessos atribuídos pela equipa. */
function Pass({ view, actions }: { view: GuestView; actions?: ReactNode }) {
  const { t, locale } = useI18n();
  const p = useProfile();
  const inv = view.invitation;
  const code = inv.checkin_code!;
  const pass = inv.pass_type;
  const vip = passIsVip(pass);
  const colors = passColors(pass?.color);
  const style = !vip && colors ? ({ ['--pass' as string]: colors.accent, ['--pass-on' as string]: colors.on } as CSSProperties) : undefined;
  const sub = [p.role, p.company].filter(Boolean).join(' · ');

  const [zoom, setZoom] = useState(false);
  const qrButton = useRef<HTMLButtonElement>(null);
  const closeZoom = () => {
    setZoom(false);
    qrButton.current?.focus();
  };

  return (
    <>
      {/* Entrada do passe: sobe e assenta (mola), com o conteúdo em cascata. */}
      <m.div
        className={`pass${vip ? ' pass-vip' : ''}`}
        style={style}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...motionTokens.spring.smooth, visualDuration: motionTokens.duration.considered }}
      >
        <span className="pass-foil" aria-hidden />
        <div className="pass-top">
          <img src={asset('images/logo-full.webp')} alt="ion" className="pass-logo" />
          <img src={asset('images/pt-27.webp')} alt="PT ’27" className="pass-edition" />
        </div>
        <div className="pass-type">{pass?.name ?? t('cred.guest')}</div>
        <button ref={qrButton} type="button" className="pass-qr" onClick={() => setZoom(true)} aria-label={t('cred.enlarge')}>
          {zoom ? (
            <span className="pass-qr-placeholder" />
          ) : (
            <m.span layoutId="pass-qr" className="pass-qr-code" transition={motionTokens.spring.morph}>
              <QRCodeSVG value={code} size={208} level="H" bgColor="#FFFFFF" fgColor="#000000" marginSize={2} title={`${t('cred.code')}: ${groupCode(code)}`} />
            </m.span>
          )}
          <span className="pass-qr-hint" aria-hidden><Maximize2 size={14} /></span>
        </button>
        <div className="pass-name">{p.name}</div>
        {sub && <div className="pass-company">{sub}</div>}
        {inv.companions.length > 0 && (
          <div className="pass-plus">
            <span>{t('cred.companions')}</span> {inv.companions.map((c) => c.full_name).join(', ')}
          </div>
        )}
        <div className="pass-id">
          <span>{t('cred.code')}</span>
          <code>{groupCode(code)}</code>
        </div>
        {!inv.checked_in_at && <LiveStrip />}
      </m.div>

      <AnimatePresence>{zoom && <QrZoom code={code} name={p.name} onClose={closeZoom} />}</AnimatePresence>

      {inv.checked_in_at ? (
        <p className="hint hint-ok">
          <CheckCircle2 size={18} /> {t('cred.checkedIn')} {fmtTime(inv.checked_in_at, locale)}
        </p>
      ) : (
        <p className="hint">
          <SunMedium size={18} /> {t('cred.brightness')}
        </p>
      )}

      {actions}

      {pass && pass.accesses.length > 0 && (
        <>
          <h2 className="h2">{t('cred.access')}</h2>
          {pass.description && <p className="muted pass-desc">{pass.description}</p>}
          <ul className="access-list">
            {pass.accesses.map((a) => (
              <li key={a}>
                <Check size={16} /> {a}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">
        {t('cred.nominal')} {EVENT.fullName}.
      </p>
    </>
  );
}

/** "Adicionar ao calendário" (.ics) e "Como chegar" (mapa), para quem já tem a credencial. */
function PassActions({ view, token }: { view: GuestView; token: string }) {
  const { t } = useI18n();
  const { state } = useStore();
  const toast = useToast();
  const e = view.event;
  // Calculado de antemão: na app nativa, a partilha do sistema tem de abrir logo a seguir ao toque.
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void calendarUid(token).then((v) => { if (alive) setUid(v); });
    return () => { alive = false; };
  }, [token]);
  if (eventIsPast(e)) return null;
  const map = mapsUrl(e);
  const ics = canDownloadIcs();
  if (!map && !ics) return null;

  const addToCalendar = async () => {
    try {
      // O link pessoal vai só no ficheiro, que fica no dispositivo do convidado (abre a credencial no dia).
      // Na pré-visualização o convite não é de quem está a ver: sem link.
      const link = state.preview ? null : inviteUrl(token);
      const description = [e.host_name, e.dress_code, link && `${t('cred.calLink')}: ${link}`].filter(Boolean).join('\n');
      await downloadIcs(icsFilename(e.name), buildIcs({
        uid: uid ?? (await calendarUid(token)),
        title: e.name,
        description,
        location: [e.venue_name, e.venue_address].filter(Boolean).join(', ') || null,
        url: link,
        start: e.starts_at,
        end: e.ends_at,
        organizerName: e.host_name,
        organizerEmail: e.contact_email,
      }));
    } catch {
      toast(t('cred.calError'), 'error');
    }
  };

  return (
    <div className="pass-actions">
      {ics && (
        <button className="btn btn-outline" onClick={() => void addToCalendar()}>
          <CalendarPlus size={18} /> {t('agenda.addCal')}
        </button>
      )}
      {map && (
        <a className="btn btn-outline" href={map} target="_blank" rel="noopener noreferrer">
          <Navigation size={18} /> {t('cred.directions')}
        </a>
      )}
    </div>
  );
}

function stateOf(view: GuestView | null): CredentialState | null {
  return view ? credentialState(view.invitation) : null;
}

export default function Credential() {
  const { t, locale } = useI18n();
  const { state, sync, refresh, signOut } = useStore();
  const navigate = useNavigate();
  const view = state.view;
  const token = state.token!;
  const cs = stateOf(view);
  useLiveRefresh(cs === 'pending' || cs === 'unconfirmed');
  const toast = useToast();
  // Aprovado enquanto o convidado tinha o ecrã aberto: avisa (o passe entra com animação).
  const lastState = useRef(cs);
  useEffect(() => {
    if (lastState.current === 'pending' && cs === 'approved') toast(t('cred.approvedNow'));
    lastState.current = cs;
  }, [cs, toast, t]);

  const loading = sync === 'loading';
  const refreshBtn = (
    <button className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
      <RefreshCw size={16} className={loading ? 'spin' : undefined} /> {t('cred.refresh')}
    </button>
  );
  const contact = view && (
    <a className="btn btn-outline" href={contactHref(view.event)} target={view.event.contact_email ? undefined : '_blank'} rel="noreferrer">
      {t('cred.contact')}
    </a>
  );

  let body: ReactNode;
  if (!view) {
    if (sync === 'unavailable') {
      body = (
        <StateCard
          tone="neutral"
          icon={<TicketX size={28} />}
          title={t('cred.unavailableTitle')}
          actions={
            <>
              <button className="btn btn-primary" onClick={() => void signOut().then(() => navigate('/welcome', { replace: true }))}>
                {t('cred.useAnother')}
              </button>
              <a className="btn btn-outline" href={EVENT.contact} target="_blank" rel="noreferrer">{t('cred.contact')}</a>
            </>
          }
        >
          <p>{t('cred.unavailableBody')}</p>
        </StateCard>
      );
    } else if (sync === 'offline') {
      body = (
        <StateCard
          tone="neutral"
          icon={<WifiOff size={28} />}
          title={t('cred.offlineTitle')}
          actions={<button className="btn btn-primary" onClick={() => void refresh()}><RefreshCw size={18} /> {t('cred.retry')}</button>}
        >
          <p>{t('cred.offlineBody')}</p>
        </StateCard>
      );
    } else {
      body = <PassSkeleton />;
    }
  } else if (cs === 'approved') {
    body = <Pass view={view} actions={<PassActions view={view} token={token} />} />;
  } else if (cs === 'pending') {
    body = (
      <StateCard tone="wait" icon={<Hourglass size={28} />} title={t('cred.pendingTitle')} actions={refreshBtn}>
        <p>{t('cred.pendingBody')}</p>
        <Steps current={3} />
      </StateCard>
    );
  } else if (cs === 'rejected') {
    body = (
      <StateCard tone="neutral" icon={<CircleSlash size={28} />} title={t('cred.rejectedTitle')} actions={contact}>
        <p>{t('cred.rejectedBody')}</p>
      </StateCard>
    );
  } else if (cs === 'declined') {
    body = (
      <StateCard
        tone="neutral"
        icon={<UserRoundX size={28} />}
        title={t('cred.declinedTitle')}
        actions={view.event.rsvp_open ? <Link to="/convite" className="btn btn-primary">{t('cred.openInvite')}</Link> : contact}
      >
        <p>{view.event.rsvp_open ? t('cred.declinedBody') : t('cred.rsvpClosed')}</p>
      </StateCard>
    );
  } else {
    const pass = view.invitation.pass_type;
    body = (
      <StateCard
        tone="warn"
        icon={<MailCheck size={28} />}
        title={t('cred.unconfirmedTitle')}
        actions={view.event.rsvp_open ? <Link to="/convite" className="btn btn-primary">{t('cred.confirm')}</Link> : contact}
      >
        <p>{view.event.rsvp_open ? t('cred.unconfirmedBody') : t('cred.rsvpClosed')}</p>
        {pass && (
          <p className="cred-assigned">
            {t('cred.assigned')} <strong>{pass.name}</strong>
          </p>
        )}
        <Steps current={2} />
      </StateCard>
    );
  }

  const updated = state.fetchedAt
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(state.fetchedAt))
    : null;

  return (
    <>
      <TopBar title={t('cred.title')} />
      <main className="screen pad credential">
        {sync === 'offline' && view && (
          <p className="cred-note" role="status">
            <WifiOff size={16} />
            <span>
              {cs === 'approved' ? t('cred.offlineCached') : t('cred.offlineStale')}
              {updated && <> · {t('cred.updatedAt')} {updated}</>}
            </span>
          </p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={cs ?? sync}
            className="cred-body"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: motionTokens.duration.exit, ease: ease(motionTokens.ease.exit) } }}
            transition={{ duration: motionTokens.duration.standard, ease: ease(motionTokens.ease.enter) }}
          >
            {body}
          </m.div>
        </AnimatePresence>
      </main>
    </>
  );
}
