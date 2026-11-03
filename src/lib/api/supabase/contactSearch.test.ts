import { describe, expect, it } from 'vitest';
import { accentInsensitivePattern, searchWords } from './contactSearch';

/** Simula o ~* do Postgres para as letras usadas aqui (as expressões geradas só usam [ ] e literais). */
const imatch = (value: string, pattern: string) => new RegExp(pattern, 'i').test(value);

describe('searchWords', () => {
  it('separa por espaços e pelos caracteres reservados do PostgREST', () => {
    expect(searchWords('  Ana   Costa ')).toEqual(['Ana', 'Costa']);
    expect(searchWords('silva,(lda)"x"')).toEqual(['silva', 'lda', 'x']);
    expect(searchWords('a:b c*d e%f g\\h [i] ^j')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(searchWords(undefined)).toEqual([]);
  });

  it('mantém emails e telefones inteiros', () => {
    expect(searchWords('ana.costa@exemplo.pt +351 912')).toEqual(['ana.costa@exemplo.pt', '+351', '912']);
  });
});

describe('accentInsensitivePattern', () => {
  it('encontra com ou sem acentos, nos dois sentidos', () => {
    expect(imatch('Inês', accentInsensitivePattern('ines'))).toBe(true);
    expect(imatch('Ines', accentInsensitivePattern('Inês'))).toBe(true);
    expect(imatch('INÊS', accentInsensitivePattern('ines'))).toBe(true);
    expect(imatch('João Conceição', accentInsensitivePattern('conceicao'))).toBe(true);
    expect(imatch('Muñoz', accentInsensitivePattern('munoz'))).toBe(true);
    expect(imatch('Inês', accentInsensitivePattern('inas'))).toBe(false);
  });

  it('trata os metacaracteres como literais', () => {
    const email = accentInsensitivePattern('ana.costa@exemplo.pt');
    expect(imatch('ana.costa@exemplo.pt', email)).toBe(true);
    expect(imatch('anaXcosta@exemplo.pt', email)).toBe(false);
    expect(imatch('+351912345678', accentInsensitivePattern('+351'))).toBe(true);
    expect(accentInsensitivePattern('a+b?c$')).toBe('[aáàâãäAÁÀÂÃÄ][+]b[?][cçCÇ][$]');
  });

  it('não produz caracteres que partem o .or() do PostgREST', () => {
    for (const word of searchWords('Ana, (Costa) "x" a:b ana.costa@ex.pt +351')) {
      expect(accentInsensitivePattern(word)).not.toMatch(/[,():"\\]/);
    }
  });
});
