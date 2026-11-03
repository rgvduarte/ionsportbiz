// Base de dados do modo demonstração: em memória, guardada no localStorage deste browser.
// Os dados são fictícios. As regras (permissões, lotação, prazos) imitam as funções SQL.

import type {
  Activity, Channel, Companion, Contact, EventRecord, EventSession, Invitation, InvitationStatus,
  MessageTemplate, Staff, StaffRole,
} from '../types';
import { ApiError } from '../errors';

export interface DemoDb {
  version: 1;
  currentUserId: string | null;
  staff: Staff[];
  events: EventRecord[];
  sessions: EventSession[];
  contacts: Contact[];
  invitations: Invitation[];
  companions: Companion[];
  activities: Activity[];
  templates: MessageTemplate[];
  deliveries: { id: string; invitation_id: string; channel: Channel; template_id: string | null; status: 'sent' | 'failed'; created_at: string }[];
}

const KEY = 'convites-demo-v1';

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
const ORGS: [string, string, string][] = [
  ['Atlântida Capital', 'atlantidacapital', 'Clientes'],
  ['Grupo Serra Alta', 'serraalta', 'Clientes'],
  ['Lusovia Energia', 'lusovia', 'Parceiros'],
  ['Tejo Digital', 'tejodigital', 'Parceiros'],
  ['Fundação Horizonte', 'fundacaohorizonte', 'Institucional'],
  ['Montado Seguros', 'montadoseguros', 'Clientes'],
  ['Ribeira & Associados', 'ribeira-associados', 'Fornecedores'],
  ['Porto Norte Logística', 'portonorte', 'Fornecedores'],
  ['Estrela Media', 'estrelamedia', 'Imprensa'],
  ['Instituto Aurora', 'institutoaurora', 'Institucional'],
  ['Câmara Municipal de Vale Novo', 'cm-valenovo', 'Institucional'],
  ['Revista Panorama', 'panorama', 'Imprensa'],
];
const JOBS = ['Presidente do Conselho de Administração', 'Administrador Executivo', 'Diretora-Geral', 'Diretor Financeiro', 'Diretora de Comunicação',
  'Head of Partnerships', 'Jornalista', 'Vereadora', 'Diretor Comercial', 'Assessora de Imprensa', 'Sócio', 'Chief Operating Officer'];
