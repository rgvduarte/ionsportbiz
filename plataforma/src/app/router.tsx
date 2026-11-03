import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequireStaff, RoleGate } from './guards';
import { isNative } from '../native/platform';
import { EmptyState, ButtonLink } from '../ui';
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

function NotFound() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <EmptyState title="Página não encontrada" actions={<ButtonLink to="/" variant="primary">Voltar ao início</ButtonLink>}>
        O endereço não existe ou foi alterado.
      </EmptyState>
    </div>
  );
}

const routes: RouteObject[] = [
  { path: '/', element: <Navigate to={isNative ? '/app' : '/admin'} replace /> },
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
          { path: 'mensagens', ...page(async () => (await import('../admin/invitations/TemplatesPage')).TemplatesPage) },
          { path: 'definicoes', ...page(async () => (await import('../admin/events/EventFormPage')).EventFormPage, EDIT) },
        ],
      },
      { path: 'check-in', ...page(async () => (await import('../admin/checkin/CheckinPage')).CheckinPage, DOOR) },
      { path: 'equipa', ...page(async () => (await import('../admin/team/TeamPage')).TeamPage, ADMIN) },
    ],
  },
  { path: '*', Component: NotFound },
];

export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
