// Tipos de acesso (sem React): valores do formulário, validação, sugestões e conversão para PassTypeInput.

import type { PassType, PassTypeInput } from '../../lib/api/types';
import { isHexColor } from './eventForm';

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const ACCESS_MAX = 120;

/** Cores sugeridas: as da marca ion e alguns tons que se distinguem bem sobre fundo escuro. */
export const PASS_COLORS = ['#ccff00', '#e27a2c', '#ea4d3b', '#7aa7ff', '#b38cff', '#4ade80', '#f4f4f4'];

/** Os dois tipos habituais do ion, para criar com um clique. */
export const SUGGESTED_PASS_TYPES: Omit<PassTypeInput, 'event_id' | 'sort'>[] = [
  {
    name: 'VIP Pass',
    description: 'Acesso a todo o programa, incluindo o jantar de gala e o almoço VIP.',
    accesses: ['VIP Gala Dinner', 'Cerimónia dos ion Awards', 'ion Conference', 'VIP Lunch'],
    color: '#ccff00',
  },
  {
    name: 'Conference Pass',
    description: 'Acesso à ion Conference.',
    accesses: ['ion Conference'],
    color: '#e27a2c',
  },
];

/** Acessos frequentes, propostos ao editar (além dos já usados noutros tipos do evento). */
export const COMMON_ACCESSES = ['VIP Gala Dinner', 'Cerimónia dos ion Awards', 'ion Conference', 'VIP Lunch', 'Zona de networking'];

export interface PassTypeFormValues {
  name: string;
  description: string;
  accesses: string[];
  /** #rrggbb ou vazio (sem cor). */
  color: string;
  sort: string;
}

/** Ordem para um tipo novo: a seguir ao último. */
export function nextSort(types: Pick<PassType, 'sort'>[]): number {
  return types.length ? Math.max(...types.map((t) => t.sort)) + 1 : 0;
}

/** Cor ainda não usada pelos outros tipos do evento (para os distinguir à primeira vista). */
export function unusedColor(types: Pick<PassType, 'color'>[]): string {
  const used = new Set(types.map((t) => t.color?.toLowerCase()));
  return PASS_COLORS.find((c) => !used.has(c)) ?? PASS_COLORS[0];
}

export function toPassTypeForm(p: PassType | null, others: PassType[] = []): PassTypeFormValues {
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    accesses: p ? [...p.accesses] : [],
    color: p ? p.color ?? '' : unusedColor(others),
    sort: String(p?.sort ?? nextSort(others)),
  };
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Sem espaços a mais, sem vazios e sem repetidos (ignora maiúsculas e acentos). */
export function cleanAccesses(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const a = raw.replace(/\s+/g, ' ').trim();
    if (!a || seen.has(fold(a))) continue;
    seen.add(fold(a));
    out.push(a);
  }
  return out;
}

/** Texto colado com vários acessos (um por linha, ou separados por ";") → lista. */
export function splitAccesses(text: string): string[] {
  return cleanAccesses(text.split(/\r?\n|;/));
}

/** Acessos já usados noutros tipos e os habituais, que ainda não estão na lista. */
export function accessSuggestions(types: Pick<PassType, 'accesses'>[], current: string[]): string[] {
  const have = new Set(current.map(fold));
  return cleanAccesses([...types.flatMap((t) => t.accesses), ...COMMON_ACCESSES]).filter((a) => !have.has(fold(a)));
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export type PassTypeErrors = Partial<Record<'name' | 'description' | 'accesses' | 'color' | 'sort', string>>;

/** `others`: os restantes tipos do evento (o nome não se pode repetir). */
export function validatePassType(v: PassTypeFormValues, others: Pick<PassType, 'name'>[]): PassTypeErrors {
  const e: PassTypeErrors = {};
  const name = v.name.trim();
  if (!name) e.name = 'Indique o nome do tipo de acesso.';
  else if (name.length > NAME_MAX) e.name = `O nome pode ter no máximo ${NAME_MAX} caracteres.`;
  else if (others.some((o) => fold(o.name) === fold(name))) e.name = 'Já existe um tipo de acesso com este nome neste evento.';
  if (v.description.trim().length > DESCRIPTION_MAX) e.description = `A descrição pode ter no máximo ${DESCRIPTION_MAX} caracteres.`;
  if (v.accesses.some((a) => a.trim().length > ACCESS_MAX)) e.accesses = `Cada acesso pode ter no máximo ${ACCESS_MAX} caracteres.`;
  if (v.color && !isHexColor(v.color)) e.color = 'Use o formato #RRGGBB, por exemplo #CCFF00.';
  const sort = Number(v.sort);
  if (v.sort.trim() === '' || !Number.isInteger(sort) || sort < 0 || sort > 999) e.sort = 'Indique um número inteiro entre 0 e 999.';
  return e;
}

export function toPassTypeInput(v: PassTypeFormValues, eventId: string, id?: string): PassTypeInput {
  return {
    ...(id ? { id } : {}),
    event_id: eventId,
    name: v.name.trim(),
    description: v.description.trim() || null,
    accesses: cleanAccesses(v.accesses),
    color: v.color ? v.color.toLowerCase() : null,
    sort: Number(v.sort),
  };
}
