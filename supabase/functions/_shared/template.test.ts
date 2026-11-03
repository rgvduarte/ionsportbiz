import { describe, expect, it } from 'vitest';
import { buildTemplateVars, renderMessage, renderTemplate, tidyText, TEMPLATE_VARIABLES, unknownVariables, usesVariable, type TemplateContact, type TemplateEvent } from './template';

const event: TemplateEvent = {
  name: 'Encontro Anual 2027',
  host_name: 'O Conselho de Administração',
  invitation_text: 'tem a honra de convidar V. Exa. para o Encontro Anual.',
  // 18:30 em Lisboa (inverno, UTC+0)
  starts_at: '2027-01-15T18:30:00Z',
  timezone: 'Europe/Lisbon',
  venue_name: 'Palácio da Exemplo',
  venue_address: 'Rua das Janelas Verdes 1, 1200-000 Lisboa',
  rsvp_deadline: '2027-01-01T23:59:00Z',
};

const contact: TemplateContact = {
  salutation: 'Exma. Senhora',
  first_name: 'Helena',
  last_name: 'Marques Ferreira',
  organization: 'Instituto Aurora',
  language: 'pt',
};

const link = 'https://convites.exemplo.pt/c/abcdefghijklmnopqrstuv';

describe('buildTemplateVars', () => {
  it('preenche todas as variáveis declaradas', () => {
    const vars = buildTemplateVars({ event, contact, link });
    for (const v of TEMPLATE_VARIABLES) expect(vars).toHaveProperty(v.key);
    expect(vars).toMatchObject({
      tratamento: 'Exma. Senhora',
      nome: 'Helena',
      apelido: 'Marques Ferreira',
      nome_completo: 'Helena Marques Ferreira',
      entidade: 'Instituto Aurora',
      evento: 'Encontro Anual 2027',
      anfitriao: 'O Conselho de Administração',
      local: 'Palácio da Exemplo, Rua das Janelas Verdes 1, 1200-000 Lisboa',
      link,
    });
  });

  it('formata a data em português, no fuso do evento', () => {
    const vars = buildTemplateVars({ event, contact, link });
    expect(vars.data).toBe('sexta-feira, 15 de janeiro de 2027, às 18:30');
    expect(vars.hora).toBe('18:30');
    expect(vars.prazo).toBe('1 de janeiro de 2027');
  });

  it('respeita a hora de verão de Lisboa', () => {
    const vars = buildTemplateVars({ event: { ...event, starts_at: '2027-07-15T17:30:00Z' }, contact, link });
    expect(vars.hora).toBe('18:30');
  });

  it('usa o fuso do evento e não o do servidor', () => {
    const tokyo = buildTemplateVars({ event: { ...event, timezone: 'Asia/Tokyo' }, contact, link });
    expect(tokyo.hora).toBe('03:30');
    expect(tokyo.data).toBe('sábado, 16 de janeiro de 2027, às 03:30');
    // O prazo também muda de dia: 23:59 UTC já é dia 2 em Tóquio.
    expect(tokyo.prazo).toBe('2 de janeiro de 2027');
  });

  it('formata em inglês para contactos em inglês', () => {
    const vars = buildTemplateVars({ event, contact: { ...contact, language: 'en' }, link });
    expect(vars.data).toBe('Friday, 15 January 2027 at 18:30');
    expect(vars.prazo).toBe('1 January 2027');
  });

  it('deixa em branco o que não existe', () => {
    const vars = buildTemplateVars({
      event: { ...event, host_name: null, venue_address: null, rsvp_deadline: null },
      contact: { ...contact, salutation: null, last_name: null, organization: null },
      link,
    });
    expect(vars.tratamento).toBe('');
    expect(vars.apelido).toBe('');
    expect(vars.nome_completo).toBe('Helena');
    expect(vars.anfitriao).toBe('');
    expect(vars.local).toBe('Palácio da Exemplo');
    expect(vars.prazo).toBe('');
  });

  it('não falha com um fuso inválido', () => {
    const vars = buildTemplateVars({ event: { ...event, timezone: 'Lua/Mar_da_Tranquilidade' }, contact, link });
    expect(vars.hora).toBe('18:30');
  });
});

