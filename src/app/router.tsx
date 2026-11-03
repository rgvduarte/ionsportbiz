import { createBrowserRouter, createHashRouter, Link, type RouteObject } from 'react-router';
import { Mail } from 'lucide-react';
import { RequireStaff, RoleGate } from './guards';
import { RouteError } from './RouteError';
import { useAuth } from './AuthProvider';
import { isNative } from '../native/platform';
import { ButtonLink, useDocumentTitle } from '../ui';
import type { StaffRole } from '../lib/api';

const CRM: StaffRole[] = ['admin', 'editor', 'viewer'];
const EDIT: StaffRole[] = ['admin', 'editor'];
const DOOR: StaffRole[] = ['admin', 'editor', 'checkin'];
const ADMIN: StaffRole[] = ['admin'];

/** Rota carregada a pedido, limitada a alguns papéis. */
function page(load: () => Promise<React.ComponentType>, roles?: StaffRole[]): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const C = await load();
      return { Component: roles ? () => <RoleGate roles={roles}><C /></RoleGate> : C };
    },
  };
}

/**
 * Endereço inexistente. Quem chega aqui é muitas vezes um convidado com o link incompleto:
 * não o mandamos para a entrada da equipa. "Voltar ao início" só para a equipa ou na app.
 */
function NotFound() {
  const { session, loading } = useAuth();
  useDocumentTitle('Página não encontrada');
  const staff = !!session?.staff;
  return (
    <main className="ui-standalone">
      <div className="ui-standalone__card">
        <span className="ui-standalone__mark" aria-hidden><Mail /></span>
        <p className="ui-standalone__eyebrow">Erro 404</p>
        <h1>Página não encontrada</h1>
        <p>O endereço não existe ou foi alterado. Se recebeu um convite, abra o link completo que lhe foi enviado por email ou mensagem.</p>
        {!loading && (
          <div className="ui-standalone__actions">
            {staff || isNative
              ? <ButtonLink to={staff ? '/admin' : '/'} variant="primary">Voltar ao início</ButtonLink>
              : <Link to="/entrar" className="ui-standalone__link">Acesso da equipa</Link>}
          </div>
        )}
      </div>
    </main>
  );
}

const routes: RouteObject[] = [
  { path: '/entrar', ...page(async () => (await import('../admin/LoginPage')).LoginPage) },
  { path: '/c/:token', ...page(async () => (await import('../guest/GuestInvitationPage')).GuestInvitationPage) },
  { path: '/app', ...page(async () => (await import('../guest/NativeHomePage')).NativeHomePage) },
  {
    path: '/admin',
    lazy: async () => {
      const { AdminLayout } = await import('../admin/AdminLayout');
      return { Component: () => <RequireStaff><AdminLayout /></RequireStaff> };
    },
    children: [
      { index: true, ...page(async () => (await import('../admin/dashboard/DashboardPage')).DashboardPage, CRM) },
      { path: 'contactos', ...page(async () => (await import('../admin/contacts/ContactsPage')).ContactsPage, CRM) },
      { path: 'contactos/importar', ...page(async () => (await import('../admin/contacts/ContactImportPage')).ContactImportPage, EDIT) },
      { path: 'contactos/:contactId', ...page(async () => (await import('../admin/contacts/ContactDetailPage')).ContactDetailPage, CRM) },
      { path: 'eventos', ...page(async () => (await import('../admin/events/EventsPage')).EventsPage, CRM) },
      { path: 'eventos/novo', ...page(async () => (await import('../admin/events/EventFormPage')).EventFormPage, EDIT) },
      {
        path: 'eventos/:eventId',
        ...page(async () => (await import('../admin/events/EventLayout')).EventLayout, CRM),
        children: [
          { index: true, ...page(async () => (await import('../admin/invitations/InvitationsPage')).InvitationsPage) },
          { path: 'programa', ...page(async () => (await import('../admin/events/ProgrammePage')).ProgrammePage) },
          { path: 'acessos', ...page(async () => (await import('../admin/events/PassTypesPage')).PassTypesPage) },
          { path: 'mensagens', ...page(async () => (await import('../admin/invitations/TemplatesPage')).TemplatesPage) },
          { path: 'definicoes', ...page(async () => (await import('../admin/events/EventFormPage')).EventFormPage, EDIT) },
        ],
      },
      { path: 'check-in', ...page(async () => (await import('../admin/checkin/CheckinPage')).CheckinPage, DOOR) },
      { path: 'equipa', ...page(async () => (await import('../admin/team/TeamPage')).TeamPage, ADMIN) },
      { path: '*', Component: NotFound },
    ],
  },
  // App do evento (participantes): início, agenda, oradores, credencial, networking, notícias.
  { path: '/*', ...page(async () => (await import('../event/EventApp')).EventApp) },
];

// Cada rota de topo mostra RouteError em vez do ecrã de erro técnico do React Router.
for (const route of routes) route.ErrorBoundary = RouteError;

// VITE_ROUTER=hash: rotas depois de "#", para alojamentos sem reescrita de rotas (ex.: demonstração no GitHub Pages).
export const router = import.meta.env.VITE_ROUTER === 'hash'
  ? createHashRouter(routes)
  : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
