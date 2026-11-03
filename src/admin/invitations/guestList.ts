// Lógica da lista de convidados (sem React): filtros, contagens, destinatários de envio,
// exportação e textos dos modelos sugeridos.

import type { EventRecord, InvitationRow, InvitationStatus, MessageTemplate, MessageTemplateInput } from '../../lib/api';
import { formalName, formatDateTime } from '../../lib/format';
import { APPROVAL_STATUS, INVITATION_STATUS } from '../../lib/status';
import { toCsv } from '../../lib/csv';
import { buildTemplateVars, renderMessage, type TemplateContact, type TemplateEvent } from '@shared/template';
import { APPROVAL_FILTERS, approvalApplies, matchesApproval, type ApprovalFilter } from './approval';

export type StatusFilter = InvitationStatus | 'all';

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Por enviar' },
  { value: 'sent', label: 'Enviados' },
  { value: 'opened', label: 'Vistos' },
  { value: 'accepted', label: 'Confirmados' },
  { value: 'declined', label: 'Recusados' },
  { value: 'cancelled', label: 'Cancelados' },
];

/** Valor do filtro de vaga para "sem vaga". */
export const NO_WAVE = '\u0000sem-vaga';

/** Minúsculas e sem acentos: "Inês" encontra "ines". */
export const fold = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function matchesSearch(row: InvitationRow, search: string): boolean {
  const words = fold(search).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [row.salutation, row.first_name, row.last_name, row.email, row.organization, row.job_title, row.wave]
    .map(fold).join(' ');
  const phone = (row.phone ?? '').replace(/\D/g, '');
  return words.every((w) => haystack.includes(w) || (/^\d{3,}$/.test(w) && phone.includes(w)));
}

export interface ListFilters {
  status: StatusFilter;
  wave: string;
  search: string;
  /** Por omissão, todos. */
  approval?: ApprovalFilter;
}

function matchesWave(row: InvitationRow, wave: string): boolean {
  if (!wave) return true;
  if (wave === NO_WAVE) return !row.wave;
  return row.wave === wave;
}

/** "Todos" não inclui os cancelados (como os números do evento). */
export function matchesStatus(row: InvitationRow, status: StatusFilter): boolean {
  return status === 'all' ? row.status !== 'cancelled' : row.status === status;
}

export function filterRows(rows: InvitationRow[], f: ListFilters): InvitationRow[] {
  return rows.filter((r) => matchesStatus(r, f.status) && matchesApproval(r, f.approval ?? 'all') && matchesWave(r, f.wave) && matchesSearch(r, f.search));
}

/** Contagens de cada filtro de estado, com a aprovação, a vaga e a pesquisa atuais. */
export function countByStatus(rows: InvitationRow[], f: Omit<ListFilters, 'status'>): Record<StatusFilter, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s.value, 0])) as Record<StatusFilter, number>;
  for (const r of rows) {
    if (!matchesApproval(r, f.approval ?? 'all') || !matchesWave(r, f.wave) || !matchesSearch(r, f.search)) continue;
    counts[r.status]++;
    if (r.status !== 'cancelled') counts.all++;
  }
  return counts;
}

/** Contagens de cada filtro de aprovação, com o estado, a vaga e a pesquisa atuais. */
export function countByApproval(rows: InvitationRow[], f: Omit<ListFilters, 'approval'>): Record<ApprovalFilter, number> {
  const counts = Object.fromEntries(APPROVAL_FILTERS.map((a) => [a.value, 0])) as Record<ApprovalFilter, number>;
  for (const r of rows) {
    if (!matchesStatus(r, f.status) || !matchesWave(r, f.wave) || !matchesSearch(r, f.search)) continue;
    counts.all++;
    for (const a of APPROVAL_FILTERS) if (a.value !== 'all' && matchesApproval(r, a.value)) counts[a.value]++;
  }
  return counts;
}

export interface Headcount {
  invited: number;
  accepted: number;
  /** Convidados que confirmaram + os respetivos acompanhantes (sem os não aprovados pela equipa, como a lotação). */
  expected: number;
  checkedIn: number;
}

export function headcount(rows: InvitationRow[]): Headcount {
  const active = rows.filter((r) => r.status !== 'cancelled');
  const accepted = active.filter((r) => r.status === 'accepted');
  return {
    invited: active.length,
    accepted: accepted.length,
    expected: accepted.reduce((n, r) => n + (r.approval_status === 'rejected' ? 0 : 1 + r.companions_count), 0),
    checkedIn: active.reduce((n, r) => n + (r.checked_in_at ? 1 : 0) + r.companions_checked_in, 0),
  };
}

export interface Recipients {
  /** Convites a enviar (sem cancelados). */
  targets: InvitationRow[];
  withEmail: InvitationRow[];
  withoutEmail: InvitationRow[];
  /** Destes, quantos já tinham sido enviados (recebem de novo). */
  resend: number;
}

