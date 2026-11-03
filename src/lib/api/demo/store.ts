// Base de dados do modo demonstração: em memória, guardada no localStorage deste browser.
// Os dados são fictícios. As regras (permissões, lotação, prazos) imitam as funções SQL.

import type {
  Activity, Channel, Companion, Contact, EventRecord, EventSession, Invitation, InvitationStatus,
  MessageTemplate, Staff, StaffRole,
PassType,
} from '../types';
import ionLogo from '../../../assets/brand/ion-logo.png';
import { ApiError } from '../errors';

/** Convite guardado: o link e o código existem sempre; o contrato só os entrega a quem edita. */
export type DemoInvitation = Invitation & { token: string; checkin_code: string };

export interface DemoDb {
  version: 1;
  currentUserId: string | null;
  staff: Staff[];
  events: EventRecord[];
  sessions: EventSession[];
  contacts: Contact[];
  invitations: DemoInvitation[];
  passTypes: PassType[];
  companions: Companion[];
  activities: Activity[];
  templates: MessageTemplate[];
  deliveries: { id: string; invitation_id: string; channel: Channel; template_id: string | null; status: 'sent' | 'failed'; created_at: string }[];
}

// Muda quando os dados fictícios mudam, para a demonstração recomeçar com os novos.
const KEY = 'convites-demo-v4';

// ───────── Utilitários ─────────

export const nowIso = () => new Date().toISOString();

