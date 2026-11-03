// Telefones e emails dos contactos. Os telefones guardam-se em E.164 (+351912345678),
// que é o formato exigido pela base de dados e pelo WhatsApp.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Converte o que o utilizador escreveu para E.164, ou null se não for um número válido.
 * Aceita números nacionais ("912 345 678"), com indicativo ("+44 20 7946 0958") ou com
 * prefixo internacional ("00351 912 345 678").
 */
export function normalizePhone(input: string | null | undefined, defaultCountry: CountryCode = 'PT'): string | null {
  const text = (input ?? '').trim();
  if (!text || !/\d/.test(text)) return null;
  // Letras indicam texto livre ("ext. 3", "ligar depois das 18h"): melhor recusar do que adivinhar.
  if (/\p{L}/u.test(text.replace(/^tel[:.]?\s*/i, ''))) return null;
  const parsed = parsePhoneNumberFromString(text, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** Formato internacional para mostrar: "+351 912 345 678". Se não reconhecer, devolve o original. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mesma regra da base de dados (contacts.email). */
export function isValidEmail(input: string | null | undefined): boolean {
  return EMAIL.test((input ?? '').trim());
}

/** Email sem espaços e em minúsculas; null se estiver vazio. */
export function normalizeEmail(input: string | null | undefined): string | null {
  const text = (input ?? '').trim().toLowerCase();
  return text || null;
}
