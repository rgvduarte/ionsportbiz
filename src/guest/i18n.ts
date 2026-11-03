// Textos do convidado (convite pessoal e app), em português de Portugal e inglês.
// Registo formal ("V. Exa.", "o seu convite"). As datas usam o `locale` de cada língua.

import { createContext, useContext } from 'react';
import type { ApiErrorCode } from '../lib/api/errors';
import type { ApprovalStatus, InvitationStatus, Language } from '../lib/api/types';

export type GuestErrorCode = Extract<ApiErrorCode,
  'not_found' | 'rsvp_closed' | 'capacity_full' | 'too_many_companions' | 'invalid_companions'
  | 'invalid_answers' | 'invalid_note' | 'already_checked_in' | 'network' | 'unknown'>;

const pt = {
  lang: 'pt' as Language,
  locale: 'pt-PT',
  htmlLang: 'pt-PT',
  languageLabel: 'Idioma',
  languageNames: { pt: 'Português', en: 'English' } as Record<Language, string>,
  documentTitle: (event: string) => `${event} — Convite`,

  // Estados da página
  loading: 'A abrir o seu convite…',
  previewBanner: 'Pré-visualização — a abertura não é registada',
  previewNoSubmit: 'Pré-visualização: as respostas não são gravadas.',
  invalidTitle: 'Este convite não está disponível',
  invalidBody: 'O link pode estar incompleto ou o convite pode já não estar ativo. Confirme que abriu o link completo que recebeu. Se a dúvida persistir, contacte a entidade que lhe enviou o convite.',
  loadErrorTitle: 'Não foi possível abrir o convite',
  loadErrorBody: 'Verifique a ligação à internet e tente novamente.',
  retry: 'Tentar novamente',
  backToApp: 'Os meus convites',

  // Cartão do convite
  timeRange: (start: string, end: string | null) => (end ? `${start} – ${end}` : start),
  timezoneNote: (zone: string) => `Horas indicadas no fuso horário do evento (${zone}).`,
  viewMap: 'Ver no mapa',
  dressCode: 'Traje',

  // Resposta
  rsvpEyebrow: 'Confirmação',
  rsvpTitle: 'A sua resposta',
  rsvpIntro: 'Agradecemos que nos indique se poderá estar presente.',
  rsvpDeadline: (date: string) => `Agradecemos a sua resposta até ${date}.`,
  accept: 'Confirmo a minha presença',
  decline: 'Não poderei estar presente',
  approvalNote: 'A presença fica sujeita a aprovação: depois da sua resposta, a equipa da ion indicará o seu tipo de acesso e a credencial com o código QR ficará disponível nesta página.',
  reservedEyebrow: 'Acesso reservado',
  reservedTitle: (pass: string | null) => (pass ? `O seu acesso ${pass} já está reservado` : 'O seu lugar já está reservado'),
  reservedBody: 'Confirme a sua presença para receber a credencial com o código QR.',
  acceptFormTitle: 'Confirmação de presença',
  declineFormTitle: 'Não poderei estar presente',
  declineFormIntro: 'Se o desejar, deixe uma mensagem à organização.',
  companionsQuestion: 'Far-se-á acompanhar?',
  companionsHint: (n: number) => (n === 1 ? 'Pode fazer-se acompanhar de uma pessoa.' : `Pode fazer-se acompanhar de até ${n} pessoas.`),
  yes: 'Sim',
  no: 'Não',
  companionName: (i: number, many: boolean) => (many ? `Nome completo do ${i}.º acompanhante` : 'Nome completo do acompanhante'),
  addCompanion: 'Acrescentar acompanhante',
  removeCompanion: (i: number) => `Retirar o ${i}.º acompanhante`,
  additionalInfo: 'Informações adicionais',
  selectPlaceholder: 'Selecione…',
  noteLabel: 'Mensagem para a organização',
  noteCounter: (n: number, max: number) => `${n} de ${max} caracteres`,
  consentPolicyLink: 'Consulte a política de privacidade.',
  requiredLegend: 'Os campos assinalados com * são obrigatórios.',
  requiredError: 'Preencha este campo.',
  requiredCheckError: 'Assinale esta opção para continuar.',
  companionError: 'Indique o nome completo do acompanhante.',
  formErrorSummary: 'Verifique os campos assinalados.',
  submitAccept: 'Confirmar presença',
  submitDecline: 'Enviar resposta',
  back: 'Voltar',

  // Depois de responder
  acceptedTitle: 'Presença confirmada',
  acceptedBody: 'Muito obrigado. A sua presença está confirmada; será um gosto recebê-lo(a).',
  approvedBody: (pass: string) => `Muito obrigado. A sua presença está confirmada e o seu acesso ${pass} foi aprovado; será um gosto recebê-lo(a).`,
  acceptedPastBody: 'A sua presença foi confirmada.',
  attendedBody: 'Agradecemos a sua presença.',
  declinedTitle: 'Resposta registada',
  declinedBody: 'Lamentamos que não possa estar presente e agradecemos que nos tenha informado.',
  respondedOn: (date: string) => `Resposta enviada a ${date}.`,
  changeAnswer: 'Alterar resposta',
  changeUntil: (date: string) => `Pode alterar a sua resposta até ${date}.`,
  summaryCompanions: 'Acompanhantes',
  summaryNone: 'Sem acompanhantes',
  summaryNote: 'A sua mensagem',
  yesValue: 'Sim',
  noValue: 'Não',
  toastAccepted: 'A sua presença ficou confirmada.',
  toastAcceptedPending: 'A sua presença ficou confirmada e aguarda agora a aprovação da equipa.',
  toastDeclined: 'A sua resposta foi registada.',
  closedTitle: 'Respostas encerradas',
  closedBody: 'O prazo de resposta a este convite terminou. Para qualquer questão, contacte a organização.',
  pastTitle: 'Este evento já se realizou',
  pastBody: 'Agradecemos o seu interesse.',
  checkedIn: (time: string) => `Entrada registada às ${time}. Seja bem-vindo(a).`,
  checkedInPast: (date: string, time: string) => `Entrada registada a ${date}, às ${time}.`,

  // Aprovação pela equipa
  awaitingTitle: 'Presença confirmada',
  awaitingStatus: 'A aguardar aprovação',
  awaitingBody: 'Obrigado pela sua resposta. A equipa da ion irá confirmar o seu tipo de acesso. Assim que o fizer, a sua credencial com o código QR ficará disponível nesta página e receberá uma notificação.',
  stepsLabel: 'Próximos passos',
  stepConfirmed: 'Presença confirmada',
  stepApproval: 'Aprovação pela equipa da ion',
  stepApprovalNow: 'Em análise',
  stepCredential: 'Credencial com código QR',
  stepCredentialHint: 'Ficará disponível nesta página',
  stepDone: 'Concluído',
  stepCurrent: 'Em curso',
  stepNext: 'A seguir',
  rejectedTitle: 'Presença não confirmada',
  rejectedBody: 'Não foi possível confirmar a sua presença neste evento. Agradecemos sinceramente o seu interesse e a sua compreensão.',
  rejectedContacts: 'Para qualquer esclarecimento, a organização está ao seu dispor:',

  errors: {
    not_found: 'Este convite já não está disponível.',
    rsvp_closed: 'O prazo de resposta terminou, pelo que já não é possível alterar a resposta.',
    capacity_full: 'Lamentamos, mas já não existem lugares disponíveis. Se indicou acompanhantes, pode confirmar apenas a sua presença.',
    too_many_companions: 'Indicou mais acompanhantes do que os previstos no seu convite.',
    invalid_companions: 'Indique o nome completo de cada acompanhante.',
    invalid_answers: 'Não foi possível guardar as respostas. Reveja o formulário e tente novamente.',
    invalid_note: 'A mensagem é demasiado longa.',
    already_checked_in: 'A sua entrada já foi registada, pelo que a resposta não pode ser alterada.',
    network: 'Sem ligação à internet. Verifique a ligação e tente novamente.',
    unknown: 'Não foi possível enviar a sua resposta. Tente novamente dentro de instantes.',
  } satisfies Record<GuestErrorCode, string>,

  // Acesso
  ticketEyebrow: 'No dia do evento',
  ticketTitle: 'O seu acesso',
  ticketIntro: 'Guarde este ecrã ou adicione o evento ao seu calendário.',
  ticketHint: 'Apresente este código à entrada.',
  ticketCode: 'Código de acesso',
  ticketGuest: 'Convidado(a)',
  ticketCompanions: 'Acompanhantes',
  ticketWhere: 'Local',
  passLabel: 'Tipo de acesso',
  passIncludes: 'Inclui',
  qrLabel: (code: string) => `Código QR de acesso ${code}`,
  addToCalendar: 'Adicionar ao calendário',
  googleCalendar: 'Google Calendar',
  directions: 'Como chegar',
  // O nome do anfitrião costuma começar por artigo ("O Conselho de Administração…"): sem preposição antes.
  calendarDescription: (host: string | null) => (host ? `${host} — convite pessoal.` : 'Convite pessoal.'),
  calendarLink: 'O seu convite',
  calendarError: 'Não foi possível criar o ficheiro de calendário.',
  eventAppTitle: 'A app do evento',
  eventAppBody: 'Programa, oradores e networking, com a sua credencial sempre à mão.',
  eventAppOpen: 'Abrir a app do evento',
  eventAppPreview: 'Pré-visualização: o convite não é guardado neste dispositivo.',

  // Programa
  programmeEyebrow: 'Programa',
  programmeTitle: 'Programa',
  until: 'até',

  // Informações
  infoEyebrow: 'Apoio ao convidado',
  infoTitle: 'Informações e contactos',
  aboutTitle: 'Sobre o evento',
  contactsTitle: 'Contactos da organização',
  contactsIntro: 'Para qualquer questão sobre o evento ou o seu convite, contacte a organização.',
  email: 'Email',
  phone: 'Telefone',

  // Privacidade
  privacyTitle: 'Proteção de dados',
  privacyText: 'Os seus dados são tratados apenas para a gestão deste convite e do acesso ao evento.',
  privacyController: 'Responsável pelo tratamento',
  privacyPolicy: 'Política de privacidade',
  erasureRequest: 'Pedir a eliminação dos meus dados',
  erasureConfirmTitle: 'Pedir a eliminação dos seus dados?',
  erasureConfirmBody: 'A organização será notificada e tratará da eliminação dos seus dados pessoais. Depois disso, este convite deixará de estar disponível.',
  erasureConfirm: 'Enviar pedido',
  cancel: 'Cancelar',
  erasureDone: 'Recebemos o seu pedido. A organização tratará da eliminação dos seus dados e poderá contactá-lo(a) para o confirmar.',
  erasureError: 'Não foi possível enviar o pedido. Tente novamente dentro de instantes.',

  // App: os meus convites
  appTitle: 'Os meus convites',
  appIntro: 'Os convites que abrir nesta aplicação ficam guardados aqui.',
  appBrowserNote: 'Esta página destina-se à aplicação móvel. No browser, abra o seu convite através do link pessoal que recebeu por email ou mensagem.',
  appEmptyTitle: 'Ainda não tem convites guardados',
  appEmptyBody: 'Abra o link pessoal que recebeu por email ou mensagem, ou adicione-o aqui.',
  appAdd: 'Adicionar convite',
  appAddTitle: 'Adicionar convite',
  appAddIntro: 'Cole o link pessoal que recebeu por email ou mensagem.',
  appAddLabel: 'Link do convite',
  appAddPlaceholder: 'https://…/c/…',
  appAddInvalid: 'Não reconhecemos este link. Confirme que copiou o link completo.',
  appAddNotFound: 'Este convite não está disponível. Confirme o link ou contacte a organização.',
  appAddOpen: 'Abrir convite',
  appScan: 'Ler código QR',
  or: 'ou',
  appScanError: 'Não foi possível ler o código. Tente novamente ou cole o link.',
  appUpcoming: 'Próximos',
  appPast: 'Anteriores',
  appRemove: 'Retirar da lista',
  appRemoveConfirmTitle: 'Retirar este convite da lista?',
  appRemoveConfirmBody: 'O convite continua válido. Pode voltar a adicioná-lo através do link pessoal.',
  appRemoveConfirm: 'Retirar',
  appRemoved: 'Convite retirado da lista.',
  appOffline: 'Sem ligação: a mostrar a última informação guardada.',
  appStaff: 'Acesso da equipa',
  guestStatus: {
    pending: 'Aguarda a sua resposta',
    accepted: 'Presença confirmada',
    awaitingApproval: 'Aguarda aprovação',
    notConfirmed: 'Presença não confirmada',
    declined: 'Não vai estar presente',
    closed: 'Respostas encerradas',
    checkedIn: 'Entrada registada',
    unavailable: 'Indisponível',
  },
};

