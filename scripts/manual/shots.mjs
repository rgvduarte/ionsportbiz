// Todas as capturas do manual, pela ordem em que são tiradas (uma só sessão do browser:
// o estado passa de uma para a seguinte — o convidado confirma, a equipa aprova, a porta dá entrada…).
// `targets` associa um nome a um localizador do Playwright; capture.mjs guarda a caixa de cada alvo
// para o manual desenhar os marcadores numerados por cima da imagem.
// `view`: 'phone' (390×844) ou 'desktop' (1440×900). `clip`: recorta a imagem a um elemento (ex.: um diálogo).
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { buildEmailHtml } from '../../supabase/functions/_shared/email-html.ts';
import { buildTemplateVars, renderMessage } from '../../supabase/functions/_shared/template.ts';

export const PUBLIC_URL = 'https://ionsportbiz.app';
/** Relógio fixo: as datas, a contagem decrescente e os prazos ficam iguais em todas as execuções. */
export const NOW = new Date('2026-11-10T10:30:00Z');
/** Dia do evento (para o check-in): 22 de março de 2027, 18:40 em Lisboa. */
const EVENT_DAY = '2027-03-22T18:40:00Z';
export const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

// Pessoas da demonstração (dados fictícios, sempre iguais: o gerador é determinístico).
const GUEST = ['Carolina', 'Oliveira Ferreira']; // a convidada que acompanhamos do convite à porta
const PENDING = ['Francisco', 'Moreira Teixeira']; // confirmou e fica por aprovar
const REJECT = ['Pedro', 'Ribeiro Martins']; // exemplo do diálogo «Não aprovar»
const ERASURE = ['Ana', 'Martins Mendes']; // pede a eliminação dos dados no convite
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const EV = `/admin/eventos/${EVENT_ID}`;

const settle = (p, ms = 350) => p.waitForTimeout(ms);
/** Recorte da área principal do back-office, sem a barra lateral (já apresentada no capítulo do painel). */
const MAIN = (p) => p.locator('.adm-main');
const top = (p) => p.evaluate(() => window.scrollTo(0, 0));
const rowOf = (p, name) => p.locator('tr', { hasText: name }).first();
const drawerSection = (p, title) => p.locator('.ui-drawer .inv-section', { has: p.locator('h3', { hasText: title }) });

/** Abre a ficha (gaveta) de um convidado na lista do evento. */
async function openDrawer(p, x, name) {
  await x.go(EV);
  await p.getByPlaceholder('Pesquisar por nome, email ou entidade').fill(name);
  await settle(p, 500);
  await rowOf(p, name).locator('button, a').filter({ hasText: name }).first().click();
  await p.locator('.ui-drawer .inv-drawer').waitFor();
  await settle(p, 600);
}

/** Email do convite tal como a função send-invitations o monta (modelo «Convite formal»). */
async function emailHtml(x) {
  const { contact, inv, db } = await x.invitation(...GUEST);
  const event = db.events[0];
  const tpl = db.templates.find((t) => t.name === 'Convite formal');
  const link = `${PUBLIC_URL}/c/${inv.token}`;
  const vars = buildTemplateVars({ event, contact, link });
  const body = buildEmailHtml({
    subject: 'Convite — ' + event.name,
    bodyText: renderMessage(tpl.body, vars),
    ctaLabel: 'Abrir o convite',
    ctaUrl: link,
    accent: event.branding.accent,
    logoUrl: event.branding.logo_url,
    footer: ['Este convite é pessoal e intransmissível.', `Para qualquer esclarecimento: ${event.contact_email}`, `Responsável pelo tratamento dos dados: ${event.privacy_controller}`].join('\n'),
  });
  // Cabeçalho de uma app de email genérica, por cima da mensagem.
  const head = `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#fff;border-bottom:1px solid #e2e5ea;padding:18px 22px 14px;color:#101828">
    <div style="font-size:19px;font-weight:700;line-height:1.25;margin-bottom:12px">Convite — ${event.name}</div>
    <div style="display:flex;gap:10px;align-items:center"><span style="width:36px;height:36px;border-radius:50%;background:#000;display:grid;place-items:center;color:#ccff00;font-weight:800;font-size:13px">ion</span>
    <div style="font-size:13px;line-height:1.35"><b>ion — International Business &amp; Sports Conference</b><br><span style="color:#667085">para ${contact.email}</span></div></div></div>`;
  return body.replace(/<body([^>]*)>/, `<body$1>${head}`);
}

