// Função send-invitations: envia convites por email (Brevo) e marca-os como enviados.
//
// Pedido:  POST { invitation_ids: string[], template_id: string }   (máx. 500 convites por pedido)
//          com o cabeçalho Authorization do utilizador (a app envia-o automaticamente).
// Resposta: { sent: number, failed: number, errors: { invitation_id: string, message: string }[] }
//
// Segredos necessários (supabase secrets set …):
//   BREVO_API_KEY     chave da API transacional da Brevo
//   MAIL_FROM_EMAIL   remetente, num domínio validado na Brevo (ex.: convites@fundacao.pt)
//   MAIL_FROM_NAME    nome do remetente (opcional; por omissão, o anfitrião ou o nome do evento)
//   MAIL_REPLY_TO     endereço para respostas (opcional; por omissão, o email de contacto do evento)
//   PUBLIC_URL        endereço público da app, sem barra final (ex.: https://convites.fundacao.pt)
// SUPABASE_URL e SUPABASE_ANON_KEY são definidos pelo Supabase.
//
// Segurança: as consultas usam o token de quem chama, por isso a RLS aplica-se; só admin/editor
// (can_edit) podem enviar. Cada envio fica registado em deliveries e na linha do tempo (mark_sent).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { buildTemplateVars, renderMessage, renderTemplate } from '../_shared/template.ts';
import { buildEmailHtml, buildEmailText } from '../_shared/email-html.ts';

const MAX_IDS = 500;
const CONCURRENCY = 5;
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EventRow {
  id: string;
  name: string;
  host_name: string | null;
  invitation_text: string | null;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_deadline: string | null;
  status: string;
  contact_email: string | null;
  privacy_controller: string | null;
  branding: { accent?: string; logo_url?: string } | null;
}

interface InvitationRow {
  id: string;
  event_id: string;
  token: string;
  status: string;
  salutation: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  organization: string | null;
  language: string;
}

interface Outcome {
  invitation_id: string;
  ok: boolean;
  messageId?: string;
  error?: string;
  /** false: o convite não existe neste evento (não se regista em deliveries). */
  record: boolean;
}

function fail(status: number, error: string, message: string): Response {
  return jsonResponse({ error, message }, status);
}

