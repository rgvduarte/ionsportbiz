import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, CheckCircle2, ChevronRight, Hourglass, Info, RefreshCw, TicketX, UserRoundX, WifiOff } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { credentialState, passColors, passIsVip } from '../lib/invite';
import { canRespond, eventDays } from '../lib/rsvp';
import { useProfile, useStore } from '../lib/store';
import { useLiveRefresh } from '../lib/useLiveRefresh';

/**
 * "O seu convite": o primeiro bloco do início, conforme o ponto em que o convidado está.
 * Por responder → botão grande para a resposta; à espera da equipa → uma frase; aprovado → mini credencial.
 */
export function InviteCard() {
  const { t, locale } = useI18n();
  const { state, sync, refresh } = useStore();
  const p = useProfile();
  const view = state.view;
  const cs = view ? credentialState(view.invitation) : null;
  useLiveRefresh(cs === 'pending' || cs === 'unconfirmed');

  const hello = p.firstName ? <p className="icard-hello">{t('home.hello')}, <strong>{p.firstName}</strong></p> : null;
  const row = (icon: ReactNode, title: string, body?: ReactNode, action?: ReactNode, tone = '') => (
    <section className={`icard${tone ? ` icard-${tone}` : ''}`} aria-label={t('invite.title')}>
      {hello}
      <div className="icard-row">
        <span className="icard-icon" aria-hidden>{icon}</span>
        <div className="icard-text">
          <strong>{title}</strong>
          {body && <p>{body}</p>}
        </div>
      </div>
      {action && <div className="icard-actions">{action}</div>}
    </section>
  );

  if (!view || !cs) {
    if (sync === 'unavailable') return row(<TicketX size={22} />, t('cred.unavailableTitle'));
    if (sync === 'offline') {
      return row(<WifiOff size={22} />, t('cred.offlineTitle'), undefined,
        <button className="btn btn-ghost btn-sm" onClick={() => void refresh()}><RefreshCw size={16} /> {t('common.retry')}</button>);
    }
    return (
      <section className="icard" aria-busy aria-label={t('card.loading')}>
        <span className="skel skel-line short" />
        <span className="skel skel-btn" />
      </section>
    );
  }

  const { invitation: inv, event: e } = view;
  const open = canRespond(view);
  const change = open && <Link to="/convite" className="icard-link">{t('card.change')} <ChevronRight size={16} /></Link>;

  if (cs === 'unconfirmed') {
    return (
      <section className="icard icard-cta" aria-label={t('invite.title')}>
        {hello}
        <p className="kicker">{t('invite.title')}</p>
        <h2 className="icard-event">{e.name}</h2>
        <p className="icard-days">{eventDays(e, locale).map((d) => <span key={d}>{d}</span>)}</p>
        {open ? (
          <Link to="/convite" className="btn btn-primary btn-lg btn-block">
            {t('card.answer')} <ArrowRight size={20} />
          </Link>
        ) : (
          <p className="muted">{t('card.closed')}</p>
        )}
      </section>
    );
  }

  if (cs === 'pending') {
    return row(<Hourglass size={22} />, t('card.pendingTitle'), t('card.pendingBody'), change, 'wait');
  }

  if (cs === 'rejected') return row(<Info size={22} />, t('card.rejectedTitle'), t('card.rejectedBody'));

  if (cs === 'declined') {
    return row(<UserRoundX size={22} />, t('card.declinedTitle'), undefined,
      open && <Link to="/convite" className="btn btn-outline btn-sm">{t('card.change')}</Link>);
  }

  // Aprovado: mini credencial com o tipo de acesso (na cor dele) e o QR code, que leva à credencial.
  const pass = inv.pass_type;
  const vip = passIsVip(pass);
  const colors = passColors(pass?.color);
  const style = !vip && colors ? ({ ['--pass' as string]: colors.accent, ['--pass-on' as string]: colors.on } as CSSProperties) : undefined;
  return (
    <Link to="/credential" className={`icard icard-pass${vip ? ' pass-vip' : ''}`} style={style} aria-label={`${t('card.seePass')} — ${pass?.name ?? t('cred.guest')}`}>
      <div className="icard-pass-main">
        {hello}
        <span className="pass-type icard-chip">{pass?.name ?? t('cred.guest')}</span>
        {inv.checked_in_at
          ? <span className="icard-ok"><CheckCircle2 size={16} /> {t('card.checkedIn')}</span>
          : <span className="icard-see">{t('card.seePass')} <ArrowRight size={18} /></span>}
      </div>
      <span className="icard-qr" aria-hidden>
        <QRCodeSVG value={inv.checkin_code!} size={76} level="M" bgColor="#FFFFFF" fgColor="#000000" marginSize={1} />
      </span>
    </Link>
  );
}
