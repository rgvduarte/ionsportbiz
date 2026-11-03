// Monta o manual em HTML (páginas A4) a partir de content.mjs e das capturas, e imprime-o em PDF com o Chromium.
// Uso: node scripts/manual/render.mjs   (depois de capture.mjs)
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { chromium } from 'playwright-core';
import {
  AREAS, CHAPTERS, CHECKIN_CASES, CREDENTIAL_STATES, EVENT_STATUS, FAQ, GLOSSARY, JOURNEY, META, PAGES, PARTS, PERMISSIONS,
  REFERENCE, ROLES, VARIABLES,
} from './content.mjs';

const root = new URL('../../', import.meta.url);
const build = new URL('docs/manual/build/', root);
const OUT_PDF = fileURLToPath(new URL('docs/manual/ion-manual.pdf', root));
const shots = JSON.parse(await readFile(new URL('shots.json', build), 'utf8'));

const asset = (p) => new URL(`public/${p}`, root).href;
/** Logótipo do back-office e dos emails (src/assets/brand), mais leve do que o da capa. */
const BRAND_LOGO = new URL('src/assets/brand/ion-logo.png', root).href;
const shotUrl = (id) => new URL(shots[id].file, build).href;
const icon = (name, size = 24, extra = {}) => {
  const C = Icons[name];
  if (!C) throw new Error(`ícone desconhecido: ${name}`);
  return renderToStaticMarkup(createElement(C, { size, strokeWidth: 2, ...extra }));
};
const qr = (value) => renderToStaticMarkup(createElement(QRCodeSVG, { value, level: 'M', marginSize: 0, bgColor: '#FFFFFF', fgColor: '#000000' }));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (s) =>
  esc(s)
    .replace(/\[\[(.+?)\]\]/g, (_, t) => `<span class="ui">${t.replace(/ /g, ' ').length < 26 ? t.replace(/ /g, ' ') : t}</span>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\{\{icon:(\w+)\}\}/g, (_, n) => `<span class="glyph">${icon(n)}</span>`);
const chapterOf = (n) => CHAPTERS.find((c) => c.n === n);
const partOf = (n) => PARTS.find((p) => p.n === n);
const keepIon = (html) => html.replace(/\bion\b/g, '<span class="nocase">ion</span>');

// Número de página (a capa é a 1) do início de cada capítulo, para o índice.
const firstPage = {};
PAGES.forEach((p, i) => { if (p.chapter && !(p.chapter in firstPage)) firstPage[p.chapter] = i + 1; });

// ───────── Cor: contraste WCAG 2.1 ─────────
function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const fmtRatio = (r) => `${r.toFixed(1).replace('.', ',')}:1`;

// ───────── Moldura das páginas ─────────
function shell(page, index, body) {
  const ch = page.chapter && chapterOf(page.chapter);
  const part = ch && partOf(ch.part);
  return `<section class="page">
    <header class="page-head">
      <img src="${new URL('logo-header.jpg', GNUM_DIR).href}" alt="ion" />
      <span class="chapter-label">${part ? `<span class="part">${esc(part.title)}</span>` : ''}${ch ? `<span><b>${ch.n}</b>${keepIon(esc(ch.title))}</span>` : ''}</span>
    </header>
    <div class="page-body">${page.opener && ch ? opener(ch) : ''}${body}</div>
    <footer class="page-foot"><span>${keepIon(esc(META.short))} · ${esc(META.edition)}</span><span class="num">${String(index + 1).padStart(2, '0')}</span></footer>
  </section>`;
}

// Números de capítulo com o gradiente da marca. São imagens: o Chromium não imprime em PDF texto com
// preenchimento em gradiente sem desenhar a caixa inteira (ou um filete à volta), por isso rasterizam-se antes.
const GNUM_DIR = new URL('gnum/', build);
const gnum = (t, on = 'page') => `<img class="gnum" src="${new URL(`${t}-${on}.jpg`, GNUM_DIR).href}" alt="${t}" />`;
// Imagens repetidas em todas as páginas: o Chromium inclui uma cópia por página, por isso ficam em JPEG pequeno
// sobre o fundo onde aparecem (preto nas páginas, #0e0e0e nos cartões do índice).
async function renderNumbers(browser) {
  await mkdir(GNUM_DIR, { recursive: true });
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  // Página em ficheiro (e não setContent): só assim o Chromium carrega as fontes e imagens locais (file://).
  const helper = new URL('gnum.html', build);
  await writeFile(helper, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${new URL('node_modules/@fontsource-variable/inter-tight/index.css', root).href}">
    <style>body{margin:0} #box{display:inline-block;padding:0} span{display:inline-block;font:800 120px/0.8 'Inter Tight Variable';letter-spacing:-0.05em;padding:0 0.06em 0 0;
    background:linear-gradient(90deg,#ccff00 0%,#e27a2c 62%,#ea4d3b 100%);-webkit-background-clip:text;background-clip:text;color:transparent}</style>
    <div id="box"><span id="n">01</span></div><img id="logo" src="${new URL('assets/logo-header.png', import.meta.url).href}" style="display:block;width:110px;height:auto;background:#000">`);
  await page.goto(helper.href, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; await document.getElementById('logo').decode(); });
  if (!(await page.evaluate(() => document.fonts.check("800 120px 'Inter Tight Variable'")))) throw new Error('Inter Tight não carregou');
  for (const c of CHAPTERS) {
    for (const [on, bg] of [['page', '#000000'], ['toc', '#0e0e0e']]) {
      await page.evaluate(([t, bg]) => { document.getElementById('n').textContent = t; document.getElementById('box').style.background = bg; document.body.style.background = bg; return document.fonts.ready; }, [c.n, bg]);
      await page.locator('#box').screenshot({ path: fileURLToPath(new URL(`${c.n}-${on}.jpg`, GNUM_DIR)), type: 'jpeg', quality: 90 });
    }
  }
  await page.locator('#logo').screenshot({ path: fileURLToPath(new URL('logo-header.jpg', GNUM_DIR)), type: 'jpeg', quality: 90 });
  await page.close();
}
function opener(ch) {
  const part = partOf(ch.part);
  const firstOfPart = CHAPTERS.find((c) => c.part === ch.part) === ch;
  return `<div class="opener">${gnum(ch.n)}<div>${firstOfPart ? `<span class="part-kicker">Parte ${part.n} · ${esc(part.title)}</span>` : ''}<h1>${keepIon(esc(ch.title))}</h1></div></div>`;
}