export type GuestStrings = typeof pt;

const en: GuestStrings = {
  lang: 'en',
  locale: 'en-GB',
  htmlLang: 'en',
  languageLabel: 'Language',
  languageNames: { pt: 'Português', en: 'English' },
  documentTitle: (event) => `${event} — Invitation`,

  loading: 'Opening your invitation…',
  previewBanner: 'Preview — this visit is not recorded',
  previewNoSubmit: 'Preview: replies are not saved.',
  invalidTitle: 'This invitation is not available',
  invalidBody: 'The link may be incomplete or the invitation may no longer be active. Please make sure you opened the full link you received. If in doubt, contact the organisation that sent you the invitation.',
  loadErrorTitle: 'We could not open the invitation',
  loadErrorBody: 'Please check your internet connection and try again.',
  retry: 'Try again',
  backToApp: 'My invitations',

  timeRange: (start, end) => (end ? `${start} – ${end}` : start),
  timezoneNote: (zone) => `Times are shown in the event's time zone (${zone}).`,
  viewMap: 'View map',
  dressCode: 'Dress code',

  rsvpEyebrow: 'RSVP',
  rsvpTitle: 'Your reply',
  rsvpIntro: 'We would be grateful if you could let us know whether you will be able to attend.',
  rsvpDeadline: (date) => `Kindly reply by ${date}.`,
  accept: 'I will attend',
  decline: 'I will not be able to attend',
  approvalNote: 'Attendance is subject to approval: once you reply, the ion team will assign your access type and your credential with the QR code will become available on this page.',
  reservedEyebrow: 'Access reserved',
  reservedTitle: (pass) => (pass ? `Your ${pass} access is reserved` : 'Your place is reserved'),
  reservedBody: 'Please confirm your attendance to receive your credential with the QR code.',
  acceptFormTitle: 'Confirm attendance',
  declineFormTitle: 'I will not be able to attend',
  declineFormIntro: 'If you wish, you may leave a message for the organisers.',
  companionsQuestion: 'Will you be accompanied?',
  companionsHint: (n) => (n === 1 ? 'You may bring one guest.' : `You may bring up to ${n} guests.`),
  yes: 'Yes',
  no: 'No',
  companionName: (i, many) => (many ? `Full name of guest ${i}` : 'Full name of your guest'),
  addCompanion: 'Add a guest',
  removeCompanion: (i) => `Remove guest ${i}`,
  additionalInfo: 'Additional information',
  selectPlaceholder: 'Select…',
  noteLabel: 'Message for the organisers',
  noteCounter: (n, max) => `${n} of ${max} characters`,
  consentPolicyLink: 'Read the privacy policy.',
  requiredLegend: 'Fields marked with * are required.',
  requiredError: 'Please complete this field.',
  requiredCheckError: 'Please tick this box to continue.',
  companionError: "Please enter your guest's full name.",
  formErrorSummary: 'Please review the highlighted fields.',
  submitAccept: 'Confirm attendance',
  submitDecline: 'Send reply',
  back: 'Back',

  acceptedTitle: 'Attendance confirmed',
  acceptedBody: 'Thank you. Your attendance is confirmed and we look forward to welcoming you.',
  approvedBody: (pass) => `Thank you. Your attendance is confirmed and your ${pass} access has been approved; we look forward to welcoming you.`,
  acceptedPastBody: 'Your attendance was confirmed.',
  attendedBody: 'Thank you for joining us.',
  declinedTitle: 'Reply received',
  declinedBody: 'We are sorry you will not be able to attend and thank you for letting us know.',
  respondedOn: (date) => `Reply sent on ${date}.`,
  changeAnswer: 'Change reply',
  changeUntil: (date) => `You may change your reply until ${date}.`,
  summaryCompanions: 'Guests',
  summaryNone: 'No guests',
  summaryNote: 'Your message',
  yesValue: 'Yes',
  noValue: 'No',
  toastAccepted: 'Your attendance has been confirmed.',
  toastAcceptedPending: 'Your attendance has been confirmed and is now awaiting approval.',
  toastDeclined: 'Your reply has been received.',
  closedTitle: 'Replies are closed',
  closedBody: 'The deadline to reply to this invitation has passed. For any questions, please contact the organisers.',
  pastTitle: 'This event has taken place',
  pastBody: 'Thank you for your interest.',
  checkedIn: (time) => `Checked in at ${time}. Welcome.`,
  checkedInPast: (date, time) => `Checked in on ${date} at ${time}.`,

  awaitingTitle: 'Attendance confirmed',
  awaitingStatus: 'Awaiting approval',
  awaitingBody: 'Thank you for your reply. The ion team will now confirm your access type. Once they do, your credential with the QR code will be available on this page and you will be notified.',
  stepsLabel: 'Next steps',
  stepConfirmed: 'Attendance confirmed',
  stepApproval: 'Approval by the ion team',
  stepApprovalNow: 'Under review',
  stepCredential: 'Credential with QR code',
  stepCredentialHint: 'Will be available on this page',
  stepDone: 'Done',
  stepCurrent: 'In progress',
  stepNext: 'Next',
  rejectedTitle: 'Attendance not confirmed',
  rejectedBody: 'We regret that we are unable to confirm your attendance at this event. Thank you sincerely for your interest and understanding.',
  rejectedContacts: 'Should you have any questions, the organisers will be glad to help:',

  errors: {
    not_found: 'This invitation is no longer available.',
    rsvp_closed: 'The reply deadline has passed, so the reply can no longer be changed.',
    capacity_full: 'We regret that there are no places left. If you added guests, you may confirm your own attendance only.',
    too_many_companions: 'You have added more guests than your invitation allows.',
    invalid_companions: 'Please enter the full name of each guest.',
    invalid_answers: 'We could not save your answers. Please review the form and try again.',
    invalid_note: 'The message is too long.',
    already_checked_in: 'You have already been checked in, so the reply can no longer be changed.',
    network: 'No internet connection. Please check your connection and try again.',
    unknown: 'We could not send your reply. Please try again in a moment.',
  },

  ticketEyebrow: 'On the day',
  ticketTitle: 'Your access',
  ticketIntro: 'Keep this screen or add the event to your calendar.',
  ticketHint: 'Please show this code at the entrance.',
  ticketCode: 'Access code',
  ticketGuest: 'Guest',
  ticketCompanions: 'Accompanied by',
  ticketWhere: 'Venue',
  passLabel: 'Access type',
  passIncludes: 'Includes',
  qrLabel: (code) => `Access QR code ${code}`,
  addToCalendar: 'Add to calendar',
  googleCalendar: 'Google Calendar',
  directions: 'Directions',
  calendarDescription: (host) => (host ? `Personal invitation — ${host}.` : 'Personal invitation.'),
  calendarLink: 'Your invitation',
  calendarError: 'We could not create the calendar file.',
  eventAppTitle: 'The event app',
  eventAppBody: 'Programme, speakers and networking, with your credential always at hand.',
  eventAppOpen: 'Open the event app',
  eventAppPreview: 'Preview: the invitation is not saved on this device.',

  programmeEyebrow: 'Programme',
  programmeTitle: 'Programme',
  until: 'until',

  infoEyebrow: 'Guest support',
  infoTitle: 'Information and contacts',
  aboutTitle: 'About the event',
  contactsTitle: 'Contact the organisers',
  contactsIntro: 'For any questions about the event or your invitation, please contact the organisers.',
  email: 'Email',
  phone: 'Telephone',

  privacyTitle: 'Data protection',
  privacyText: 'Your data is processed solely to manage this invitation and access to the event.',
  privacyController: 'Data controller',
  privacyPolicy: 'Privacy policy',
  erasureRequest: 'Request deletion of my data',
  erasureConfirmTitle: 'Request deletion of your data?',
  erasureConfirmBody: 'The organisers will be notified and will delete your personal data. After that, this invitation will no longer be available.',
  erasureConfirm: 'Send request',
  cancel: 'Cancel',
  erasureDone: 'We have received your request. The organisers will delete your data and may contact you to confirm.',
  erasureError: 'We could not send the request. Please try again in a moment.',

  appTitle: 'My invitations',
  appIntro: 'Invitations you open in this app are kept here.',
  appBrowserNote: 'This page is intended for the mobile app. In a browser, please open your invitation using the personal link you received by email or message.',
  appEmptyTitle: 'No saved invitations yet',
  appEmptyBody: 'Open the personal link you received by email or message, or add it here.',
  appAdd: 'Add invitation',
  appAddTitle: 'Add invitation',
  appAddIntro: 'Paste the personal link you received by email or message.',
  appAddLabel: 'Invitation link',
  appAddPlaceholder: 'https://…/c/…',
  appAddInvalid: 'We do not recognise this link. Please make sure you copied the full link.',
  appAddNotFound: 'This invitation is not available. Please check the link or contact the organisers.',
  appAddOpen: 'Open invitation',
  appScan: 'Scan QR code',
  or: 'or',
  appScanError: 'We could not read the code. Please try again or paste the link.',
  appUpcoming: 'Upcoming',
  appPast: 'Past',
  appRemove: 'Remove from list',
  appRemoveConfirmTitle: 'Remove this invitation from the list?',
  appRemoveConfirmBody: 'The invitation remains valid. You can add it again using your personal link.',
  appRemoveConfirm: 'Remove',
  appRemoved: 'Invitation removed from the list.',
  appOffline: 'No connection: showing the last saved information.',
  appStaff: 'Staff access',
  guestStatus: {
    pending: 'Awaiting your reply',
    accepted: 'Attendance confirmed',
    awaitingApproval: 'Awaiting approval',
    notConfirmed: 'Not confirmed',
    declined: 'Not attending',
    closed: 'Replies closed',
    checkedIn: 'Checked in',
    unavailable: 'Unavailable',
  },
};

