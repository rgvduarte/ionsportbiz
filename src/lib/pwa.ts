// Instalar a app no telemóvel (PWA) e o service worker (public/sw.js).
// - Android/Chrome: o browser oferece o evento beforeinstallprompt; guardamo-lo e o botão «Instalar» abre o instalador.
// - iPhone/iPad: não há forma de instalar por botão. Mostramos os passos («Partilhar» → «Adicionar ao ecrã principal»).
//   A app instalada no iOS tem dados à parte do Safari, por isso o atalho tem de abrir pelo link pessoal (ver prepareIosInstall).
// - Apps nativas (Capacitor) e app já instalada: nada a mostrar.
import { useSyncExternalStore } from 'react';
import { isNative } from '../native/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'other';

const CACHE = 'ion-v1';
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installPlatform(ua = navigator.userAgent, touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua) || touchMac) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** Chamar uma vez, o mais cedo possível (o Chrome pode oferecer a instalação antes de a app carregar). */
export function initPwa(): void {
  if (isNative) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    if (document.readyState === 'complete') void registerServiceWorker();
    else window.addEventListener('load', () => void registerServiceWorker(), { once: true });
  }
}

async function registerServiceWorker(): Promise<void> {
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    await navigator.serviceWorker.ready;
    // O que esta página carregou antes de o service worker a controlar também fica guardado,
    // para a app (e a credencial) abrir sem rede já na próxima vez. De novo mais tarde, para o que chegou entretanto.
    void cacheLoadedFiles();
    window.setTimeout(() => void cacheLoadedFiles(), 5000);
  } catch {
    // Sem service worker a app funciona na mesma; só não fica instalável no Chrome nem abre sem rede.
  }
}

async function cacheLoadedFiles(): Promise<void> {
  if (!('caches' in window)) return;
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType('resource')) {
    try {
      const u = new URL(entry.name);
      if (u.origin === location.origin && /\/(assets|images|icons)\//.test(u.pathname)) urls.add(u.href);
    } catch {
      // ignora
    }
  }
  const cache = await caches.open(CACHE);
  await Promise.allSettled([...urls].map(async (u) => { if (!(await cache.match(u, { ignoreVary: true }))) await cache.add(u); }));
}

/**
 * iPhone: a app instalada abre no endereço da página no momento em que se adiciona ao ecrã principal.
 * Põe esse endereço no link pessoal (sem recarregar) e retira o manifesto, cujo endereço de início não o tem:
 * assim a app instalada entra diretamente com o convite.
 */
export function prepareIosInstall(personalUrl: string | null): void {
  if (personalUrl) {
    try {
      history.replaceState(history.state, '', personalUrl);
    } catch {
      // outro domínio (ex.: desenvolvimento): fica o endereço atual
    }
  }
  document.querySelector('link[rel="manifest"]')?.remove();
}

export interface PwaInstall {
  platform: InstallPlatform;
  /** Já está a correr como app instalada (ou acabou de ser instalada). */
  standalone: boolean;
  /** O Chrome oferece o instalador nativo. */
  canPrompt: boolean;
  /** Há alguma forma de instalar a partir daqui (instalador ou passos). */
  available: boolean;
  /** Abre o instalador nativo; devolve se o convidado aceitou. */
  prompt: () => Promise<boolean>;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function usePwaInstall(): PwaInstall {
  useSyncExternalStore(subscribe, () => version);
  const platform = installPlatform();
  const standalone = installed || isStandalone();
  const canPrompt = !!deferred;
  return {
    platform,
    standalone,
    canPrompt,
    available: !isNative && !standalone && (canPrompt || platform === 'ios' || platform === 'android'),
    prompt: async () => {
      const ev = deferred;
      if (!ev) return false;
      deferred = null;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'accepted') installed = true;
      emit();
      return outcome === 'accepted';
    },
  };
}
