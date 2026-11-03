// Modelos de mensagem (email e WhatsApp): variáveis {{nome}}, {{evento}}, {{link}}, …
// Código partilhado entre a app (Vite, via '@shared/template') e as funções Deno: só TypeScript
// e APIs standard (Intl), sem nada específico de Node ou Deno.

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

/** Variáveis disponíveis nos modelos, pela ordem em que aparecem no editor. */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  { key: 'tratamento', label: 'Tratamento', example: 'Exma. Senhora' },
  { key: 'nome', label: 'Nome', example: 'Helena' },
  { key: 'apelido', label: 'Apelido', example: 'Marques Ferreira' },
  { key: 'nome_completo', label: 'Nome completo', example: 'Helena Marques Ferreira' },
  { key: 'entidade', label: 'Entidade', example: 'Instituto Aurora' },
  { key: 'evento', label: 'Evento', example: 'Encontro Anual 2027' },
  { key: 'anfitriao', label: 'Anfitrião', example: 'O Conselho de Administração' },
  { key: 'texto_convite', label: 'Texto do convite', example: 'tem a honra de convidar V. Exa. para o Encontro Anual.' },
  { key: 'data', label: 'Data e hora', example: 'sexta-feira, 15 de janeiro de 2027, às 18:30' },
  { key: 'hora', label: 'Hora', example: '18:30' },
  { key: 'local', label: 'Local', example: 'Palácio do Exemplo, Rua das Janelas Verdes 1, Lisboa' },
  { key: 'prazo', label: 'Prazo de resposta', example: '1 de janeiro de 2027' },
  { key: 'link', label: 'Link pessoal', example: 'https://ionsportbiz.app/c/…' },
];

const KNOWN_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

/** O que é preciso do evento (EventRecord serve). */
export interface TemplateEvent {
  name: string;
  host_name: string | null;
  invitation_text: string | null;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_deadline: string | null;
}

/** O que é preciso do convidado (Contact ou InvitationRow servem). */
export interface TemplateContact {
  salutation: string | null;
  first_name: string;
  last_name: string | null;
  organization: string | null;
  language: string;
}

export type TemplateVars = Record<string, string>;

function format(iso: string | null | undefined, timeZone: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(date);
  } catch {
    // Fuso desconhecido: usa o de Lisboa em vez de falhar o envio.
    return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Lisbon', ...opts }).format(date);
  }
}

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Valores das variáveis para um convidado. Datas no fuso do evento, em português ou inglês conforme o idioma do contacto. */
export function buildTemplateVars({ event, contact, link }: { event: TemplateEvent; contact: TemplateContact; link: string }): TemplateVars {
  const en = contact.language === 'en';
  const locale = en ? 'en-GB' : 'pt-PT';
  const tz = event.timezone || 'Europe/Lisbon';
  const day = format(event.starts_at, tz, locale, LONG_DATE);
  const time = format(event.starts_at, tz, locale, TIME);
  const trim = (s: string | null | undefined) => (s ?? '').trim();
  return {
    tratamento: trim(contact.salutation),
    nome: trim(contact.first_name),
    apelido: trim(contact.last_name),
    nome_completo: [contact.first_name, contact.last_name].map(trim).filter(Boolean).join(' '),
    entidade: trim(contact.organization),
    evento: trim(event.name),
    anfitriao: trim(event.host_name),
    texto_convite: trim(event.invitation_text),
    data: day && time ? (en ? `${day} at ${time}` : `${day}, às ${time}`) : day,
    hora: time,
    local: [event.venue_name, event.venue_address].map(trim).filter(Boolean).join(', '),
    prazo: format(event.rsvp_deadline, tz, locale, DATE),
    link,
  };
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Valor de uma variável. Só chaves próprias: {{constructor}} ou {{__proto__}} ficam em branco. */
function valueOf(vars: TemplateVars, key: string): string {
  const k = key.toLowerCase();
  return Object.hasOwn(vars, k) ? String(vars[k] ?? '') : '';
}

/** Substitui {{ variavel }} pelo valor. Variáveis desconhecidas ou vazias ficam em branco. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return (text ?? '').replace(PLACEHOLDER, (_m, key: string) => valueOf(vars, key));
}

/**
 * Variáveis cujo valor começa por minúscula ("sexta-feira, 15 de janeiro…"): no início de uma linha
 * levam maiúscula. A meio da frase ("a {{data}}") ficam como estão. O {{link}} nunca é alterado.
 */
const CAPITALIZE_AT_LINE_START = new Set(['data']);

/**
 * Arruma o texto depois de substituir as variáveis vazias: espaços repetidos ou no início e fim
 * das linhas, espaço antes de pontuação ("Exmo. Senhor ," → "Exmo. Senhor,") e linhas em branco a mais.
 */
export function tidyText(text: string): string {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:])/g, '$1').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** renderTemplate seguido de tidyText: o texto final de uma mensagem. */
export function renderMessage(text: string, vars: TemplateVars): string {
  const source = text ?? '';
  const rendered = source.replace(PLACEHOLDER, (_m, key: string, offset: number) => {
    const value = valueOf(vars, key);
    if (!value || !CAPITALIZE_AT_LINE_START.has(key.toLowerCase())) return value;
    // Início de linha: antes só há espaços ou variáveis que ficam em branco.
    const before = source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset);
    if (renderTemplate(before, vars).trim()) return value;
    return value.charAt(0).toLocaleUpperCase('pt-PT') + value.slice(1);
  });
  return tidyText(rendered);
}

/** Variáveis usadas no texto que não existem (para avisar no editor). */
export function unknownVariables(text: string): string[] {
  const out = new Set<string>();
  for (const m of (text ?? '').matchAll(PLACEHOLDER)) {
    const key = m[1].toLowerCase();
    if (!KNOWN_KEYS.has(key)) out.add(m[1]);
  }
  return [...out];
}

/** true se o texto usa a variável (ex.: para avisar quando falta o {{link}}). */
export function usesVariable(text: string, key: string): boolean {
  for (const m of (text ?? '').matchAll(PLACEHOLDER)) {
    if (m[1].toLowerCase() === key) return true;
  }
  return false;
}
