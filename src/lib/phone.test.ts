import { describe, expect, it } from 'vitest';
import { formatPhone, isValidEmail, normalizeEmail, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('aceita números portugueses sem indicativo', () => {
    expect(normalizePhone('912 345 678')).toBe('+351912345678');
    expect(normalizePhone('912345678')).toBe('+351912345678');
    expect(normalizePhone('21 000 0000')).toBe('+351210000000');
  });

  it('aceita o prefixo internacional 00 e o indicativo com +', () => {
    expect(normalizePhone('00351 912 345 678')).toBe('+351912345678');
    expect(normalizePhone('+351 912 345 678')).toBe('+351912345678');
    expect(normalizePhone('(+351) 912-345-678')).toBe('+351912345678');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671');
  });

  it('usa o país por omissão indicado', () => {
    expect(normalizePhone('020 7946 0958', 'GB')).toBe('+442079460958');
  });

  it('aceita o prefixo tel:', () => {
    expect(normalizePhone('tel:+351912345678')).toBe('+351912345678');
  });

  it('recusa valores vazios, curtos ou com texto', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+3519')).toBeNull();
    expect(normalizePhone('sem telefone')).toBeNull();
    expect(normalizePhone('912 345 678 ext. 3')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formata em formato internacional', () => {
    expect(formatPhone('+351912345678')).toBe('+351 912 345 678');
    expect(formatPhone('+442079460958')).toBe('+44 20 7946 0958');
  });

  it('devolve vazio sem número e o original se não o reconhecer', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
    expect(formatPhone('abc')).toBe('abc');
  });
});

describe('emails', () => {
  it('valida como a base de dados', () => {
    expect(isValidEmail('ana.costa@exemplo.pt')).toBe(true);
    expect(isValidEmail('  ana@exemplo.pt ')).toBe(true);
    expect(isValidEmail('ana@exemplo')).toBe(false);
    expect(isValidEmail('ana exemplo.pt')).toBe(false);
    expect(isValidEmail('ana@@exemplo.pt')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('normaliza para minúsculas sem espaços', () => {
    expect(normalizeEmail('  Ana.Costa@Exemplo.PT ')).toBe('ana.costa@exemplo.pt');
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});
