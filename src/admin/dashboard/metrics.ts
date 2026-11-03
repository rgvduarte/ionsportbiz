// Cálculos do painel (sem React), a partir de EventStats.

import type { BreakdownRow, Channel, EventRecord, EventStats, InvitationStatus } from '../../lib/api/types';
import { formatNumber, toLocalInput } from '../../lib/format';
import { CHANNEL } from '../../lib/status';

export const ratio = (part: number, total: number) => (total > 0 ? part / total : 0);

export interface FunnelStep {
  key: 'invited' | 'delivered' | 'opened' | 'responded' | 'accepted';
  label: string;
  count: number;
  /** Fração dos convidados (0–1). */
  share: number;
}

export function funnel(s: EventStats): FunnelStep[] {
  const steps: Omit<FunnelStep, 'share'>[] = [
    { key: 'invited', label: 'Convidados', count: s.invited },
    { key: 'delivered', label: 'Enviados', count: s.delivered },
    { key: 'opened', label: 'Vistos', count: s.opened },
    { key: 'responded', label: 'Responderam', count: s.responded },
    { key: 'accepted', label: 'Confirmados', count: s.by_status.accepted },
  ];
  return steps.map((x) => ({ ...x, share: ratio(x.count, s.invited) }));
}

export type ActiveStatus = Exclude<InvitationStatus, 'cancelled'>;

export interface BreakdownLine extends BreakdownRow {
  name: string;
  pending: number;
  /** Fração de confirmados entre os convidados do grupo (0–1). */
  acceptedShare: number;
}

export function breakdownLines(rows: (BreakdownRow & { name: string })[]): BreakdownLine[] {
  return rows.map((r) => ({ ...r, pending: Math.max(0, r.invited - r.accepted - r.declined), acceptedShare: ratio(r.accepted, r.invited) }));
}

export function breakdownTotal(lines: BreakdownLine[]): Omit<BreakdownLine, 'name'> {
  const t = lines.reduce((acc, l) => ({
    invited: acc.invited + l.invited, accepted: acc.accepted + l.accepted, declined: acc.declined + l.declined, pending: acc.pending + l.pending,
  }), { invited: 0, accepted: 0, declined: 0, pending: 0 });
  return { ...t, acceptedShare: ratio(t.accepted, t.invited) };
}

/** Dia (AAAA-MM-DD) de um instante no fuso indicado. */
function dayKey(iso: string, tz: string): string {
  return toLocalInput(iso, tz).slice(0, 10);
}

/** Diferença em dias de calendário (no fuso do evento) entre `now` e `iso`. Positivo: no futuro. */
export function calendarDaysUntil(iso: string, tz: string, now = new Date()): number {
  const [a, b] = [dayKey(now.toISOString(), tz), dayKey(iso, tz)].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 864e5);
}

export type EventPhase = 'upcoming' | 'today' | 'live' | 'past';

/** Antes, no dia, a decorrer ou depois do evento (sem hora de fim, conta como a decorrer até ao fim do dia). */
export function eventPhase(event: Pick<EventRecord, 'starts_at' | 'ends_at' | 'timezone'>, now = new Date()): EventPhase {
  const start = new Date(event.starts_at).getTime();
  const days = calendarDaysUntil(event.starts_at, event.timezone, now);
  const t = now.getTime();
  if (event.ends_at) {
    const end = new Date(event.ends_at).getTime();
    if (t >= start && t <= end) return 'live';
    if (t > end) return 'past';
  } else if (t >= start) {
    return days === 0 ? 'live' : 'past';
  }
  return days > 0 ? 'upcoming' : 'today';
}

/** true no dia do evento e depois (para mostrar as entradas). */
export function showCheckins(event: Pick<EventRecord, 'starts_at' | 'ends_at' | 'timezone'>, now = new Date()): boolean {
  return eventPhase(event, now) !== 'upcoming';
}

/** Complemento "por <canal>" de uma linha de atividade: "Manual" e "Link" não se leem bem depois de "por". */
export function channelPhrase(channel: Channel): string {
  if (channel === 'manual') return 'por outra via';
  if (channel === 'link') return 'no convite pessoal';
  return `por ${CHANNEL[channel]}`;
}

/** Decomposição das pessoas esperadas: convites confirmados + acompanhantes (sem os não aprovados pela equipa). */
export function attendeesLine(s: Pick<EventStats, 'expected_attendees' | 'by_status' | 'approval'>): string {
  const rejected = s.approval.rejected;
  const accepted = Math.max(0, s.by_status.accepted - rejected);
  if (!accepted) return s.by_status.accepted ? 'Sem confirmações aprovadas' : 'Ainda sem confirmações';
  const companions = Math.max(0, s.expected_attendees - accepted);
  const head = `${formatNumber(accepted)} ${accepted === 1 ? 'confirmado' : 'confirmados'}`;
  const tail = rejected ? ` (sem ${formatNumber(rejected)} não ${rejected === 1 ? 'aprovado' : 'aprovados'})` : '';
  if (!companions) return head + tail;
  return `${head} + ${formatNumber(companions)} ${companions === 1 ? 'acompanhante' : 'acompanhantes'}${tail}`;
}

export interface PassTypeLine {
  id: string | null;
  name: string;
  color: string | null;
  /** Convidados com presença confirmada e aprovados com este tipo. */
  approved: number;
  /** Os mesmos, com acompanhantes. */
  attendees: number;
  /** Fração dos aprovados (0–1). */
  share: number;
}

/**
 * Aprovados por tipo de acesso, pela ordem definida pela equipa. Os aprovados sem tipo (ex.: tipo eliminado,
 * ou aprovação automática) aparecem numa linha própria no fim.
 */
export function passTypeLines(s: Pick<EventStats, 'approval' | 'by_pass_type'>): PassTypeLine[] {
  const total = s.approval.approved;
  const typed = [...s.by_pass_type].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'pt-PT'));
  const lines: PassTypeLine[] = typed.map((t) => ({
    id: t.pass_type_id, name: t.name, color: t.color, approved: t.approved, attendees: t.attendees, share: ratio(t.approved, total),
  }));
  const without = Math.max(0, total - typed.reduce((n, t) => n + t.approved, 0));
  if (without) lines.push({ id: null, name: 'Sem tipo de acesso', color: null, approved: without, attendees: 0, share: ratio(without, total) });
  return lines;
}
