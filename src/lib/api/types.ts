// Contrato entre a interface e os dados. Há duas implementações:
//   supabase/  — produção (Postgres + RLS, ver supabase/migrations)
//   demo/      — em memória, com dados fictícios, para ver a app sem backend
// As páginas usam só este contrato (via `api` em ./index.ts), nunca o Supabase diretamente.

export type StaffRole = 'admin' | 'editor' | 'checkin' | 'viewer';
export type EventStatus = 'draft' | 'open' | 'closed' | 'archived';
export type InvitationStatus = 'draft' | 'sent' | 'opened' | 'accepted' | 'declined' | 'cancelled';
export type Channel = 'email' | 'whatsapp' | 'sms' | 'manual' | 'link';
export type Language = 'pt' | 'en';

export interface Staff {
  user_id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface SessionInfo {
  user: { id: string; email: string };
  /** null: tem conta mas não pertence à equipa (ou está inativo). */
  staff: Staff | null;
}

export interface RsvpField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  options?: string[];
  required?: boolean;
}

export interface Branding {
  accent?: string;
  logo_url?: string;
  /** Fundo da página do convidado: claro (papel, por omissão) ou escuro. */
  theme?: 'light' | 'dark';
}

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  host_name: string | null;
  invitation_text: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_maps_url: string | null;
  dress_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  rsvp_deadline: string | null;
  capacity: number | null;
  default_plus_ones: number;
  status: EventStatus;
  rsvp_fields: RsvpField[];
  branding: Branding;
  privacy_controller: string | null;
  privacy_policy_url: string | null;
  marketing_consent_text: string | null;
  created_at: string;
  updated_at: string;
}

export type EventInput = Omit<EventRecord, 'id' | 'created_at' | 'updated_at'>;

export interface EventSession {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  description: string | null;
  location: string | null;
  speakers: string | null;
}

export type EventSessionInput = Omit<EventSession, 'id'> & { id?: string };

