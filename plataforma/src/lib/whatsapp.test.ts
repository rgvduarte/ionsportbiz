import { describe, expect, it } from 'vitest';
import { whatsappUrl } from './whatsapp';

describe('whatsappUrl', () => {
  it('usa só os dígitos do número', () => {
    expect(whatsappUrl('+351 912 345 678', '')).toBe('https://wa.me/351912345678');
  });

  it('codifica o texto, incluindo acentos, mudanças de linha e o link', () => {
    const url = whatsappUrl('+351912345678', 'Exma. Senhora,\nConvite & programa: https://x.pt/c/a?b=1');
    expect(url).toBe('https://wa.me/351912345678?text=Exma.%20Senhora%2C%0AConvite%20%26%20programa%3A%20https%3A%2F%2Fx.pt%2Fc%2Fa%3Fb%3D1');
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Exma. Senhora,\nConvite & programa: https://x.pt/c/a?b=1');
  });

  it('mantém caracteres portugueses', () => {
    const url = whatsappUrl('+351912345678', 'Confirmação');
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Confirmação');
  });
});
