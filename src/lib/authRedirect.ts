import { config } from './config';

// Parâmetros que o Supabase Auth acrescenta ao endereço depois de um link de acesso ou de convite da equipa.
const HASH_PARAMS = /(?:^|[#&?])(access_token|refresh_token|error_description|token_hash)=/;
const SEARCH_PARAMS = /[?&](code|error_description)=/;

/**
 * Trata o regresso de um link de acesso (email da equipa) ANTES de o router arrancar: com rotas em "#",
 * o router leria "#access_token=…" como um caminho e apagava-o. O cliente Supabase guarda a sessão e
 * a página passa para o back-office.
 */
export async function consumeAuthRedirect(): Promise<void> {
  if (config.demo) return;
  const { hash, search } = window.location;
  if (!HASH_PARAMS.test(hash) && !SEARCH_PARAMS.test(search)) return;
  const { supabase } = await import('./api/supabase/client');
  // getSession espera pela inicialização, que lê os parâmetros do endereço (detectSessionInUrl).
  await supabase.auth.getSession();
  const base = import.meta.env.BASE_URL;
  window.history.replaceState(null, '', import.meta.env.VITE_ROUTER === 'hash' ? `${base}#/admin` : `${base}admin`);
}
