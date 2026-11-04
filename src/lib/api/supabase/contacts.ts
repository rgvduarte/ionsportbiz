import type { Activity, Api, Contact, ContactInput, EventRecord, ImportResult, ImportRow, Invitation } from '../types';
import { ApiError } from '../errors';
import type { ErasureRequest, ErasureRequestsApi } from '../erasure';
import { normalizeEmail, normalizePhone } from '../../phone';
import { supabase, check, must } from './client';
import { accentInsensitivePattern, searchWords } from './contactSearch';

const SEARCH_COLUMNS = ['first_name', 'last_name', 'email', 'organization', 'phone'];
/** Colunas de Invitation na vista invitation_overview. */
const INVITATION_COLUMNS = 'id,event_id,contact_id,token,checkin_code,status,wave,plus_ones_allowed,invited_by,sent_at,sent_channel,'
  + 'first_opened_at,last_opened_at,open_count,responded_at,answers,guest_note,checked_in_at,checked_in_by,created_at,updated_at';
/** O PostgREST devolve no máximo 1000 linhas por pedido. */
const BATCH = 1000;

/** Normaliza no browser o que o trigger normalize_contact também normaliza (telefone em E.164, email em minúsculas). */
function clean<T extends Partial<ContactInput>>(input: T): T {
  const out = { ...input };
  if ('email' in out) out.email = normalizeEmail(out.email);
  if ('phone' in out && out.phone) out.phone = normalizePhone(out.phone) ?? out.phone.replace(/[\s().-]/g, '');
  if ('tags' in out && out.tags) out.tags = [...new Set(out.tags.map((t) => t.trim()).filter(Boolean))];
  return out;
}

/** Lê todas as linhas de uma consulta, em blocos de 1000. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += BATCH) {
    const rows = must(await page(from, from + BATCH - 1));
    out.push(...rows);
    if (rows.length < BATCH) return out;
  }
}

const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError('auth');
  return id;
}

export const contacts: Api['contacts'] & ErasureRequestsApi = {
  async list(q) {
    let query = supabase.from('contacts').select('*', { count: 'exact' });
    // Cada palavra tem de aparecer num dos campos: "ana costa" encontra Ana (nome) Costa (apelido).
    // Sem distinguir acentos (o ilike distingue "Ines" de "Inês"): imatch com as variantes de cada letra.
    for (const word of searchWords(q.search)) {
      const pattern = accentInsensitivePattern(word);
      const filters = SEARCH_COLUMNS.map((c) => `${c}.imatch.${pattern}`);
      const digits = word.replace(/[\s().+-]/g, '');
      if (/^\d{3,}$/.test(digits) && digits !== word) filters.push(`phone.ilike.*${digits}*`);
      query = query.or(filters.join(','));
    }
    if (q.segment) query = query.eq('segment', q.segment);
    if (q.tag) query = query.contains('tags', [q.tag]);
    if (q.consent !== undefined) query = query.eq('marketing_consent', q.consent);

    const sort = q.sort ?? { column: 'last_name', ascending: true };
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
    if (sort.column !== 'last_name') query = query.order('last_name', { ascending: true, nullsFirst: false });
    query = query.order('first_name', { ascending: true }).order('id');

    const from = q.page * q.pageSize;
    const res = await query.range(from, from + q.pageSize - 1);
    check(res);
    return { rows: (res.data ?? []) as Contact[], total: res.count ?? 0 };
  },

  async get(id) {
    return must(await supabase.from('contacts').select('*').eq('id', id).single()) as Contact;
  },

  async create(input) {
    return must(await supabase.from('contacts').insert(clean(input)).select().single()) as Contact;
  },

  async update(id, patch) {
    return must(await supabase.from('contacts').update(clean(patch)).eq('id', id).select().single()) as Contact;
  },

  async remove(id) {
    const res = await supabase.from('contacts').delete().eq('id', id).select('id');
    check(res);
    if (!res.data?.length) throw new ApiError('not_found');
  },

  async anonymize(id) {
    check(await supabase.rpc('anonymize_contact', { p_contact_id: id }));
  },

  async exportData(id) {
    const res = await supabase.rpc('contact_export', { p_contact_id: id });
    check(res);
    return res.data as unknown;
  },

  async segments() {
    const rows = await readAll<{ segment: string }>((from, to) =>
      supabase.from('contacts').select('segment').not('segment', 'is', null).order('segment').range(from, to));
    return [...new Set(rows.map((r) => r.segment))].sort(collator.compare);
  },

  async tags() {
    const rows = await readAll<{ tags: string[] }>((from, to) =>
      supabase.from('contacts').select('tags').neq('tags', '{}').order('id').range(from, to));
    return [...new Set(rows.flatMap((r) => r.tags))].sort(collator.compare);
  },

  async import(rows, opts) {
    const payload: ImportRow[] = rows.map((r) => {
      const email = normalizeEmail(r.email);
      const phone = r.phone ? normalizePhone(r.phone) ?? r.phone : undefined;
      return { ...r, email: email ?? undefined, phone };
    });
    const res = await supabase.rpc('import_contacts', {
      p_rows: payload,
      p_event_id: opts?.eventId ?? null,
      p_wave: opts?.wave?.trim() || null,
      p_plus_ones: opts?.plusOnes ?? null,
      p_pass_type_id: opts?.passTypeId ?? null,
    });
    check(res);
    const data = res.data as Partial<ImportResult> | null;
    return {
      inserted: data?.inserted ?? 0,
      updated: data?.updated ?? 0,
      invited: data?.invited ?? 0,
      errors: data?.errors ?? [],
    };
  },

  async activities(contactId) {
    return must(await supabase.from('activities').select('*').eq('contact_id', contactId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200)) as Activity[];
  },

  async addNote(contactId, text) {
    const body = text.trim();
    if (!body) throw new ApiError('validation');
    const actorId = await currentUserId();
    check(await supabase.from('activities').insert({ kind: 'note', contact_id: contactId, detail: { text: body }, actor_id: actorId }));
  },

  async erasureRequests() {
    // Pedidos registados por guest_request_erasure cujo contacto ainda não foi anonimizado.
    type Row = { contact_id: string; created_at: string; contacts: Contact };
    const rows = await readAll<Row>((from, to) =>
      supabase.from('activities')
        .select('contact_id, created_at, contacts!inner(*)')
        .eq('kind', 'privacy.erasure_requested')
        .is('contacts.anonymized_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
        .overrideTypes<Row[], { merge: false }>());
    // Um por contacto: o prazo conta a partir do primeiro pedido.
    const out = new Map<string, ErasureRequest>();
    for (const r of rows) {
      if (!out.has(r.contact_id)) out.set(r.contact_id, { contact_id: r.contact_id, requested_at: r.created_at, contact: r.contacts });
    }
    return [...out.values()];
  },

  async invitations(contactId) {
    // A tabela não deixa ler o link nem o código: vêm da vista, só para quem edita (null para a leitura).
    const rows = must(await supabase.from('invitation_overview').select(INVITATION_COLUMNS)
      .eq('contact_id', contactId).order('created_at', { ascending: false }).order('id')) as unknown as Invitation[];
    if (!rows.length) return [];
    const events = must(await supabase.from('events').select('id,name,starts_at,status')
      .in('id', [...new Set(rows.map((r) => r.event_id))])) as Pick<EventRecord, 'id' | 'name' | 'starts_at' | 'status'>[];
    const byId = new Map(events.map((e) => [e.id, e]));
    return rows.flatMap((r) => {
      const event = byId.get(r.event_id);
      return event ? [{ ...r, event }] : [];
    });
  },
};