describe('renderTemplate', () => {
  const vars = buildTemplateVars({ event, contact, link });

  it('substitui as variáveis, com ou sem espaços', () => {
    expect(renderTemplate('{{tratamento}} {{ nome }},', vars)).toBe('Exma. Senhora Helena,');
    expect(renderTemplate('{{  evento\t}}', vars)).toBe('Encontro Anual 2027');
  });

  it('aceita maiúsculas no nome da variável', () => {
    expect(renderTemplate('{{Nome}}', vars)).toBe('Helena');
  });

  it('apaga variáveis desconhecidas e mantém o resto do texto', () => {
    expect(renderTemplate('Olá {{cargo}}!', vars)).toBe('Olá !');
    expect(renderTemplate('{ nome } e {{nome', vars)).toBe('{ nome } e {{nome');
  });

  it('substitui todas as ocorrências', () => {
    expect(renderTemplate('{{nome}} {{nome}}', vars)).toBe('Helena Helena');
  });

  it('não interpreta padrões especiais do replace nos valores', () => {
    expect(renderTemplate('{{nome}}', { nome: '$& $1' })).toBe('$& $1');
  });

  it('ignora propriedades herdadas do objeto', () => {
    expect(renderTemplate('[{{constructor}}][{{__proto__}}][{{toString}}][{{hasOwnProperty}}]', vars)).toBe('[][][][]');
    expect(renderMessage('{{constructor}} {{nome}}', vars)).toBe('Helena');
  });
});

describe('unknownVariables / usesVariable', () => {
  it('lista as variáveis que não existem', () => {
    expect(unknownVariables('{{nome}} {{cargo}} {{ cargo }} {{link}}')).toEqual(['cargo']);
    expect(unknownVariables('Sem variáveis')).toEqual([]);
  });

  it('deteta o uso de uma variável', () => {
    expect(usesVariable('Abra: {{ link }}', 'link')).toBe(true);
    expect(usesVariable('Abra o convite', 'link')).toBe(false);
  });
});

describe('tidyText / renderMessage', () => {
  it('arruma os espaços e as linhas deixados por variáveis vazias', () => {
    expect(tidyText('  Helena  Marques ,\r\n\n\n\nTexto  ')).toBe('Helena Marques,\n\nTexto');
  });

  it('não mexe em horas nem em links', () => {
    expect(tidyText('às 18:30 em https://x.pt/c/a_b-c')).toBe('às 18:30 em https://x.pt/c/a_b-c');
  });

  it('põe maiúscula na data quando abre uma linha', () => {
    const vars = buildTemplateVars({ event, contact, link });
    expect(renderMessage('{{evento}}\n{{data}}\n{{local}}', vars))
      .toBe('Encontro Anual 2027\nSexta-feira, 15 de janeiro de 2027, às 18:30\nPalácio da Exemplo, Rua das Janelas Verdes 1, 1200-000 Lisboa');
    expect(renderMessage('{{data}}', vars)).toBe('Sexta-feira, 15 de janeiro de 2027, às 18:30');
    expect(renderMessage('  {{ Data }} é o dia.', vars)).toBe('Sexta-feira, 15 de janeiro de 2027, às 18:30 é o dia.');
  });

  it('também quando o que vem antes na linha fica em branco', () => {
    const vars = buildTemplateVars({ event, contact: { ...contact, salutation: null }, link });
    expect(renderMessage('{{tratamento}} {{data}}', vars)).toBe('Sexta-feira, 15 de janeiro de 2027, às 18:30');
  });

  it('mantém a data em minúscula a meio da frase', () => {
    const vars = buildTemplateVars({ event, contact, link });
    expect(renderMessage('Realiza-se a {{data}}.', vars)).toBe('Realiza-se a sexta-feira, 15 de janeiro de 2027, às 18:30.');
    expect(renderMessage('Olá\nrealiza-se a {{data}}', vars)).toBe('Olá\nrealiza-se a sexta-feira, 15 de janeiro de 2027, às 18:30');
  });

  it('não altera o link nem outras variáveis no início da linha', () => {
    const vars = buildTemplateVars({ event, contact, link: 'https://convites.exemplo.pt/c/abcDEF' });
    expect(renderMessage('{{link}}\n{{hora}}', vars)).toBe('https://convites.exemplo.pt/c/abcDEF\n18:30');
    expect(renderMessage('{{texto_convite}}', vars)).toBe('tem a honra de convidar V. Exa. para o Encontro Anual.');
  });

  it('renderMessage substitui e arruma', () => {
    const vars = buildTemplateVars({ event, contact: { ...contact, salutation: null }, link });
    expect(renderMessage('{{tratamento}} {{nome_completo}},\n\n{{anfitriao}}', vars)).toBe('Helena Marques Ferreira,\n\nO Conselho de Administração');
  });
});
