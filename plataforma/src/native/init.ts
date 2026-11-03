import { isNative, platform } from './platform';

const ACCENT = '#13294b';

/** Ecrãs de onde o botão "voltar" do Android sai da app em vez de recuar. */
const ROOT_PATHS = new Set(['/', '/app', '/admin', '/entrar']);

/**
 * Caminho interno de um link profundo: https://<domínio>/c/<token> ou convites://c/<token> (convite),
 * ou https://<domínio>/admin… (back-office, ex.: link de acesso enviado à equipa).
 * Devolve null para qualquer outro endereço.
 */
export function deepLinkPath(url: string): string | null {
  const u = url.trim();
  const invite = /^(?:https:\/\/[^/?#]+\/|convites:\/\/)c\/([A-Za-z0-9_-]{22})\/?(?:[?#].*)?$/i.exec(u);
  if (invite) return `/c/${invite[1]}`;
  const admin = /^https:\/\/[^/?#]+(\/admin(?:\/[A-Za-z0-9_-]+)*)\/?(?:[?#].*)?$/.exec(u);
  return admin ? admin[1] : null;
}

/**
 * Só se confia em convites://… e em https://<domínio público>/… (VITE_PUBLIC_URL). No Android outra app
 * pode abrir a app com qualquer endereço (Intent explícito); sem esta verificação, um link de outro
 * domínio com credenciais iniciaria uma sessão alheia. Devolve o endereço normalizado (o que as
 * expressões abaixo leem) ou null. Sem domínio público configurado (origem localhost) só vale convites://.
 */
export function trustedUrl(url: string, publicUrl: string): string | null {
  let u: URL;
  let base: URL;
  try {
    u = new URL(url.trim());
    base = new URL(publicUrl);
  } catch {
    return null;
  }
  if (u.protocol === 'convites:') return u.href;
  const ownDomain = base.protocol === 'https:' && base.hostname !== 'localhost';
  if (!ownDomain || u.protocol !== 'https:' || u.host !== base.host || u.username || u.password) return null;
  return u.href;
}

export type AuthLink =
  | { kind: 'session'; access_token: string; refresh_token: string }
  | { kind: 'otp'; token_hash: string; type: 'invite' | 'magiclink' | 'email' | 'recovery' | 'signup' };

const OTP_TYPES = new Set(['invite', 'magiclink', 'email', 'recovery', 'signup']);

/**
 * Credenciais de um link de acesso do Supabase (convite da equipa ou link por email), em dois formatos:
 *   https://<domínio>/admin#access_token=…&refresh_token=…   (modelos de email por omissão)
 *   https://<domínio>/admin?token_hash=…&type=magiclink        (modelos com {{ .TokenHash }})
 */
export function authLink(url: string): AuthLink | null {
  const m = /^https:\/\/[^/?#]+\/admin[^?#]*(?:\?([^#]*))?(?:#(.*))?$/.exec(url.trim());
  if (!m) return null;
  const hash = new URLSearchParams(m[2] ?? '');
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (access_token && refresh_token) return { kind: 'session', access_token, refresh_token };
  const query = new URLSearchParams(m[1] ?? '');
  const token_hash = query.get('token_hash');
  const type = query.get('type') ?? '';
  if (token_hash && OTP_TYPES.has(type)) return { kind: 'otp', token_hash, type: type as Extract<AuthLink, { kind: 'otp' }>['type'] };
  return null;
}

/**
 * Na app, os links de acesso da equipa abrem aqui (Universal/App Links): inicia a sessão com o link.
 * Uma sessão já aberta nunca é trocada pela de um link: um Intent explícito pode trazer o domínio
 * certo com credenciais de outra conta. Para entrar com outra conta, termina-se a sessão primeiro.
 */
async function signInFromLink(link: AuthLink): Promise<void> {
  const { config } = await import('../lib/config');
  if (config.demo) return;
  // Exceção à regra "só através de api": a sessão vem do Supabase Auth e não há equivalente no contrato.
  const { supabase } = await import('../lib/api/supabase/client');
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  if (link.kind === 'session') {
    await supabase.auth.setSession({ access_token: link.access_token, refresh_token: link.refresh_token });
  } else {
    await supabase.auth.verifyOtp({ token_hash: link.token_hash, type: link.type });
  }
}

/** Espera até a app ter desenhado o primeiro ecrã (ou desiste ao fim de `max` ms). */
function afterFirstPaint(max = 4000): Promise<void> {
  return new Promise((resolve) => {
    const root = document.getElementById('root');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const timer = setTimeout(finish, max);
    const observer = root ? new MutationObserver(() => root.childElementCount && finish()) : null;
    if (!root || root.childElementCount) finish();
    else observer?.observe(root, { childList: true });
  });
}

async function navigate(path: string): Promise<void> {
  // Import dinâmico: o router importa páginas que importam este módulo.
  const { router } = await import('../app/router');
  if (router.state.location.pathname !== path) await router.navigate(path);
}

/** Configuração das apps iOS/Android (barra de estado, ecrã inicial, links profundos). No browser não faz nada. */
export async function initNative(): Promise<void> {
  if (!isNative) return;
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ]);

  // Barra de estado azul-marinho com texto claro. No Android 15+ a app ocupa o ecrã todo
  // (edge-to-edge) e a cor de fundo é ignorada: as margens vêm de env(safe-area-inset-*).
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  await StatusBar.setBackgroundColor({ color: ACCENT }).catch(() => undefined);

  void afterFirstPaint().then(() => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined));

  // Links profundos (Universal Links / App Links e convites://). Na abertura a frio o
  // mesmo link pode chegar pelo evento e por getLaunchUrl(); navigate() ignora o repetido.
  const { config } = await import('../lib/config');
  const open = async (raw: string | undefined) => {
    const url = raw ? trustedUrl(raw, config.publicUrl) : null;
    const path = url ? deepLinkPath(url) : null;
    if (!url || !path) return;
    // authLink só aceita https: (Universal/App Links do domínio público), nunca convites://.
    const link = authLink(url);
    if (link) await signInFromLink(link).catch(() => undefined);
    await navigate(path);
  };
  await App.addListener('appUrlOpen', ({ url }) => void open(url));
  App.getLaunchUrl().then((r) => open(r?.url)).catch(() => undefined);

  if (platform === 'android') {
    await App.addListener('backButton', ({ canGoBack }) => {
      // Uma janela aberta (diálogo, painel) fecha-se primeiro, como no Escape.
      if (document.querySelector('.ui-overlay')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (ROOT_PATHS.has(path) || !canGoBack) void App.exitApp();
      else window.history.back();
    });
  }
}