export interface Contact {
  id: string;
  salutation: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  /** E.164, ex.: +351912345678 */
  phone: string | null;
  organization: string | null;
  job_title: string | null;
  segment: string | null;
  tags: string[];
  language: Language;
  notes: string | null;
  owner_id: string | null;
  source: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_text: string | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactInput = Pick<
  Contact,
  'salutation' | 'first_name' | 'last_name' | 'email' | 'phone' | 'organization' | 'job_title' | 'segment' | 'tags' | 'language' | 'notes'
> & { owner_id?: string | null; source?: string | null };

export interface ContactQuery {
  search?: string;
  segment?: string;
  tag?: string;
  /** true: só quem deu consentimento para comunicações futuras. */
  consent?: boolean;
  page: number; // começa em 0
  pageSize: number;
  sort?: { column: 'last_name' | 'organization' | 'created_at'; ascending: boolean };
}

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface Invitation {
  id: string;
  event_id: string;
  contact_id: string;
  /** Link pessoal (credencial do convidado). null para quem não edita (leitura). */
  token: string | null;
  /** Código de entrada. null para quem não edita (leitura). */
  checkin_code: string | null;
  status: InvitationStatus;
  wave: string | null;
  plus_ones_allowed: number;
  invited_by: string | null;
  sent_at: string | null;
  sent_channel: Channel | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  responded_at: string | null;
  answers: Record<string, unknown>;
  guest_note: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha da lista de convidados de um evento (vista invitation_overview). */
export interface InvitationRow extends Invitation {
  salutation: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  job_title: string | null;
  segment: string | null;
  tags: string[];
  language: Language;
  marketing_consent: boolean;
  companions_count: number;
  companions_checked_in: number;
}

export interface Companion {
  id: string;
  invitation_id: string;
  full_name: string;
  checked_in_at: string | null;
  created_at: string;
}

export interface InvitationQuery {
  status?: InvitationStatus;
  wave?: string;
  search?: string;
}

export interface Activity {
  id: number;
  contact_id: string | null;
  invitation_id: string | null;
  event_id: string | null;
  kind: string;
  channel: Channel | null;
  detail: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  event_id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  name: string;
  subject: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export type MessageTemplateInput = Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface BreakdownRow {
  invited: number;
  accepted: number;
  declined: number;
}

export interface EventStats {
  invited: number;
  by_status: Record<Exclude<InvitationStatus, 'cancelled'>, number>;
  delivered: number;
  opened: number;
  responded: number;
  expected_attendees: number;
  checked_in: number;
  capacity: number | null;
  by_wave: (BreakdownRow & { wave: string })[];
  by_segment: (BreakdownRow & { segment: string })[];
}

/** Uma linha a importar (já normalizada no browser: telefone em E.164, email em minúsculas). */
export interface ImportRow {
  first_name: string;
  last_name?: string;
  salutation?: string;
  email?: string;
  phone?: string;
  organization?: string;
  job_title?: string;
  segment?: string;
  tags?: string[];
  language?: Language;
  notes?: string;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  invited: number;
  errors: { row: number; message: string }[];
}

/** O que o convidado vê (função guest_invitation). Sem dados internos. */
export interface GuestView {
  invitation: {
    status: InvitationStatus;
    plus_ones_allowed: number;
    answers: Record<string, unknown>;
    guest_note: string | null;
    responded_at: string | null;
    checked_in_at: string | null;
    /** Só existe depois de confirmar presença. */
    checkin_code: string | null;
    companions: { full_name: string }[];
  };
  contact: {
    salutation: string | null;
    first_name: string;
    last_name: string | null;
    language: Language;
    marketing_consent: boolean;
  };
  event: Pick<
    EventRecord,
    | 'name' | 'host_name' | 'invitation_text' | 'description' | 'starts_at' | 'ends_at' | 'timezone'
    | 'venue_name' | 'venue_address' | 'venue_maps_url' | 'dress_code' | 'contact_email' | 'contact_phone'
    | 'rsvp_deadline' | 'rsvp_fields' | 'branding' | 'status' | 'privacy_controller' | 'privacy_policy_url'
    | 'marketing_consent_text'
  > & { rsvp_open: boolean };
  sessions: Omit<EventSession, 'event_id'>[];
}

export interface GuestResponse {
  accept: boolean;
  answers: Record<string, unknown>;
  companions: { full_name: string }[];
  note?: string | null;
  /** null: não mexer no consentimento. */
  marketingConsent: boolean | null;
}

/** Registo mínimo mostrado na porta (sem email, telefone ou notas). */
export interface CheckinRecord {
  invitation_id: string;
  event_id: string;
  event_name: string;
  salutation: string | null;
  first_name: string;
  last_name: string | null;
  organization: string | null;
  status: InvitationStatus;
  wave: string | null;
  plus_ones_allowed: number;
  checked_in_at: string | null;
  companions: { id: string; full_name: string; checked_in_at: string | null }[];
}

export type Unsubscribe = () => void;

export interface Api {
  mode: 'supabase' | 'demo';

  auth: {
    session(): Promise<SessionInfo | null>;
    signIn(email: string, password: string): Promise<void>;
    sendMagicLink(email: string): Promise<void>;
    signOut(): Promise<void>;
    onChange(cb: () => void): Unsubscribe;
  };

  staff: {
    list(): Promise<Staff[]>;
    update(userId: string, patch: Partial<Pick<Staff, 'full_name' | 'role' | 'active'>>): Promise<Staff>;
    /** Envia um convite por email para criar conta (função invite-staff). */
    invite(input: { email: string; full_name: string; role: StaffRole }): Promise<void>;
  };

  events: {
    list(): Promise<EventRecord[]>;
    get(id: string): Promise<EventRecord>;
    create(input: EventInput): Promise<EventRecord>;
    update(id: string, patch: Partial<EventInput>): Promise<EventRecord>;
    remove(id: string): Promise<void>;
    stats(id: string): Promise<EventStats>;
    sessions(eventId: string): Promise<EventSession[]>;
    saveSession(input: EventSessionInput): Promise<EventSession>;
    removeSession(id: string): Promise<void>;
  };

  contacts: {
    list(q: ContactQuery): Promise<Page<Contact>>;
    get(id: string): Promise<Contact>;
    create(input: ContactInput): Promise<Contact>;
    update(id: string, patch: Partial<ContactInput>): Promise<Contact>;
    remove(id: string): Promise<void>;
    /** Direito ao apagamento: só admin. */
    anonymize(id: string): Promise<void>;
    /** Direito de acesso: JSON com tudo o que existe sobre a pessoa. */
    exportData(id: string): Promise<unknown>;
    segments(): Promise<string[]>;
    tags(): Promise<string[]>;
    import(rows: ImportRow[], opts?: { eventId?: string; wave?: string; plusOnes?: number }): Promise<ImportResult>;
    activities(contactId: string): Promise<Activity[]>;
    addNote(contactId: string, text: string): Promise<void>;
    invitations(contactId: string): Promise<(Invitation & { event: Pick<EventRecord, 'id' | 'name' | 'starts_at' | 'status'> })[]>;
  };

  invitations: {
    list(eventId: string, q?: InvitationQuery): Promise<InvitationRow[]>;
    get(id: string): Promise<InvitationRow & { companions: Companion[] }>;
    /** Convida contactos existentes; ignora quem já está convidado. Devolve quantos convites novos. */
    create(eventId: string, contactIds: string[], opts?: { wave?: string | null; plusOnes?: number }): Promise<number>;
    update(id: string, patch: Partial<Pick<Invitation, 'wave' | 'plus_ones_allowed' | 'status' | 'answers' | 'guest_note'>>): Promise<void>;
    remove(id: string): Promise<void>;
    markSent(ids: string[], channel: Channel): Promise<number>;
    /** Envia por email (função send-invitations) e marca como enviados. */
    sendEmail(ids: string[], templateId: string): Promise<{ sent: number; failed: number }>;
    waves(eventId: string): Promise<string[]>;
    activities(eventId: string, limit?: number): Promise<Activity[]>;
  };

  templates: {
    list(eventId: string): Promise<MessageTemplate[]>;
    save(input: MessageTemplateInput): Promise<MessageTemplate>;
    remove(id: string): Promise<void>;
  };

  checkin: {
    lookup(eventId: string, code: string): Promise<CheckinRecord | null>;
    search(eventId: string, query: string): Promise<CheckinRecord[]>;
    checkIn(invitationId: string, companionIds: string[], force?: boolean): Promise<CheckinRecord>;
    undo(invitationId: string): Promise<CheckinRecord>;
  };

  guest: {
    /** null: link inválido, convite cancelado ou evento indisponível. */
    view(token: string, opts?: { track?: boolean }): Promise<GuestView | null>;
    respond(token: string, input: GuestResponse): Promise<GuestView>;
    requestErasure(token: string): Promise<void>;
  };
}
