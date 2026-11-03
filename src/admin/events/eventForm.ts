// Lógica do formulário de evento (sem React): valores do formulário, validação e conversão para EventInput.

import type { EventInput, EventRecord, EventStatus, RsvpField } from '../../lib/api/types';
import { fromLocalInput, toLocalInput } from '../../lib/format';
import { fieldKey, isValidSlug, SLUG_MAX, slugify } from '../../lib/slug';

export const DEFAULT_TIMEZONE = 'Europe/Lisbon';
export const DEFAULT_ACCENT = '#ccff00';

export const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Europe/Lisbon', label: 'Lisboa — Portugal continental' },
  { value: 'Atlantic/Madeira', label: 'Funchal — Madeira' },
  { value: 'Atlantic/Azores', label: 'Ponta Delgada — Açores' },
  { value: 'Europe/London', label: 'Londres' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Brussels', label: 'Bruxelas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Africa/Luanda', label: 'Luanda' },
  { value: 'Africa/Maputo', label: 'Maputo' },
];

export const DRESS_CODES = ['Black tie', 'Traje de cerimónia', 'Traje formal', 'Business casual'];

export type RsvpFieldType = RsvpField['type'];

export const FIELD_TYPES: { value: RsvpFieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Escolha' },
  { value: 'checkbox', label: 'Sim ou não' },
];

/** Perguntas habituais, para acrescentar com um clique. */
export const FIELD_PRESETS: { label: string; type: RsvpFieldType }[] = [
  { label: 'Restrições alimentares', type: 'text' },
  { label: 'Necessidades de acessibilidade', type: 'textarea' },
  { label: 'Precisa de lugar de estacionamento?', type: 'checkbox' },
];

export interface FieldDraft {
  /** Só para a lista no ecrã. */
  uid: string;
  /** Chave gravada. As perguntas já existentes mantêm a chave, para não perder as respostas dadas. */
  key: string | null;
  label: string;
  type: RsvpFieldType;
  /** Uma opção por linha (tipo "Escolha"). */
  optionsText: string;
  required: boolean;
}

export interface EventFormValues {
  name: string;
  slug: string;
  /** true: o endereço curto acompanha o nome enquanto não for editado à mão. */
  slugAuto: boolean;
  host_name: string;
  invitation_text: string;
  description: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  rsvp_deadline: string;
  venue_name: string;
  venue_address: string;
  venue_maps_url: string;
  dress_code: string;
  contact_email: string;
  contact_phone: string;
  capacity: string;
  default_plus_ones: string;
  fields: FieldDraft[];
  accent: string;
  logo_url: string;
  /** Fundo da página do convidado. */
  theme: 'light' | 'dark';
  privacy_controller: string;
  privacy_policy_url: string;
  marketing_consent_text: string;
  /** true: quem confirma fica por aprovar até a equipa escolher o tipo de acesso. */
  requires_approval: boolean;
  status: EventStatus;
}

export type FormErrors = Record<string, string>;

let draftSeq = 0;
export const newDraftUid = () => `f${++draftSeq}`;

export function newFieldDraft(label = '', type: RsvpFieldType = 'text'): FieldDraft {
  return { uid: newDraftUid(), key: null, label, type, optionsText: '', required: false };
}

export function toFormValues(event?: EventRecord | null): EventFormValues {
  const tz = event?.timezone || DEFAULT_TIMEZONE;
  return {
    name: event?.name ?? '',
    slug: event?.slug ?? '',
    slugAuto: !event,
    host_name: event?.host_name ?? '',
    invitation_text: event?.invitation_text ?? '',
    description: event?.description ?? '',
    starts_at: toLocalInput(event?.starts_at, tz),
    ends_at: toLocalInput(event?.ends_at, tz),
    timezone: tz,
    rsvp_deadline: toLocalInput(event?.rsvp_deadline, tz),
    venue_name: event?.venue_name ?? '',
    venue_address: event?.venue_address ?? '',
    venue_maps_url: event?.venue_maps_url ?? '',
    dress_code: event?.dress_code ?? '',
    contact_email: event?.contact_email ?? '',
    contact_phone: event?.contact_phone ?? '',
    capacity: event?.capacity ? String(event.capacity) : '',
    default_plus_ones: String(event?.default_plus_ones ?? 0),
    fields: (event?.rsvp_fields ?? []).map((f) => ({
      uid: newDraftUid(),
      key: f.key,
      label: f.label,
      type: f.type,
      optionsText: (f.options ?? []).join('\n'),
      required: !!f.required,
    })),
    accent: event?.branding?.accent || DEFAULT_ACCENT,
    logo_url: event?.branding?.logo_url ?? '',
    theme: event?.branding?.theme === 'dark' ? 'dark' : 'light',
    privacy_controller: event?.privacy_controller ?? '',
    privacy_policy_url: event?.privacy_policy_url ?? '',
    marketing_consent_text: event?.marketing_consent_text ?? '',
    requires_approval: event?.requires_approval ?? true,
    status: event?.status ?? 'draft',
  };
}

