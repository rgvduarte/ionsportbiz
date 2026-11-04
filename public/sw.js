// Service worker da app ion.
// Serve para duas coisas: a app ficar instalável no Chrome (botão «Instalar app») e abrir sem rede
// com a última versão vista (a credencial com o QR fica guardada no dispositivo).
//
// - Páginas: rede primeiro; sem rede, a última cópia guardada. Online nunca se serve uma versão antiga.
// - Ficheiros com hash (assets/): cache primeiro (o nome muda a cada versão, por isso nunca ficam velhos).
// - Imagens e ícones: a cópia guardada já, e atualiza em segundo plano.
// - Supabase e outros domínios: não passam por aqui.
//
// Para desligar em caso de problema: publicar este ficheiro só com
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', () => self.registration.unregister());

const CACHE = 'ion-v1';
// Os ficheiros guardados servem qualquer pedido do mesmo endereço: alguns servidores respondem com «Vary: Origin»
// e os scripts da app são pedidos com Origin, o que faria falhar a correspondência sem rede.
const MATCH = { ignoreVary: true };

// A página de entrada e os ficheiros que ela carrega (assets/ referidos no index.html) ficam guardados logo,
// para a app abrir sem rede. Os restantes (ex.: o ecrã da app do evento) guardam-se quando são pedidos.
async function precacheShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch(self.registration.scope, { cache: 'no-cache' });
  if (!response.ok) return;
  await cache.put(self.registration.scope, response.clone());
  const html = await response.text();
  const urls = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
  await Promise.allSettled(urls.map((u) => cache.add(u)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('ion-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (err) {
    const saved = (await cache.match(key, MATCH)) ?? (await cache.match(self.registration.scope, MATCH));
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request, MATCH);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(event.request, MATCH);
  const update = fetch(event.request).then((response) => {
    if (response.ok) return cache.put(event.request, response.clone()).then(() => response);
    return response;
  });
  if (saved) {
    event.waitUntil(update.catch(() => undefined));
    return saved;
  }
  return update;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // A app usa o router com «#»: o que interessa é o caminho (sem pesquisa nem âncora).
    event.respondWith(networkFirst(request, url.origin + url.pathname));
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.includes('/images/') || url.pathname.includes('/icons/')) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
