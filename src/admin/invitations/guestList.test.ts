import { describe, expect, it } from 'vitest';
import type { InvitationRow } from '../../lib/api';
import { renderMessage, buildTemplateVars } from '@shared/template';
import {
  attendanceCsv, attendanceFileName, capacityExcess, countByStatus, defaultTemplates, filterRows, headcount, matchesSearch, NO_WAVE,
  personalMessage, recipients, runBulk, whatsappBody,
} from './guestList';

let n = 0;
function row(p: Partial<InvitationRow>): InvitationRow {
  n++;
  return {
    id: `id-${n}`, event_id: 'e', contact_id: `c-${n}`, token: 'abcdefghijklmnopqrstuv', checkin_code: 'ABCDEFGHJK',
    status: 'draft', wave: null, plus_ones_allowed: 0, invited_by: null, sent_at: null, sent_channel: null,
    first_opened_at: null, last_opened_at: null, open_count: 0, responded_at: null, answers: {}, guest_note: null,
    checked_in_at: null, checked_in_by: null, created_at: '', updated_at: '',
    salutation: null, first_name: 'Ana', last_name: 'Costa', email: 'ana@exemplo.pt', phone: null, organization: null,
    job_title: null, segment: null, tags: [], language: 'pt', marketing_consent: false, companions_count: 0, companions_checked_in: 0,
    ...p,
  };
}

const rows = [
  row({ first_name: 'Inês', last_name: 'Gonçalves', organization: 'Instituto Aurora', wave: 'VIP', status: 'accepted', companions_count: 1, plus_ones_allowed: 1, checked_in_at: '2027-01-15T18:40:00Z', companions_checked_in: 1 }),
  row({ first_name: 'Rui', last_name: 'Matos', wave: 'VIP', status: 'sent', phone: '+351912345678' }),
  row({ first_name: 'Sofia', last_name: 'Reis', status: 'draft', email: null }),
  row({ first_name: 'Pedro', last_name: 'Lopes', status: 'draft', wave: '1.ª vaga' }),
  row({ first_name: 'Teresa', last_name: 'Pinto', status: 'cancelled', wave: 'VIP' }),
];

describe('pesquisa e filtros', () => {
  it('ignora acentos e maiúsculas, procura em várias colunas e no telemóvel', () => {
    expect(matchesSearch(rows[0], 'ines goncalves')).toBe(true);
    expect(matchesSearch(rows[0], 'AURORA')).toBe(true);
    expect(matchesSearch(rows[1], '912 345')).toBe(true);
    expect(matchesSearch(rows[1], 'aurora')).toBe(false);
  });

  it('"Todos" exclui os cancelados; filtra por vaga e "sem vaga"', () => {
    expect(filterRows(rows, { status: 'all', wave: '', search: '' })).toHaveLength(4);
    expect(filterRows(rows, { status: 'cancelled', wave: '', search: '' })).toHaveLength(1);
    expect(filterRows(rows, { status: 'all', wave: 'VIP', search: '' }).map((r) => r.first_name)).toEqual(['Inês', 'Rui']);
    expect(filterRows(rows, { status: 'all', wave: NO_WAVE, search: '' }).map((r) => r.first_name)).toEqual(['Sofia']);
  });

  it('conta cada estado com a vaga e a pesquisa atuais', () => {
    const all = countByStatus(rows, { wave: '', search: '' });
    expect(all).toMatchObject({ all: 4, draft: 2, sent: 1, opened: 0, accepted: 1, declined: 0, cancelled: 1 });
    expect(countByStatus(rows, { wave: 'VIP', search: '' })).toMatchObject({ all: 2, cancelled: 1, draft: 0 });
  });

  it('conta pessoas esperadas e entradas com acompanhantes', () => {
    expect(headcount(rows)).toEqual({ invited: 4, accepted: 1, expected: 2, checkedIn: 2 });
  });
});

describe('recipients', () => {
  it('sem seleção: todos os que estão por enviar', () => {
    const r = recipients(rows, null);
    expect(r.targets.map((x) => x.first_name)).toEqual(['Sofia', 'Pedro']);
    expect(r.withEmail.map((x) => x.first_name)).toEqual(['Pedro']);
    expect(r.withoutEmail.map((x) => x.first_name)).toEqual(['Sofia']);
    expect(r.resend).toBe(0);
  });

  it('com seleção: exclui cancelados e conta os reenvios', () => {
    const r = recipients(rows, new Set([rows[0].id, rows[1].id, rows[4].id]));
    expect(r.targets).toHaveLength(2);
    expect(r.resend).toBe(2);
  });
});