/** Aplica uma alteração ao nome, mantendo o endereço curto automático em sintonia. */
export function withName(values: EventFormValues, name: string): EventFormValues {
  return { ...values, name, slug: values.slugAuto ? slugify(name) : values.slug };
}

/** Chave de cada pergunta: as existentes mantêm-se; as novas derivam do texto, sem repetir. */
export function resolveFieldKeys(fields: FieldDraft[]): string[] {
  const taken = new Set(fields.filter((f) => f.key).map((f) => f.key!));
  return fields.map((f) => {
    if (f.key) return f.key;
    const key = fieldKey(f.label, taken);
    taken.add(key);
    return key;
  });
}

export function parseOptions(text: string): string[] {
  return [...new Set(text.split('\n').map((o) => o.trim()).filter(Boolean))];
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEX = /^#[0-9a-f]{6}$/i;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname.includes('.');
  } catch {
    return false;
  }
}

export const isHexColor = (v: string) => HEX.test(v);

function time(local: string, tz: string): number | null {
  const iso = local ? fromLocalInput(local, tz) : null;
  return iso ? new Date(iso).getTime() : null;
}

/** Erros por campo (chaves = nomes dos campos; perguntas: "field:<uid>:label" e "field:<uid>:options"). */
export function validateEvent(v: EventFormValues): FormErrors {
  const e: FormErrors = {};
  const name = v.name.trim();
  if (!name) e.name = 'Indique o nome do evento.';
  else if (name.length > 160) e.name = 'O nome pode ter no máximo 160 caracteres.';

  if (!v.slug) e.slug = 'Indique o endereço curto.';
  else if (v.slug.length > SLUG_MAX) e.slug = `O endereço curto pode ter no máximo ${SLUG_MAX} caracteres.`;
  else if (!isValidSlug(v.slug)) e.slug = 'Use só letras minúsculas, números e hífenes simples (sem hífenes no início ou no fim).';

  const start = time(v.starts_at, v.timezone);
  const end = time(v.ends_at, v.timezone);
  const deadline = time(v.rsvp_deadline, v.timezone);
  if (start === null) e.starts_at = 'Indique a data e a hora de início.';
  if (v.ends_at && end === null) e.ends_at = 'Data inválida.';
  else if (start !== null && end !== null && end < start) e.ends_at = 'O fim não pode ser anterior ao início.';
  if (v.rsvp_deadline && deadline === null) e.rsvp_deadline = 'Data inválida.';
  else if (start !== null && deadline !== null && deadline > start) e.rsvp_deadline = 'O prazo de resposta tem de terminar até ao início do evento.';

  if (v.capacity.trim()) {
    const n = Number(v.capacity);
    if (!Number.isInteger(n) || n <= 0) e.capacity = 'Indique um número inteiro maior do que zero, ou deixe vazio para não limitar.';
  }
  const plus = Number(v.default_plus_ones);
  if (v.default_plus_ones === '' || !Number.isInteger(plus) || plus < 0 || plus > 10) e.default_plus_ones = 'Indique um número entre 0 e 10.';

  if (v.contact_email.trim() && !EMAIL.test(v.contact_email.trim())) e.contact_email = 'Email inválido.';
  for (const k of ['venue_maps_url', 'logo_url', 'privacy_policy_url'] as const) {
    if (v[k].trim() && !isHttpUrl(v[k].trim())) e[k] = 'Indique um endereço completo, a começar por https://';
  }
  if (!isHexColor(v.accent)) e.accent = 'Use o formato #RRGGBB, por exemplo #CCFF00.';

  for (const f of v.fields) {
    if (!f.label.trim()) e[`field:${f.uid}:label`] = 'Escreva a pergunta.';
    else if (f.label.trim().length > 200) e[`field:${f.uid}:label`] = 'A pergunta pode ter no máximo 200 caracteres.';
    if (f.type === 'select' && parseOptions(f.optionsText).length < 2) e[`field:${f.uid}:options`] = 'Indique pelo menos duas opções, uma por linha.';
  }

  if (v.status === 'open' && !v.privacy_controller.trim()) {
    e.privacy_controller = 'Obrigatório para abrir o evento aos convidados.';
    e.status = 'Para abrir o evento, indique primeiro o responsável pelo tratamento dos dados (secção Privacidade).';
  }
  return e;
}

const orNull = (s: string) => s.trim() || null;