// ───────── Figuras com marcadores numerados ─────────
function marksHtml(s, spec) {
  return Object.entries(spec.marks ?? {})
    .map(([n, t]) => {
      const [key, pos] = Array.isArray(t) ? t : [t, 'tl'];
      const b = s.targets[key];
      if (!b) throw new Error(`a captura ${spec.shot} não tem o alvo ${key}`);
      const clamp = (v) => Math.max(0, Math.min(100, v));
      const x = clamp(b.x), y = clamp(b.y), w = clamp(b.x + b.w) - x, h = clamp(b.y + b.h) - y;
      const below = pos === 'br' || ((pos === 'tl' || pos === 'tr') && y < 4);
      const bx = pos === 'tr' || pos === 'br' ? x + w : pos === 'above' ? x + w / 2 : x;
      const by = pos === 'l' ? y + h / 2 : pos === 'in' ? y : below ? y + h : y;
      const cls = pos === 'br' ? 'tr' : pos;
      return `<div class="hl" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></div>
        <span class="bubble ${cls}${below ? ' below' : ''}" style="left:${bx}%;top:${by}%">${n}</span>`;
    })
    .join('');
}

/** Moldura conforme a captura: telemóvel, janela de browser (ecrã inteiro do computador) ou painel (recorte). */
function frameOf(s) {
  if (s.view === 'phone') return 'phone';
  return s.clip ? 'panel' : 'browser';
}
const DEFAULT_W = { phone: 70, browser: 184, panel: 120 };

function fig(spec, layout) {
  const s = shots[spec.shot];
  if (!s) throw new Error(`captura desconhecida: ${spec.shot}`);
  const frame = spec.frame ?? s.frame ?? frameOf(s);
  const max = spec.w ?? (frame === 'phone' && layout === 'side' ? 84 : DEFAULT_W[frame]);
  const min = spec.min ?? Math.round(max * 0.7);
  const chrome = frame === 'browser'
    ? `<div class="chrome"><span class="dots"><i></i><i></i><i></i></span><span class="addr">${icon('Lock', 10)}${esc(s.url)}</span></div>`
    : '';
  return `<div class="fig ${frame}" data-max="${max}" data-min="${min}" style="width:${max}mm${spec.span ? ';grid-column:1 / -1' : ''}">${chrome}<div class="screen-wrap">
    <div class="screen" style="aspect-ratio:${s.w} / ${s.h}"><img src="${shotUrl(spec.shot)}" alt="" /></div>
    <div class="marks">${marksHtml(s, spec)}</div></div>${spec.caption ? `<div class="fig-caption">${md(spec.caption)}</div>` : ''}</div>`;
}

const stepItem = (n, t) => `<li><span class="bubble">${n}</span><span>${md(t)}</span></li>`;
const stepList = (steps, cls = '') => `<ol class="steps ${cls}">${steps.map((t, i) => stepItem(i + 1, t)).join('')}</ol>`;

const badge = (label, tone) => `<span class="badge ${tone}">${esc(label)}</span>`;

const legends = {
  credential: () => `<h3 class="section-title legend-title" style="font-size:12pt">Do convite à credencial</h3>
    <table class="legend-table"><thead><tr><th>Estado</th><th>Quando</th><th>O que aparece</th></tr></thead><tbody>${CREDENTIAL_STATES.map(
      (s) => `<tr><td>${badge(s.badge, s.tone)}</td><td>${md(s.when)}</td><td>${md(s.shows)}</td></tr>`,
    ).join('')}</tbody></table>`,
  'event-status': () => `<h3 class="section-title legend-title" style="font-size:12pt">Estado do evento</h3>
    <table class="legend-table"><tbody>${EVENT_STATUS.map((s) => `<tr><td>${badge(s.label, s.tone)}</td><td>${md(s.text)}</td></tr>`).join('')}</tbody></table>`,
  checkin: () => `<h3 class="section-title legend-title" style="font-size:12pt">O que o ecrã mostra à porta</h3>
    <table class="legend-table"><tbody>${CHECKIN_CASES.map((s) => `<tr><td>${badge(s.label, s.tone)}</td><td>${md(s.text)}</td></tr>`).join('')}</tbody></table>`,
};

const rolesHtml = () => `<div class="roles">${ROLES.map((r) => `<div class="role">${icon(r.icon)}<h3>${esc(r.role)}</h3><p>${md(r.text)}</p></div>`).join('')}</div>
  <table class="perm"><thead><tr><th>Permissão</th>${ROLES.map((r) => `<th>${esc(r.role)}</th>`).join('')}</tr></thead><tbody>${PERMISSIONS.map(
    ([label, who]) => `<tr><td>${esc(label)}</td>${ROLES.map((r) => (who.includes(r.role) ? `<td class="y">${icon('Check', 14)}</td>` : '<td class="n">—</td>')).join('')}</tr>`,
  ).join('')}</tbody></table>`;

const varsHtml = () => `<h3 class="section-title legend-title" style="font-size:12pt">Variáveis</h3>
  <div class="vars">${VARIABLES.map(([k, v]) => `<div><code>{{${k}}}</code><span>${esc(v)}</span></div>`).join('')}</div>`;

const extras = (p) =>
  [
    p.legend && legends[p.legend](),
    p.roles && rolesHtml(),
    p.variables && varsHtml(),
    p.box && `<div class="box"><h3>${esc(p.box.title)}</h3><ul>${p.box.items.map((i) => `<li>${md(i)}</li>`).join('')}</ul></div>`,
    p.tip && `<div class="tip"><span class="kicker">Dica</span>${md(p.tip)}</div>`,
    p.note && `<div class="note"><span class="kicker">Nota</span>${md(p.note)}</div>`,
  ]
    .filter(Boolean)
    .join('');

function stepsPage(p) {
  const head = `<h2 class="section-title">${keepIon(esc(p.title))}</h2>${p.intro ? `<p class="intro">${md(p.intro)}</p>` : ''}`;
  const layout = p.layout ?? (p.figs.length === 1 ? 'side' : 'row');
  if (layout === 'side') {
    return p.wideExtras
      ? `${head}<div class="layout-side">${fig(p.figs[0], 'side')}<div>${stepList(p.steps)}</div></div>${extras(p)}`
      : `${head}<div class="layout-side">${fig(p.figs[0], 'side')}<div>${stepList(p.steps)}${extras(p)}</div></div>`;
  }
  if (layout === 'stack-side') {
    // Uma figura larga em cima; por baixo, a segunda figura com os passos ao lado.
    return `${head}<div class="layout-stack">${fig(p.figs[0], 'stack')}</div><div class="layout-side">${fig(p.figs[1], 'side')}<div>${stepList(p.steps)}</div></div>${extras(p)}`;
  }
  if (layout === 'stack') {
    const figs = p.grid
      ? `<div class="layout-grid">${p.figs.map((f) => fig(f, 'stack')).join('')}</div>`
      : `<div class="layout-stack">${p.figs.map((f) => fig(f, 'stack')).join('')}</div>`;
    return `${head}${figs}${stepList(p.steps, p.steps.length > 3 ? 'two' : '')}${extras(p)}`;
  }
  // Em linha: cada coluna de passos fica por baixo da figura a que pertence.
  const n = p.figs.length;
  const perFig = p.figs.map((f) => Object.keys(f.marks ?? {}).map(Number).sort((a, b) => a - b));
  const listed = new Set(perFig.flat());
  p.steps.forEach((_, i) => { if (!listed.has(i + 1)) perFig[0].push(i + 1); });
  perFig[0].sort((a, b) => a - b);
  const cols = perFig.map((ks) => `<ol class="steps">${ks.map((k) => stepItem(k, p.steps[k - 1])).join('')}</ol>`).join('');
  return `${head}<div class="layout-row n${n}">${p.figs.map((f) => fig({ w: n === 3 ? 56 : 80, min: 44, ...f }, 'row')).join('')}</div>
    <div class="step-cols n${n}">${cols}</div>${extras(p)}`;
}