/** Executa as tarefas com no máximo `limit` em simultâneo. */
async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function footerFor(event: EventRow, en: boolean): string {
  const lines = [en ? 'This invitation is personal and non-transferable.' : 'Este convite é pessoal e intransmissível.'];
  if (event.contact_email) lines.push(en ? `For any questions: ${event.contact_email}` : `Para qualquer esclarecimento: ${event.contact_email}`);
  if (event.privacy_controller) lines.push(en ? `Data controller: ${event.privacy_controller}` : `Responsável pelo tratamento dos dados: ${event.privacy_controller}`);
  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return fail(405, 'validation', 'Método não permitido.');

  const authorization = req.headers.get('Authorization');
  if (!authorization) return fail(401, 'auth', 'Sessão em falta.');

  const env = {
    url: Deno.env.get('SUPABASE_URL'),
    anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    brevoKey: Deno.env.get('BREVO_API_KEY'),
    fromEmail: Deno.env.get('MAIL_FROM_EMAIL'),
    fromName: Deno.env.get('MAIL_FROM_NAME'),
    replyTo: Deno.env.get('MAIL_REPLY_TO'),
    publicUrl: (Deno.env.get('PUBLIC_URL') ?? '').replace(/\/+$/, ''),
  };
  if (!env.url || !env.anonKey) return fail(500, 'unknown', 'Configuração do Supabase em falta.');

  let body: { invitation_ids?: unknown; template_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'validation', 'Pedido inválido.');
  }
  const ids = Array.isArray(body.invitation_ids)
    ? [...new Set(body.invitation_ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)))]
    : [];
  const templateId = typeof body.template_id === 'string' && UUID.test(body.template_id) ? body.template_id : null;
  if (!ids.length || !templateId) return fail(400, 'validation', 'Indique os convites e o modelo de email.');
  if (ids.length > MAX_IDS) return fail(400, 'validation', `No máximo ${MAX_IDS} convites por envio.`);

  const supabase = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: canEdit, error: roleError } = await supabase.rpc('can_edit');
  if (roleError) return fail(401, 'auth', 'Sessão inválida ou expirada.');
  if (canEdit !== true) return fail(403, 'forbidden', 'Não tem permissão para enviar convites.');

  if (!env.brevoKey || !env.fromEmail || !env.publicUrl) {
    return fail(500, 'unknown', 'O envio de emails não está configurado (BREVO_API_KEY, MAIL_FROM_EMAIL, PUBLIC_URL).');
  }

  const { data: template, error: templateError } = await supabase
    .from('message_templates').select('id, event_id, channel, subject, body').eq('id', templateId).maybeSingle();
  if (templateError) return fail(500, 'unknown', templateError.message);
  if (!template) return fail(404, 'not_found', 'O modelo de email não existe.');
  if (template.channel !== 'email') return fail(400, 'validation', 'O modelo escolhido não é de email.');

  const { data: event, error: eventError } = await supabase
    .from('events').select('*').eq('id', template.event_id).maybeSingle<EventRow>();
  if (eventError) return fail(500, 'unknown', eventError.message);
  if (!event) return fail(404, 'not_found', 'O evento não existe.');
  if (event.status !== 'open' && event.status !== 'closed') {
    return fail(409, 'validation', 'O evento não está publicado: os links pessoais ainda não abrem.');
  }

  // Em blocos, para o endereço do pedido não ficar demasiado longo.
  const invitations: InvitationRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('invitation_overview')
      .select('id, event_id, token, status, salutation, first_name, last_name, email, organization, language')
      .eq('event_id', event.id)
      .in('id', ids.slice(i, i + 100));
    if (error) return fail(500, 'unknown', error.message);
    invitations.push(...((data ?? []) as InvitationRow[]));
  }
  const byId = new Map(invitations.map((inv) => [inv.id, inv]));

  const accent = event.branding?.accent ?? null;
  const logoUrl = event.branding?.logo_url ?? null;

  const outcomes = await pool(ids, CONCURRENCY, async (id): Promise<Outcome> => {
    const inv = byId.get(id);
    if (!inv) return { invitation_id: id, ok: false, error: 'Convite não encontrado neste evento.', record: false };
    if (inv.status === 'cancelled') return { invitation_id: id, ok: false, error: 'Convite cancelado.', record: false };
    if (!inv.email) return { invitation_id: id, ok: false, error: 'Sem endereço de email.', record: true };

    const en = inv.language === 'en';
    const link = `${env.publicUrl}/c/${inv.token}`;
    const vars = buildTemplateVars({ event, contact: inv, link });
    const subject = renderTemplate(template.subject ?? '', vars).replace(/\s+/g, ' ').trim() || event.name;
    const bodyText = renderMessage(template.body, vars);
    const ctaLabel = en ? 'Open the invitation' : 'Abrir o convite';
    const footer = footerFor(event, en);

    const payload: Record<string, unknown> = {
      sender: { email: env.fromEmail, name: env.fromName || event.host_name || event.name },
      to: [{ email: inv.email, name: vars.nome_completo || undefined }],
      subject,
      htmlContent: buildEmailHtml({ subject, bodyText, ctaLabel, ctaUrl: link, accent, logoUrl, footer, lang: en ? 'en' : 'pt' }),
      textContent: buildEmailText({ bodyText, ctaLabel, ctaUrl: link, footer }),
      tags: ['convite'],
    };
    const replyTo = env.replyTo || event.contact_email;
    if (replyTo) payload.replyTo = { email: replyTo };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': env.brevoKey!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({})) as { messageId?: string; message?: string; code?: string };
      if (!res.ok) {
        return { invitation_id: id, ok: false, error: data.message || data.code || `Erro ${res.status} do serviço de email.`, record: true };
      }
      return { invitation_id: id, ok: true, messageId: data.messageId, record: true };
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      return { invitation_id: id, ok: false, error: aborted ? 'O serviço de email não respondeu a tempo.' : String(err), record: true };
    } finally {
      clearTimeout(timer);
    }
  });

  const now = new Date().toISOString();
  const deliveries = outcomes.filter((o) => o.record).map((o) => ({
    invitation_id: o.invitation_id,
    channel: 'email',
    template_id: template.id,
    status: o.ok ? 'sent' : 'failed',
    provider_message_id: o.messageId ?? null,
    error: o.ok ? null : o.error ?? null,
    sent_at: o.ok ? now : null,
  }));
  if (deliveries.length) {
    const { error } = await supabase.from('deliveries').insert(deliveries);
    // O registo de envios não deve esconder que os emails já saíram.
    if (error) console.error('deliveries insert', error.message);
  }

  const sentIds = outcomes.filter((o) => o.ok).map((o) => o.invitation_id);
  if (sentIds.length) {
    const { error } = await supabase.rpc('mark_sent', { p_invitation_ids: sentIds, p_channel: 'email' });
    if (error) {
      return jsonResponse({
        error: 'unknown',
        message: `Foram enviados ${sentIds.length} emails, mas não foi possível atualizar o estado dos convites.`,
        sent: sentIds.length,
        failed: outcomes.length - sentIds.length,
      }, 500);
    }
  }

  const errors = outcomes.filter((o) => !o.ok).map((o) => ({ invitation_id: o.invitation_id, message: o.error ?? '' }));
  return jsonResponse({ sent: sentIds.length, failed: errors.length, errors });
});