export function toEventInput(v: EventFormValues, base?: EventRecord | null): EventInput {
  const keys = resolveFieldKeys(v.fields);
  const branding: Record<string, unknown> = { ...(base?.branding ?? {}) };
  branding.accent = v.accent.toLowerCase();
  if (v.logo_url.trim()) branding.logo_url = v.logo_url.trim();
  else delete branding.logo_url;
  if (v.theme === 'dark') branding.theme = 'dark';
  else delete branding.theme;
  return {
    slug: v.slug,
    name: v.name.trim(),
    host_name: orNull(v.host_name),
    invitation_text: orNull(v.invitation_text),
    description: orNull(v.description),
    starts_at: fromLocalInput(v.starts_at, v.timezone)!,
    ends_at: v.ends_at ? fromLocalInput(v.ends_at, v.timezone) : null,
    timezone: v.timezone,
    venue_name: orNull(v.venue_name),
    venue_address: orNull(v.venue_address),
    venue_maps_url: orNull(v.venue_maps_url),
    dress_code: orNull(v.dress_code),
    contact_email: orNull(v.contact_email)?.toLowerCase() ?? null,
    contact_phone: orNull(v.contact_phone),
    rsvp_deadline: v.rsvp_deadline ? fromLocalInput(v.rsvp_deadline, v.timezone) : null,
    capacity: v.capacity.trim() ? Number(v.capacity) : null,
    default_plus_ones: Number(v.default_plus_ones),
    status: v.status,
    rsvp_fields: v.fields.map((f, i) => {
      const field: RsvpField = { key: keys[i], label: f.label.trim(), type: f.type };
      if (f.type === 'select') field.options = parseOptions(f.optionsText);
      if (f.required) field.required = true;
      return field;
    }),
    branding,
    privacy_controller: orNull(v.privacy_controller),
    privacy_policy_url: orNull(v.privacy_policy_url),
    marketing_consent_text: orNull(v.marketing_consent_text),
    requires_approval: v.requires_approval,
  };
}

/** Link de pesquisa no Google Maps para o local indicado. */
export function mapsSearchUrl(venueName: string, address: string): string {
  const query = [venueName.trim(), address.trim()].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** "Fundação Exemplo, Avenida da Liberdade 100, Lisboa" → "Fundação Exemplo". */
export function entityName(controller: string): string {
  return controller.split(/[,;\n]/)[0].trim();
}

export function suggestConsentText(controller: string): string {
  const who = entityName(controller);
  return who
    ? `Aceito receber de ${who} convites para futuros eventos e outras comunicações institucionais. Posso retirar este consentimento a qualquer momento.`
    : 'Aceito receber convites para futuros eventos e outras comunicações institucionais. Posso retirar este consentimento a qualquer momento.';
}

/** Frase formal do convite: "O Conselho de Administração … tem a honra de convidar V. Exa. para …". */
export function invitationSentence(host: string, text: string): string {
  return [host.trim(), text.trim()].filter(Boolean).join(' ');
}

/** Contraste (WCAG) entre texto branco e a cor de destaque. */
export function contrastWithWhite(hex: string): number {
  if (!isHexColor(hex)) return 21;
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (lum + 0.05);
}

/** Diferença em dias de calendário entre duas datas locais do formulário ("AAAA-MM-DDTHH:MM"). */
export function daysBetween(fromLocal: string, toLocal: string): number | null {
  const a = Date.parse(fromLocal.slice(0, 10));
  const b = Date.parse(toLocal.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 864e5);
}

/** "Europe/Lisbon" → "Lisboa" (para "hora de Lisboa"). */
export function timezoneCity(tz: string): string {
  const known = TIMEZONES.find((t) => t.value === tz);
  return known ? known.label.split(' — ')[0] : tz.split('/').pop()!.replace(/_/g, ' ');
}

/**
 * Definições reutilizáveis de outro evento (local, contacto, perguntas, imagem, privacidade, aprovação).
 * Não copia o nome, o endereço curto, as datas, os textos próprios do evento nem o estado.
 */
export function copyableValues(source: EventRecord): Partial<EventFormValues> {
  const v = toFormValues(source);
  return {
    host_name: v.host_name,
    timezone: v.timezone,
    venue_name: v.venue_name,
    venue_address: v.venue_address,
    venue_maps_url: v.venue_maps_url,
    dress_code: v.dress_code,
    contact_email: v.contact_email,
    contact_phone: v.contact_phone,
    capacity: v.capacity,
    default_plus_ones: v.default_plus_ones,
    // Num evento novo ainda não há respostas: as chaves voltam a ser geradas a partir do texto.
    fields: v.fields.map((f) => ({ ...f, key: null })),
    accent: v.accent,
    logo_url: v.logo_url,
    theme: v.theme,
    privacy_controller: v.privacy_controller,
    privacy_policy_url: v.privacy_policy_url,
    marketing_consent_text: v.marketing_consent_text,
    requires_approval: v.requires_approval,
  };
}