/** Mensagem de WhatsApp do convite, num ecrã de conversa genérico (ilustrativo). */
async function whatsappHtml(x) {
  const { contact, inv, db } = await x.invitation(...GUEST);
  const event = db.events[0];
  const tpl = db.templates.find((t) => t.channel === 'whatsapp');
  const link = `${PUBLIC_URL}/c/${inv.token}`;
  const text = renderMessage(tpl.body, buildTemplateVars({ event, contact, link }));
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = esc(text).replace(esc(link), `<span class="lnk">${esc(link)}</span>`).replace(/\n/g, '<br>');
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><style>
    body{margin:0;background:#0b141a;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#e9edef;height:100vh;display:flex;flex-direction:column}
    .bar{padding:52px 14px 12px;background:#1f2c33;display:flex;gap:12px;align-items:center}
    .av{width:38px;height:38px;border-radius:50% 50% 14% 50%;background:linear-gradient(135deg,#ccff00,#e27a2c 62%,#ea4d3b);color:#000;font-weight:800;display:grid;place-items:center;font-size:13px}
    .who b{display:block;font-size:16px}.who span{font-size:12px;color:#8696a0}
    .chat{flex:1;padding:16px 12px;background:#0b141a}
    .day{margin:0 auto 14px;width:fit-content;font-size:12px;color:#8696a0;background:#1f2c33;padding:5px 10px;border-radius:8px}
    .msg{max-width:84%;background:#202c33;border-radius:0 12px 12px 12px;padding:9px 11px 20px;font-size:14.5px;line-height:1.42;position:relative}
    .msg time{position:absolute;right:10px;bottom:5px;font-size:11px;color:#8696a0}
    .lnk{color:#53bdeb;word-break:break-all}
    .input{margin:10px;padding:12px 16px;border-radius:24px;background:#2a3942;color:#8696a0;font-size:15px}
  </style></head><body><div class="bar"><span class="av">ion</span><div class="who"><b>ion · Equipa de convidados</b><span>mensagem</span></div></div>
  <div class="chat"><div class="day">Hoje</div><div class="msg">${html}<time>10:30</time></div></div><div class="input">Mensagem</div></body></html>`;
}

// ───────── Amostras de componentes: o HTML real dos componentes, desenhado com o CSS da própria app ─────────
const ic = (name, size = 16, props = {}) => renderToStaticMarkup(createElement(Icons[name], { size, 'aria-hidden': true, ...props }));
const qrSvg = (value, size) => renderToStaticMarkup(createElement(QRCodeSVG, { value, size, level: 'H', bgColor: '#FFFFFF', fgColor: '#000000', marginSize: 2 }));
const label = (t) => `<p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8e8e8e;margin:0 0 10px">${t}</p>`;
const row = (html, gap = 10) => `<div style="display:flex;flex-wrap:wrap;gap:${gap}px;align-items:center">${html}</div>`;

const ADMIN_SPEC = `<div id="spec" style="position:fixed;inset:0;z-index:99999;background:#000;overflow:auto;padding:36px">
<div id="spec-in" style="width:940px;display:grid;gap:24px;padding:22px;font-family:var(--font-sans);color:var(--c-text);background:#000">
<section data-s="buttons">${label('Botões')}${row(`
  <button class="ui-btn ui-btn--primary">${ic('Check')}Aprovar com VIP Pass</button>
  <button class="ui-btn ui-btn--secondary">${ic('UserPlus')}Adicionar convidados</button>
  <button class="ui-btn ui-btn--ghost">Cancelar</button>
  <button class="ui-btn ui-btn--danger">${ic('X')}Não aprovar</button>
  <button class="ui-btn ui-btn--danger-ghost">${ic('Undo2')}Anular entrada</button>
  <button class="ui-btn ui-btn--secondary ui-btn--sm">${ic('Send')}Enviar email</button>
  <button class="ui-btn ui-btn--primary ui-btn--lg">Entrar</button>
  <button class="ui-btn ui-btn--primary" disabled>Sem alterações</button>`)}</section>
<section data-s="badges">${label('Etiquetas de estado e tipos de acesso')}${row(`
  <span class="ui-badge ui-badge--dot">Por enviar</span><span class="ui-badge ui-badge--info ui-badge--dot">Enviado</span>
  <span class="ui-badge ui-badge--accent ui-badge--dot">Visto</span><span class="ui-badge ui-badge--success ui-badge--dot">Confirmado</span>
  <span class="ui-badge ui-badge--danger ui-badge--dot">Recusado</span><span class="ui-badge ui-badge--dot">Cancelado</span>
  <span style="width:18px"></span>
  <span class="ui-badge ui-badge--warning ui-badge--dot">Por aprovar</span><span class="ui-badge ui-badge--success ui-badge--dot">Aprovado</span>
  <span class="ui-badge ui-badge--danger ui-badge--dot">Não aprovado</span><span class="ui-badge ui-badge--accent">1.ª vaga</span>
  <span style="width:18px"></span>
  <span class="pass-chip" style="--pass-color:#ccff00"><span class="pass-dot" style="background:#ccff00"></span><span class="pass-chip__name">VIP Pass</span></span>
  <span class="pass-chip" style="--pass-color:#e27a2c"><span class="pass-dot" style="background:#e27a2c"></span><span class="pass-chip__name">Conference Pass</span></span>`, 8)}</section>
<section data-s="alerts">${label('Avisos')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  <div class="ui-alert ui-alert--info">${ic('Info')}<div>O convidado só vê o código QR e a lista de acessos depois de aprovado.</div></div>
  <div class="ui-alert ui-alert--warning">${ic('TriangleAlert')}<div><strong>8 confirmações por aprovar.</strong> Estes convidados ainda não têm código QR.</div></div>
  <div class="ui-alert ui-alert--danger">${ic('CircleX')}<div>O evento está arquivado: os links pessoais já não abrem.</div></div>
  <div class="ui-alert ui-alert--success">${ic('CircleCheck')}<div>Importação concluída: 4 contactos criados, 1 atualizado.</div></div></div></section>
<section data-s="fields">${label('Campos')}<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;align-items:start">
  <div class="ui-field"><label class="ui-field__label">Nome do evento<span class="req">*</span></label><input class="ui-input" value="ion Portugal 2027"><div class="ui-field__hint">Aparece no convite.</div></div>
  <div class="ui-field"><label class="ui-field__label">Email<span class="req">*</span></label><input class="ui-input" value="marta.lencastre@ionsportbiz.app" style="border-color:var(--c-accent);box-shadow:var(--focus-ring-field)"><div class="ui-field__hint">Com foco.</div></div>
  <div class="ui-field"><label class="ui-field__label">Nome completo<span class="req">*</span></label><input class="ui-input" value="" aria-invalid="true"><div class="ui-field__error">Indique o nome.</div></div>
  <div class="ui-field"><label class="ui-field__label">Papel</label><select class="ui-select"><option>Receção</option></select><label class="ui-check" style="margin-top:8px"><input type="checkbox" checked>Aceita comunicações futuras</label></div></div></section>
<section data-s="card">${label('Cartão')}<div class="ui-card" style="max-width:620px"><div class="ui-card__header"><div><div class="ui-card__title">Aprovação</div><div class="ui-card__subtitle">Quem confirma recebe o código QR só depois de a equipa aprovar.</div></div><a style="font-size:13px;font-weight:600">Acessos</a></div><div class="ui-card__body" style="font-size:14px;color:var(--c-text-2)">8 por aprovar · 18 aprovados · 0 não aprovados</div><div class="ui-card__footer"><button class="ui-btn ui-btn--secondary">Cancelar</button><button class="ui-btn ui-btn--primary">${ic('BadgeCheck')}Aprovar 8 confirmações</button></div></div></section>
</div></div>`;

const avatar = (t, tone, size = 44) => `<span class="avatar avatar-${tone}" style="width:${size}px;height:${size}px;font-size:${size * 0.36}px">${t}</span>`;
const passCard = (name, vip, style = '') => `<div class="pass${vip ? ' pass-vip' : ''}" style="${style}">
  <div class="pass-top"><img src="/images/logo-full.webp" alt="" class="pass-logo"><img src="/images/pt-27.webp" alt="" class="pass-edition"></div>
  <div class="pass-type">${name}</div><div class="pass-qr">${qrSvg('MWJVAVYTA6', 140)}</div>
  <div class="pass-name">Carolina Oliveira Ferreira</div><div class="pass-company">Diretora de Comunicação · Montado Seguros</div>
  <div class="pass-id"><span>Código de entrada</span><code>MWJVA-VYTA6</code></div></div>`;

const APP_SPEC = `<div class="ev" id="spec" style="position:fixed;inset:0;z-index:99999;overflow:auto;padding:36px;min-height:0">
<div id="spec-in" style="width:1140px;display:grid;grid-template-columns:440px 1fr;gap:28px;padding:22px;background:#000">
<div style="display:grid;gap:26px;align-content:start">
<section data-s="buttons">${label('Botões')}${row(`<button class="btn btn-primary">${ic('Mail', 20)} Abrir o meu convite</button><button class="btn btn-outline">${ic('CalendarPlus', 18)} Adicionar ao calendário</button>
  <button class="btn btn-ghost btn-sm">${ic('RefreshCw', 16)} Verificar de novo</button><button class="btn btn-danger btn-sm">${ic('LogOut', 16)} Sair</button>`)}</section>
<section data-s="chips">${label('Filtros, estados e etiquetas')}${row(`<button class="chip">${ic('Star', 14)} A minha agenda</button><button class="chip active">Todos</button><button class="chip"><span class="dot" style="background:#ccff00"></span>ion Main Stage</button>`, 8)}
  <div style="height:12px"></div>${row(`<span class="pill">${ic('Hourglass', 16)} Pendente</span><span class="pill pill-on">${ic('UserCheck', 16)} Ligado</span><span class="vip-tag">VIP</span><span class="access-tag ok">Incluído</span><span class="access-tag">Não incluído</span><span class="seg-badge">2</span>`, 10)}</section>
<section data-s="session">${label('Cartão de sessão')}<article class="session-card" style="--stage:#FFFFFF"><a class="session-main"><div class="session-time">21:30 – 22:30</div><h3>ion Awards Ceremony</h3><div class="session-meta"><span class="stage-tag"><span class="dot"></span> Gala Venue</span><span class="vip-tag">VIP</span><span class="access-tag ok">Incluído</span></div><div class="session-speakers">${avatar('AL', 'grad', 28)}<span class="muted small">André Lopes</span></div></a><button class="fav-btn on">${ic('Star', 22, { fill: 'currentColor' })}</button></article></section>
<section data-s="avatars">${label('Balão: avatares, botão da credencial e confirmação')}${row(`${avatar('CO', 'grad')}${avatar('MC', 'lime')}${avatar('3', 'red', 30)}<span class="pass-bubble" style="margin:0 8px">${ic('QrCode', 26)}</span><span class="toast show" style="position:static;transform:none;opacity:1">${ic('Check', 18)} Pedido de ligação enviado</span>`, 16)}</section>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-content:start">
<section data-s="pass">${label('Credencial VIP')}${passCard('VIP Pass', true)}</section>
<section data-s="passConf">${label('Outro tipo de acesso')}${passCard('Conference Pass', false, '--pass:#e27a2c;--pass-on:#000000')}</section>
</div></div></div>`;

async function specimen(p, x, path, html) {
  await x.go(path, 600);
  await p.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', html); window.scrollTo(0, 0); }, html);
  await p.evaluate(() => Promise.all([...document.querySelectorAll('#spec img')].map((im) => im.decode().catch(() => null))));
  await settle(p, 300);
}

export const SHOTS = [
  // ─────────────────────────── Convidado: o convite ───────────────────────────
  {
    id: 'email',
    view: 'desktop',
    viewport: { width: 620, height: 1180 },
    clip: { x: 0, y: 0, width: 620, height: 1180 },
    setup: async (p, x) => {
      await x.go('/entrar', 200);
      await p.setContent(await emailHtml(x), { waitUntil: 'networkidle' });
      await settle(p, 300);
    },
    targets: {
      subject: (p) => p.getByText('Convite — ion Portugal 2027').first(),
      greeting: (p) => p.getByText('Exma. Senhora Carolina Oliveira Ferreira,'),
      cta: (p) => p.getByRole('link', { name: 'Abrir o convite' }),
    },
  },
  {
    id: 'whatsapp',
    setup: async (p, x) => {
      await x.go('/entrar', 200);
      await p.setContent(await whatsappHtml(x), { waitUntil: 'networkidle' });
    },
    targets: {
      msg: (p) => p.locator('.msg'),
      link: (p) => p.locator('.lnk'),
    },
  },
  {
    id: 'invite',
    setup: async (p, x) => {
      const { inv } = await x.invitation(...GUEST);
      await x.go(`/c/${inv.token}`, 700);
    },
    targets: {
      lang: (p) => p.locator('.gi-lang'),
      greeting: (p) => p.locator('.gi-card__greeting'),
      text: (p) => [p.locator('.gi-card__host'), p.locator('.gi-card__text')],
      name: (p) => p.locator('.gi-card__name'),
      when: (p) => [p.locator('.gi-card__date'), p.locator('.gi-card__time')],
      dress: (p) => p.locator('.gi-card__dress'),
    },
  },
  {
    id: 'invite-rsvp',
    setup: async (p, x) => { await x.scrollTo('#gi-rsvp', 24); },
    targets: {
      deadline: (p) => p.locator('.gi-deadline'),
      accept: (p) => p.locator('.gi-choice__btn--accept'),
      decline: (p) => p.locator('.gi-choice__btn--decline'),
      note: (p) => p.locator('.gi-fineprint'),
      programme: (p) => p.locator('#gi-programme h2, #gi-programme .gi-section__title').first(),
    },
  },
  {
    id: 'rsvp-form',
    setup: async (p, x) => {
      await p.locator('.gi-choice__btn--accept').click();
      await settle(p);
      await p.locator('.gi-segment label', { hasText: 'Sim' }).click();
      await p.locator('.gi-companion input').first().fill('Miguel Ferreira');
      await p.getByLabel('Restrições alimentares').fill('Vegetariana');
      await p.locator('.gi-companion input').first().blur();
      await x.scrollTo('#gi-rsvp-form', 16);
    },
    targets: {
      title: (p) => p.locator('.gi-form__title'),
      companions: (p) => p.locator('.gi-fieldset').nth(0),
      extra: (p) => p.locator('.gi-fieldset').nth(1),
    },
  },
  {
    id: 'rsvp-submit',
    setup: async (p, x) => {
      await p.locator('.gi-consent input[type=checkbox]').check();
      await x.scrollTo('.gi-consent', 330);
    },
    targets: {
      note: (p) => p.getByLabel('Mensagem para a organização'),
      consent: (p) => p.locator('.gi-consent'),
      submit: (p) => p.getByRole('button', { name: 'Confirmar presença' }),
      back: (p) => p.locator('#gi-rsvp-form').getByRole('button', { name: 'Voltar' }),
    },
  },
  {
    id: 'rsvp-awaiting',
    setup: async (p, x) => {
      await p.getByRole('button', { name: 'Confirmar presença' }).click();
      await p.locator('.gi-done--awaiting').waitFor();
      await settle(p, 400);
      await x.scrollTo('#gi-rsvp', 24);
    },
    targets: {
      status: (p) => p.locator('.gi-done__head'),
      steps: (p) => p.locator('.gi-steps'),
      summary: (p) => p.locator('.gi-summary'),
    },
  },
  {
    id: 'rsvp-change',
    setup: async (p, x) => { await x.scrollTo('.gi-summary', 120); },
    targets: {
      summary: (p) => p.locator('.gi-summary'),
      change: (p) => p.getByRole('button', { name: 'Alterar resposta' }),
    },
  },

  // ─────────────────────────── App do evento: entrar ───────────────────────────
  {
    id: 'welcome',
    setup: async (p, x) => { await x.go('/welcome', 600); },
    targets: {
      lang: (p) => p.locator('.welcome-lang'),
      exclusive: (p) => p.locator('.invite-only'),
      cta: (p) => p.getByRole('button', { name: 'Abrir o meu convite' }),
      contact: (p) => p.locator('.welcome-body p.center'),
      staff: (p) => p.locator('.staff-link'),
    },
  },
  {
    id: 'welcome-link',
    setup: async (p, x) => {
      const { inv } = await x.invitation(...GUEST);
      await p.getByRole('button', { name: 'Abrir o meu convite' }).click();
      await p.locator('.welcome-body input').fill(`${PUBLIC_URL}/c/${inv.token}`);
      await p.locator('.welcome-body input').evaluate((el) => { el.setSelectionRange(0, 0); el.scrollLeft = 0; el.blur(); });
    },
    targets: {
      back: (p) => p.locator('.back-link'),
      field: (p) => p.locator('.welcome-body .form label'),
      submit: (p) => p.getByRole('button', { name: /Continuar/ }),
      legal: (p) => p.locator('.welcome-body > p.center'),
    },
  },
  {
    id: 'app-pending',
    setup: async (p, x) => {
      await p.getByRole('button', { name: /Continuar/ }).click();
      await p.locator('.countdown').waitFor();
      await x.go('/credential', 700);
    },
    targets: {
      card: (p) => p.locator('.cred-state h2'),
      steps: (p) => p.locator('.cred-steps'),
      refresh: (p) => p.getByRole('button', { name: 'Verificar de novo' }),
      tab: (p) => p.locator('.tabbar .tab-pass'),
    },
  },
  {
    id: 'app-unconfirmed',
    setup: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        const inv = d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id);
        inv.status = 'opened';
      }, GUEST);
      await x.go('/credential', 700);
    },
    targets: {
      card: (p) => p.locator('.cred-state h2'),
      confirm: (p) => p.locator('.cred-state-actions a'),
    },
  },
  {
    id: 'app-rejected',
    setup: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        const inv = d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id);
        inv.status = 'accepted';
        inv.approval_status = 'rejected';
      }, GUEST);
      await x.go('/credential', 700);
    },
    teardown: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id).approval_status = 'pending';
      }, GUEST);
    },
    targets: {
      card: (p) => p.locator('.cred-state h2'),
      contact: (p) => p.locator('.cred-state-actions a'),
    },
  },

  // ─────────────────────────── Equipa: entrar e painel ───────────────────────────
  {
    id: 'login',
    view: 'desktop',
    clip: (p) => p.locator('.login__card'),
    pad: 48,
    setup: async (p, x) => {
      await x.as(null);
      await x.go('/entrar', 500);
      await p.locator('.login__card .ui-alert').first().evaluate((el) => el.remove());
      await p.getByLabel('Email').fill('marta.lencastre@ionsportbiz.app');
      await p.getByLabel('Palavra-passe').fill('palavra-passe');
      await p.getByLabel('Palavra-passe').blur();
    },
    teardown: async (p, x) => { await x.as('admin@demo.pt'); },
    targets: {
      email: (p) => p.locator('.ui-field', { hasText: 'Email' }),
      password: (p) => p.locator('.ui-field', { hasText: 'Palavra-passe' }),
      submit: (p) => p.getByRole('button', { name: 'Entrar', exact: true }),
      link: (p) => p.getByRole('button', { name: 'Receber link de acesso por email' }),
    },
  },
  {
    id: 'dashboard',
    view: 'desktop',
    viewport: { height: 1000 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go('/admin', 900); },
    targets: {
      event: (p) => p.locator('select').first(),
      hero: (p) => p.locator('.dash-hero'),
      kpis: (p) => p.getByText('Convidados', { exact: true }).first().locator('xpath=ancestor::*[contains(@class,"dash-kpis") or contains(@class,"dash-kpi")][1]'),
      funnel: (p) => p.locator('.ui-card', { hasText: 'Funil de respostas' }),
      approval: (p) => p.locator('.ui-card', { hasText: 'Por tipo de acesso' }),
      approveAll: (p) => p.getByRole('link', { name: /Aprovar \d+ confirma/ }).or(p.getByRole('button', { name: /Aprovar \d+ confirma/ })),
      checkin: (p) => p.getByRole('link', { name: 'Abrir check-in' }),
    },
  },

  // ─────────────────────────── Equipa: convidados e aprovação ───────────────────────────
  {
    id: 'guests',
    view: 'desktop',
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go(EV, 900); },
    targets: {
      tabs: (p) => p.locator('.ui-tabs, nav[aria-label]').filter({ hasText: 'Programa' }).first(),
      capacity: (p) => p.locator('.inv-capacity'),
      actions: (p) => p.locator('.inv-head__actions'),
      alert: (p) => p.locator('.inv-approval-alert'),
      status: (p) => p.locator('.inv-segments'),
      approval: (p) => p.locator('.inv-approval-row'),
      toolbar: (p) => p.locator('.inv-toolbar'),
      table: (p) => p.locator('.inv-table thead'),
    },
  },
  {
    id: 'guests-pending',
    view: 'desktop',
    setup: async (p, x) => {
      await p.locator('.inv-approval-row button', { hasText: 'Por aprovar' }).click();
      await settle(p, 500);
      await rowOf(p, GUEST.join(' ')).locator('input[type=checkbox]').check();
      await rowOf(p, PENDING.join(' ')).locator('input[type=checkbox]').check();
      await settle(p, 300);
      await x.scrollTo('.inv-approval-alert', 20);
    },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    viewport: { height: 760 },
    targets: {
      filter: (p) => p.locator('.inv-approval-row button[aria-pressed=true]'),
      rows: (p) => [rowOf(p, GUEST.join(' ')).locator('input[type=checkbox]'), rowOf(p, PENDING.join(' ')).locator('input[type=checkbox]')],
      bulk: (p) => p.locator('.inv-bulkbar__info'),
      approve: (p) => p.locator('.inv-bulkbar').getByRole('button', { name: 'Aprovar…' }),
      more: (p) => p.locator('.inv-bulkbar').getByRole('button', { name: 'Mais ações' }),
    },
  },
  {
    id: 'approve-dialog',
    view: 'desktop',
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p) => {
      // Aprova só a convidada que acompanhamos: desmarca o outro.
      await rowOf(p, PENDING.join(' ')).locator('input[type=checkbox]').uncheck();
      await p.locator('.inv-bulkbar').getByRole('button', { name: 'Aprovar…' }).click();
      await p.locator('.apv-option').first().waitFor();
      await p.locator('.apv-option', { hasText: 'VIP Pass' }).click();
      await settle(p, 300);
    },
    targets: {
      title: (p) => p.locator('.ui-dialog__title'),
      vip: (p) => p.locator('.apv-option', { hasText: 'VIP Pass' }),
      conference: (p) => p.locator('.apv-option', { hasText: 'Conference Pass' }),
      info: (p) => p.locator('.ui-dialog .ui-alert').last(),
      submit: (p) => p.getByRole('button', { name: /Aprovar com/ }),
    },
  },
  {
    id: 'approved-list',
    view: 'desktop',
    setup: async (p) => {
      await p.getByRole('button', { name: /Aprovar com/ }).click();
      await settle(p, 600);
      await p.locator('.inv-approval-row button', { hasText: /^Aprovados/ }).click();
      await p.getByPlaceholder('Pesquisar por nome, email ou entidade').fill('Ferreira');
      await settle(p, 600);
    },
    targets: {
      row: (p) => rowOf(p, GUEST.join(' ')).locator('td').nth(3),
    },
  },
  {
    id: 'reject-dialog',
    view: 'desktop',
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p, x) => {
      await x.go(EV, 700);
      await p.locator('.inv-approval-row button', { hasText: 'Por aprovar' }).click();
      await settle(p, 400);
      await rowOf(p, REJECT.join(' ')).locator('input[type=checkbox]').check();
      await p.locator('.inv-bulkbar').getByRole('button', { name: 'Mais ações' }).click();
      await p.getByRole('menuitem', { name: 'Não aprovar…' }).click();
      await p.getByPlaceholder('Ex.: lotação reservada a parceiros').fill('Lotação da gala reservada a parceiros institucionais.');
      await settle(p, 300);
    },
    teardown: async (p) => { await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click(); },
    targets: {
      title: (p) => p.locator('.ui-dialog__header'),
      reason: (p) => p.locator('.ui-dialog .ui-field'),
      submit: (p) => p.locator('.ui-dialog__footer').getByRole('button', { name: 'Não aprovar' }),
    },
  },
  {
    id: 'drawer-approval',
    view: 'desktop',
    setup: async (p, x) => {
      await openDrawer(p, x, GUEST.join(' '));
      await drawerSection(p, 'Aprovação').scrollIntoViewIfNeeded();
      await drawerSection(p, 'Aprovação').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await settle(p, 300);
    },
    clip: (p) => p.locator('.ui-drawer'),
    targets: {
      approval: (p) => drawerSection(p, 'Aprovação'),
      change: (p) => drawerSection(p, 'Aprovação').getByRole('button', { name: /Mudar tipo de acesso/ }),
      checkin: (p) => drawerSection(p, 'Entrada'),
    },
  },
  {
    id: 'drawer-send',
    view: 'desktop',
    setup: async (p) => {
      await p.locator('.ui-drawer .ui-dialog__body').evaluate((el) => el.scrollTo(0, 0));
      await drawerSection(p, 'Enviar convite').locator('summary', { hasText: 'Ver mensagem' }).click();
      await settle(p, 300);
    },
    clip: (p) => p.locator('.ui-drawer'),
    targets: {
      identity: (p) => p.locator('.inv-identity'),
      link: (p) => drawerSection(p, 'Link pessoal').locator('.inv-link__main'),
      qr: (p) => p.locator('.inv-link__qr'),
      email: (p) => drawerSection(p, 'Enviar convite').locator('.inv-channel').nth(0),
      whatsapp: (p) => drawerSection(p, 'Enviar convite').locator('.inv-channel').nth(1),
    },
  },

  // ─────────────────────────── Convidado: credencial aprovada ───────────────────────────
  {
    id: 'ticket',
    setup: async (p, x) => {
      const { inv } = await x.invitation(...GUEST);
      await x.go(`/c/${inv.token}`, 800);
      await x.scrollTo('#gi-ticket', 16);
    },
    targets: {
      title: (p) => p.locator('#gi-ticket h2').first(),
      qr: (p) => p.locator('.gi-ticket__qr-wrap'),
      code: (p) => p.locator('.gi-ticket__code'),
      pass: (p) => p.locator('.gi-ticket__pass'),
    },
  },
  {
    id: 'ticket-more',
    setup: async (p, x) => { await x.scrollTo('.gi-ticket__pass', 16); },
    targets: {
      includes: (p) => p.locator('.gi-ticket__includes'),
      meta: (p) => p.locator('.gi-ticket__meta'),
      app: (p) => p.locator('.gi-appcta'),
      calendar: (p) => p.locator('.gi-ticket__actions'),
    },
  },
  {
    id: 'app-cred',
    setup: async (p, x) => { await x.go('/credential', 900); },
    targets: {
      type: (p) => p.locator('.pass-type'),
      qr: (p) => p.locator('.pass-qr'),
      name: (p) => [p.locator('.pass-name'), p.locator('.pass-company')],
      plus: (p) => p.locator('.pass-plus'),
      code: (p) => p.locator('.pass-id'),
    },
  },
  {
    id: 'app-cred-access',
    setup: async (p, x) => { await x.scrollTo('.hint', 280); },
    targets: {
      hint: (p) => p.locator('.hint'),
      access: (p) => p.locator('.access-list'),
      desc: (p) => p.locator('.pass-desc'),
    },
  },

  // ─────────────────────────── App do evento ───────────────────────────
  {
    id: 'home',
    setup: async (p, x) => { await x.go('/', 900); },
    targets: {
      bell: (p) => p.locator('.topbar a[aria-label="Notícias"]'),
      hello: (p) => p.locator('.greeting'),
      countdown: (p) => p.locator('.countdown'),
      alert: (p) => p.locator('a.alert'),
      quick: (p) => p.locator('.quick-card').nth(0),
    },
  },
  {
    id: 'nav',
    setup: async (p, x) => { await x.scrollTo('.quick', 300); },
    targets: {
      home: (p) => p.locator('.tabbar a').nth(0),
      agenda: (p) => p.locator('.tabbar a').nth(1),
      pass: (p) => p.locator('.tabbar a').nth(2),
      network: (p) => p.locator('.tabbar a').nth(3),
      more: (p) => p.locator('.tabbar a').nth(4),
      badge: (p) => p.locator('.tabbar .badge'),
      quick: (p) => p.locator('.quick'),
    },
  },
  {
    id: 'agenda-vip',
    setup: async (p, x) => { await x.go('/agenda?day=2027-03-22', 700); },
    targets: {
      days: (p) => p.locator('.day-tabs'),
      chips: (p) => p.locator('.chips'),
      vip: (p) => p.locator('.session-card').nth(1).locator('.vip-tag'),
      included: (p) => p.locator('.session-card').nth(1).locator('.access-tag'),
      star: (p) => p.locator('.session-card').nth(1).locator('.fav-btn'),
    },
  },
  {
    id: 'session-conference',
    setup: async (p, x) => {
      // A mesma convidada, por instantes com Conference Pass: as sessões VIP aparecem como não incluídas.
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id).pass_type_id = d.passTypes.find((t) => t.name === 'Conference Pass').id;
      }, GUEST);
      await x.go('/agenda?day=2027-03-23', 700);
      await x.scrollTo('.time-group:has(.vip-tag)', 70);
    },
    teardown: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id).pass_type_id = d.passTypes.find((t) => t.name === 'VIP Pass').id;
      }, GUEST);
    },
    targets: {
      vip: (p) => p.locator('.session-card:has(.vip-tag)').first(),
      open: (p) => p.locator('.session-card:has(.vip-tag)').first().locator('xpath=following-sibling::article[1]'),
    },
  },
  {
    id: 'session-note',
    setup: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id).pass_type_id = d.passTypes.find((t) => t.name === 'Conference Pass').id;
      }, GUEST);
      await x.go('/agenda/c13', 700);
    },
    teardown: async (p, x) => {
      await x.mutate((d, who) => {
        const c = d.contacts.find((c) => c.first_name === who[0] && c.last_name === who[1]);
        d.invitations.find((i) => i.contact_id === c.id && i.event_id === d.events[0].id).pass_type_id = d.passTypes.find((t) => t.name === 'VIP Pass').id;
      }, GUEST);
    },
    targets: {
      note: (p) => p.locator('.access-note'),
    },
  },
  {
    id: 'session',
    setup: async (p, x) => { await x.go('/agenda/c3', 700); },
    targets: {
      back: (p) => p.locator('.topbar .icon-btn'),
      facts: (p) => p.locator('.facts'),
      fav: (p) => p.locator('.detail .actions .btn').nth(0),
      cal: (p) => p.locator('.detail .actions .btn').nth(1),
      speaker: (p) => p.locator('.detail .row-card').nth(0),
    },
  },
  {
    id: 'speakers',
    setup: async (p, x) => { await x.go('/speakers', 700); },
    targets: {
      search: (p) => p.locator('.search'),
      card: (p) => p.locator('.speaker-card').nth(0),
    },
  },
  {
    id: 'net-people',
    setup: async (p, x) => { await x.go('/networking', 700); },
    targets: {
      tabs: (p) => p.locator('.segmented'),
      search: (p) => p.locator('.search'),
      chips: (p) => p.locator('.chips'),
      person: (p) => p.locator('.row-card').nth(0).locator('.row-link'),
      connect: (p) => p.locator('.row-card').nth(0).getByRole('button', { name: 'Ligar' }),
      incoming: (p) => p.locator('.row-card .row-actions').first(),
    },
  },
  {
    id: 'net-connections',
    setup: async (p) => {
      await p.getByRole('tab', { name: /Ligações/ }).click();
      await settle(p, 300);
    },
    targets: {
      tab: (p) => p.getByRole('tab', { name: /Ligações/ }),
      accept: (p) => p.locator('.row-card').nth(0).locator('button.btn-primary'),
      decline: (p) => p.locator('.row-card').nth(0).locator('button.btn-ghost'),
      connected: (p) => p.locator('.row-card .pill-on').first(),
    },
  },
  {
    id: 'slot',
    setup: async (p, x) => {
      await x.go('/networking/a3', 600);
      await p.getByRole('button', { name: 'Pedir reunião 1:1' }).click();
      await p.getByRole('button', { name: '11:30', exact: true }).click();
      await x.scrollTo('.slot-picker', 200);
    },
    targets: {
      head: (p) => p.locator('.profile-head'),
      slots: (p) => p.locator('.slots'),
      chosen: (p) => p.locator('.slot.on'),
      send: (p) => p.getByRole('button', { name: 'Enviar pedido' }),
    },
  },
  {
    id: 'meetings',
    setup: async (p, x) => {
      await p.getByRole('button', { name: 'Enviar pedido' }).click();
      await settle(p, 300);
      await x.go('/networking?tab=meetings', 600);
    },
    targets: {
      tab: (p) => p.getByRole('tab', { name: /Reuniões/ }),
      outgoing: (p) => p.locator('.meeting-card.m-outgoing').first(),
      incoming: (p) => p.locator('.meeting-card.m-incoming').first(),
      accept: (p) => p.locator('.meeting-card.m-incoming').getByRole('button', { name: 'Aceitar' }),
    },
  },
  {
    id: 'more',
    setup: async (p, x) => { await x.go('/more', 600); await p.evaluate(() => window.scrollBy(0, 90)); await settle(p, 200); },
    targets: {
      me: (p) => p.locator('.me-card'),
      menu: (p) => p.locator('nav.menu').nth(0),
      lang: (p) => p.locator('.lang-switch'),
      contact: (p) => p.locator('nav.menu').nth(1).locator('.menu-item').nth(1),
      logout: (p) => p.locator('nav.menu').nth(1).locator('.menu-item').nth(2),
    },
  },
  {
    id: 'profile',
    setup: async (p, x) => {
      await x.go('/more/profile', 600);
      for (const tag of ['Football', 'Partnerships', 'Sponsorship']) {
        const b = p.locator('.tag-toggle', { hasText: new RegExp(`^${tag}$`) });
        if (await b.count()) await b.first().click();
      }
      await top(p);
      await settle(p, 200);
    },
    targets: {
      invite: (p) => p.locator('.invite-card'),
      sector: (p) => p.locator('.form label').first(),
      interests: (p) => p.locator('.interest-picker'),
    },
  },
  {
    id: 'news',
    setup: async (p, x) => { await x.go('/news', 600); },
    targets: {
      item: (p) => p.locator('.news-item').nth(0),
      back: (p) => p.locator('.topbar .icon-btn'),
    },
  },
  {
    id: 'erasure-guest',
    setup: async (p, x) => {
      const { inv } = await x.invitation(...ERASURE);
      await x.go(`/c/${inv.token}`, 700);
      await p.locator('.gi-footer').getByRole('button', { name: 'Pedir a eliminação dos meus dados' }).click();
      await settle(p, 400);
    },
    clip: (p) => p.locator('.ui-dialog'),
    pad: 16,
    scale: 'device',
    targets: {
      confirm: (p) => p.locator('.ui-dialog').getByRole('button', { name: 'Enviar pedido' }),
    },
    teardown: async (p) => {
      await p.locator('.ui-dialog').getByRole('button', { name: 'Enviar pedido' }).click();
      await settle(p, 500);
    },
  },

  // ─────────────────────────── Equipa: contactos ───────────────────────────
  {
    id: 'contacts',
    view: 'desktop',
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go('/admin/contactos', 900); },
    targets: {
      actions: (p) => p.locator('.ui-page-header__actions, .ui-page-header .ui-row').first(),
      erasure: (p) => p.locator('.ct-erasure'),
      filters: (p) => p.locator('.ui-toolbar').first(),
      table: (p) => p.locator('table thead').first(),
      consent: (p) => p.locator('table thead th', { hasText: 'Comunicações' }),
    },
  },
  {
    id: 'contact',
    view: 'desktop',
    viewport: { height: 1000 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => {
      const { contact } = await x.invitation(...GUEST);
      await x.go(`/admin/contactos/${contact.id}`, 900);
    },
    targets: {
      header: (p) => p.locator('.ct-head__id').first(),
      actions: (p) => p.locator('.ct-head__actions'),
      data: (p) => p.locator('.ui-card', { hasText: 'Dados do contacto' }).first(),
      consent: (p) => p.locator('.ui-card', { hasText: 'Comunicações futuras' }).first(),
      invites: (p) => p.locator('.ui-card', { hasText: 'Convites deste contacto' }).first(),
      timeline: (p) => p.locator('.ui-card', { hasText: 'Linha do tempo' }).first(),
    },
  },
  {
    id: 'contact-gdpr',
    view: 'desktop',
    setup: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.locator('.ct-head__actions').getByRole('button', { name: 'Mais ações' }).click();
      await settle(p, 300);
    },
    clip: (p) => [p.locator('.ct-head__actions'), p.getByRole('menu')],
    pad: 14,
    targets: {
      menu: (p) => p.getByRole('menu'),
      export: (p) => p.getByRole('menuitem', { name: 'Exportar dados (RGPD)' }),
      erase: (p) => p.getByRole('menuitem', { name: 'Apagar dados pessoais' }),
    },
    teardown: async (p) => { await p.keyboard.press('Escape'); },
  },
  {
    id: 'import-map',
    view: 'desktop',
    viewport: { height: 1020 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => {
      await x.go('/admin/contactos/importar', 700);
      const csv = await readFile(new URL('./assets/contactos-exemplo.csv', import.meta.url));
      await p.locator('input[type=file]').setInputFiles({ name: 'contactos.csv', mimeType: 'text/csv', buffer: csv });
      await p.getByText('Correspondência entre as colunas do ficheiro e os campos do contacto').waitFor();
      await settle(p, 500);
    },
    targets: {
      steps: (p) => p.locator('.ct-steps'),
      map: (p) => p.getByText('Correspondência entre as colunas do ficheiro e os campos do contacto').locator('xpath=ancestor::*[contains(@class,"ui-card")][1]'),
    },
  },

  // ─────────────────────────── Equipa: eventos, acessos, mensagens ───────────────────────────
  {
    id: 'events',
    view: 'desktop',
    viewport: { height: 300 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go('/admin/eventos', 800); },
    targets: {
      tabs: (p) => p.getByRole('tab', { name: /Próximos/ }).locator('xpath=..'),
      card: (p) => p.locator('a, article', { hasText: 'ion Portugal 2027' }).filter({ hasText: 'Convidados' }).first(),
      create: (p) => p.getByRole('link', { name: 'Novo evento' }).or(p.getByRole('button', { name: 'Novo evento' })),
    },
  },
  {
    id: 'settings',
    view: 'desktop',
    setup: async (p, x) => { await x.go(`${EV}/definicoes`, 900); },
    targets: {
      tabs: (p) => p.getByRole('link', { name: 'Definições' }).first(),
      ident: (p) => p.locator('#evf-identificacao, section', { hasText: 'Como o evento é apresentado aos convidados.' }).first(),
      nav: (p) => p.getByText('Nesta página').locator('xpath=..'),
      check: (p) => p.getByText('Verificação', { exact: true }).locator('xpath=..'),
    },
  },
  {
    id: 'settings-approval',
    view: 'desktop',
    setup: async (p) => {
      await p.locator('#evf-aprovacao').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
      await settle(p, 300);
    },
    clip: (p) => p.locator('#evf-aprovacao'),
    pad: 1,
    targets: {
      on: (p) => p.locator('#evf-aprovacao label', { hasText: 'Com aprovação' }),
      off: (p) => p.locator('#evf-aprovacao label', { hasText: 'Sem aprovação' }),
    },
  },
  {
    id: 'settings-privacy',
    view: 'desktop',
    setup: async (p) => {
      await p.locator('#evf-privacidade').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
      await settle(p, 300);
    },
    clip: (p) => p.locator('#evf-privacidade'),
    pad: 1,
    maxHeight: 640,
    targets: {
      controller: (p) => p.locator('#evf-privacidade .ui-field').nth(0),
      policy: (p) => p.locator('#evf-privacidade .ui-field').nth(1),
      consent: (p) => p.locator('#evf-privacidade .ui-field').nth(2),
    },
  },
  {
    id: 'settings-status',
    view: 'desktop',
    setup: async (p) => {
      await p.locator('#evf-estado').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
      await settle(p, 300);
    },
    clip: (p) => p.locator('#evf-estado'),
    pad: 1,
    targets: {},
  },
  {
    id: 'programme',
    view: 'desktop',
    viewport: { height: 640 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go(`${EV}/programa`, 800); },
    targets: {
      add: (p) => p.getByRole('button', { name: 'Adicionar sessão' }),
      day: (p) => p.locator('.ui-card').first(),
    },
  },
  {
    id: 'passes',
    view: 'desktop',
    viewport: { height: 640 },
    // Recorte: o título da secção e os cartões dos tipos de acesso.
    clip: (p) => [p.getByRole('heading', { name: 'Acessos', exact: true }), p.locator('.pt-card').nth(0), p.locator('.pt-card').nth(1)],
    pad: 22,
    setup: async (p, x) => { await x.go(`${EV}/acessos`, 800); },
    targets: {
      vip: (p) => p.locator('.pt-card[aria-label="VIP Pass"]'),
      conf: (p) => p.locator('.pt-card[aria-label="Conference Pass"]'),
    },
  },
  {
    id: 'pass-edit',
    view: 'desktop',
    viewport: { height: 1000 },
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p) => {
      const card = p.locator('.pt-card[aria-label="VIP Pass"]');
      await card.getByRole('button').first().click();
      const edit = p.getByRole('menuitem', { name: /Editar/ });
      if (await edit.count()) await edit.first().click();
      await p.locator('.ui-dialog').waitFor();
      await settle(p, 400);
    },
    teardown: async (p) => { await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click(); },
    targets: {
      name: (p) => p.locator('.ui-dialog .ui-field', { hasText: 'Nome' }).first(),
      accesses: (p) => p.locator('.ui-dialog').getByText('Acessos incluídos').locator('xpath=ancestor::*[contains(@class,"ui-field") or self::fieldset][1]'),
      color: (p) => p.locator('.ui-dialog').getByText('Cor', { exact: true }).locator('xpath=ancestor::*[contains(@class,"ui-field") or self::fieldset][1]'),
      preview: (p) => p.locator('.ui-dialog').getByText('Como o convidado vê').locator('xpath=..'),
    },
  },
  {
    id: 'templates',
    view: 'desktop',
    setup: async (p, x) => { await x.go(`${EV}/mensagens`, 800); },
    targets: {
      channels: (p) => p.getByText('Enviado pela plataforma', { exact: false }).locator('xpath=ancestor::*[contains(@class,"ui-card") or contains(@class,"tpl-")][2]'),
      email: (p) => p.getByText('Convite formal').first(),
      create: (p) => p.getByRole('button', { name: 'Novo modelo' }),
    },
  },
  {
    id: 'template-edit',
    view: 'desktop',
    viewport: { height: 1000 },
    setup: async (p) => {
      await p.getByText('Convite formal').first().click();
      await p.locator('.ui-dialog, .ui-drawer').first().waitFor();
      await settle(p, 500);
    },
    clip: (p) => p.locator('.ui-dialog, .ui-drawer').first(),
    pad: 2,
    targets: {
      vars: (p) => p.getByRole('group', { name: 'Inserir variável' }).or(p.getByLabel('Inserir variável')).first(),
      subject: (p) => p.locator('.ui-field', { hasText: 'Assunto' }).first(),
      preview: (p) => p.getByLabel('Pré-visualização').first(),
    },
    teardown: async (p) => { await p.keyboard.press('Escape'); await settle(p, 300); },
  },
  {
    id: 'send-dialog',
    view: 'desktop',
    viewport: { height: 1000 },
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p, x) => {
      await x.go(EV, 800);
      await p.locator('.inv-head__actions').getByRole('button', { name: /Enviar/ }).click();
      await p.locator('.inv-send').waitFor();
      await settle(p, 500);
    },
    teardown: async (p) => { await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click(); },
    targets: {
      template: (p) => p.locator('.ui-dialog .ui-field', { hasText: 'Modelo de email' }),
      figures: (p) => p.locator('.inv-send__figures'),
      preview: (p) => p.locator('.inv-send__preview'),
      submit: (p) => p.locator('.ui-dialog__footer').getByRole('button', { name: /Enviar/ }),
    },
  },
  {
    id: 'add-guests',
    view: 'desktop',
    viewport: { height: 1000 },
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p) => {
      await p.locator('.inv-head__actions').getByRole('button', { name: /Adicionar/ }).click();
      await p.locator('.ui-dialog').waitFor();
      await settle(p, 500);
      const boxes = p.locator('.ui-dialog input[type=checkbox]:not(:disabled)');
      if (await boxes.count() > 3) { await boxes.nth(1).check(); await boxes.nth(2).check(); }
      await settle(p, 300);
    },
    teardown: async (p) => { await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click(); },
    targets: {
      search: (p) => p.locator('.ui-dialog input[type=search], .ui-dialog .ui-input').first(),
      already: (p) => p.locator('.ui-dialog').getByText('Já convidado').first(),
      wave: (p) => p.locator('.ui-dialog .ui-field', { hasText: 'Vaga' }).first(),
      submit: (p) => p.locator('.ui-dialog__footer').getByRole('button', { name: /Adicionar/ }),
    },
  },

  // ─────────────────────────── Equipa: equipa ───────────────────────────
  {
    id: 'team',
    view: 'desktop',
    viewport: { height: 840 },
    clip: MAIN,
    frame: 'browser',
    scale: 'css',
    setup: async (p, x) => { await x.go('/admin/equipa', 800); },
    targets: {
      invite: (p) => p.getByRole('button', { name: 'Convidar membro' }),
      role: (p) => p.locator('tr', { hasText: 'editor@demo.pt' }).locator('select'),
      active: (p) => p.locator('tr', { hasText: 'editor@demo.pt' }).getByRole('switch').or(p.locator('tr', { hasText: 'editor@demo.pt' }).locator('input[type=checkbox]')).first(),
      roles: (p) => p.getByText('Papéis e permissões').locator('xpath=ancestor::*[contains(@class,"ui-card")][1]'),
    },
  },
  {
    id: 'team-invite',
    view: 'desktop',
    clip: (p) => p.locator('.ui-dialog'),
    pad: 2,
    setup: async (p) => {
      await p.getByRole('button', { name: 'Convidar membro' }).click();
      await p.locator('.ui-dialog').waitFor();
      await p.locator('.ui-dialog').getByLabel('Nome completo').fill('Rita Antunes');
      await p.locator('.ui-dialog').getByLabel('Email').fill('rita.antunes@ionsportbiz.app');
      await settle(p, 300);
    },
    teardown: async (p) => { await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click(); },
    targets: {
      role: (p) => p.locator('.ui-dialog').getByText('Papel', { exact: true }).locator('xpath=ancestor::*[contains(@class,"ui-field") or self::fieldset][1]'),
      submit: (p) => p.locator('.ui-dialog__footer').getByRole('button', { name: 'Enviar convite' }),
    },
  },

  // ─────────────────────────── Check-in à porta (dia do evento, papel Receção) ───────────────────────────
  {
    id: 'checkin',
    setup: async (p, x) => {
      await x.clock(EVENT_DAY);
      await x.as('porta@demo.pt');
      await x.go('/admin/check-in', 900);
      const { inv } = await x.invitation(...GUEST);
      await p.locator('#ck-code').fill(inv.checkin_code);
      await p.locator('#ck-code').blur();
      await p.waitForTimeout(1500); // a câmara simulada arranca
      await top(p);
    },
    targets: {
      menu: (p) => p.locator('.adm-topbar button').first(),
      event: (p) => p.locator('.ck-top__event'),
      count: (p) => p.locator('.ck-count'),
      modes: (p) => p.locator('.ck-seg'),
      camera: (p) => p.locator('#ck-pane video, #ck-pane').first(),
    },
  },
  {
    id: 'checkin-code',
    setup: async (p, x) => { await x.scrollTo('#ck-pane', 20); },
    targets: {
      camera: (p) => p.locator('#ck-pane video, #ck-pane').first(),
      code: (p) => p.locator('.ck-manual'),
      recent: (p) => p.getByText('Últimas entradas').first(),
    },
  },
  {
    id: 'checkin-result',
    setup: async (p) => {
      await p.getByRole('button', { name: 'Procurar' }).click();
      await p.locator('.ck-cta').waitFor();
      await settle(p, 400);
      const companion = p.locator('.ck-companions input[type=checkbox]');
      if (await companion.count()) await companion.first().check();
      await settle(p, 200);
    },
    targets: {
      person: (p) => p.locator('.ck-panel__head').locator('xpath=following-sibling::*[1]').or(p.locator('.ck-panel__head')).first(),
      pass: (p) => p.locator('.ck-side .pass-chip--lg').locator('xpath=ancestor::*[contains(@class,"ck-")][1]'),
      companions: (p) => p.locator('.ck-companions'),
      cta: (p) => p.locator('.ck-cta'),
    },
  },
  {
    id: 'checkin-done',
    setup: async (p) => {
      await p.locator('.ck-cta').click();
      await settle(p, 600);
    },
    targets: {
      done: (p) => [p.getByText('Entrada registada', { exact: true }).first(), p.getByText('com 1 acompanhante').first()],
      next: (p) => p.getByRole('button', { name: 'Próximo convidado' }),
    },
  },
  {
    id: 'checkin-warning',
    setup: async (p, x) => {
      await x.go('/admin/check-in', 900);
      await p.getByRole('tab', { name: /Pesquisar/ }).click();
      await p.locator('.ck-search input').fill(PENDING[0] + ' ' + PENDING[1].split(' ')[0]);
      await settle(p, 700);
      await p.locator('.ck-result').first().click();
      await p.locator('.ck-notice').waitFor();
      await settle(p, 400);
    },
    targets: {
      notice: (p) => p.locator('.ck-notice'),
      cta: (p) => p.locator('.ck-cta'),
    },
  },
  {
    id: 'checkin-force',
    setup: async (p) => {
      await p.locator('.ck-cta').click();
      await p.locator('.ui-dialog').waitFor();
      await settle(p, 300);
    },
    teardown: async (p, x) => {
      await p.locator('.ui-dialog').getByRole('button', { name: 'Cancelar' }).click();
      await x.clock(NOW);
      await x.as('admin@demo.pt');
    },
    targets: {
      dialog: (p) => p.locator('.ui-dialog'),
      confirm: (p) => p.locator('.ui-dialog').getByRole('button', { name: 'Dar entrada' }),
    },
  },

  // ─────────────────────────── Design system: amostras de componentes ───────────────────────────
  {
    id: 'spec-admin',
    view: 'desktop',
    viewport: { height: 1100 },
    clip: (p) => p.locator('#spec-in'),
    setup: async (p, x) => { await specimen(p, x, '/admin', ADMIN_SPEC); },
    targets: {
      buttons: (p) => p.locator('#spec [data-s=buttons] > div'),
      badges: (p) => p.locator('#spec [data-s=badges] > div'),
      alerts: (p) => p.locator('#spec [data-s=alerts] > div'),
      fields: (p) => p.locator('#spec [data-s=fields] > div'),
      card: (p) => p.locator('#spec [data-s=card] .ui-card'),
    },
  },
  {
    id: 'spec-app',
    view: 'desktop',
    toasts: true,
    viewport: { height: 1100 },
    clip: (p) => p.locator('#spec-in'),
    setup: async (p, x) => { await specimen(p, x, '/more', APP_SPEC); },
    targets: {
      buttons: (p) => p.locator('#spec [data-s=buttons] > div'),
      chips: (p) => p.locator('#spec [data-s=chips]').locator('div').first(),
      session: (p) => p.locator('#spec .session-card'),
      pass: (p) => p.locator('#spec [data-s=pass] .pass'),
      passConf: (p) => p.locator('#spec [data-s=passConf] .pass'),
      avatars: (p) => p.locator('#spec [data-s=avatars] > div'),
    },
  },
];
