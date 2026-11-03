// Gera as capturas de ecrã do manual: compila a app em modo demonstração, percorre os ecrãs
// definidos em shots.mjs e guarda as imagens e as caixas dos elementos assinalados com números.
// Uso: node scripts/manual/capture.mjs   (SKIP_BUILD=1 reaproveita a compilação anterior)
//      ONLY=id1,id2 captura só algumas imagens (as restantes ficam como estavam).
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { NOW, PUBLIC_URL, SHOTS, VIEWPORTS } from './shots.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BUILD = new URL('../../docs/manual/build/', import.meta.url);
const APP_DIR = 'docs/manual/build/app';
const OUT = fileURLToPath(new URL('shots/', BUILD));
const MANIFEST = new URL('shots.json', BUILD);

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      const p = `${base}/${d}/chrome-linux/chrome`;
      if (existsSync(p)) return p;
    }
  }
  return undefined; // playwright-core procura o Chromium instalado por omissão
}

await mkdir(OUT, { recursive: true });

// App em modo demonstração (dados fictícios no browser), com os links pessoais no domínio público.
if (!process.env.SKIP_BUILD) {
  process.env.VITE_DEMO = '1';
  process.env.VITE_PUBLIC_URL = PUBLIC_URL;
  delete process.env.VITE_ROUTER;
  await build({ root: ROOT, logLevel: 'warn', build: { outDir: APP_DIR, emptyOutDir: true } });
}

const server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir: APP_DIR }, preview: { port: 4319, strictPort: false } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

// Câmara simulada para o check-in: o Chromium lê as imagens de um ficheiro MJPEG em vez de uma câmara.
// A imagem é um telemóvel desfocado com uma credencial (o QR não chega a ser lido, como ao apontar a câmara).
const CAMERA = fileURLToPath(new URL('camera.mjpeg', BUILD));
{
  const b = await chromium.launch({ executablePath: findChrome() });
  const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto(base + '/entrar');
  const qr = renderToStaticMarkup(createElement(QRCodeSVG, { value: 'https://ionsportbiz.app', size: 132, level: 'H', marginSize: 1 }));
  await p.setContent(`<body style="margin:0;width:640px;height:480px;overflow:hidden;background:radial-gradient(circle at 25% 15%,#4a4f55,#1a1c1f 55%,#0c0d0e);display:grid;place-items:center">
    <div style="filter:blur(3.2px);transform:rotate(-7deg) translateY(10px)"><div style="width:200px;height:400px;border-radius:32px;background:#050505;border:7px solid #2b2b2b;padding:22px 16px;box-sizing:border-box;display:grid;justify-items:center;align-content:start;gap:12px;font-family:sans-serif">
    <img src="/images/logo-full.webp" style="width:84px"><span style="background:linear-gradient(90deg,#ccff00,#e27a2c 62%,#ea4d3b);color:#000;font-weight:800;font-size:11px;padding:4px 12px;border-radius:99px">VIP PASS</span>
    <div style="background:#fff;border-radius:12px;padding:6px">${qr}</div><span style="color:#fff;font-weight:800;font-size:15px">Carolina Oliveira Ferreira</span></div></div></body>`);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => null))));
  const frame = await p.screenshot({ type: 'jpeg', quality: 85 });
  await writeFile(CAMERA, Buffer.concat(Array(30).fill(frame)));
  await b.close();
}