export function uid(): string {
  return crypto.randomUUID();
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomString(alphabet: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const newToken = () => randomString(B64, 22);
export const newCheckinCode = () => randomString(CODE, 10);

/** Latência simulada, para os estados de carregamento serem visíveis e realistas. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

// ───────── Estado ─────────

let db: DemoDb | null = null;
const listeners = new Set<() => void>();

export function getDb(): DemoDb {
  if (!db) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDb;
        if (parsed.version === 1) db = parsed;
      }
    } catch {
      // Sem localStorage (navegação privada, pré-visualizações): começa do zero.
    }
    db ??= seed();
  }
  return db;
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Ignora: os dados ficam só em memória.
  }
  listeners.forEach((l) => l());
}

export function onDbChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function resetDemo(): void {
  db = seed();
  save();
}

// ───────── Permissões (imitam a RLS) ─────────

export function currentStaff(): Staff | null {
  const d = getDb();
  return d.staff.find((s) => s.user_id === d.currentUserId && s.active) ?? null;
}

export function requireRole(...roles: StaffRole[]): Staff {
  const s = currentStaff();
  if (!s || !roles.includes(s.role)) throw new ApiError('forbidden');
  return s;
}

export const CAN_READ_CRM: StaffRole[] = ['admin', 'editor', 'viewer'];
export const CAN_EDIT: StaffRole[] = ['admin', 'editor'];
export const CAN_CHECK_IN: StaffRole[] = ['admin', 'editor', 'checkin'];
export const ALL_STAFF: StaffRole[] = ['admin', 'editor', 'checkin', 'viewer'];

/** Como invitation_secret: o link pessoal e o código de entrada só chegam a quem edita. */
export function withSecrets<T extends Invitation>(row: T): T {
  const s = currentStaff();
  return s && CAN_EDIT.includes(s.role) ? row : { ...row, token: null, checkin_code: null };
}

// ───────── Linha do tempo ─────────

export function logActivity(a: Omit<Activity, 'id' | 'created_at' | 'actor_id'> & { created_at?: string; actor_id?: string | null }): void {
  const d = getDb();
  const id = (d.activities.at(-1)?.id ?? 0) + 1;
  d.activities.push({
    id,
    created_at: a.created_at ?? nowIso(),
    actor_id: a.actor_id === undefined ? d.currentUserId : a.actor_id,
    contact_id: a.contact_id,
    invitation_id: a.invitation_id,
    event_id: a.event_id,
    kind: a.kind,
    channel: a.channel,
    detail: a.detail,
  });
}

const STATUS_KIND: Record<InvitationStatus, string> = {
  draft: 'invitation.reopened',
  sent: 'invitation.sent',
  opened: 'invitation.opened',
  accepted: 'invitation.accepted',
  declined: 'invitation.declined',
  cancelled: 'invitation.cancelled',
};

/** Muda o estado de um convite e regista na linha do tempo (como o trigger invitations_log). */
export function setInvitationStatus(inv: Invitation, status: InvitationStatus, actorId: string | null | undefined = undefined): void {
  if (inv.status === status) return;
  const from = inv.status;
  inv.status = status;
  inv.updated_at = nowIso();
  logActivity({
    kind: STATUS_KIND[status],
    contact_id: inv.contact_id,
    invitation_id: inv.id,
    event_id: inv.event_id,
    channel: status === 'sent' ? inv.sent_channel : null,
    detail: { from, to: status },
    actor_id: actorId,
  });
}

// ───────── Dados fictícios ─────────

// Gerador determinístico: a demonstração é sempre igual depois de repor.
function prng(seedValue: number) {
  let s = seedValue >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ana', 'Beatriz', 'Carolina', 'Diana', 'Filipa', 'Helena', 'Inês', 'Joana', 'Leonor', 'Margarida', 'Marta', 'Rita', 'Sofia', 'Teresa',
  'António', 'Bernardo', 'Duarte', 'Francisco', 'Gonçalo', 'Henrique', 'João', 'Luís', 'Miguel', 'Nuno', 'Pedro', 'Ricardo', 'Rui', 'Tiago'];
const LAST = ['Almeida', 'Barros', 'Carvalho', 'Costa', 'Ferreira', 'Gomes', 'Lopes', 'Marques', 'Martins', 'Mendes', 'Moreira', 'Nunes',
  'Oliveira', 'Pereira', 'Pinto', 'Ribeiro', 'Rodrigues', 'Santos', 'Silva', 'Sousa', 'Teixeira', 'Vieira'];
type OrgKind = 'empresa' | 'imprensa' | 'autarquia' | 'instituicao';
const ORGS: [string, string, string, OrgKind][] = [
  ['Atlântida Capital', 'atlantidacapital', 'Clientes', 'empresa'],
  ['Grupo Serra Alta', 'serraalta', 'Clientes', 'empresa'],
  ['Lusovia Energia', 'lusovia', 'Parceiros', 'empresa'],
  ['Tejo Digital', 'tejodigital', 'Parceiros', 'empresa'],
  ['Fundação Horizonte', 'fundacaohorizonte', 'Institucional', 'instituicao'],
  ['Montado Seguros', 'montadoseguros', 'Clientes', 'empresa'],
  ['Ribeira & Associados', 'ribeira-associados', 'Fornecedores', 'empresa'],
  ['Porto Norte Logística', 'portonorte', 'Fornecedores', 'empresa'],
  ['Estrela Media', 'estrelamedia', 'Imprensa', 'imprensa'],
  ['Instituto Aurora', 'institutoaurora', 'Institucional', 'instituicao'],
  ['Câmara Municipal de Vale Novo', 'cm-valenovo', 'Institucional', 'autarquia'],
  ['Revista Panorama', 'panorama', 'Imprensa', 'imprensa'],
];
// Cargos coerentes com o tipo de entidade, no feminino [0] e no masculino [1].
const JOBS: Record<OrgKind, [string, string][]> = {
  empresa: [
    ['Presidente do Conselho de Administração', 'Presidente do Conselho de Administração'],
    ['Administradora Executiva', 'Administrador Executivo'], ['Diretora-Geral', 'Diretor-Geral'],
    ['Diretora Financeira', 'Diretor Financeiro'], ['Diretora de Comunicação', 'Diretor de Comunicação'],
    ['Diretora de Parcerias', 'Diretor de Parcerias'], ['Diretora Comercial', 'Diretor Comercial'],
    ['Diretora de Operações', 'Diretor de Operações'], ['Assessora de Imprensa', 'Assessor de Imprensa'],
  ],
  imprensa: [['Jornalista', 'Jornalista'], ['Diretora de Redação', 'Diretor de Redação'], ['Editora', 'Editor']],
  autarquia: [['Presidente da Câmara', 'Presidente da Câmara'], ['Vereadora', 'Vereador'], ['Chefe de Gabinete', 'Chefe de Gabinete']],
  instituicao: [
    ['Presidente do Conselho Diretivo', 'Presidente do Conselho Diretivo'], ['Diretora Executiva', 'Diretor Executivo'],
    ['Diretora de Relações Institucionais', 'Diretor de Relações Institucionais'], ['Vogal do Conselho Diretivo', 'Vogal do Conselho Diretivo'],
  ],
};
/** Cargos que podem repetir-se na mesma entidade; os outros (presidente, diretor-geral, …) são de uma só pessoa. */
const REPEATABLE = new Set(['Administrador Executivo', 'Assessor de Imprensa', 'Jornalista', 'Editor', 'Vereador', 'Vogal do Conselho Diretivo']);
/** Prefixos de telemóvel em Portugal (91, 92, 93, 96). */
const MOBILE = ['1', '2', '3', '6'];
const TAGS = ['vip', 'orador', 'patrocinador', 'imprensa', 'conselho consultivo', 'novo contacto'];

/** Telemóvel português válido (E.164) a partir de um número aleatório entre 0 e 1. */
function mobile(r: number): string {
  const n = Math.floor(r * MOBILE.length * 10_000_000);
  return `+3519${MOBILE[Math.floor(n / 10_000_000)]}${String(n % 10_000_000).padStart(7, '0')}`;
}

function seed(): DemoDb {
  const rnd = prng(20271015);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const day = 86_400_000;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const created = iso(now - 120 * day);

  const staff: Staff[] = [
    { user_id: '00000000-0000-4000-8000-0000000000a1', full_name: 'Marta Lencastre', email: 'admin@demo.pt', role: 'admin', active: true, created_at: created },
    { user_id: '00000000-0000-4000-8000-0000000000a2', full_name: 'Tomás Valadares', email: 'editor@demo.pt', role: 'editor', active: true, created_at: created },
    { user_id: '00000000-0000-4000-8000-0000000000a3', full_name: 'Equipa de Receção', email: 'porta@demo.pt', role: 'checkin', active: true, created_at: created },
    { user_id: '00000000-0000-4000-8000-0000000000a4', full_name: 'Isabel Morais', email: 'leitura@demo.pt', role: 'viewer', active: true, created_at: created },
  ];
  const admin = staff[0].user_id;

  // Evento principal: ion Portugal 2027, 22 de março às 19h00 de Lisboa (UTC+0 nessa data).
  const main = new Date('2027-03-22T19:00:00Z');
  const past = new Date(now - 140 * day);
  past.setUTCHours(17, 30, 0, 0);

  const baseEvent = {
    timezone: 'Europe/Lisbon',
    contact_email: 'convidados@exemplo.pt',
    contact_phone: '+351210000000',
    // O convite mostra o logótipo só a partir de um endereço absoluto (http/https).
    branding: { accent: '#ccff00', logo_url: typeof window === 'undefined' ? ionLogo : new URL(ionLogo, window.location.href).href, theme: 'dark' },
    privacy_controller: 'Entidade organizadora da ion (a definir)',
    privacy_policy_url: null,
    marketing_consent_text: 'Aceito receber convites e comunicações futuras da ion — International Business & Sports Conference.',
    created_at: created,
    updated_at: created,
  } as const;

  const events: EventRecord[] = [
    {
      ...baseEvent,
      id: '00000000-0000-4000-8000-0000000000e1',
      slug: 'ion-portugal-2027',
      name: 'ion Portugal 2027',
      host_name: 'A organização da ion — International Business & Sports Conference',
      invitation_text: 'tem a honra de convidar V. Exa. para o VIP Gala Dinner e a cerimónia dos ion Awards, a 22 de março, e para a ion Conference, a 23 de março.',
      description: 'Dois dias onde o desporto abre a porta aos negócios: jantar de gala e entrega de prémios, seguidos de uma conferência com cinco palcos temáticos e mais de 90 oradores.',
      starts_at: iso(main.getTime()),
      ends_at: iso(main.getTime() + 23 * 3_600_000),
      venue_name: null, // local ainda por anunciar
      venue_address: null,
      venue_maps_url: null,
      dress_code: 'Black tie (jantar de gala)',
      rsvp_deadline: iso(main.getTime() - 14 * day),
      capacity: 650,
      requires_approval: true,
      default_plus_ones: 1,
      status: 'open',
      rsvp_fields: [
        { key: 'dieta', label: 'Restrições alimentares', type: 'text' },
        { key: 'estacionamento', label: 'Precisa de lugar de estacionamento?', type: 'checkbox' },
        { key: 'mobilidade', label: 'Necessidades de acessibilidade', type: 'textarea' },
      ],
    },
    {
      ...baseEvent,
      id: '00000000-0000-4000-8000-0000000000e2',
      slug: 'ion-networking-2026',
      name: 'ion Networking 2026',
      host_name: 'A organização da ion',
      invitation_text: 'convida V. Exa. para o encontro ion Networking.',
      description: null,
      starts_at: iso(past.getTime()),
      ends_at: iso(past.getTime() + 3 * 3_600_000),
      venue_name: 'Local do evento',
      venue_address: null,
      venue_maps_url: null,
      dress_code: null,
      rsvp_deadline: null,
      capacity: 80,
      requires_approval: false,
      default_plus_ones: 0,
      status: 'closed',
      rsvp_fields: [],
    },
  ];

  // Minutos a partir do início (22 de março, 19h00).
  const sessions: EventSession[] = [
    [0, 45, 'Receção VIP e cocktail de boas-vindas', 'Foyer'],
    [60, 210, 'VIP Gala Dinner', 'Sala de gala'],
    [210, 270, 'Cerimónia dos ion Awards', 'Sala de gala'],
    [840, 870, 'Acreditação da ion Conference', 'Entrada principal'],
    [870, 1080, 'ion Conference: sessões da manhã nos cinco palcos temáticos', 'Palcos 1 a 5'],
    [1080, 1200, 'VIP Lunch', 'Sala VIP'],
    [1200, 1380, 'ion Conference: sessões da tarde e encerramento', 'Palco principal'],
  ].map(([from, to, title, location], i) => ({
    id: `00000000-0000-4000-8000-0000000005${String(i).padStart(2, '0')}`,
    event_id: events[0].id,
    starts_at: iso(main.getTime() + (from as number) * 60_000),
    ends_at: iso(main.getTime() + (to as number) * 60_000),
    title: title as string,
    description: null,
    location: location as string,
    speakers: null,
  }));

  const contacts: Contact[] = [];
  const used = new Set<string>();
  const roles = new Set<string>();
  const jobFor = (org: string, kind: OrgKind, female: boolean) => {
    const list = JOBS[kind];
    const free = (j: number) => REPEATABLE.has(list[j][1]) || !roles.has(`${org}|${list[j][1]}`);
    let j = Math.floor(rnd() * list.length);
    for (let n = 0; n < list.length && !free(j); n++) j = (j + 1) % list.length;
    if (!free(j)) j = list.findIndex(([, m]) => REPEATABLE.has(m));
    roles.add(`${org}|${list[j][1]}`);
    return list[j][female ? 0 : 1];
  };
  while (contacts.length < 64) {
    const first = pick(FIRST);
    const a = Math.floor(rnd() * LAST.length);
    let b = Math.floor(rnd() * LAST.length);
    if (b === a) b = (b + 1) % LAST.length; // sem apelidos repetidos ("Almeida Almeida")
    const last = `${LAST[a]} ${LAST[b]}`;
    if (used.has(first + last)) continue;
    used.add(first + last);
    const [org, domain, segment, kind] = pick(ORGS);
    const female = FIRST.indexOf(first) < 14;
    const consent = rnd() < 0.45;
    const createdAt = iso(now - (30 + Math.floor(rnd() * 300)) * day);
    const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    contacts.push({
      id: uid(),
      salutation: rnd() < 0.5 ? (female ? 'Exma. Senhora' : 'Exmo. Senhor') : female ? 'Dr.ª' : 'Dr.',
      first_name: first,
      last_name: last,
      email: `${strip(first)}.${strip(last.split(' ')[1])}@${domain}.example`,
      phone: rnd() < 0.8 ? mobile(rnd()) : null,
      organization: org,
      job_title: jobFor(org, kind, female),
      segment,
      tags: rnd() < 0.55 ? [...new Set([pick(TAGS), ...(rnd() < 0.3 ? [pick(TAGS)] : [])])].sort() : [],
      language: rnd() < 0.12 ? 'en' : 'pt',
      notes: rnd() < 0.15 ? 'Contactar através da assessoria.' : null,
      owner_id: rnd() < 0.5 ? admin : staff[1].user_id,
      source: rnd() < 0.7 ? 'importação' : 'manual',
      marketing_consent: consent,
      marketing_consent_at: consent ? createdAt : null,
      marketing_consent_text: consent ? baseEvent.marketing_consent_text : null,
      anonymized_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  const d: DemoDb = {
    version: 1,
    currentUserId: null,
    staff, events, sessions, contacts,
    invitations: [], passTypes: [], companions: [], activities: [], templates: [], deliveries: [],
  };
  db = d;

  // Tipos de acesso do evento principal (definidos pela equipa; o convidado não escolhe).
  const vip: PassType = {
    id: '00000000-0000-4000-8000-0000000009a1', event_id: events[0].id, name: 'VIP Pass',
    description: 'Acesso a todo o programa, incluindo o jantar de gala e o almoço VIP.',
    accesses: ['VIP Gala Dinner', 'Cerimónia dos ion Awards', 'ion Conference (5 palcos)', 'VIP Lunch'],
    color: '#ccff00', sort: 0, created_at: created,
  };
  const conference: PassType = {
    id: '00000000-0000-4000-8000-0000000009a2', event_id: events[0].id, name: 'Conference Pass',
    description: 'Acesso à ion Conference de 23 de março.',
    accesses: ['ion Conference (5 palcos)', 'Zona de networking'],
    color: '#e27a2c', sort: 1, created_at: created,
  };
  d.passTypes = [vip, conference];

  const companionNames = ['Paulo Reis', 'Cláudia Antunes', 'Jorge Matos', 'Sara Cunha', 'Vasco Brito', 'Laura Fontes'];
  const plan: InvitationStatus[] = [
    ...Array<InvitationStatus>(6).fill('draft'), ...Array<InvitationStatus>(9).fill('sent'), ...Array<InvitationStatus>(7).fill('opened'),
    ...Array<InvitationStatus>(19).fill('accepted'), ...Array<InvitationStatus>(5).fill('declined'), 'cancelled',
  ];
  const addInvitation = (event: EventRecord, contact: Contact, status: InvitationStatus, wave: string, checkedIn: boolean) => {
    const createdAt = now - (50 + Math.floor(rnd() * 10)) * day;
    const sentAt = status === 'draft' ? null : createdAt + 2 * day;
    const openedAt = ['opened', 'accepted', 'declined'].includes(status) && sentAt ? sentAt + Math.floor(rnd() * 5 + 1) * day : null;
    const respondedAt = ['accepted', 'declined'].includes(status) && openedAt ? openedAt + Math.floor(rnd() * 3_600_000) : null;
    const inv: DemoInvitation = {
      id: uid(),
      event_id: event.id,
      contact_id: contact.id,
      token: newToken(),
      checkin_code: newCheckinCode(),
      status: 'draft',
      wave,
      plus_ones_allowed: event.default_plus_ones,
      invited_by: admin,
      sent_at: sentAt ? iso(sentAt) : null,
      sent_channel: sentAt ? (rnd() < 0.7 ? 'email' : 'whatsapp') : null,
      first_opened_at: openedAt ? iso(openedAt) : null,
      last_opened_at: openedAt ? iso(openedAt + 3_600_000) : null,
      open_count: openedAt ? 1 + Math.floor(rnd() * 3) : 0,
      responded_at: respondedAt ? iso(respondedAt) : null,
      answers: {},
      guest_note: null,
      checked_in_at: null,
      checked_in_by: null,
      approval_status: 'pending',
      pass_type_id: null,
      approved_at: null,
      approved_by: null,
      created_at: iso(createdAt),
      updated_at: iso(createdAt),
    };
    d.invitations.push(inv);
    logActivity({ kind: 'invitation.created', contact_id: contact.id, invitation_id: inv.id, event_id: event.id, channel: null, detail: { wave }, created_at: iso(createdAt), actor_id: admin });
    const steps: [InvitationStatus, number | null, string | null][] = [
      ['sent', sentAt, admin], ['opened', openedAt, null],
      [status === 'declined' ? 'declined' : 'accepted', respondedAt, null],
    ];
    for (const [s, at, actor] of steps) {
      if (!at) continue;
      inv.status = s;
      logActivity({ kind: STATUS_KIND[s], contact_id: contact.id, invitation_id: inv.id, event_id: event.id,
        channel: s === 'sent' ? inv.sent_channel : null, detail: { to: s }, created_at: iso(at), actor_id: actor });
    }
    if (status === 'cancelled') {
      inv.status = 'cancelled';
      logActivity({ kind: 'invitation.cancelled', contact_id: contact.id, invitation_id: inv.id, event_id: event.id, channel: null, detail: {}, created_at: iso(createdAt + 3 * day), actor_id: admin });
    }
    if (status === 'accepted') {
      if (event.default_plus_ones > 0 && rnd() < 0.45) {
        d.companions.push({ id: uid(), invitation_id: inv.id, full_name: pick(companionNames), checked_in_at: checkedIn ? inv.responded_at : null, created_at: inv.responded_at! });
      }
      if (rnd() < 0.3) inv.answers = { dieta: pick(['Vegetariana', 'Sem glúten', 'Sem lactose']) };
      if (rnd() < 0.2) inv.answers = { ...inv.answers, estacionamento: true };
      if (checkedIn) {
        inv.checked_in_at = iso(new Date(event.starts_at).getTime() + Math.floor(rnd() * 3_600_000));
        inv.checked_in_by = staff[2].user_id;
      }
    }
    // Aprovação da equipa: convidados de honra aprovados como VIP (mesmo antes de responderem);
    // os restantes que confirmaram ficam Conference ou por aprovar. Sem aprovação obrigatória, quem confirma fica aprovado.
    const honor = wave === 'Convidados de honra';
    if (!event.requires_approval) {
      if (status === 'accepted') { inv.approval_status = 'approved'; inv.approved_at = inv.responded_at; }
    } else if (status !== 'declined' && status !== 'cancelled' && status !== 'draft' && (honor || (status === 'accepted' && rnd() < 0.7))) {
      const pass = honor ? vip : conference;
      const at = (inv.responded_at ? new Date(inv.responded_at).getTime() : createdAt + 3 * day) + day;
      Object.assign(inv, { approval_status: 'approved', pass_type_id: pass.id, approved_at: iso(at), approved_by: admin });
      logActivity({ kind: 'invitation.approved', contact_id: contact.id, invitation_id: inv.id, event_id: event.id, channel: null,
        detail: { pass_type: pass.name }, created_at: iso(at), actor_id: admin });
    }
    inv.updated_at = inv.responded_at ?? inv.sent_at ?? inv.created_at;
  };

  contacts.slice(0, plan.length).forEach((c, i) => {
    addInvitation(events[0], c, plan[i], i < 12 ? 'Convidados de honra' : i < 30 ? '1.ª vaga' : '2.ª vaga', false);
  });
  contacts.slice(20, 50).forEach((c, i) => {
    addInvitation(events[1], c, i < 23 ? 'accepted' : i < 27 ? 'declined' : 'opened', 'Geral', i < 20);
  });

  // Os mesmos textos que o módulo de mensagens sugere (defaultTemplates), mais um lembrete.
  const paragraphs = (...p: string[]) => p.join('\n\n');
  const event = '{{evento}}\n{{data}}\n{{local}}';
  d.templates = [
    {
      id: '00000000-0000-4000-8000-0000000007a1', event_id: events[0].id, channel: 'email', name: 'Convite formal',
      subject: 'Convite — {{evento}}',
      body: paragraphs(
        '{{tratamento}} {{nome_completo}},',
        '{{anfitriao}} {{texto_convite}}',
        event,
        'Agradecemos que confirme a sua presença até {{prazo}}, através do seu convite pessoal, onde encontrará também o programa e as informações práticas.',
        '{{link}}',
        'Com os melhores cumprimentos,\n{{anfitriao}}',
      ),
      created_at: created, updated_at: created,
    },
    {
      id: '00000000-0000-4000-8000-0000000007a2', event_id: events[0].id, channel: 'whatsapp', name: 'Convite WhatsApp',
      subject: null,
      body: paragraphs(
        '{{tratamento}} {{nome_completo}},',
        '{{anfitriao}} {{texto_convite}}',
        event,
        'Pode confirmar a sua presença até {{prazo}} no seu convite pessoal:\n{{link}}',
        'Com os melhores cumprimentos.',
      ),
      created_at: created, updated_at: created,
    },
    {
      id: '00000000-0000-4000-8000-0000000007a3', event_id: events[0].id, channel: 'email', name: 'Lembrete',
      subject: 'Lembrete — {{evento}}',
      body: paragraphs(
        '{{tratamento}} {{nome_completo}},',
        'Permitimo-nos recordar o convite para o {{evento}}:',
        '{{data}}\n{{local}}',
        'Agradecemos que confirme a sua presença até {{prazo}}, através do seu convite pessoal:\n{{link}}',
        'Com os melhores cumprimentos,\n{{anfitriao}}',
      ),
      created_at: created, updated_at: created,
    },
  ];

  d.activities.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((a, i) => { a.id = i + 1; });
  return d;
}
