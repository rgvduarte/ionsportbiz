// Pesquisa de contactos no PostgREST (lógica pura, testável sem Supabase).

/**
 * Palavras da pesquisa. Os caracteres que partem a sintaxe do PostgREST (vírgulas, dois pontos, parênteses, aspas)
 * ou das expressões regulares ([ ] \ ^ *) também separam palavras.
 */
export function searchWords(search: string | undefined): string[] {
  return (search ?? '').split(/[\s,()"*%:\\[\]^]+/).filter(Boolean).slice(0, 6);
}

// Letras com as variantes acentuadas, em minúsculas e maiúsculas (para não depender do locale da base de dados).
const ACCENTS: Record<string, string> = {
  a: 'aáàâãäAÁÀÂÃÄ', c: 'cçCÇ', e: 'eéèêëEÉÈÊË', i: 'iíìîïIÍÌÎÏ', n: 'nñNÑ',
  o: 'oóòôõöOÓÒÔÕÖ', u: 'uúùûüUÚÙÛÜ', y: 'yýÿYÝŸ',
};

/**
 * Expressão regular para `imatch` (~* no Postgres) que encontra a palavra com ou sem acentos:
 * "ines" e "Inês" encontram "Inês" e "Ines", como a pesquisa do modo demonstração.
 * Recebe uma palavra de `searchWords`; os outros metacaracteres ficam entre [ ], como literais.
 */
export function accentInsensitivePattern(word: string): string {
  const folded = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let out = '';
  for (const ch of folded) {
    if (ACCENTS[ch]) out += `[${ACCENTS[ch]}]`;
    else if (/[.+?{}|$]/.test(ch)) out += `[${ch}]`;
    else out += ch;
  }
  return out;
}