const browser = await chromium.launch({
  executablePath: findChrome(),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${CAMERA}`],
});
const ctx = await browser.newContext({ viewport: VIEWPORTS.phone, deviceScaleFactor: 2, locale: 'pt-PT', timezoneId: 'Europe/Lisbon', permissions: ['camera'] });
await ctx.clock.setFixedTime(NOW);
// Avisos do modo demonstração e cursor de texto: ruído num manual (o manual explica que os dados são fictícios).
await ctx.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = '.demo-note,.adm-demo,.inv-send__demo{display:none!important} *{caret-color:transparent!important}' +
      // O Chromium sem ecrã não pinta o desfoque das barras; num telemóvel leem-se como preto.
      '.ev .topbar,.ev .tabbar{background:#000!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' +
      'html.no-toast .ui-toasts,html.no-toast .ev .toast{display:none!important}' +
      '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}';
    document.head.appendChild(s);
  });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|camera|getUserMedia|NotFoundError|NotAllowedError|about:srcdoc/i.test(m.text()) && errors.push(m.text()));
// O WhatsApp abre-se noutra janela: não sai do manual.
ctx.on('page', (p) => { if (p !== page) void p.close(); });

const KEY = 'convites-demo-v5';
const x = {
  base,
  page,
  /** Abre um endereço da app e espera que fique estável. */
  async go(path, wait = 500) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(wait);
  },
  /** Lê a base de dados da demonstração (localStorage). */
  async db() {
    return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
  },
  /** Altera a base de dados da demonstração e recarrega a página (a app lê-a de novo). */
  async mutate(fn, arg = null) {
    await page.evaluate(({ k, src, arg }) => {
      const d = JSON.parse(localStorage.getItem(k));
      (0, eval)(`(${src})`)(d, arg);
      localStorage.setItem(k, JSON.stringify(d));
    }, { k: KEY, src: fn.toString(), arg });
  },
  /** Muda a pessoa da equipa com sessão iniciada (null: sem sessão). */
  async as(email) {
    await x.mutate((d, email) => { d.currentUserId = email ? d.staff.find((s) => s.email === email).user_id : null; }, email);
  },
  /** Convite de um contacto no evento principal. */
  async invitation(first, last) {
    const d = await x.db();
    const c = d.contacts.find((c) => c.first_name === first && c.last_name === last);
    if (!c) throw new Error(`contacto ${first} ${last} não existe`);
    return { contact: c, inv: d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id), db: d };
  },
  async clock(date) { await page.clock.setFixedTime(new Date(date)); },
  async scrollTo(selector, offset = 72) {
    await page.locator(selector).first().evaluate((el, off) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off), offset);
    await page.waitForTimeout(150);
  },
  async toasts(show) { await page.evaluate((show) => document.documentElement.classList.toggle('no-toast', !show), show); },
};

// Primeira visita: cria a base de dados da demonstração com uma sessão da equipa.
await page.goto(base + '/entrar', { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill('admin@demo.pt');
await page.getByLabel('Palavra-passe').fill('demonstracao');
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL(/\/admin/);

/** Caixa de um localizador, de vários (a união) ou de um objeto {x, y, width, height}. */
async function boxOf(target) {
  if (!target) return null;
  const list = [target].flat();
  const boxes = await Promise.all(list.map((t) => (typeof t.boundingBox === 'function' ? t.first().boundingBox() : t)));
  if (boxes.some((b) => !b)) return null;
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  return { x: x0, y: y0, width: Math.max(...boxes.map((b) => b.x + b.width)) - x0, height: Math.max(...boxes.map((b) => b.y + b.height)) - y0 };
}

const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const failures = [];
const manifest = only && existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};

for (const shot of SHOTS) {
  const view = shot.view ?? 'phone';
  const vp = { ...VIEWPORTS[view], ...(shot.viewport ?? {}) };
  await page.setViewportSize(vp);
  await x.toasts(!!shot.toasts);
  try {
    await shot.setup(page, x);
  } catch (e) {
    failures.push(`[${shot.id}] preparação: ${e.message.split('\n')[0]}`);
    console.error(failures.at(-1));
    continue;
  }
  await x.toasts(!!shot.toasts);
  await page.waitForTimeout(shot.wait ?? 250);
  if (only && !only.has(shot.id)) { if (shot.teardown) await shot.teardown(page, x); continue; }

  // Área da imagem: o ecrã inteiro ou um recorte (um diálogo, uma secção).
  let area = { x: 0, y: 0, width: vp.width, height: vp.height };
  if (shot.clip) {
    const c = typeof shot.clip === 'function' ? await boxOf(await shot.clip(page)) : shot.clip;
    if (!c) throw new Error(`[${shot.id}] recorte não encontrado`);
    const pad = shot.pad ?? 0;
    const x0 = Math.max(0, Math.floor(c.x - pad)), y0 = Math.max(0, Math.floor(c.y - pad));
    area = { x: x0, y: y0, width: Math.min(vp.width, Math.ceil(c.x + c.width + pad)) - x0, height: Math.min(vp.height, Math.ceil(c.y + c.height + pad)) - y0 };
    if (shot.maxHeight) area.height = Math.min(area.height, shot.maxHeight);
  }

  const targets = {};
  for (const [key, loc] of Object.entries(shot.targets ?? {})) {
    // Um alvo pode ser vários elementos: enquadra-se a união.
    const locs = [loc(page)].flat().map((l) => l.first());
    const boxes = await Promise.all(locs.map((l) => l.boundingBox({ timeout: 3000 }).catch(() => null)));
    if (boxes.some((b) => !b)) {
      failures.push(`[${shot.id}] alvo "${key}" não encontrado`);
      console.error(failures.at(-1));
      continue;
    }
    const x0 = Math.min(...boxes.map((b) => b.x)), y0b = Math.min(...boxes.map((b) => b.y));
    let box = { x: x0, y: y0b, width: Math.max(...boxes.map((b) => b.x + b.width)) - x0, height: Math.max(...boxes.map((b) => b.y + b.height)) - y0b };
    // App do evento: o que fica por baixo da barra de topo ou da barra de separadores só conta na parte visível.
    const inBar = await locs[0].evaluate((el) => !!el.closest('.ev .topbar, .ev .tabbar'));
    if (!inBar) {
      const [barTop, barBottom] = await page.evaluate(() => [
        document.querySelector('.ev .topbar')?.getBoundingClientRect().bottom ?? 0,
        document.querySelector('.ev .tabbar')?.getBoundingClientRect().top ?? innerHeight,
      ]);
      const y0 = Math.max(box.y, barTop), y1 = Math.min(box.y + box.height, barBottom);
      box = { ...box, y: y0, height: Math.max(0, y1 - y0) };
    }
    const rel = { x: box.x - area.x, y: box.y - area.y, w: box.width, h: box.height };
    if (rel.y + rel.h <= 0 || rel.y >= area.height || rel.x >= area.width || rel.h <= 0) console.warn(`[${shot.id}] alvo "${key}" fora da imagem`, rel);
    targets[key] = { x: (rel.x / area.width) * 100, y: (rel.y / area.height) * 100, w: (rel.w / area.width) * 100, h: (rel.h / area.height) * 100 };
  }

  // JPEG: o ecrã escuro não mostra artefactos a esta qualidade e o PDF fica leve.
  // Ecrãs de computador inteiros a 1 px por píxel CSS; telemóveis e recortes com o dobro da resolução.
  const scale = shot.scale ?? (view === 'desktop' && !shot.clip ? 'css' : 'device');
  const file = `${shot.id}.jpg`;
  await page.screenshot({ path: `${OUT}${file}`, type: 'jpeg', quality: shot.quality ?? 72, scale, clip: area });
  const url = shot.url ?? page.url().replace(base, PUBLIC_URL.replace('https://', ''));
  manifest[shot.id] = { file: `shots/${file}`, view, clip: !!shot.clip, frame: shot.frame ?? null, w: area.width, h: area.height, url, targets };
  if (shot.teardown) await shot.teardown(page, x).catch((e) => failures.push(`[${shot.id}] fim: ${e.message.split('\n')[0]}`));
  console.log('capturada', shot.id);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
await browser.close();
await server.close();
if (errors.length) console.error('Erros da app durante a captura:', [...new Set(errors)]);
if (failures.length) console.error(`${failures.length} problema(s):\n` + failures.join('\n'));
if (errors.length || failures.length) process.exit(1);
