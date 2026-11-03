// HTML dos emails de convite: tabelas e estilos inline (Outlook, Gmail, Apple Mail), 600 px de largura
// máxima, e a versão em texto simples. Todo o texto é escapado aqui; os modelos são texto simples.
// Partilhado entre a app (pré-visualização) e a função send-invitations.

export interface EmailContent {
  subject: string;
  /** Corpo já com as variáveis substituídas. Linhas em branco separam parágrafos. */
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Cor do evento (#rrggbb). Por omissão, o azul institucional. */
  accent?: string | null;
  /** Só https. */
  logoUrl?: string | null;
  /** Texto do rodapé (linhas separadas por \n). */
  footer?: string | null;
  /** Texto que alguns clientes mostram na lista, a seguir ao assunto. */
  preheader?: string | null;
  lang?: string;
}

const DEFAULT_ACCENT = '#13294b';
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(text: string): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(color: string | null | undefined): string {
  return color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim()) ? color.trim() : DEFAULT_ACCENT;
}

// Contraste (WCAG): a cor da marca pode ser clara (ex.: verde-lima da ion) e o email tem fundo branco.
function rgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: number[]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number[], b: number[]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const WHITE = [255, 255, 255];
const INK = [16, 24, 40];

/** Texto do botão: branco sobre cores escuras, quase preto sobre cores claras. */
export function textOnAccent(accent: string): string {
  return contrast(rgb(accent), WHITE) >= 4.5 ? '#ffffff' : '#101828';
}

/** Cor dos links sobre branco: escurece a cor da marca até ter contraste suficiente. */
export function linkColor(accent: string): string {
  const base = rgb(accent);
  let c = base;
  for (let t = 0.1; contrast(c, WHITE) < 4.5 && t <= 1; t += 0.1) c = base.map((v, i) => Math.round(v + (INK[i] - v) * t)) as [number, number, number];
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function safeUrl(url: string | null | undefined): string | null {
  const u = (url ?? '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Escapa e transforma os endereços em links. */
function inline(text: string, accent: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_IN_TEXT)) {
    const start = m.index ?? 0;
    out += escapeHtml(text.slice(last, start));
    const href = escapeHtml(m[0]);
    out += `<a href="${href}" style="color:${accent};text-decoration:underline;word-break:break-all;">${href}</a>`;
    last = start + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/** Parágrafos separados por linhas em branco; as mudanças de linha simples mantêm-se. */
export function splitParagraphs(text: string): string[] {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/^\n+|\s+$/g, ''))
    .filter((p) => p.trim() !== '');
}

function button(label: string, url: string, accent: string): string {
  const l = escapeHtml(label);
  const u = escapeHtml(url);
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0;border-collapse:separate;">
<tr><td align="center" bgcolor="${accent}" style="border-radius:6px;background:${accent};">
<a href="${u}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${textOnAccent(accent)};text-decoration:none;border-radius:6px;">${l}</a>
</td></tr></table>`;
}

/** Email completo em HTML. Se uma linha do corpo for só o link pessoal, o botão aparece nesse sítio. */
export function buildEmailHtml(c: EmailContent): string {
  const accent = safeColor(c.accent);
  const logo = safeUrl(c.logoUrl);
  const cta = safeUrl(c.ctaUrl);
  const lang = escapeHtml(c.lang || 'pt');

  let placed = false;
  const blocks: string[] = [];
  for (const paragraph of splitParagraphs(c.bodyText)) {
    const lines = paragraph.split('\n');
    // Linha que é só o link: dá lugar ao botão (o resto do parágrafo mantém-se).
    const before: string[] = [];
    const flush = () => {
      if (before.length) {
        blocks.push(`<p style="margin:0 0 18px;font-family:${SERIF};font-size:17px;line-height:1.6;color:#1d2433;">${before.map((l) => inline(l, linkColor(accent))).join('<br>')}</p>`);
        before.length = 0;
      }
    };
    for (const line of lines) {
      if (cta && !placed && line.trim() === cta) {
        flush();
        blocks.push(button(c.ctaLabel, cta, accent));
        placed = true;
      } else {
        before.push(line);
      }
    }
    flush();
  }
  if (cta && !placed) blocks.push(button(c.ctaLabel, cta, accent));

  const footer = splitParagraphs(c.footer ?? '')
    .map((p) => `<p style="margin:0 0 8px;">${p.split('\n').map((l) => inline(l, '#475467')).join('<br>')}</p>`)
    .join('');

  const preheader = c.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(c.preheader)}</div>`
    : '';

  const header = logo
    ? `<tr><td style="padding:32px 48px 0;"><img src="${escapeHtml(logo)}" alt="" height="48" style="display:block;height:48px;width:auto;max-width:240px;border:0;"></td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.subject)}</title>
<!--[if mso]><style>table,td,p,a{font-family:Georgia,serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f2f3f6;-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f2f3f6" style="background:#f2f3f6;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e5ea;border-collapse:separate;border-radius:8px;">
<tr><td height="6" bgcolor="${accent}" style="height:6px;line-height:6px;font-size:0;background:${accent};border-radius:8px 8px 0 0;">&nbsp;</td></tr>
${header}
<tr><td style="padding:40px 48px 24px;">
${blocks.join('\n')}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
${footer ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:20px 24px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#667085;text-align:center;">${footer}</td></tr>
</table>` : ''}
</td></tr>
</table>
</body>
</html>`;
}

/** Versão em texto simples (melhora a entrega e serve leitores que não mostram HTML). */
export function buildEmailText(c: Pick<EmailContent, 'bodyText' | 'ctaLabel' | 'ctaUrl' | 'footer'>): string {
  const body = splitParagraphs(c.bodyText).join('\n\n');
  const parts = [body];
  if (c.ctaUrl && !body.includes(c.ctaUrl)) parts.push(`${c.ctaLabel}: ${c.ctaUrl}`);
  const footer = splitParagraphs(c.footer ?? '').join('\n\n');
  if (footer) parts.push(`--\n${footer}`);
  return parts.filter(Boolean).join('\n\n') + '\n';
}