/** Destinatários: a seleção, ou (sem seleção) todos os que estão por enviar. */
export function recipients(rows: InvitationRow[], selectedIds: ReadonlySet<string> | null): Recipients {
  const targets = rows.filter((r) => r.status !== 'cancelled' && (selectedIds ? selectedIds.has(r.id) : r.status === 'draft'));
  const withEmail = targets.filter((r) => !!r.email);
  return {
    targets,
    withEmail,
    withoutEmail: targets.filter((r) => !r.email),
    resend: withEmail.filter((r) => r.status !== 'draft').length,
  };
}

export const ATTENDANCE_HEADERS = ['Convidado', 'Entidade', 'Cargo', 'Estado', 'Aprovação', 'Tipo de acesso', 'Acompanhantes', 'Vaga', 'Entrada'];

/** Lista de presenças para o Excel (BOM, ";"), pela ordem da lista. */
export function attendanceCsv(rows: InvitationRow[], event: Pick<EventRecord, 'timezone'>): string {
  return toCsv([
    ATTENDANCE_HEADERS,
    ...rows.map((r) => [
      formalName(r),
      r.organization,
      r.job_title,
      INVITATION_STATUS[r.status].label,
      approvalApplies(r) ? APPROVAL_STATUS[r.approval_status].label : '',
      approvalApplies(r) && r.approval_status === 'approved' ? r.pass_type_name : '',
      r.plus_ones_allowed > 0 || r.companions_count > 0 ? `${r.companions_count} de ${r.plus_ones_allowed}` : '',
      r.wave,
      formatDateTime(r.checked_in_at, event.timezone),
    ]),
  ]);
}

/** "convidados-encontro-anual-2027-2026-11-03.csv" */
export function attendanceFileName(event: Pick<EventRecord, 'slug'>, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `convidados-${event.slug}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`;
}

// ───────── Modelos sugeridos ─────────

type DefaultTemplate = Omit<MessageTemplateInput, 'event_id'>;

/** Primeira frase do convite, conforme o que o evento tem preenchido. */
function opening(event: Pick<EventRecord, 'host_name' | 'invitation_text'>): string {
  if (event.host_name && event.invitation_text) return '{{anfitriao}} {{texto_convite}}';
  if (event.host_name) return '{{anfitriao}} tem a honra de convidar V. Exa. para {{evento}}.';
  return 'Temos a honra de convidar V. Exa. para {{evento}}.';
}

/** Convite formal (email) e convite por WhatsApp, adaptados aos dados do evento. */
export function defaultTemplates(event: Pick<EventRecord, 'host_name' | 'invitation_text' | 'rsvp_deadline'>): DefaultTemplate[] {
  const deadline = event.rsvp_deadline ? ' até {{prazo}}' : '';
  const email = [
    '{{tratamento}} {{nome_completo}},',
    opening(event),
    '{{evento}}\n{{data}}\n{{local}}',
    `Agradecemos que confirme a sua presença${deadline ? `${deadline},` : ''} através do seu convite pessoal, onde encontrará também o programa e as informações práticas.`,
    '{{link}}',
    event.host_name ? 'Com os melhores cumprimentos,\n{{anfitriao}}' : 'Com os melhores cumprimentos,',
  ].join('\n\n');
  const whatsapp = [
    '{{tratamento}} {{nome_completo}},',
    opening(event),
    '{{evento}}\n{{data}}\n{{local}}',
    `Pode confirmar a sua presença${deadline} no seu convite pessoal:\n{{link}}`,
    'Com os melhores cumprimentos.',
  ].join('\n\n');
  return [
    { channel: 'email', name: 'Convite formal', subject: 'Convite — {{evento}}', body: email },
    { channel: 'whatsapp', name: 'Convite por WhatsApp', subject: null, body: whatsapp },
  ];
}

/** Texto do WhatsApp: o primeiro modelo de WhatsApp do evento, ou o sugerido. */
export function whatsappBody(templates: MessageTemplate[] | undefined, event: Pick<EventRecord, 'host_name' | 'invitation_text' | 'rsvp_deadline'>): string {
  return templates?.find((t) => t.channel === 'whatsapp')?.body ?? defaultTemplates(event)[1].body;
}

/**
 * Lotação excedida ao juntar `party` pessoas (convidado e acompanhantes) às já esperadas.
 * null quando cabe ou quando o evento não tem lotação.
 */
export function capacityExcess(expected: number, capacity: number | null, party: number): { capacity: number; total: number } | null {
  if (capacity === null) return null;
  const total = expected + party;
  return total > capacity ? { capacity, total } : null;
}

/** Texto final de uma mensagem para um convidado. */
export function personalMessage(text: string, event: TemplateEvent, row: TemplateContact, link: string): string {
  return renderMessage(text, buildTemplateVars({ event, contact: row, link }));
}

export interface BulkResult {
  ok: number;
  failed: number;
  /** Primeiro erro, para mostrar ao utilizador. */
  error: unknown;
}

/** Executa uma operação por elemento, no máximo `limit` em simultâneo, sem parar nos erros. */
export async function runBulk<T>(items: T[], task: (item: T) => Promise<unknown>, limit = 6): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, error: null };
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
        result.ok++;
      } catch (err) {
        result.failed++;
        result.error ??= err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return result;
}
