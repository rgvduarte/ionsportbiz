import { describe, expect, it } from 'vitest';
import type { Contact } from './api/types';
import {
  contactsToCsv, decodeCsv, detectDelimiter, mapRows, normalizeHeader, normalizeSalutation, parseCsv, splitFullName, splitTags,
  suggestMapping, templateCsv, toCsv,
} from './csv';

describe('parseCsv', () => {
  it('lê separador ";" com BOM e CRLF', () => {
    const csv = parseCsv('\uFEFFNome;Email\r\nAna;ana@exemplo.pt\r\nRui;rui@exemplo.pt\r\n');
    expect(csv.delimiter).toBe(';');
    expect(csv.headers).toEqual(['Nome', 'Email']);
    expect(csv.rows).toEqual([
      { line: 2, values: { Nome: 'Ana', Email: 'ana@exemplo.pt' } },
      { line: 3, values: { Nome: 'Rui', Email: 'rui@exemplo.pt' } },
    ]);
  });

  it('lê separador "," e campos entre aspas com separadores, aspas e mudanças de linha', () => {
    const csv = parseCsv('nome,notas,email\n"Costa, Ana","Disse ""sim""\nà tarde",ana@exemplo.pt\nRui,,rui@exemplo.pt');
    expect(csv.delimiter).toBe(',');
    expect(csv.rows[0]).toEqual({ line: 2, values: { nome: 'Costa, Ana', notas: 'Disse "sim"\nà tarde', email: 'ana@exemplo.pt' } });
    // O registo anterior ocupa duas linhas.
    expect(csv.rows[1].line).toBe(4);
  });

  it('ignora linhas vazias mas mantém a numeração do ficheiro', () => {
    const csv = parseCsv('Nome;Email\n\nAna;a@exemplo.pt\n;\n\nRui;r@exemplo.pt\n\n');
    expect(csv.rows.map((r) => [r.line, r.values.Nome])).toEqual([[3, 'Ana'], [6, 'Rui']]);
  });

  it('dá nome às colunas sem cabeçalho e distingue cabeçalhos repetidos', () => {
    const csv = parseCsv('Nome;;Email;Email\nAna;x;a@exemplo.pt;b@exemplo.pt');
    expect(csv.headers).toEqual(['Nome', 'Coluna 2', 'Email', 'Email (2)']);
    expect(csv.rows[0].values['Email (2)']).toBe('b@exemplo.pt');
  });

  it('completa linhas curtas e corta espaços', () => {
    const csv = parseCsv('Nome;Apelido;Email\n  Ana  ;Costa');
    expect(csv.rows[0].values).toEqual({ Nome: 'Ana', Apelido: 'Costa', Email: '' });
  });

  it('aceita tabulação e ficheiros vazios', () => {
    expect(parseCsv('Nome\tEmail\nAna\ta@exemplo.pt').rows[0].values.Email).toBe('a@exemplo.pt');
    expect(parseCsv('')).toEqual({ headers: [], rows: [], delimiter: ',' });
    expect(parseCsv('\uFEFF\n\n').rows).toEqual([]);
  });
});

describe('detectDelimiter', () => {
  it('ignora separadores dentro de aspas', () => {
    expect(detectDelimiter('"a;b;c",d,e\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b\n1,2,3,4')).toBe(';');
  });
});

describe('decodeCsv', () => {
  it('lê UTF-8 e recorre a Windows-1252 quando não é UTF-8', () => {
    expect(decodeCsv(new TextEncoder().encode('Telemóvel;Ação'))).toBe('Telemóvel;Ação');
    // "Telemóvel" em Windows-1252: ó = 0xF3
    const latin = new Uint8Array([0x54, 0x65, 0x6c, 0x65, 0x6d, 0xf3, 0x76, 0x65, 0x6c]);
    expect(decodeCsv(latin)).toBe('Telemóvel');
  });
});

