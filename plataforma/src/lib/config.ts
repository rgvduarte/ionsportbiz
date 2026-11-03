// Configuração lida das variáveis VITE_* (ver .env.example).

const env = import.meta.env;

const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseKey =
  ((env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || (env.VITE_SUPABASE_ANON_KEY as string | undefined))?.trim() || '';

export const config = {
  supabaseUrl,
  supabaseKey,
  /** Sem Supabase configurado (ou com VITE_DEMO=1) a app usa dados fictícios em memória. */
  demo: env.VITE_DEMO === '1' || !supabaseUrl || !supabaseKey,
  /** Base dos links pessoais. Na app nativa a origem é capacitor://localhost, por isso tem de vir da configuração. */
  publicUrl: ((env.VITE_PUBLIC_URL as string | undefined)?.trim() || `${window.location.origin}${env.BASE_URL}`).replace(/\/+$/, ''),
};

/** Link pessoal do convidado. */
export function inviteUrl(token: string): string {
  return `${config.publicUrl}/c/${token}`;
}
