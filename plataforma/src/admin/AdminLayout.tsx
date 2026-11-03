import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { CalendarDays, LayoutDashboard, LogOut, Mail, Menu, ScanLine, Users, UserCog } from 'lucide-react';
import './admin.css';
import { useAuth } from '../app/AuthProvider';
import { api } from '../lib/api';
import { resetDemo } from '../lib/api/demo/store';
import { ROLE } from '../lib/status';
import { Avatar, Button, useConfirm } from '../ui';

const SECTIONS: { to: string; label: string; end?: boolean }[] = [
  { to: '/admin', label: 'Painel', end: true },
  { to: '/admin/eventos', label: 'Eventos' },
  { to: '/admin/contactos', label: 'Contactos' },
  { to: '/admin/check-in', label: 'Check-in' },
  { to: '/admin/equipa', label: 'Equipa' },
];

export function AdminLayout() {
  const { session, can, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const confirm = useConfirm();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [location.pathname]);

  // Menu móvel: ao abrir, o foco passa para a navegação; Escape fecha e devolve o foco ao botão.
  useEffect(() => {
    if (!open) return;
    document.querySelector<HTMLElement>('#adm-sidebar .adm-nav a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const staff = session!.staff!;
  const items = [
    can.readCrm && { to: '/admin', label: 'Painel', icon: <LayoutDashboard />, end: true },
    can.readCrm && { to: '/admin/eventos', label: 'Eventos', icon: <CalendarDays /> },
    can.readCrm && { to: '/admin/contactos', label: 'Contactos', icon: <Users /> },
    can.checkIn && { to: '/admin/check-in', label: 'Check-in', icon: <ScanLine /> },
  ].filter(Boolean) as { to: string; label: string; icon: React.ReactNode; end?: boolean }[];

  // Título do separador por secção; as páginas com título próprio (PageHeader, useDocumentTitle) acertam-no
  // depois (efeito normal, que corre após este).
  useLayoutEffect(() => {
    const path = location.pathname.replace(/\/+$/, '');
    const section = [...SECTIONS].reverse().find((s) => path === s.to || (!s.end && path.startsWith(`${s.to}/`)));
    document.title = section ? `${section.label} · Convites` : 'Convites';
  }, [location.pathname]);

  const onReset = async () => {
    if (await confirm({ title: 'Repor os dados de demonstração?', message: 'As alterações feitas nesta demonstração perdem-se.', confirmLabel: 'Repor' })) {
      resetDemo();
      window.location.reload();
    }
  };

  return (
    <div className="adm">
      <aside id="adm-sidebar" className={['adm-sidebar', open && 'open'].filter(Boolean).join(' ')} aria-label="Navegação principal">
        <div className="adm-brand">
          <span className="adm-brand__mark"><Mail aria-hidden /></span>
          <span>Convites<small>Gestão de convidados</small></span>
        </div>
        <nav className="adm-nav">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>{i.icon}{i.label}</NavLink>
          ))}
          {can.admin && (
            <>
              <div className="adm-nav__label">Administração</div>
              <NavLink to="/admin/equipa"><UserCog />Equipa</NavLink>
            </>
          )}
        </nav>
        <div className="adm-user">
          <Avatar name={staff.full_name} />
          <div style={{ minWidth: 0 }}>
            <div className="adm-user__name">{staff.full_name}</div>
            <div className="adm-user__role">{ROLE[staff.role].label}</div>
          </div>
          <Button variant="ghost" size="sm" iconOnly aria-label="Terminar sessão" title="Terminar sessão" icon={<LogOut />} onClick={() => void signOut()} />
        </div>
      </aside>
      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
      <div className="adm-main">
        <header className="adm-topbar">
          <Button ref={menuButton} variant="ghost" iconOnly aria-label="Abrir menu" aria-expanded={open} aria-controls="adm-sidebar"
            icon={<Menu />} onClick={() => setOpen(true)} />
          <span className="adm-topbar__title">Convites</span>
        </header>
        {api.mode === 'demo' && (
          <div className="adm-demo" role="note">
            <span>Modo demonstração: dados fictícios, guardados só neste browser.</span>
            <button type="button" onClick={() => void onReset()}>Repor dados</button>
          </div>
        )}
        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