describe('attendanceCsv', () => {
  it('gera o CSV para o Excel com BOM, ";" e as colunas da lista de presenças', () => {
    const csv = attendanceCsv(rows.slice(0, 2), { timezone: 'Europe/Lisbon' });
    expect(csv.startsWith('﻿Convidado;Entidade;Cargo;Estado;Acompanhantes;Vaga;Entrada\r\n')).toBe(true);
    expect(csv).toContain('Inês Gonçalves;Instituto Aurora;;Confirmado;1 de 1;VIP;15/01/2027, 18:40\r\n');
    expect(csv).toContain('Rui Matos;;;Enviado;;VIP;\r\n');
  });

  it('nome do ficheiro com o evento e a data', () => {
    expect(attendanceFileName({ slug: 'gala' }, new Date(2027, 0, 5))).toBe('convidados-gala-2027-01-05.csv');
  });
});

describe('modelos sugeridos', () => {
  const event = {
    name: 'Encontro Anual', host_name: 'O Conselho de Administração', invitation_text: 'tem a honra de convidar V. Exa. para o Encontro Anual.',
    starts_at: '2027-01-15T18:30:00Z', timezone: 'Europe/Lisbon', venue_name: 'Palácio', venue_address: null, rsvp_deadline: null,
  };

  it('adapta a primeira frase e o prazo aos dados do evento', () => {
    const [email, whatsapp] = defaultTemplates(event);
    expect(email).toMatchObject({ channel: 'email', name: 'Convite formal', subject: 'Convite — {{evento}}' });
    expect(email.body).toContain('{{anfitriao}} {{texto_convite}}');
    expect(email.body).toContain('{{link}}');
    expect(email.body).not.toContain('{{prazo}}');
    expect(whatsapp.channel).toBe('whatsapp');
    const withDeadline = defaultTemplates({ ...event, host_name: null, rsvp_deadline: '2027-01-01T00:00:00Z' });
    expect(withDeadline[0].body).toContain('Temos a honra de convidar V. Exa. para {{evento}}.');
    expect(withDeadline[0].body).toContain('presença até {{prazo}}, através');
  });

  it('a mensagem final não deixa espaços nem linhas vazias soltas', () => {
    const text = personalMessage(defaultTemplates(event)[1].body, event, { ...rows[0], salutation: null }, 'https://x.pt/c/abc');
    expect(text.startsWith('Inês Gonçalves,\n\nO Conselho de Administração tem a honra')).toBe(true);
    expect(text).not.toMatch(/\n{3,}/);
    expect(text).toContain('https://x.pt/c/abc');
    expect(text).toBe(renderMessage(defaultTemplates(event)[1].body, buildTemplateVars({ event, contact: { ...rows[0], salutation: null }, link: 'https://x.pt/c/abc' })));
  });

  it('usa o primeiro modelo de WhatsApp do evento, se existir', () => {
    const own = { id: 't', event_id: 'e', channel: 'whatsapp' as const, name: 'X', subject: null, body: 'Olá {{nome}}', created_at: '', updated_at: '' };
    expect(whatsappBody([own], event)).toBe('Olá {{nome}}');
    expect(whatsappBody([], event)).toBe(defaultTemplates(event)[1].body);
  });
});

describe('runBulk', () => {
  it('corre tudo, respeita o limite e guarda o primeiro erro', async () => {
    let running = 0;
    let peak = 0;
    const result = await runBulk([1, 2, 3, 4, 5, 6, 7], async (x) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (x % 3 === 0) throw new Error(`falhou ${x}`);
    }, 3);
    expect(result.ok).toBe(5);
    expect(result.failed).toBe(2);
    expect((result.error as Error).message).toBe('falhou 3');
    expect(peak).toBe(3);
  });
});

describe('capacityExcess', () => {
  it('avisa quando a confirmação ultrapassa a lotação', () => {
    expect(capacityExcess(28, 28, 1)).toEqual({ capacity: 28, total: 29 });
    expect(capacityExcess(26, 28, 3)).toEqual({ capacity: 28, total: 29 });
  });

  it('não avisa quando ainda cabe ou sem lotação definida', () => {
    expect(capacityExcess(27, 28, 1)).toBeNull();
    expect(capacityExcess(500, null, 3)).toBeNull();
  });
});
