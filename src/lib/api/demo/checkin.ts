import type { Api, CheckinRecord, Invitation } from '../types';
import { ApiError } from '../errors';
import { CAN_CHECK_IN, CAN_EDIT, delay, getDb, logActivity, nowIso, requireRole, save } from './store';

// Imita as funções SQL checkin_record, checkin_lookup, checkin_search, check_in e undo_check_in.

/** upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')) */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** substring(p_code from '([A-Za-z0-9_-]{22})/?$'): o token no fim de um link pessoal. */
export function tokenFromCode(raw: string | null | undefined): string | null {
  return /([A-Za-z0-9_-]{22})\/?$/.exec(raw ?? '')?.[1] ?? null;
}

/** Converte um padrão LIKE do Postgres ('%' e '_' são curingas) numa expressão regular. */
export function likeToRegExp(pattern: string): RegExp {
  const body = Array.from(pattern, (ch) => {
    if (ch === '%') return '[\\s\\S]*';
    if (ch === '_') return '[\\s\\S]';
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(`^${body}$`);
}

/** btrim() sem argumentos só tira espaços. */
const btrim = (s: string) => s.replace(/^ +| +$/g, '');

function record(inv: Invitation): CheckinRecord {
  const d = getDb();
  const c = d.contacts.find((x) => x.id === inv.contact_id);
  const e = d.events.find((x) => x.id === inv.event_id);
  if (!c || !e) throw new ApiError('not_found');
  return {
    invitation_id: inv.id,
    event_id: inv.event_id,
    event_name: e.name,
    salutation: c.salutation,
    first_name: c.first_name,
    last_name: c.last_name,
    organization: c.organization,
    status: inv.status,
    wave: inv.wave,
    approval_status: inv.approval_status,
    pass_type: (() => {
      const p = inv.approval_status === 'approved' ? d.passTypes.find((x) => x.id === inv.pass_type_id) : undefined;
      return p ? { name: p.name, color: p.color, accesses: [...p.accesses] } : null;
    })(),
    plus_ones_allowed: inv.plus_ones_allowed,
    checked_in_at: inv.checked_in_at,
    companions: d.companions
      .filter((m) => m.invitation_id === inv.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({ id: m.id, full_name: m.full_name, checked_in_at: m.checked_in_at })),
  };
}

function find(id: string): Invitation {
  const inv = getDb().invitations.find((i) => i.id === id);
  if (!inv) throw new ApiError('not_found');
  return inv;
}

const ORDER: Partial<Record<Invitation['status'], number>> = { accepted: 0, cancelled: 2 };
const collator = new Intl.Collator('pt-PT');

export const checkin: Api['checkin'] = {
  async lookup(eventId, code) {
    requireRole(...CAN_CHECK_IN);
    const v = normalizeCode(code);
    const token = tokenFromCode(code);
    const inv = getDb().invitations.find(
      (i) => i.event_id === eventId && (i.checkin_code === v || (token !== null && i.token === token)),
    );
    return delay(inv ? record(inv) : null);
  },

  async search(eventId, query) {
    requireRole(...CAN_CHECK_IN);
    const text = btrim(query ?? '');
    if (text.length < 2) return delay([]);
    const like = likeToRegExp(`%${text.toLowerCase()}%`);
    const d = getDb();
    const rows = d.invitations
      .filter((i) => i.event_id === eventId)
      .flatMap((i) => {
        const c = d.contacts.find((x) => x.id === i.contact_id);
        if (!c) return [];
        const hit = like.test(`${c.first_name} ${c.last_name ?? ''}`.toLowerCase())
          || like.test((c.organization ?? '').toLowerCase())
          || d.companions.some((m) => m.invitation_id === i.id && like.test(m.full_name.toLowerCase()));
        if (!hit) return [];
        return [{ inv: i, ord: ORDER[i.status] ?? 1, name: `${c.last_name ?? ''} ${c.first_name}`.toLowerCase() }];
      })
      .sort((a, b) => a.ord - b.ord || collator.compare(a.name, b.name))
      .slice(0, 25);
    return delay(rows.map((r) => record(r.inv)));
  },

  async checkIn(invitationId, companionIds, force = false) {
    const me = requireRole(...CAN_CHECK_IN);
    const inv = find(invitationId);
    if (inv.status !== 'accepted' && !force) throw new ApiError('not_accepted');
    if (inv.approval_status !== 'approved' && !force) throw new ApiError('not_approved');
    const now = nowIso();
    if (inv.checked_in_at === null) {
      inv.checked_in_at = now;
      inv.checked_in_by = me.user_id;
      inv.updated_at = now;
      logActivity({
        kind: 'checkin', contact_id: inv.contact_id, invitation_id: inv.id, event_id: inv.event_id, channel: null,
        detail: { status: inv.status, approval_status: inv.approval_status, forced: inv.status !== 'accepted' || inv.approval_status !== 'approved' },
      });
    }
    const ids = new Set(companionIds ?? []);
    for (const m of getDb().companions) {
      if (m.invitation_id === inv.id && ids.has(m.id) && m.checked_in_at === null) m.checked_in_at = now;
    }
    save();
    return delay(record(inv));
  },

  async undo(invitationId) {
    requireRole(...CAN_EDIT);
    const inv = find(invitationId);
    inv.checked_in_at = null;
    inv.checked_in_by = null;
    inv.updated_at = nowIso();
    for (const m of getDb().companions) {
      if (m.invitation_id === inv.id) m.checked_in_at = null;
    }
    logActivity({ kind: 'checkin.undone', contact_id: inv.contact_id, invitation_id: inv.id, event_id: inv.event_id, channel: null, detail: {} });
    save();
    return delay(record(inv));
  },
};
