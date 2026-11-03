import type { ApprovalStatus, Channel, EventStatus, InvitationStatus, StaffRole } from './api/types';
import type { Tone } from '../ui/Feedback';

export const INVITATION_STATUS: Record<InvitationStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Por enviar', tone: 'neutral' },
  sent: { label: 'Enviado', tone: 'info' },
  opened: { label: 'Visto', tone: 'accent' },  // o convidado abriu o convite (≠ evento «Aberto»)
  accepted: { label: 'Confirmado', tone: 'success' },
  declined: { label: 'Recusado', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
};

/** Decisão da equipa sobre a presença (só conta para quem confirmou). */
export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Por aprovar', tone: 'warning' },
  approved: { label: 'Aprovado', tone: 'success' },
  rejected: { label: 'Não aprovado', tone: 'danger' },
};

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone; hint: string }> = {
  draft: { label: 'Rascunho', tone: 'neutral', hint: 'Os links dos convidados ainda não abrem.' },
  open: { label: 'Aberto', tone: 'success', hint: 'Os convidados podem abrir o convite e responder.' },
  closed: { label: 'Fechado', tone: 'warning', hint: 'Os convidados veem o convite e o bilhete, mas já não respondem.' },
  archived: { label: 'Arquivado', tone: 'neutral', hint: 'Os links deixam de funcionar.' },
};

export const ROLE: Record<StaffRole, { label: string; description: string }> = {
  admin: { label: 'Administrador', description: 'Acesso total, incluindo equipa e eliminação de dados (RGPD).' },
  editor: { label: 'Editor', description: 'Gere contactos, eventos, convites e envios.' },
  checkin: { label: 'Receção', description: 'Só faz check-in à porta. Não vê o CRM.' },
  viewer: { label: 'Leitura', description: 'Consulta sem alterar.' },
};

export const CHANNEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  manual: 'Manual',
  link: 'Link',
};

export const ACTIVITY: Record<string, string> = {
  'contact.created': 'Contacto criado',
  'contact.anonymized': 'Dados pessoais apagados (RGPD)',
  'invitation.created': 'Convite criado',
  'invitation.sent': 'Convite enviado',
  'invitation.resent': 'Convite reenviado',
  'invitation.opened': 'Convite visto',
  'invitation.accepted': 'Presença confirmada',
  'invitation.declined': 'Convite recusado',
  'invitation.cancelled': 'Convite cancelado',
  'invitation.reopened': 'Convite reaberto',
  'invitation.approved': 'Presença aprovada',
  'invitation.rejected': 'Presença não aprovada',
  'invitation.approval_reset': 'Aprovação reposta (por aprovar)',
  checkin: 'Entrada registada',
  'checkin.undone': 'Entrada anulada',
  'consent.granted': 'Consentimento para comunicações dado',
  'consent.revoked': 'Consentimento para comunicações retirado',
  'privacy.erasure_requested': 'Pediu a eliminação dos dados',
  note: 'Nota',
};
