import { describe, expect, it } from 'vitest';
import { fieldKey, isValidSlug, slugify, SLUG_MAX } from './slug';

describe('slugify', () => {
  it('remove acentos e pontuação', () => {
    expect(slugify('Encontro Anual 2027 — Lisboa')).toBe('encontro-anual-2027-lisboa');
    expect(slugify('Conferência de Primavera: Inovação & Ação')).toBe('conferencia-de-primavera-inovacao-e-acao');
    expect(slugify('  Jantar   de  Gala!! ')).toBe('jantar-de-gala');
    expect(slugify('Straße Øresund Æble')).toBe('strasse-oresund-aeble');
  });

  it('devolve texto vazio quando não há letras nem números', () => {
    expect(slugify('— !! —')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('limita a 60 caracteres sem cortar palavras', () => {
    const s = slugify('Cerimónia de entrega dos Prémios Horizonte de Inovação Social e Ambiental 2027');
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s).toBe('cerimonia-de-entrega-dos-premios-horizonte-de-inovacao');
    expect(isValidSlug(s)).toBe(true);
  });

  it('corta uma única palavra demasiado longa', () => {
    expect(slugify('a'.repeat(80))).toBe('a'.repeat(60));
  });

  it('produz sempre endereços válidos', () => {
    for (const t of ['Évora — 2.ª edição', 'Gala 2027/2028', '---x---', 'Ciclo «Diálogos»']) {
      const s = slugify(t);
      expect(isValidSlug(s)).toBe(true);
    }
  });
});

describe('isValidSlug', () => {
  it('aceita e rejeita conforme a regra da base de dados', () => {
    expect(isValidSlug('encontro-anual-2027')).toBe(true);
    expect(isValidSlug('Encontro')).toBe(false);
    expect(isValidSlug('encontro--anual')).toBe(false);
    expect(isValidSlug('-encontro')).toBe(false);
    expect(isValidSlug('encontro-')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(61))).toBe(false);
  });
});

describe('fieldKey', () => {
  it('usa underscores e evita repetidos', () => {
    expect(fieldKey('Restrições alimentares')).toBe('restricoes_alimentares');
    expect(fieldKey('Restrições alimentares', ['restricoes_alimentares'])).toBe('restricoes_alimentares_2');
    expect(fieldKey('Restrições alimentares', ['restricoes_alimentares', 'restricoes_alimentares_2'])).toBe('restricoes_alimentares_3');
  });

  it('tem um valor por omissão', () => {
    expect(fieldKey('')).toBe('campo');
    expect(fieldKey('?', ['campo'])).toBe('campo_2');
  });
});
