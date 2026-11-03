// Capturas de ecrã da app em modo demonstração (para rever o aspeto sem abrir um browser).
// Uso: node scripts/shot.mjs <caminho> <saida.png> [--as=admin@demo.pt] [--width=1440] [--height=900] [--full] [--wait=600]
//      Vários pares caminho/saída: node scripts/shot.mjs /admin a.png /admin/contactos b.png
// Abre um servidor Vite próprio numa porta livre, por isso pode correr em paralelo.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v ?? true];
}));
const pairs = args.filter((a) => !a.startsWith('--'));
if (pairs.length < 2 || pairs.length % 2) {
  console.error('Uso: node scripts/shot.mjs <caminho> <saida.png> [<caminho> <saida.png> …] [--as=email] [--width=1440] [--full]');
  process.exit(1);
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      const p = `${base}/${d}/chrome-linux/chrome`;
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error', define: { 'import.meta.env.VITE_DEMO': '"1"' } });
await server.listen();
const { port } = server.httpServer.address();
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ executablePath: findChrome() });
const width = Number(opts.width ?? 1440);
const height = Number(opts.height ?? 900);
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, locale: 'pt-PT', timezoneId: 'Europe/Lisbon' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

try {
  if (opts.as) {
    await page.goto(`${origin}/entrar`);
    await page.getByLabel('Email').fill(String(opts.as));
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(/\/admin/);
  }
  for (let i = 0; i < pairs.length; i += 2) {
    await page.goto(`${origin}${pairs[i]}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(Number(opts.wait ?? 600));
    await page.screenshot({ path: pairs[i + 1], fullPage: !!opts.full });
    console.log(`ok ${pairs[i]} -> ${pairs[i + 1]}`);
  }
  if (errors.length) console.log('Erros na consola:\n' + errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