describe('suggestMapping', () => {
  it('reconhece sinónimos em português e inglês, sem acentos nem maiúsculas', () => {
    expect(normalizeHeader('  E-mail ')).toBe('e mail');
    expect(normalizeHeader('Telemóvel')).toBe('telemovel');
    const m = suggestMapping(['Tratamento', 'Primeiro Nome', 'Último nome', 'E-mail', 'Telemóvel', 'Organização', 'Função',
      'Segmento', 'Etiquetas', 'Língua', 'Observações', 'Outra coisa']);
    expect(m).toEqual({
      Tratamento: 'salutation', 'Primeiro Nome': 'first_name', 'Último nome': 'last_name', 'E-mail': 'email', 'Telemóvel': 'phone',
      'Organização': 'organization', 'Função': 'job_title', Segmento: 'segment', Etiquetas: 'tags', 'Língua': 'language',
      'Observações': 'notes', 'Outra coisa': '',
    });
  });

  it('reconhece cabeçalhos em inglês', () => {
    expect(suggestMapping(['First Name', 'Last Name', 'Email Address', 'Mobile', 'Company', 'Job Title', 'Title', 'Language', 'Notes', 'Tags']))
      .toEqual({
        'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email', Mobile: 'phone', Company: 'organization',
        'Job Title': 'job_title', Title: 'salutation', Language: 'language', Notes: 'notes', Tags: 'tags',
      });
  });

  it('usa cada campo uma só vez e reconhece o nome completo', () => {
    expect(suggestMapping(['Nome completo', 'Email', 'Correio eletrónico', 'Telefone', 'Telemóvel'])).toEqual({
      'Nome completo': 'full_name', Email: 'email', 'Correio eletrónico': '', Telefone: 'phone', 'Telemóvel': '',
    });
  });

  it('dispensa o nome completo quando há nome e apelido', () => {
    expect(suggestMapping(['Nome', 'Apelido', 'Full name'])).toEqual({ Nome: 'first_name', Apelido: 'last_name', 'Full name': '' });
  });
});

describe('mapRows', () => {
  const rows = (...values: Record<string, string>[]) => values.map((v, i) => ({ line: i + 2, values: v }));

  it('normaliza email, telefone, etiquetas e idioma', () => {
    const r = mapRows(
      rows({ N: ' Ana ', A: 'Costa', E: ' Ana@Exemplo.PT ', T: '912 345 678', G: 'vip; orador, vip', L: 'Inglês', X: 'ignorado' }),
      { N: 'first_name', A: 'last_name', E: 'email', T: 'phone', G: 'tags', L: 'language', X: '' },
    );
    expect(r.issues).toEqual([]);
    expect(r.rows).toEqual([{
      first_name: 'Ana', last_name: 'Costa', email: 'ana@exemplo.pt', phone: '+351912345678', tags: ['vip', 'orador'], language: 'en',
    }]);
    expect(r.lines).toEqual([2]);
  });

  it('omite campos vazios', () => {
    const r = mapRows(rows({ N: 'Rui', E: '', O: '' }), { N: 'first_name', E: 'email', O: 'organization' });
    expect(r.rows).toEqual([{ first_name: 'Rui' }]);
  });

  it('divide o nome completo', () => {
    const r = mapRows(rows({ F: 'Ana Maria  Costa' }, { F: 'Costa, Rui' }, { F: 'Madonna' }), { F: 'full_name' });
    expect(r.rows).toEqual([
      { first_name: 'Ana', last_name: 'Maria Costa' },
      { first_name: 'Rui', last_name: 'Costa' },
      { first_name: 'Madonna' },
    ]);
  });

  it('o nome e o apelido explícitos têm prioridade sobre o nome completo', () => {
    const map = { N: 'first_name', F: 'full_name' } as const;
    expect(mapRows(rows({ N: 'Ana', F: 'Ana Costa' }), map).rows).toEqual([{ first_name: 'Ana', last_name: 'Costa' }]);
    expect(mapRows(rows({ N: '', F: 'Rui Lopes' }), map).rows).toEqual([{ first_name: 'Rui', last_name: 'Lopes' }]);
  });

  it('exclui linhas sem nome ou com email inválido e indica a linha do ficheiro', () => {
    const r = mapRows(
      rows({ N: '', E: 'a@exemplo.pt' }, { N: 'Rui', E: 'rui@' }, { N: 'Eva', E: 'eva@exemplo.pt' }),
      { N: 'first_name', E: 'email' },
    );
    expect(r.rows).toEqual([{ first_name: 'Eva', email: 'eva@exemplo.pt' }]);
    expect(r.lines).toEqual([4]);
    expect(r.issues).toEqual([
      { row: 2, message: 'Falta o nome.', severity: 'error' },
      { row: 3, message: 'Email inválido: «rui@».', severity: 'error' },
    ]);
  });

  it('importa sem telefone quando não o reconhece e avisa', () => {
    const r = mapRows(rows({ N: 'Ana', T: '123' }), { N: 'first_name', T: 'phone' });
    expect(r.rows).toEqual([{ first_name: 'Ana' }]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ row: 2, severity: 'warning' });
  });

  it('avisa sobre idiomas desconhecidos e emails repetidos no ficheiro', () => {
    const r = mapRows(
      rows({ N: 'Ana', E: 'ana@exemplo.pt', L: 'klingon' }, { N: 'Ana', E: 'ANA@exemplo.pt', L: 'pt' }),
      { N: 'first_name', E: 'email', L: 'language' },
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].language).toBeUndefined();
    expect(r.rows[1].language).toBe('pt');
    expect(r.issues.map((i) => [i.row, i.severity])).toEqual([[2, 'warning'], [3, 'warning']]);
    expect(r.issues[1].message).toContain('linha 2');
  });

  it('recusa nomes com mais de 120 caracteres', () => {
    const r = mapRows(rows({ N: 'x'.repeat(121) }), { N: 'first_name' });
    expect(r.rows).toEqual([]);
    expect(r.issues[0].severity).toBe('error');
  });
});

