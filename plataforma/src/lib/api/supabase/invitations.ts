import type { Activity, Api, Companion, Invitation, InvitationRow } from '../types';
import { ApiError, toApiError, type ApiErrorCode } from '../errors';
import { supabase, check, ilikeTerm, must } from './client';

/** O PostgREST devolve no máximo 1000 linhas por pedido. */
const BATCH = 1000;
/** Limite da função send-invitations por pedido. */
const SEND_BATCH = 500;
const SEARCH_COLUMNS = ['first_name', 'last_name', 'email', 'organization'];

const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += BATCH) {
    const rows = must(await page(from, from + BATCH - 1));
    out.push(...rows);
    if (rows.length < BATCH) return out;
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const blank = (s: string | null | undefined) => (s ?? '').trim() || null;

/** Erro devolvido pela função send-invitations ({ error, message }) convertido em ApiError. */
async function functionError(err: unknown): Promise<ApiError> {
  const context = (err as { context?: unknown })?.context;
  if (context instanceof Response) {
    const body = await context.clone().json().catch(() => null) as { error?: string; message?: string } | null;
    const status = context.status;
    const code: ApiErrorCode = status === 403 ? 'forbidden' : status === 401 ? 'auth' : status === 404 ? 'not_found'
      : status === 400 || status === 409 ? 'validation' : 'unknown';
    return new ApiError(code, body?.error, body?.message || undefined);
  }
  return toApiError(err);
}

export const invitations: Api['invitations'] = {
  async list(eventId, q) {
    const words = (q?.search ?? '').split(/\s+/).map((w) => w.trim()).filter(Boolean).slice(0, 6);
    return readAll<InvitationRow>((from, to) => {
      let query = supabase.from('invitation_overview').select('*').eq('event_id', eventId);
      if (q?.status) query = query.eq('status', q.status);
      if (q?.wave) query = query.eq('wave', q.wave);
      // Cada palavra tem de aparecer num dos campos.
      for (const word of words) {
        const term = ilikeTerm(word);
        if (term !== '**') query = query.or(SEARCH_COLUMNS.map((c) => `${c}.ilike.${term}`).join(','));
      }
      return query
        .order('last_name', { ascending: true, nullsFirst: false })
        .order('first_name', { ascending: true })
        .order('id')
        .range(from, to);
    });
  },

  async get(id) {
    const row = must(await supabase.from('invitation_overview').select('*').eq('id', id).maybeSingle()) as InvitationRow;
    const companions = must(
      await supabase.from('companions').select('*').eq('invitation_id', id).order('created_at').order('id'),
    ) as Companion[];
    return { ...row, companions };
  },

  async create(eventId, contactIds, opts) {
    const ids = [...new Set(contactIds)];
    if (!ids.length) return 0;
    let plusOnes = opts?.plusOnes;
    if (plusOnes === undefined) {
      const event = must(await supabase.from('events').select('default_plus_ones').eq('id', eventId).maybeSingle());
      plusOnes = (event as { default_plus_ones: number }).default_plus_ones;
    }
    const wave = blank(opts?.wave);
    let created = 0;
    for (const part of chunks(ids, 500)) {
      const rows = part.map((contact_id) => ({ event_id: eventId, contact_id, wave, plus_ones_allowed: plusOnes }));
      const inserted = must(
        await supabase.from('invitations').upsert(rows, { onConflict: 'event_id,contact_id', ignoreDuplicates: true }).select('id'),
      );
      created += inserted.length;
    }
    return created;
  },

  async update(id, patch) {
    const fields: Partial<Invitation> = {};
    if (patch.wave !== undefined) fields.wave = blank(patch.wave);
    if (patch.plus_ones_allowed !== undefined) fields.plus_ones_allowed = patch.plus_ones_allowed;
    if (patch.answers !== undefined) fields.answers = patch.answers;
    if (patch.guest_note !== undefined) fields.guest_note = blank(patch.guest_note);
    if (patch.status !== undefined) {
      fields.status = patch.status;
      // Resposta registada pela equipa (telefone, email): conta como resposta.
      if (patch.status === 'accepted' || patch.status === 'declined') fields.responded_at = new Date().toISOString();
    }
    if (!Object.keys(fields).length) return;
    const rows = must(await supabase.from('invitations').update(fields).eq('id', id).select('id'));
    if (!rows.length) throw new ApiError('not_found');
    // Como guest_respond: quem recusa deixa de ter acompanhantes (não aparecem na entrada nem voltam a contar).
    if (patch.status === 'declined') check(await supabase.from('companions').delete().eq('invitation_id', id));
  },

  async remove(id) {
    const rows = must(await supabase.from('invitations').delete().eq('id', id).select('id'));
    if (!rows.length) throw new ApiError('not_found');
  },

  async markSent(ids, channel) {
    if (!ids.length) return 0;
    const res = await supabase.rpc('mark_sent', { p_invitation_ids: ids, p_channel: channel });
    check(res);
    return (res.data as number | null) ?? 0;
  },

  async sendEmail(ids, templateId) {
    let sent = 0;
    let failed = 0;
    for (const part of chunks([...new Set(ids)], SEND_BATCH)) {
      const { data, error } = await supabase.functions.invoke<{ sent: number; failed: number }>('send-invitations', {
        body: { invitation_ids: part, template_id: templateId },
      });
      if (error) {
        const err = await functionError(error);
        // Os blocos anteriores já foram enviados: não esconder isso.
        if (sent > 0) throw new ApiError(err.code, err.detail, `${err.message} (${sent} convites já tinham sido enviados.)`);
        throw err;
      }
      sent += data?.sent ?? 0;
      failed += data?.failed ?? 0;
    }
    return { sent, failed };
  },

  async waves(eventId) {
    const rows = await readAll<{ wave: string }>((from, to) =>
      supabase.from('invitations').select('wave').eq('event_id', eventId).not('wave', 'is', null).order('wave').order('id').range(from, to));
    return [...new Set(rows.map((r) => r.wave))].sort(collator.compare);
  },

  async activities(eventId, limit = 50) {
    return must(
      await supabase.from('activities').select('*').eq('event_id', eventId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit),
    ) as Activity[];
  },
};
