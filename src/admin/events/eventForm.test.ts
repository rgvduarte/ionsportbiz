import { describe, expect, it } from 'vitest';
import type { EventRecord } from '../../lib/api/types';
import {
  contrastWithWhite, copyableValues, daysBetween, mapsSearchUrl, newFieldDraft, resolveFieldKeys, suggestConsentText,
  toEventInput, toFormValues, validateEvent, withName,
} from './eventForm';

const EVENT: EventRecord = {
  id: 'e1',
  slug: 'encontro-anual-2027',
  name: 'Encontro Anual 2027',
  host_name: 'O Conselho de Administração',
  invitation_text: 'tem a honra de convidar V. Exa. para o Encontro Anual.',
  description: null,
  starts_at: '2027-07-15T17:30:00.000Z', // 18:30 em Lisboa (verão)
  ends_at: '2027-07-15T22:00:00.000Z',
  timezone: 'Europe/Lisbon',
  venue_name: 'Palácio',
  venue_address: 'Rua das Janelas Verdes 1, Lisboa',
  venue_maps_url: null,
  dress_code: 'Black tie',
  contact_email: 'eventos@exemplo.pt',
  contact_phone: null,
  rsvp_deadline: '2027-07-01T22:59:00.000Z',
  capacity: 120,
  default_plus_ones: 1,
  status: 'open',
  rsvp_fields: [{ key: 'dieta', label: 'Restrições alimentares', type: 'text' }],
  branding: { accent: '#13294b', extra: 'x' } as EventRecord['branding'],
  privacy_controller: 'Fundação Exemplo, Avenida da Liberdade 100',
  privacy_policy_url: 'https://exemplo.pt/privacidade',
  marketing_consent_text: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('toFormValues / toEventInput', () => {
  it('converte as datas para o fuso do evento e volta sem perdas', () => {
    const v = toFormValues(EVENT);
    expect(v.starts_at).toBe('2027-07-15T18:30');
    expect(v.rsvp_deadline).toBe('2027-07-01T23:59');
    const input = toEventInput(v, EVENT);
    expect(input.starts_at).toBe(EVENT.starts_at);
    expect(input.ends_at).toBe(EVENT.ends_at);
    expect(input.rsvp_deadline).toBe(EVENT.rsvp_deadline);
    expect(input.rsvp_fields).toEqual(EVENT.rsvp_fields);
    expect(input.branding).toEqual({ accent: '#13294b', extra: 'x' });
    expect(input.capacity).toBe(120);
    expect(input.description).toBeNull();
  });

  it('mantém a hora de parede quando muda o fuso', () => {
    const v = { ...toFormValues(EVENT), timezone: 'Atlantic/Azores' };
    expect(toEventInput(v).starts_at).toBe('2027-07-15T18:30:00.000Z');
  });

  it('valores por omissão de um evento novo', () => {
    const v = toFormValues(null);
    expect(v.status).toBe('draft');
    expect(v.timezone).toBe('Europe/Lisbon');
    expect(v.slugAuto).toBe(true);
    expect(withName(v, 'Gala de Natal 2027').slug).toBe('gala-de-natal-2027');
    expect(withName({ ...v, slugAuto: false, slug: 'manual' }, 'Outro').slug).toBe('manual');
  });
});

describe('resolveFieldKeys', () => {
  it('mantém as chaves existentes e gera novas sem repetir', () => {
    const v = toFormValues(EVENT);
    const a = newFieldDraft('Restrições alimentares');
    const b = newFieldDraft('Dieta');
    const c = newFieldDraft('');
    expect(resolveFieldKeys([...v.fields, a, b, c])).toEqual(['dieta', 'restricoes_alimentares', 'dieta_2', 'campo']);
  });
});

describe('validateEvent', () => {
  it('aceita um evento completo', () => {
    expect(validateEvent(toFormValues(EVENT))).toEqual({});
  });

  it('assinala datas incoerentes', () => {
    const v = toFormValues(EVENT);
    const e = validateEvent({ ...v, ends_at: '2027-07-15T18:00', rsvp_deadline: '2027-07-16T10:00' });
    expect(e.ends_at).toBeTruthy();
    expect(e.rsvp_deadline).toBeTruthy();
    expect(validateEvent({ ...v, starts_at: '' }).starts_at).toBeTruthy();
    // Fim igual ao início é permitido.
    expect(validateEvent({ ...v, ends_at: v.starts_at }).ends_at).toBeUndefined();
  });

  it('exige o responsável pelo tratamento para abrir', () => {
    const v = { ...toFormValues(EVENT), privacy_controller: ' ' };
    const e = validateEvent(v);
    expect(e.status).toBeTruthy();
    expect(e.privacy_controller).toBeTruthy();
    expect(validateEvent({ ...v, status: 'draft' })).toEqual({});
  });

  it('valida endereço curto, lotação, acompanhantes, URLs e cor', () => {
    const v = toFormValues(EVENT);
    expect(validateEvent({ ...v, slug: 'Com Espaço' }).slug).toBeTruthy();
    expect(validateEvent({ ...v, capacity: '0' }).capacity).toBeTruthy();
    expect(validateEvent({ ...v, capacity: '12.5' }).capacity).toBeTruthy();
    expect(validateEvent({ ...v, capacity: '' }).capacity).toBeUndefined();
    expect(validateEvent({ ...v, default_plus_ones: '11' }).default_plus_ones).toBeTruthy();
    expect(validateEvent({ ...v, logo_url: 'logo.png' }).logo_url).toBeTruthy();
    expect(validateEvent({ ...v, accent: '#13294' }).accent).toBeTruthy();
    expect(validateEvent({ ...v, contact_email: 'eventos@' }).contact_email).toBeTruthy();
  });

  it('valida as perguntas do formulário', () => {
    const v = toFormValues(EVENT);
    const empty = newFieldDraft('');
    const select = { ...newFieldDraft('Menu', 'select'), optionsText: 'Carne\n\n Carne ' };
    const e = validateEvent({ ...v, fields: [empty, select] });
    expect(e[`field:${empty.uid}:label`]).toBeTruthy();
    expect(e[`field:${select.uid}:options`]).toBeTruthy();
    const ok = { ...select, optionsText: 'Carne\nPeixe\nVegetariano' };
    expect(validateEvent({ ...v, fields: [ok] })).toEqual({});
    expect(toEventInput({ ...v, fields: [ok] }).rsvp_fields).toEqual([{ key: 'menu', label: 'Menu', type: 'select', options: ['Carne', 'Peixe', 'Vegetariano'] }]);
  });
});

describe('utilitários', () => {
  it('link do Google Maps', () => {
    expect(mapsSearchUrl('Palácio', 'Rua das Janelas Verdes 1, Lisboa'))
      .toBe('https://www.google.com/maps/search/?api=1&query=Pal%C3%A1cio%2C%20Rua%20das%20Janelas%20Verdes%201%2C%20Lisboa');
  });

  it('texto de consentimento sugerido usa o nome da entidade', () => {
    expect(suggestConsentText('Fundação Exemplo, Avenida da Liberdade 100')).toContain('de Fundação Exemplo convites');
  });

  it('contraste com branco', () => {
    expect(contrastWithWhite('#13294b')).toBeGreaterThan(10);
    expect(contrastWithWhite('#f5d76e')).toBeLessThan(3);
  });

  it('dias entre datas', () => {
    expect(daysBetween('2027-07-01T23:59', '2027-07-15T18:30')).toBe(14);
    expect(daysBetween('2027-07-15T08:00', '2027-07-15T23:30')).toBe(0);
    expect(daysBetween('2027-07-15T23:00', '2027-07-16T01:00')).toBe(1);
    expect(daysBetween('', '2027-07-15T18:30')).toBeNull();
  });
});

describe('copyableValues', () => {
  it('copia definições, mas não nome, datas, texto nem estado', () => {
    const c = copyableValues(EVENT);
    expect(c.venue_name).toBe('Palácio');
    expect(c.privacy_controller).toBe(EVENT.privacy_controller);
    expect(c.fields?.[0]).toMatchObject({ key: null, label: 'Restrições alimentares' });
    for (const k of ['name', 'slug', 'starts_at', 'ends_at', 'rsvp_deadline', 'invitation_text', 'description', 'status']) {
      expect(k in c).toBe(false);
    }
  });
});
