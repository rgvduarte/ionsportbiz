import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { m } from 'motion/react';
import { motionTokens } from '../../lib/motion/tokens';
import { CalendarDays, Ellipsis, House, QrCode, Users } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { pendingCount, useStore } from '../lib/store';

export function TabBar() {
  const { t } = useI18n();
  const { state } = useStore();
  const pending = pendingCount(state);
  const tab = (to: string, label: string, icon: ReactNode, badge?: number) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
      {({ isActive }) => (
        <>
          <span className="tab-icon">
            {/* Destaque partilhado: desliza de um separador para o outro (layoutId). */}
            {isActive && <m.span layoutId="ev-tab-ind" className="tab-ind" transition={motionTokens.spring.morph} aria-hidden />}
            {icon}
            {!!badge && <span className="badge">{badge}</span>}
          </span>
          <span className="tab-label">{label}</span>
        </>
      )}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {tab('/', t('tab.home'), <House size={22} />)}
      {tab('/agenda', t('tab.agenda'), <CalendarDays size={22} />)}
      <NavLink to="/credential" className={({ isActive }) => `tab tab-pass${isActive ? ' active' : ''}`}>
        <span className="pass-bubble">
          <QrCode size={26} />
        </span>
        <span className="tab-label">{t('tab.credential')}</span>
      </NavLink>
      {tab('/networking', t('tab.networking'), <Users size={22} />, pending)}
      {tab('/more', t('tab.more'), <Ellipsis size={22} />)}
    </nav>
  );
}