const TAGS = ['vip', 'orador', 'patrocinador', 'imprensa', 'conselho consultivo', 'novo contacto'];

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

  // Evento principal: daqui a ~2 meses, ao fim da tarde (guardado em UTC).
  const main = new Date(now + 62 * day);
  main.setUTCHours(18, 0, 0, 0);
  const past = new Date(now - 140 * day);
  past.setUTCHours(17, 30, 0, 0);

  const baseEvent = {
    timezone: 'Europe/Lisbon',
    contact_email: 'eventos@exemplo.pt',
    contact_phone: '+351210000000',
    branding: { accent: '#13294b' },
    privacy_controller: 'Fundação Exemplo, Avenida da Liberdade 100, 1250-000 Lisboa',
    privacy_policy_url: null,
    marketing_consent_text: 'Aceito receber convites e comunicações futuras da Fundação Exemplo.',
    created_at: created,
    updated_at: created,
  } as const;

  const events: EventRecord[] = [
    {
      ...baseEvent,
      id: '00000000-0000-4000-8000-0000000000e1',
      slug: 'encontro-anual-2027',
      name: 'Encontro Anual 2027',
      host_name: 'O Conselho de Administração da Fundação Exemplo',
      invitation_text: 'tem a honra de convidar V. Exa. para o Encontro Anual, seguido de jantar.',
      description: 'Apresentação do relatório anual, entrega dos Prémios Horizonte e jantar.',
      starts_at: iso(main.getTime()),
      ends_at: iso(main.getTime() + 5 * 3_600_000),
      venue_name: 'Palácio da Exemplo',
      venue_address: 'Rua das Janelas Verdes 1, 1200-000 Lisboa',
      venue_maps_url: 'https://maps.google.com/?q=Rua+das+Janelas+Verdes+Lisboa',
      dress_code: 'Black tie',
      rsvp_deadline: iso(main.getTime() - 14 * day),
      capacity: 120,
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
      slug: 'conferencia-primavera',
      name: 'Conferência de Primavera',
      host_name: 'A Fundação Exemplo',
      invitation_text: 'convida V. Exa. para a Conferência de Primavera.',
      description: null,
      starts_at: iso(past.getTime()),
      ends_at: iso(past.getTime() + 3 * 3_600_000),
      venue_name: 'Auditório Horizonte',
      venue_address: 'Avenida da Liberdade 100, 1250-000 Lisboa',
      venue_maps_url: null,
      dress_code: null,
      rsvp_deadline: null,
      capacity: 80,
      default_plus_ones: 0,
      status: 'closed',
      rsvp_fields: [],
    },
  ];

  const sessions: EventSession[] = [
    [0, 30, 'Receção e cocktail de boas-vindas', 'Claustro'],
    [30, 75, 'Abertura e apresentação do Relatório Anual', 'Salão Nobre'],
    [75, 105, 'Entrega dos Prémios Horizonte', 'Salão Nobre'],
    [120, 270, 'Jantar', 'Galeria'],
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
  while (contacts.length < 64) {
    const first = pick(FIRST);
    const last = `${pick(LAST)} ${pick(LAST)}`;
    if (used.has(first + last)) continue;
    used.add(first + last);
    const [org, domain, segment] = pick(ORGS);
    const female = FIRST.indexOf(first) < 14;
    const consent = rnd() < 0.45;
    const createdAt = iso(now - (30 + Math.floor(rnd() * 300)) * day);
    const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    contacts.push({
      id: uid(),
      salutation: rnd() < 0.5 ? (female ? 'Exma. Senhora' : 'Exmo. Senhor') : female ? 'Dra.' : 'Dr.',
      first_name: first,
      last_name: last,
      email: `${strip(first)}.${strip(last.split(' ')[1])}@${domain}.example`,
      phone: rnd() < 0.8 ? `+3519${Math.floor(10_000_000 + rnd() * 89_999_999)}` : null,
      organization: org,
      job_title: pick(JOBS),
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
    invitations: [], companions: [], activities: [], templates: [], deliveries: [],
  };
  db = d;

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
    const inv: Invitation = {
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
    inv.updated_at = inv.responded_at ?? inv.sent_at ?? inv.created_at;
  };

  contacts.slice(0, plan.length).forEach((c, i) => {
    addInvitation(events[0], c, plan[i], i < 12 ? 'Convidados de honra' : i < 30 ? '1.ª vaga' : '2.ª vaga', false);
  });
  contacts.slice(20, 50).forEach((c, i) => {
    addInvitation(events[1], c, i < 23 ? 'accepted' : i < 27 ? 'declined' : 'opened', 'Geral', i < 20);
  });

  d.templates = [
    {
      id: '00000000-0000-4000-8000-0000000007a1', event_id: events[0].id, channel: 'email', name: 'Convite formal',
      subject: 'Convite — {{evento}}',
      body: '{{tratamento}} {{nome}},\n\n{{anfitriao}} {{texto_convite}}\n\n{{data}}\n{{local}}\n\nPara confirmar a sua presença, utilize o seu convite pessoal:\n{{link}}\n\nCom os melhores cumprimentos,',
      created_at: created, updated_at: created,
    },
    {
      id: '00000000-0000-4000-8000-0000000007a2', event_id: events[0].id, channel: 'whatsapp', name: 'Convite WhatsApp',
      subject: null,
      body: 'Bom dia {{nome}}. Em nome da Fundação Exemplo, envio o seu convite pessoal para o {{evento}} ({{data}}). Pode confirmar aqui: {{link}}',
      created_at: created, updated_at: created,
    },
    {
      id: '00000000-0000-4000-8000-0000000007a3', event_id: events[0].id, channel: 'email', name: 'Lembrete',
      subject: 'Lembrete — {{evento}}',
      body: '{{tratamento}} {{nome}},\n\nRecordamos o convite para o {{evento}}, a {{data}}. Agradecemos a confirmação até {{prazo}}:\n{{link}}',
      created_at: created, updated_at: created,
    },
  ];

  d.activities.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((a, i) => { a.id = i + 1; });
  return d;
}
