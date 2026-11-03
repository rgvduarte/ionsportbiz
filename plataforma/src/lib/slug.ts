// Identificadores legíveis a partir de texto livre (endereço curto do evento, chaves dos campos do formulário).

export const SLUG_MAX = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Letras que a decomposição Unicode (NFD) não separa do acento.
const SPECIAL: Record<string, string> = { æ: 'ae', œ: 'oe', ø: 'o', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th' };

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/&/g, ' e ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[æœøßłđðþ]/g, (c) => SPECIAL[c] ?? '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Junta palavras até `max` caracteres, sem cortar a meio de uma palavra (exceto se for a primeira). */
function join(parts: string[], sep: string, max: number): string {
  let out = '';
  for (const w of parts) {
    const next = out ? `${out}${sep}${w}` : w;
    if (next.length > max) return out || w.slice(0, max);
    out = next;
  }
  return out;
}

/** "Encontro Anual 2027 — Lisboa" → "encontro-anual-2027-lisboa" (minúsculas, sem acentos, até 60 caracteres). */
export function slugify(text: string, max = SLUG_MAX): string {
  return join(words(text), '-', max);
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);
}

/**
 * Chave de um campo do formulário de resposta: "Restrições alimentares" → "restricoes_alimentares".
 * Evita as chaves já usadas acrescentando _2, _3, …
 */
export function fieldKey(label: string, taken: Iterable<string> = [], max = 40): string {
  const used = new Set(taken);
  const base = join(words(label), '_', max) || 'campo';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, max - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