// ───────── Páginas especiais ─────────
const COLORS = {
  brand: [
    { name: 'Preto', hex: '#000000', token: '--c-bg', use: 'Fundo de todas as superfícies.', fg: '#ccff00' },
    { name: 'Verde-lima', hex: '#CCFF00', token: '--brand-lime · --c-accent', use: 'Ação principal, destaque, foco.', fg: '#000000' },
    { name: 'Laranja', hex: '#FF5300', token: '--brand-orange · --c-gold', use: 'Filetes, contornos e ícones.', fg: '#000000' },
  ],
  greys: [
    ['#000000', 'Fundo', '--c-bg'], ['#0E0E0E', 'Superfície', '--c-surface'], ['#141414', 'Superfície 2', '--c-surface-2'], ['#1D1D1D', 'Superfície 3', '--c-surface-3'],
    ['#262626', 'Linha', '--c-border'], ['#3A3A3A', 'Linha forte', '--c-border-strong'], ['#6B6B6B', 'Placeholder', '--c-placeholder'], ['#8E8E8E', 'Texto 3', '--c-text-3'],
    ['#C2C2C2', 'Texto 2', '--c-text-2'], ['#F4F4F4', 'Texto', '--c-text'],
  ],
  status: [
    ['#4ADE80', 'Sucesso', '--c-success', 'Confirmado · Aprovado · Entrada registada'],
    ['#FBBF24', 'Aviso', '--c-warning', 'Por aprovar · Fechado · prazos'],
    ['#FF6B5B', 'Erro', '--c-danger', 'Recusado · Não aprovado · eliminar'],
    ['#7AA7FF', 'Informação', '--c-info', 'Enviado · avisos informativos'],
  ],
};