describe('utilitários', () => {
  it('normalizeSalutation usa as formas portuguesas', () => {
    for (const v of ['Dra.', 'Dra', 'DRA.', 'Dr.a', 'Drª', ' Dr.ª ']) expect(normalizeSalutation(v)).toBe('Dr.ª');
    expect(normalizeSalutation('Profa.')).toBe('Prof.ª');
    expect(normalizeSalutation('Engª')).toBe('Eng.ª');
    expect(normalizeSalutation('Sra.')).toBe('Sr.ª');
    expect(normalizeSalutation('Arqa')).toBe('Arq.ª');
    for (const v of ['Dr.', 'Exma. Senhora', 'Embaixadora', '']) expect(normalizeSalutation(v)).toBe(v);
    expect(mapRows([{ line: 2, values: { T: 'Dra.', N: 'Ana' } }], { T: 'salutation', N: 'first_name' }).rows)
      .toEqual([{ salutation: 'Dr.ª', first_name: 'Ana' }]);
  });

  it('splitTags e splitFullName', () => {
    expect(splitTags(' vip , orador|vip;;')).toEqual(['vip', 'orador']);
    expect(splitFullName('  Ana   Costa ')).toEqual({ first: 'Ana', last: 'Costa' });
  });
});

describe('escrita', () => {
  it('usa BOM, ";" e CRLF e coloca aspas quando é preciso', () => {
    expect(toCsv([['a', 'b;c', 'd"e', 'f\ng', null, 3]])).toBe('\uFEFFa;"b;c";"d""e";"f\ng";;3\r\n');
  });

  it('neutraliza fórmulas mas mantém telefones', () => {
    expect(toCsv([['=SUM(A1)', '@x', '+351 912 345 678', '-5', '+cmd|x']])).toBe("\uFEFF'=SUM(A1);'@x;+351 912 345 678;-5;'+cmd|x\r\n");
  });

  const contact: Contact = {
    id: '1', salutation: 'Dr.ª', first_name: 'Ana', last_name: 'Costa', email: 'ana@exemplo.pt', phone: '+351912345678',
    organization: 'Fundação; Exemplo', job_title: null, segment: 'Clientes', tags: ['vip', 'orador'], language: 'pt', notes: null,
    owner_id: null, source: 'manual', marketing_consent: true, marketing_consent_at: '2026-10-01T09:30:00Z',
    marketing_consent_text: 'Aceito.', anonymized_at: null, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  };

  it('exporta contactos com colunas que se podem reimportar', () => {
    const text = contactsToCsv([contact]);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe('Tratamento;Nome;Apelido;Email;Telemóvel;Entidade;Cargo;Segmento;Etiquetas;Idioma;Notas;Comunicações;Data do consentimento;Origem;Criado em');
    expect(lines[1]).toBe('Dr.ª;Ana;Costa;ana@exemplo.pt;+351 912 345 678;"Fundação; Exemplo";;Clientes;vip, orador;Português;;Sim;01/10/2026, 10:30;manual;01/09/2026, 11:00');

    const parsed = parseCsv(text);
    const mapped = mapRows(parsed.rows, suggestMapping(parsed.headers));
    expect(mapped.issues).toEqual([]);
    expect(mapped.rows[0]).toEqual({
      salutation: 'Dr.ª', first_name: 'Ana', last_name: 'Costa', email: 'ana@exemplo.pt', phone: '+351912345678',
      organization: 'Fundação; Exemplo', segment: 'Clientes', tags: ['vip', 'orador'], language: 'pt',
    });
  });

  it('o modelo é válido', () => {
    const parsed = parseCsv(templateCsv());
    const mapped = mapRows(parsed.rows, suggestMapping(parsed.headers));
    expect(mapped.issues).toEqual([]);
    expect(mapped.rows).toHaveLength(2);
    expect(mapped.rows[1]).toMatchObject({ phone: '+442079460958', language: 'en' });
  });
});
