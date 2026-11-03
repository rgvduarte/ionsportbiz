import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Check, CheckCircle2, CircleSlash, Hourglass, MailCheck, RefreshCw, SunMedium, TicketX, UserRoundX, WifiOff } from 'lucide-react';
import type { GuestView } from '../../lib/api/types';
import { EVENT } from '../data/event';
import { TopBar } from '../components/ui';
import { fmtTime } from '../lib/format';
import { useI18n, type I18nKey } from '../lib/i18n';
import { credentialState, groupCode, passColors, passIsVip, type CredentialState } from '../lib/invite';
import { useProfile, useStore } from '../lib/store';
import { asset } from '../lib/asset';

/** Pedidos ao servidor: ao entrar no ecrã, ao voltar à app e, enquanto se espera pela equipa, de 30 em 30 segundos. */
function useLiveRefresh(waiting: boolean) {
  const { refresh } = useStore();
  const last = useRef(0);
  useEffect(() => {
    const run = () => {
      // "focus" e "visibilitychange" chegam muitas vezes juntos: um pedido chega.
      if (Date.now() - last.current < 2000) return;
      last.current = Date.now();
      void refresh();
    };
    run();
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') { last.current = Date.now(); void refresh(); }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [waiting, refresh]);
}

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

/** Credencial aprovada: o passe com o QR code real e os acessos atribuídos pela equipa. */
function Pass({ view }: { view: GuestView }) {
  const { t, locale } = useI18n();
  const p = useProfile();
  const inv = view.invitation;
  const code = inv.checkin_code!;
  const pass = inv.pass_type;
  const vip = passIsVip(pass);
  const colors = passColors(pass?.color);
  const style = !vip && colors ? ({ ['--pass' as string]: colors.accent, ['--pass-on' as string]: colors.on } as CSSProperties) : undefined;
  const sub = [p.role, p.company].filter(Boolean).join(' · ');

  return (
    <>
      <div className={`pass${vip ? ' pass-vip' : ''}`} style={style}>
        <div className="pass-top">
          <img src={asset('images/logo-full.webp')} alt="ion" className="pass-logo" />
          <img src={asset('images/pt-27.webp')} alt="PT ’27" className="pass-edition" />
        </div>
        <div className="pass-type">{pass?.name ?? t('cred.guest')}</div>
        <div className="pass-qr">
          <QRCodeSVG value={code} size={208} level="H" bgColor="#FFFFFF" fgColor="#000000" marginSize={2} title={`${t('cred.code')}: ${groupCode(code)}`} />
        </div>
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
      </div>

      {inv.checked_in_at ? (
        <p className="hint hint-ok">
          <CheckCircle2 size={18} /> {t('cred.checkedIn')} {fmtTime(inv.checked_in_at, locale)}
        </p>
      ) : (
        <p className="hint">
          <SunMedium size={18} /> {t('cred.brightness')}
        </p>
      )}

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
    body = <Pass view={view} />;
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
        actions={view.event.rsvp_open ? <Link to={`/c/${token}`} className="btn btn-primary">{t('cred.openInvite')}</Link> : contact}
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
        actions={view.event.rsvp_open ? <Link to={`/c/${token}`} className="btn btn-primary">{t('cred.confirm')}</Link> : contact}
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
        {body}
      </main>
    </>
  );
}