const STRINGS: Record<Language, GuestStrings> = { pt, en };

export function guestStrings(lang: Language): GuestStrings {
  return STRINGS[lang] ?? pt;
}

/** Língua do dispositivo, para quando ainda não se sabe a do convidado. */
export function deviceLanguage(): Language {
  try {
    return (navigator.languages?.[0] ?? navigator.language ?? 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';
  } catch {
    return 'pt';
  }
}

/** Estado do convite, do ponto de vista do convidado. */
export type GuestStatusKey = keyof GuestStrings['guestStatus'];

export function guestStatusKey(
  v: { status: InvitationStatus; checked_in_at: string | null; approval_status?: ApprovalStatus },
  rsvpOpen: boolean,
): GuestStatusKey {
  if (v.checked_in_at) return 'checkedIn';
  if (v.status === 'declined') return 'declined';
  if (v.status === 'cancelled') return 'unavailable';
  // A recusa da equipa prevalece sobre o resto; quem confirmou só tem credencial depois de aprovado.
  if (v.approval_status === 'rejected') return 'notConfirmed';
  if (v.status === 'accepted') return v.approval_status === 'pending' ? 'awaitingApproval' : 'accepted';
  return rsvpOpen ? 'pending' : 'closed';
}

export function errorText(t: GuestStrings, err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  return code && code in t.errors ? t.errors[code as GuestErrorCode] : t.errors.unknown;
}

export const GuestI18n = createContext<GuestStrings>(pt);
export const useGuestStrings = () => useContext(GuestI18n);