const pages = {
  cover: () => `<section class="page cover">
    <span class="band"></span>
    <span class="edition">${esc(META.edition)}<br/>ionsportbiz.app</span>
    <img class="map" src="${asset('images/world-map.webp')}" alt="" />
    <img class="logo" src="${asset('images/logo-full.webp')}" alt="ion — International Business & Sports Conference" />
    <img class="edition-mark" src="${asset('images/pt-27.webp')}" alt="PT ’27" />
    <div class="text"><span class="kicker">Convidados · Equipa ion · Design system</span><h1>Manual da<br/>plataforma <span class="nocase">ion</span></h1><p>Convite pessoal, app do evento, back-office e design system — passo a passo.</p></div>
    <div class="qr"><div class="code">${qr(META.appUrl)}</div><span>ionsportbiz.app</span></div>
    <img class="markets" src="${asset('images/markets-strip.webp')}" alt="PT · UAE · WW · HK" />
  </section>`,

  toc: (p, i) =>
    shell(p, i, `<div class="opener"><h1>Índice</h1></div>
      <nav class="toc">${PARTS.map(
        (pt) => `<div class="toc-part"><span class="partno">${pt.n < 4 ? `Parte ${pt.n}` : 'Anexos'}</span><h2>${keepIon(esc(pt.title))}</h2><p class="lead">${keepIon(esc(pt.lead))}</p>${CHAPTERS.filter((c) => c.part === pt.n)
          .map((c) => `<a>${gnum(c.n, 'toc')}<span>${keepIon(esc(c.title))}</span><span class="p">${firstPage[c.n]}</span></a>`)
          .join('')}</div>`,
      ).join('')}</nav>`),

  overview: (p, i) =>
    shell(p, i, `<p class="about-ion">A ion é uma plataforma internacional de negócios onde o desporto é o ponto de partida para conversas que geram parcerias, influência, investimento e crescimento.</p>
      <p class="intro">Este manual descreve a plataforma digital da ion para o PT ’27 (22 e 23 de março de 2027), em <strong>ionsportbiz.app</strong>. A plataforma tem três partes, ligadas entre si: o convite pessoal de cada convidado, a app do evento e o back-office onde a equipa ion gere tudo.</p>
      <div class="areas">${AREAS.map((a) => `<div class="area">${icon(a.icon)}<span class="who">${esc(a.who)}</span><h3>${esc(a.title)}</h3><span class="where">${esc(a.where)}</span><p>${md(a.text)}</p></div>`).join('')}</div>
      <h2 class="section-title">Como ler este manual</h2>
      <div class="howto">
        <div><div class="row"><span class="bubble">1</span><strong>Marcadores numerados</strong></div><p>Cada número sobre um ecrã corresponde ao passo com o mesmo número na lista ao lado ou por baixo.</p></div>
        <div><div class="row"><span class="ui">Texto verde-lima</span></div><p>Texto que aparece no ecrã: o nome de um botão, separador ou opção, tal como surge na plataforma.</p></div>
        <div><div class="row"><strong>Três partes</strong></div><p><strong>Parte 1</strong> para os convidados, <strong>Parte 2</strong> para a equipa ion e <strong>Parte 3</strong> com o design system.</p></div>
      </div>
      <div class="note"><span class="kicker">Nota</span>As imagens foram feitas no modo de demonstração da plataforma, com dados fictícios: as pessoas, entidades, contactos e o programa são exemplos. O aviso «Modo demonstração», que só existe nesse modo, foi retirado das imagens.</div>`),

  journey: (p, i) =>
    shell(p, i, `<h2 class="section-title">O percurso do convidado</h2>
      <p class="intro">Do convite à porta, seis passos. A presença só dá acesso ao evento depois de a equipa ion a <strong>aprovar e escolher o tipo de acesso</strong>: é nesse momento que o convidado recebe o código QR e a lista do que o seu acesso inclui.</p>
      <div class="journey">${JOURNEY.map((s, k) => `<div class="jstep${s.who === 'Convidado' ? '' : ' team'}${k === 3 ? ' key' : ''}"><span class="ic">${icon(s.icon)}</span><div><span class="who">${k + 1} · ${esc(s.who)}</span><h3>${esc(s.title)}</h3><p>${md(s.text)}</p></div><span class="st">${badge(s.state, ['info', 'success', 'warning', 'success', 'lime', 'accent'][k])}</span></div>`).join('')}</div>
      <div class="key-note">
        <div class="a"><h3>O convidado nunca escolhe o acesso</h3><p>O tipo de acesso (por exemplo, <strong>VIP Pass</strong> ou <strong>Conference Pass</strong>) é sempre atribuído pela equipa ion. O convidado vê apenas o que lhe foi atribuído.</p></div>
        <div class="b"><h3>Sem contas nem palavras-passe</h3><p>O link pessoal do convite é a chave de tudo: abre o convite, a credencial e a app do evento. Por isso é pessoal e não deve ser partilhado.</p></div>
      </div>`),

  steps: (p, i) => shell(p, i, stepsPage(p)),
  states: (p, i) => shell(p, i, stepsPage(p)),

  faq: (p, i) =>
    shell(p, i, `<div class="faq">${FAQ[p.items].map(
      (t) => `<div class="qa">${icon('CircleHelp')}<div><h3>${esc(t.q)}</h3><p>${md(t.a)}</p></div></div>`,
    ).join('')}</div>${p.items === 'guest'
      ? `<div class="tip"><span class="kicker">Proteção de dados</span>No fim do convite, a secção [[Proteção de dados]] indica quem trata os seus dados e permite [[Pedir a eliminação dos meus dados]]. A organização trata o pedido no prazo de um mês.</div>`.replace(/\[\[(.+?)\]\]/g, '<span class="ui">$1</span>')
      : ''}`),

  'approval-flow': (p, i) => {
    // Diagrama em SVG: três faixas (equipa, convidado, receção), os passos numerados e as ligações entre eles.
    const W = 1000, LANE = 122, LABEL = 118, NW = 134, NH = 84;
    const col = (c) => LABEL + 22 + c * 142;
    const lanes = [['EQUIPA ION', '#160d05', '#e27a2c'], ['CONVIDADO', '#0b0f00', '#ccff00'], ['RECEÇÃO', '#0d0d14', '#7aa7ff']];
    const nodes = {
      1: { lane: 0, c: 0, t: ['Envia o convite'], s: ['Email ou WhatsApp,', 'com o link pessoal'] },
      2: { lane: 1, c: 1, t: ['Abre o convite', 'e confirma'], s: ['Acompanhantes,', 'informações'] },
      3: { lane: 1, c: 2, t: ['Fica por aprovar'], s: ['Ainda sem código QR'] },
      4: { lane: 0, c: 3, t: ['Aprova e escolhe', 'o tipo de acesso'], s: ['Aprovar… ou', 'Não aprovar…'], key: true },
      5: { lane: 0, c: 4, t: ['Avisa o convidado'], s: ['Email ou WhatsApp', '(opcional)'], dashed: true },
      6: { lane: 1, c: 4, t: ['Recebe o QR', 'e os acessos'], s: ['No convite e na app'], lime: true },
      7: { lane: 2, c: 5, t: ['Check-in à porta'], s: ['Lê o QR e vê o', 'tipo de acesso'] },
    };
    const box = (n) => { const d = nodes[n]; const x = col(d.c), y = d.lane * LANE + (LANE - NH) / 2; return { x, y, r: x + NW, b: y + NH, cx: x + NW / 2, cy: y + NH / 2 }; };
    const node = (n) => {
      const d = nodes[n], b = box(n);
      const fill = d.lime ? '#ccff00' : '#141414', stroke = d.key ? '#ccff00' : d.lime ? '#ccff00' : '#2f2f2f';
      const tc = d.lime ? '#000' : '#f4f4f4', sc = d.lime ? '#2a3a00' : d.key ? '#ccff00' : '#8e8e8e';
      const lines = d.t.map((t, k) => `<text x="${b.x + 12}" y="${b.y + 27 + k * 16}" font-size="14" font-weight="800" fill="${tc}" letter-spacing="-0.2">${esc(t)}</text>`).join('')
        + d.s.map((t, k) => `<text x="${b.x + 12}" y="${b.y + 30 + d.t.length * 16 + k * 13}" font-size="11" font-weight="500" fill="${sc}">${esc(t)}</text>`).join('');
      return `<rect x="${b.x}" y="${b.y}" width="${NW}" height="${NH}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${d.key ? 2 : 1.2}"${d.dashed ? ' stroke-dasharray="5 4"' : ''}/>${lines}
        <circle cx="${b.x + 2}" cy="${b.y + 2}" r="11" fill="#ccff00" stroke="#000" stroke-width="2.5"/><text x="${b.x + 2}" y="${b.y + 6.5}" font-size="12" font-weight="800" fill="#000" text-anchor="middle">${n}</text>`;
    };
    const arrow = (d, dashed) => `<path d="${d}" fill="none" stroke="#6a6a6a" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#arr)"/>`;
    const [b1, b2, b3, b4, b5, b6, b7] = [1, 2, 3, 4, 5, 6, 7].map(box);
    const H = LANE * 3;
    const svg = `<svg class="flow" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter Tight Variable, sans-serif">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8a8a8a"/></marker></defs>
      ${lanes.map(([label, bg, color], k) => `<rect x="0" y="${k * LANE}" width="${W}" height="${LANE}" fill="${k % 2 ? '#090909' : '#050505'}"/><rect x="0" y="${k * LANE}" width="${LABEL}" height="${LANE}" fill="${bg}"/>
        <text x="${LABEL / 2}" y="${k * LANE + LANE / 2 + 4}" font-size="11" font-weight="800" letter-spacing="1.4" fill="${color}" text-anchor="middle">${label}</text>`).join('')}
      <line x1="0" y1="${LANE}" x2="${W}" y2="${LANE}" stroke="#232323"/><line x1="0" y1="${2 * LANE}" x2="${W}" y2="${2 * LANE}" stroke="#232323"/>
      ${arrow(`M${b1.r} ${b1.cy} H${b2.cx} V${b2.y - 2}`)}
      ${arrow(`M${b2.r} ${b2.cy} H${b3.x - 2}`)}
      ${arrow(`M${b3.r} ${b3.cy} H${b4.cx} V${b4.b + 2}`)}
      ${arrow(`M${b4.r} ${b4.cy} H${b5.x - 2}`, true)}
      ${arrow(`M${b4.cx + 30} ${b4.b} V${b6.cy} H${b6.x - 2}`)}
      ${arrow(`M${b6.r} ${b6.cy} H${b7.cx} V${b7.y - 2}`)}
      ${[1, 2, 3, 4, 5, 6, 7].map(node).join('')}
    </svg>`;
    return shell(p, i, `<h2 class="section-title">O fluxo de aprovação</h2>
      <p class="intro">Nos eventos <strong>com aprovação</strong> (a definição recomendada para a ion), confirmar a presença não basta: a equipa decide quem entra e com que acesso. Só depois de aprovado o convidado recebe o código QR e a lista de acessos.</p>
      <div class="flow-wrap">${svg}</div>
      <table class="matrix"><thead><tr><th>Estado do convite</th><th>Aprovação</th><th>O convidado vê</th><th>À porta</th></tr></thead><tbody>
        <tr><td>${badge('Enviado', 'info')} ${badge('Visto', 'accent')}</td><td>—</td><td>O convite e os botões para responder.</td><td class="no">Aviso: presença não confirmada.</td></tr>
        <tr><td>${badge('Enviado', 'info')} ${badge('Visto', 'accent')}</td><td>${badge('Pré-aprovado', 'accent')}</td><td>«O seu acesso … já está reservado». Recebe o QR ao confirmar.</td><td class="no">Aviso: presença não confirmada.</td></tr>
        <tr><td>${badge('Confirmado', 'success')}</td><td>${badge('Por aprovar', 'warning')}</td><td>«A aguardar aprovação». Sem QR.</td><td class="no">Aviso amarelo: só com indicação.</td></tr>
        <tr><td>${badge('Confirmado', 'success')}</td><td>${badge('Aprovado', 'success')}</td><td>O código QR, o tipo de acesso e o que inclui.</td><td class="yes">Registar entrada.</td></tr>
        <tr><td>${badge('Confirmado', 'success')}</td><td>${badge('Não aprovado', 'danger')}</td><td>Mensagem de que não foi possível confirmar o lugar.</td><td class="no">Aviso vermelho.</td></tr>
        <tr><td>${badge('Recusado', 'danger')} ${badge('Cancelado', 'neutral')}</td><td>—</td><td>A resposta registada (ou o convite indisponível).</td><td class="no">Aviso vermelho.</td></tr>
      </tbody></table>
      <div class="note"><span class="kicker">Importante</span>A aprovação <strong>não envia mensagens automáticas</strong>. O convidado vê a credencial logo que abre o convite ou a app; para o avisar, envie um email ou WhatsApp com um modelo de <span class="ui">Mensagens</span>.</div>`);
  },

  'ds-brand': (p, i) =>
    shell(p, i, `<p class="intro">A marca ion junta o preto, o verde-lima e o gradiente do logótipo. O nome escreve-se sempre em minúsculas (<strong>ion</strong>), mesmo no início de uma frase. Os ficheiros estão em <code>public/images</code>, <code>public/icons</code> e <code>src/assets/brand</code>.</p>
      <div class="ds-grid four">
        <div class="ds-card"><span class="kicker">Logótipo principal</span><div class="logo-stage" style="min-height:30mm"><img src="${BRAND_LOGO}" alt="" style="max-height:20mm" /></div><p>Com o descritor <em>International Business &amp; Sports Conference</em> e a edição (PT). Na app, no back-office e nos emails. Ficheiros: <code>public/images/logo-full.webp</code>, <code>src/assets/brand/ion-logo.png</code>.</p></div>
        <div class="ds-card"><span class="kicker">Balão</span><div class="logo-stage" style="min-height:30mm"><img src="${asset('images/logo-bubble.webp')}" alt="" style="max-height:24mm" /></div><p>O balão de conversa (círculo com uma ponta em baixo, à direita) é a forma-assinatura: ecrã de entrada, avatares, botão da credencial, marcadores deste manual. <code>logo-bubble.webp</code>.</p></div>
        <div class="ds-card"><span class="kicker">Ícone da app</span><div class="logo-stage" style="min-height:30mm"><img src="${asset('icons/icon-512.png')}" alt="" style="max-height:20mm;border-radius:4.4mm" /></div><p>Ícone do ecrã principal e das apps iOS e Android. <code>public/icons/</code>.</p></div>
        <div class="ds-card"><span class="kicker">Descritor e edição</span><div class="logo-stage" style="min-height:30mm;gap:2.4mm"><img src="${asset('images/wordmark.webp')}" alt="" style="max-height:10mm" /><img src="${asset('images/pt-27.webp')}" alt="" style="max-height:6mm" /></div><p>O descritor isolado e as marcas de edição (<em>PT ’27</em>, <em>march ’27</em>, dias 22 e 23) usam o mesmo gradiente.</p></div>
      </div>
      <h3 class="section-title legend-title" style="font-size:12pt">Regras de utilização <span style="color:#8e8e8e;font-weight:600;font-size:9pt;letter-spacing:0">(recomendações para a plataforma)</span></h3>
      <div class="cols2"><ul class="rules">
        <li><strong>Fundo preto</strong> sempre que possível. Sobre fundos claros, garanta contraste e nunca use a versão com o descritor em verde-lima sobre branco.</li>
        <li><strong>Área de proteção:</strong> deixar à volta do logótipo um espaço livre, pelo menos igual à altura do «i».</li>
        <li><strong>Tamanho mínimo:</strong> cerca de 32 px de altura no ecrã (a barra da app usa 34 px) e 12 mm impresso, para o descritor continuar legível.</li>
      </ul><ul class="rules">
        <li><strong>Parceria institucional:</strong> com a Liga Portugal, usar o conjunto aprovado (<code>logo-liga-portugal.webp</code>), sem recompor.</li>
        <li>Usar sempre os ficheiros originais: nada de recriar o logótipo com texto.</li>
        <li>A app usa também a variante com o gradiente lima → âmbar → vermelho (<code>event.css</code>).</li>
      </ul></div>
      <h3 class="section-title legend-title" style="font-size:12pt">Não fazer</h3>
      <div class="dont">${[
        ['filter:hue-rotate(160deg)', 'Mudar as cores ou o gradiente'],
        ['transform:scaleX(1.45)', 'Deformar ou esticar'],
        ['transform:rotate(-12deg)', 'Rodar ou inclinar'],
        ['opacity:.35', 'Usar sem contraste suficiente'],
      ].map(([css, t]) => `<div><div class="logo-stage${t.startsWith('Usar') ? ' light' : ''}"><span class="x">${icon('X', 12)}</span><img src="${BRAND_LOGO}" alt="" style="${css}" /></div><span>${t}</span></div>`).join('')}</div>`),

  'ds-color': (p, i) => {
    const sw = (c) => `<div class="swatch"><div class="chip" style="background:${c.hex};color:${c.fg}">${c.hex}</div><div class="meta"><b>${esc(c.name)}</b><code>${esc(c.token)}</code><span>${esc(c.use)}</span></div></div>`;
    return shell(p, i, `<p class="intro">As cores vêm de <code>src/styles/tokens.css</code> (back-office e convite) e de <code>src/event/event.css</code> (app do evento). O ecrã é preto; o verde-lima é a cor de ação e o laranja acompanha o gradiente.</p>
      <div class="swatches">${COLORS.brand.map(sw).join('')}</div>
      <h3 class="section-title legend-title" style="font-size:12pt">Gradiente da marca</h3>
      <div class="gradbar" style="background:linear-gradient(90deg,#ccff00 0%,#e27a2c 62%,#ea4d3b 100%)"></div>
      <div class="gradstops"><span><code>#CCFF00</code> 0%</span><span><code>#E27A2C</code> 62%</span><span><code>#EA4D3B</code> 100%</span></div>
      <p style="font-size:8.4pt;margin-top:1.6mm">Token <code>--brand-gradient</code>. A app do evento usa a variante <code>#CCFF00 → #DAAC1B → #EB473D</code> (contagem decrescente, passe VIP, botão da credencial). Na diagonal (135°) em formas pequenas: avatares, ícones de estado.</p>
      <h3 class="section-title legend-title" style="font-size:12pt">Superfícies e texto</h3>
      <div class="ramp">${COLORS.greys.map(([hex, name, token]) => `<div><div class="c" style="background:${hex}"></div><div class="t"><b>${name}</b>${hex}<br/><span style="color:#6a6a6a">${token}</span></div></div>`).join('')}</div>
      <h3 class="section-title legend-title" style="font-size:12pt">Estados</h3>
      <div class="status-row">${COLORS.status.map(([hex, name, token, use]) => `<div style="background:${hex}1f;border:0.3mm solid ${hex}66"><b style="color:${hex}">${name}</b><code style="color:#cfcfcf">${hex} · ${token}</code><span>${esc(use)}</span></div>`).join('')}</div>
      <div class="ds-grid" style="margin-top:4mm">
        <div class="ds-card"><span class="kicker">Estados do convite e da aprovação</span><p style="display:flex;flex-wrap:wrap;gap:1.6mm">${badge('Por enviar', 'neutral')}${badge('Enviado', 'info')}${badge('Visto', 'accent')}${badge('Confirmado', 'success')}${badge('Recusado', 'danger')}${badge('Cancelado', 'neutral')}</p><p style="display:flex;flex-wrap:wrap;gap:1.6mm">${badge('Por aprovar', 'warning')}${badge('Aprovado', 'success')}${badge('Não aprovado', 'danger')}</p><p>Cada estado tem sempre texto: a cor nunca é a única pista.</p></div>
        <div class="ds-card"><span class="kicker">Tipos de acesso e palcos</span><p>Cada tipo de acesso tem uma cor, escolhida no back-office: <strong style="color:#ccff00">VIP Pass #CCFF00</strong>, <strong style="color:#e27a2c">Conference Pass #E27A2C</strong>. Os palcos da agenda seguem o gradiente: <span style="color:#ccff00">Main Stage</span>, <span style="color:#e2e86a">Football</span>, <span style="color:#daac1b">Capital</span>, <span style="color:#e77a2e">Media</span>, <span style="color:#eb473d">Health</span>.</p><p>Texto sobre verde-lima: sempre preto. Laranja em texto pequeno: <code>#FF7A3D</code> (<code>--c-gold-text</code>).</p></div>
      </div>`);
  },

  'ds-type': (p, i) =>
    shell(p, i, `<p class="intro"><strong>Inter Tight</strong> é a letra da ion: compacta, com desenho geométrico e muitos pesos (fonte variável 100–900). Títulos com espaçamento apertado; texto corrido com entrelinha generosa.</p>
      <div class="weights">${[[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extrabold']].map(([w, n]) => `<div><div class="aa" style="font-weight:${w}">Aa</div><small>${w} · ${n}</small></div>`).join('')}</div>
      <div class="type-spec" style="margin-top:5mm">
        <div class="s"><div class="k"><b>Display</b>800 · 32–46 px · −0,03 em · entrelinha 1,02</div><div style="font-size:30pt;font-weight:800;letter-spacing:-0.035em;line-height:1;color:#ccff00">the best in sports unite with the best in business</div></div>
        <div class="s"><div class="k"><b>Título de ecrã</b>800 · 26–30 px · −0,03 em</div><div style="font-size:20pt;font-weight:800;letter-spacing:-0.03em;line-height:1.05;color:#f4f4f4">A aguardar aprovação da equipa ion</div></div>
        <div class="s"><div class="k"><b>Título de secção</b>600–800 · 17–20 px · −0,011 a −0,02 em</div><div style="font-size:14pt;font-weight:700;letter-spacing:-0.02em;color:#f4f4f4">Funil de respostas</div></div>
        <div class="s"><div class="k"><b>Texto</b>400 · 14–16 px · entrelinha 1,45–1,5</div><div style="font-size:11pt;line-height:1.45;color:#d4d4d4">Obrigado por confirmar. A ion é um evento apenas por convite: a equipa revê cada confirmação e atribui o tipo de acesso.</div></div>
        <div class="s"><div class="k"><b>Etiqueta (kicker)</b>700 · 12 px · maiúsculas · +0,08 a +0,1 em</div><div style="font-size:8.4pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8e8e8e">Contagem decrescente PT ’27</div></div>
        <div class="s"><div class="k"><b>Números</b>800 · algarismos tabulares</div><div style="font-size:22pt;font-weight:800;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:#ccff00">132 <span style="color:#f4f4f4">dias</span> · 26 / 650</div></div>
        <div class="s"><div class="k"><b>Código</b>monoespaçada · blocos de 5</div><div style="font-family:ui-monospace,Menlo,monospace;font-size:15pt;font-weight:700;letter-spacing:0.08em;color:#ccff00">MWJVA-VYTA6</div></div>
        <div class="s"><div class="k"><b>Convite (cartão)</b>Source Serif 4 · 500</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:17pt;color:#f4f4f4">ion Portugal 2027</div></div>
      </div>
      <div class="ds-grid" style="margin-top:4mm">
        <div class="ds-card"><span class="kicker">Escala do back-office</span><p><code>--text-xs</code> 12 · <code>--text-sm</code> 13 · <code>--text-base</code> 14 · <code>--text-md</code> 15 · <code>--text-lg</code> 17 · <code>--text-xl</code> 20 · <code>--text-2xl</code> 26 · <code>--text-3xl</code> 34 px.</p></div>
        <div class="ds-card"><span class="kicker">Regras</span><ul class="rules"><li>Títulos em minúsculas, como frase («Abrir o meu convite»), nunca Em Maiúsculas Todas.</li><li>Maiúsculas só nas etiquetas pequenas (kicker), com espaçamento largo.</li><li>O cartão do convite usa uma serifa (Source Serif 4) para lembrar um convite impresso; os emails usam Georgia.</li></ul></div>
      </div>`),

  'ds-components': (p, i) =>
    shell(p, i, `<p class="intro">Os componentes do back-office estão em <code>src/ui/</code> (classes <code>ui-</code>) e os do convite e da app em <code>src/guest/</code> (<code>gi-</code>) e <code>src/event/</code> (<code>.ev</code>). As imagens abaixo são os componentes reais, desenhados com o CSS da plataforma.</p>
      <div class="layout-stack">${fig({ shot: 'spec-admin', w: 184, min: 150, marks: { 1: ['buttons', 'tr'], 2: ['badges', 'tr'], 3: ['alerts', 'tr'], 4: ['fields', 'tr'], 5: ['card', 'tr'] } }, 'stack')}</div>
      ${stepList([
        '**Botões** ([[ui-btn]]): um só botão principal (verde-lima) por ecrã ou diálogo; secundário com contorno; fantasma para ações discretas; vermelho para ações destrutivas (com confirmação). Tamanhos sm, md e lg; ícone Lucide à esquerda.',
        '**Etiquetas** ([[ui-badge]]): estado do convite e da aprovação, sempre com ponto e texto. O tipo de acesso aparece com o ponto da sua cor.',
        '**Avisos** ([[ui-alert]]): informação, aviso, erro e sucesso, com ícone. Explicam o que acontece e o que fazer.',
        '**Campos** ([[ui-field]]): rótulo por cima, * nos obrigatórios, ajuda por baixo, erro em vermelho. O foco põe o contorno em verde-lima.',
        '**Cartões** ([[ui-card]]): cabeçalho com título e subtítulo, corpo e rodapé com ações à direita.',
      ], 'two')}`),

  'ds-components-app': (p, i) =>
    shell(p, i, `<h2 class="section-title">Componentes da app e do convite</h2>
      <p class="intro">Na app do evento, os cantos são mais redondos, os botões são «pílulas» de 48 px de altura e as formas pequenas seguem o balão da ion.</p>
      <div class="layout-stack">${fig({ shot: 'spec-app', w: 184, min: 150, marks: { 1: ['buttons', 'tr'], 2: ['chips', 'tr'], 3: ['session', 'tr'], 4: ['pass', 'tr'], 5: ['passConf', 'tr'], 6: ['avatars', 'tr'] } }, 'stack')}</div>
      ${stepList([
        '**Botões** em pílula: [[btn-primary]] (verde-lima, texto preto), [[btn-outline]] e [[btn-ghost]].',
        '**Filtros e estados**: chip ativo a branco; pílula [[Pendente]] e [[Ligado]]; etiquetas [[VIP]], [[Incluído]] e [[Não incluído]].',
        '**Cartão de sessão**: filete à esquerda com a cor do palco, horário, título, palco, etiquetas e estrela.',
        '**Credencial VIP**: contorno com o gradiente da marca e etiqueta do tipo de acesso em gradiente; QR em fundo branco.',
        '**Outros tipos de acesso**: contorno e etiqueta na cor do tipo (aqui, Conference Pass #E27A2C), com o texto em preto ou branco conforme o contraste.',
        '**Balão**: avatares, ícones de estado e o botão central da credencial têm a forma do balão da ion.',
      ], 'two')}`),

  'ds-icons': (p, i) => {
    const list = [
      ['House', 'Início'], ['CalendarDays', 'Agenda'], ['QrCode', 'Credencial'], ['Users', 'Networking'], ['Ellipsis', 'Mais'], ['Bell', 'Notícias'],
      ['Mail', 'Email'], ['MessageCircle', 'WhatsApp'], ['Send', 'Enviar'], ['BadgeCheck', 'Aprovar'], ['ShieldX', 'Não aprovar'], ['Hourglass', 'Por aprovar'],
      ['Ticket', 'Tipo de acesso'], ['ScanLine', 'Check-in'], ['UserCheck', 'Ligado · entrou'], ['UserPlus', 'Ligar · adicionar'], ['Star', 'A minha agenda'], ['CalendarPlus', 'Calendário'],
    ];
    return shell(p, i, `<p class="intro">Os ícones são da biblioteca <strong>Lucide</strong> (<code>lucide-react</code>): traço de 2 px, cantos arredondados, sem preenchimento. 16 px nos botões do back-office, 18–22 px na app, 22 px na barra de separadores.</p>
      <div class="icons">${list.map(([n, t]) => `<div>${icon(n)}<b>${t}</b><span>${n}</span></div>`).join('')}</div>
      <ul class="rules" style="margin-top:3.5mm"><li>Um ícone acompanha sempre um texto; sozinho, só com um nome acessível (<code>aria-label</code>).</li><li>Usar sempre o mesmo ícone para a mesma ação em toda a plataforma.</li></ul>
      <h3 class="section-title legend-title" style="font-size:14pt">Tom de voz e escrita</h3>
      <div class="cols2">
        <div class="ds-card"><span class="kicker">Para os convidados</span><p><strong>Formal e cordial.</strong> Trata-se o convidado por <strong>V. Exa.</strong> e pelo tratamento registado («Exma. Senhora», «Dr.»). Frases completas, sem jargão técnico.</p><p style="color:#ccff00;font-weight:700">«Muito obrigado. A sua presença está confirmada; será um gosto recebê-lo(a).»</p></div>
        <div class="ds-card"><span class="kicker">Para a equipa</span><p><strong>Neutro e direto.</strong> Verbos no imperativo, a ação primeiro, o resultado a seguir. Os botões dizem o que fazem: «Aprovar com VIP Pass», «Enviar 6 emails».</p><p style="color:#ccff00;font-weight:700">«Estes convidados só recebem o código QR depois de a equipa aprovar.»</p></div>
      </div>
      <div class="cols2" style="margin-top:3.5mm">
        <table class="dodont"><thead><tr><th>Português de Portugal</th><th>Evitar (PT-BR)</th></tr></thead><tbody>${[
          ['telemóvel', 'celular'], ['ecrã', 'tela'], ['ficheiro', 'arquivo'], ['palavra-passe', 'senha'], ['guardar', 'salvar'], ['descarregar', 'baixar'],
          ['contacto', 'contato'], ['equipa', 'time'], ['receção', 'recepção'], ['iniciar sessão · entrar', 'fazer login'], ['utilizador', 'usuário'],
        ].map(([a, b]) => `<tr><td class="ok">${a}</td><td class="ko">${b}</td></tr>`).join('')}</tbody></table>
        <ul class="rules"><li>Ortografia do Acordo Ortográfico de 1990 (ação, receção, ativo).</li><li>Datas por extenso, meses em minúsculas: «22 de março de 2027»; horas no formato 24 h: «19:00».</li><li>Ordinais com ponto: «1.ª vaga».</li><li>Códigos em blocos de cinco: «MWJVA-VYTA6».</li><li>Rótulos citados em texto entre aspas angulares: «Por aprovar».</li><li>Mensagens de erro dizem o que aconteceu e o que fazer a seguir.</li><li>«ion» sempre em minúsculas.</li></ul>
      </div>`);
  },

  'ds-a11y': (p, i) => {
    const rows = [
      ['#000000', '#CCFF00', 'Texto preto sobre verde-lima', 'Botões principais'],
      ['#CCFF00', '#000000', 'Verde-lima sobre preto', 'Destaques, ligações'],
      ['#F4F4F4', '#0E0E0E', 'Texto sobre superfície', 'Texto principal'],
      ['#C2C2C2', '#0E0E0E', 'Texto 2 sobre superfície', 'Texto secundário'],
      ['#8E8E8E', '#0E0E0E', 'Texto 3 sobre superfície', 'Ajudas, metadados'],
      ['#FF7A3D', '#000000', 'Laranja (texto) sobre preto', 'Texto pequeno laranja'],
      ['#FF5300', '#000000', 'Laranja da marca sobre preto', 'Só filetes e ícones'],
      ['#FFFFFF', '#CCFF00', 'Branco sobre verde-lima', 'Não usar'],
    ];
    const verdict = (r) => (r >= 4.5 ? '<span class="pass-tag ok">AA</span>' : r >= 3 ? '<span class="pass-tag big">AA texto grande</span>' : '<span class="pass-tag ko">Falha</span>');
    return shell(p, i, `<p class="intro">A plataforma segue as WCAG 2.1, nível AA. Estas regras aplicam-se a tudo o que se acrescenta: ecrãs, emails, modelos de mensagem e materiais impressos.</p>
      <h3 class="section-title" style="font-size:12pt">Contraste</h3>
      <table class="contrast"><tbody>${rows.map(([fg, bg, label, use]) => {
        const r = contrast(fg, bg);
        return `<tr><td><span class="sample" style="color:${fg};background:${bg};border:0.3mm solid #333">Aa ion</span></td><td><strong>${esc(label)}</strong><br/><span style="color:#8e8e8e">${esc(use)} · ${fg} / ${bg}</span></td><td><span class="ratio">${fmtRatio(r)}</span>${verdict(r)}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="cols2" style="margin-top:4mm">
        <div class="ds-card"><span class="kicker">Foco do teclado</span><div class="focus-demo"><span class="fbtn">Entrar</span><span class="ffield">admin@…</span></div><p>Anel verde-lima de 2 px, separado do elemento por 2 px de preto (<code>--focus-ring</code>); nos campos, contorno verde-lima com halo (<code>--focus-ring-field</code>). Nunca retirar o foco visível.</p></div>
        <div class="ds-card"><span class="kicker">Boas práticas</span><ul class="rules"><li>Áreas de toque de pelo menos 44 px (na app, botões de 48 px).</li><li>Os estados têm texto e ícone, não só cor.</li><li>Avisos e contadores anunciados aos leitores de ecrã (<code>aria-live</code>).</li><li>Animações desligadas com «reduzir movimento».</li><li>Idioma da página definido (PT/EN) e texto alternativo nas imagens.</li></ul></div>
      </div>
      <div class="note"><span class="kicker">Emails</span>O botão [[Abrir o convite]] dos emails usa a cor de destaque do evento com texto branco. Com o verde-lima o contraste não chega a 1,2:1: escolha, nas definições do evento, uma cor de destaque escura o suficiente para texto branco (contraste de pelo menos 4,5:1), ou peça à equipa técnica que use texto preto nos botões claros.</div>`.replace(/\[\[(.+?)\]\]/g, '<span class="ui">$1</span>'));
  },

  glossary: (p, i) =>
    shell(p, i, `<div class="gloss">
      <div><h2>Estados do convite</h2><dl>${GLOSSARY.invitation.map(([t, tone, d]) => `<div><dt>${badge(t, tone)}</dt><dd>${md(d)}</dd></div>`).join('')}</dl>
        <h2 style="margin-top:4mm">Estados de aprovação</h2><dl>${GLOSSARY.approval.map(([t, tone, d]) => `<div><dt>${badge(t, tone)}</dt><dd>${md(d)}</dd></div>`).join('')}</dl>
        <h2 style="margin-top:4mm">Estado do evento</h2><dl>${EVENT_STATUS.map((s) => `<div><dt>${badge(s.label, s.tone)}</dt><dd>${md(s.text)}</dd></div>`).join('')}</dl></div>
      <div><h2>Papéis da equipa</h2><dl>${ROLES.map((r) => `<div><dt class="term">${esc(r.role)}</dt><dd>${md(r.text)}</dd></div>`).join('')}</dl>
        <h2 style="margin-top:4mm">Termos</h2><dl>${GLOSSARY.terms.map(([t, d]) => `<div><dt class="term">${esc(t)}</dt><dd>${md(d)}</dd></div>`).join('')}</dl></div>
    </div>`),

  reference: (p, i) => {
    const path = (arr) => arr.map((x) => (x.startsWith('~') ? `<span>${esc(x.slice(1))}</span>` : `<span class="ui">${esc(x)}</span>`)).join('<span class="sep">›</span>');
    const rows = (list) => list.map(([want, ...paths]) => `<tr><td>${esc(want)}</td><td>${paths.map(path).join('<span class="or">ou</span>')}</td></tr>`).join('');
    return shell(p, i, `<h2 class="section-title">Quero… onde?</h2>
      <h3 class="ref-group">Convidados</h3><table class="ref"><tbody>${rows(REFERENCE.guest)}</tbody></table>
      <h3 class="ref-group">Equipa ion</h3><table class="ref"><tbody>${rows(REFERENCE.staff)}</tbody></table>`);
  },

  back: () => `<section class="page back">
    <img class="bubble-logo" src="${asset('images/logo-bubble.webp')}" alt="ion" />
    <h2>the best in sports unite with the best in business</h2>
    <p class="site">ionsportbiz.app</p>
    <img class="markets" src="${asset('images/markets-strip.webp')}" alt="PT · UAE · WW · HK" />
    <p class="small">ion — International Business &amp; Sports Conference · ${esc(META.title)} · ${esc(META.edition)}</p>
    <span class="band"></span>
  </section>`,
};

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

const browser = await chromium.launch({ executablePath: findChrome() });
await renderNumbers(browser);

const fontCss = `<link rel="stylesheet" href="${new URL('node_modules/@fontsource-variable/inter-tight/index.css', root).href}" />`;
const html = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8" /><title>${esc(META.title)}</title>
  ${fontCss}<link rel="stylesheet" href="${new URL('manual.css', import.meta.url).href}" /></head>
  <body>${PAGES.map((p, i) => {
    const r = pages[p.type];
    if (!r) throw new Error(`tipo de página desconhecido: ${p.type}`);
    return r(p, i);
  }).join('\n')}</body></html>`;

const htmlPath = new URL('manual.html', build);
await writeFile(htmlPath, html);

const page = await browser.newPage();
await page.goto(htmlPath.href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// As maiores figuras que cabem: reduz as figuras de cada página 1 mm de cada vez até o corpo deixar de transbordar.
await page.evaluate(() => {
  for (const p of document.querySelectorAll('.page')) {
    const body = p.querySelector('.page-body');
    const figs = [...p.querySelectorAll('.fig')];
    if (!body || !figs.length) continue;
    let k = 1;
    while (body.scrollHeight > body.clientHeight + 1 && k > 0.4) {
      k -= 0.02;
      let all = true;
      for (const f of figs) {
        const w = Math.max(Number(f.dataset.min), Number(f.dataset.max) * k);
        if (w > Number(f.dataset.min)) all = false;
        f.style.width = `${w}mm`;
      }
      if (all) break;
    }
  }
});
// Páginas de tamanho fixo: o que passar do corpo da página ficaria cortado, por isso falha.
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.page')].flatMap((p, i) => {
    const b = p.querySelector('.page-body');
    return b && b.scrollHeight > b.clientHeight + 1 ? [`página ${i + 1}: +${b.scrollHeight - b.clientHeight}px`] : [];
  }),
);
const broken = await page.evaluate(() => [...document.images].filter((im) => !im.naturalWidth).map((im) => im.src));
await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();

const size = (await stat(OUT_PDF)).size;
console.log(`PDF: ${OUT_PDF} (${PAGES.length} páginas, ${(size / 1024 / 1024).toFixed(1)} MB)`);
if (broken.length) console.error('Imagens em falta:', broken);
if (overflow.length) console.error('Páginas a transbordar:', overflow);
if (broken.length || overflow.length) process.exit(1);
