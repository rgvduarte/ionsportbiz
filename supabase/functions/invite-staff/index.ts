// Função invite-staff: convida um novo membro da equipa (ou reativa quem já tem conta).
//
// Pedido:   POST { email: string, full_name: string, role: 'admin' | 'editor' | 'checkin' | 'viewer' }
//           com o cabeçalho Authorization do utilizador (a app envia-o automaticamente).
// Resposta: { ok: true, existing: boolean }   existing = a conta já existia (não é enviado email)
// Erros:    { error, message } com error = 'auth' | 'forbidden' | 'validation' | 'last_admin' | 'unknown'
//
// Segredos: PUBLIC_URL (endereço público da app, sem barra final). SUPABASE_URL, SUPABASE_ANON_KEY
// e SUPABASE_SERVICE_ROLE_KEY são definidos pelo Supabase.
//
// Segurança: só um administrador ativo (is_admin, verificado com o token de quem chama) pode convidar.
// A chave de serviço só é usada depois dessa verificação, para criar a conta e escrever na tabela staff.
// O email de convite é o modelo "Invite user" do Supabase (Authentication → Email Templates).

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';

const ROLES = ['admin', 'editor', 'checkin', 'viewer'] as const;
type Role = (typeof ROLES)[number];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_PAGE = 1000;

function fail(status: number, error: string, message: string): Response {
  return jsonResponse({ error, message }, status);
}

interface Input {
  email: string;
  full_name: string;
  role: Role;
}

function parse(body: unknown): Input | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : '';
  const role = b.role as Role;
  if (!EMAIL.test(email) || email.length > 254) return 'Indique um email válido.';
  if (fullName.length < 1 || fullName.length > 120) return 'O nome tem de ter entre 1 e 120 caracteres.';
  if (!ROLES.includes(role)) return 'Papel inválido.';
  return { email, full_name: fullName, role };
}

/** Procura uma conta pelo email (a API de administração só lista por páginas). */
async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < PER_PAGE) return null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return fail(405, 'validation', 'Método não permitido.');

  const authorization = req.headers.get('Authorization');
  if (!authorization) return fail(401, 'auth', 'Sessão em falta.');

  const env = {
    url: Deno.env.get('SUPABASE_URL'),
    anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    publicUrl: (Deno.env.get('PUBLIC_URL') ?? '').trim().replace(/\/+$/, ''),
  };
  if (!env.url || !env.anonKey || !env.serviceKey) return fail(500, 'unknown', 'Configuração do Supabase em falta.');

  let input: Input | string;
  try {
    input = parse(await req.json());
  } catch {
    return fail(400, 'validation', 'Pedido inválido.');
  }
  if (typeof input === 'string') return fail(400, 'validation', input);

  // 1. Quem chama tem de ser administrador (com o token dele, por isso a regra é a da base de dados).
  const asCaller = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: roleError } = await asCaller.rpc('is_admin');
  if (roleError) return fail(401, 'auth', 'Sessão inválida ou expirada.');
  if (isAdmin !== true) return fail(403, 'forbidden', 'Só um administrador pode convidar membros da equipa.');

  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 2. Cria a conta e envia o email de convite; se a conta já existir, usa-a.
    let userId: string | null = null;
    let existing = false;
    const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
      ...(env.publicUrl ? { redirectTo: `${env.publicUrl}/` } : {}),
      data: { full_name: input.full_name },
    });
    if (invited.error) {
      const code = (invited.error as { code?: string }).code;
      const already = code === 'email_exists' || /already (been )?registered|already exists/i.test(invited.error.message);
      if (!already) throw invited.error;
      const user = await findUserByEmail(admin, input.email);
      if (!user) throw invited.error;
      userId = user.id;
      existing = true;
    } else {
      userId = invited.data.user?.id ?? null;
    }
    if (!userId) return fail(500, 'unknown', 'Não foi possível criar a conta.');

    // 3. Linha na equipa (o trigger keep_one_admin continua a aplicar-se).
    const { error: upsertError } = await admin
      .from('staff')
      .upsert({ user_id: userId, full_name: input.full_name, email: input.email, role: input.role, active: true }, { onConflict: 'user_id' });
    if (upsertError) {
      if (upsertError.message.startsWith('last_admin')) {
        return fail(409, 'last_admin', 'Tem de existir pelo menos um administrador ativo.');
      }
      throw upsertError;
    }

    return jsonResponse({ ok: true, existing });
  } catch (err) {
    console.error('invite-staff', err);
    const message = err instanceof Error ? err.message : String(err);
    if (/rate limit/i.test(message)) {
      return fail(429, 'unknown', 'Foram enviados demasiados convites num curto espaço de tempo. Tente daqui a alguns minutos.');
    }
    return fail(500, 'unknown', 'Não foi possível enviar o convite. Tente novamente.');
  }
});
