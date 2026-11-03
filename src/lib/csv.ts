// Ficheiros CSV de contactos: leitura (importação) e escrita (exportação para o Excel em português).

import Papa from 'papaparse';
import type { Contact, ImportRow, Language } from './api/types';
import { formatPhone, isValidEmail, normalizeEmail, normalizePhone } from './phone';
import { formatDateTime } from './format';

// ───────── Leitura ─────────

export interface CsvRow {
  /** Linha do ficheiro onde o registo começa (a linha 1 é o cabeçalho). */
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  delimiter: string;
}

/**
 * Lê os bytes de um ficheiro. O Excel em português grava "CSV (separado por vírgulas)" em
 * Windows-1252; se o conteúdo não for UTF-8 válido, usa essa codificação.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Separador mais provável, contado na primeira linha (fora de aspas). */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

/** Lê um CSV com linha de cabeçalho. Separador automático (; , ou tabulação), ignora o BOM e as linhas vazias. */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);
  const records: { data: string[]; start: number }[] = [];
  let cursor = 0;
  Papa.parse<string[]>(clean, {
    delimiter,
    skipEmptyLines: false,
    step: (r) => {
      records.push({ data: r.data, start: cursor });
      cursor = r.meta.cursor;
    },
  });

  // Número da linha de cada registo (os campos entre aspas podem ocupar várias linhas).
  let pos = 0;
  let line = 1;
  const located = records.map((r) => {
    for (; pos < r.start; pos++) {
      const ch = clean[pos];
      if (ch === '\n' || (ch === '\r' && clean[pos + 1] !== '\n')) line++;
    }
    return { line, data: r.data };
  });

  const nonEmpty = located.filter((r) => r.data.some((v) => (v ?? '').trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [], delimiter };

  const [head, ...body] = nonEmpty;
  const seen = new Map<string, number>();
  const headers = head.data.map((h, i) => {
    const base = (h ?? '').trim() || `Coluna ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });

  const rows = body.map((r) => ({
    line: r.line,
    values: Object.fromEntries(headers.map((h, i) => [h, (r.data[i] ?? '').trim()])),
  }));
  return { headers, rows, delimiter };
}

// ───────── Correspondência de colunas ─────────

/** Campos de destino. "full_name" é dividido em nome e apelido. */
export type ImportField = keyof ImportRow | 'full_name';
export type ColumnMapping = Record<string, ImportField | ''>;

export const IMPORT_FIELDS: { value: ImportField; label: string }[] = [
  { value: 'salutation', label: 'Tratamento' },
  { value: 'first_name', label: 'Nome' },
  { value: 'last_name', label: 'Apelido' },
  { value: 'full_name', label: 'Nome completo (dividir)' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telemóvel' },
  { value: 'organization', label: 'Entidade' },
  { value: 'job_title', label: 'Cargo' },
  { value: 'segment', label: 'Segmento' },
  { value: 'tags', label: 'Etiquetas' },
  { value: 'language', label: 'Idioma' },
  { value: 'notes', label: 'Notas' },
];

/** Minúsculas, sem acentos nem pontuação: "E-mail" → "e mail", "Telemóvel" → "telemovel". */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SYNONYMS: Record<ImportField, string[]> = {
  first_name: ['nome', 'primeiro nome', 'nome proprio', 'first name', 'firstname', 'given name', 'forename'],
  last_name: ['apelido', 'apelidos', 'ultimo nome', 'sobrenome', 'last name', 'lastname', 'surname', 'family name'],
  full_name: ['nome completo', 'nome e apelido', 'full name', 'fullname', 'name', 'contact name'],
  email: ['email', 'e mail', 'mail', 'correio eletronico', 'correio electronico', 'endereco de email', 'endereco eletronico',
    'email address', 'e mail address'],
  phone: ['telemovel', 'telefone', 'telefone movel', 'tlm', 'tel', 'n telemovel', 'numero de telemovel', 'contacto telefonico',
    'mobile', 'mobile phone', 'phone', 'phone number', 'telephone', 'cell', 'celular'],
  organization: ['entidade', 'empresa', 'organizacao', 'instituicao', 'organization', 'organisation', 'company', 'company name'],
  job_title: ['cargo', 'funcao', 'posicao', 'job title', 'jobtitle', 'position', 'role'],
  segment: ['segmento', 'segment', 'categoria', 'category'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'tag', 'labels'],
  salutation: ['tratamento', 'titulo', 'salutation', 'title', 'prefixo', 'prefix'],
  language: ['idioma', 'lingua', 'language', 'lang'],
  notes: ['notas', 'nota', 'observacoes', 'observacao', 'obs', 'comentarios', 'notes', 'note', 'comments'],
};

const LOOKUP = new Map<string, ImportField>(
  (Object.entries(SYNONYMS) as [ImportField, string[]][]).flatMap(([field, names]) => names.map((n) => [n, field] as const)),
);

/** Sugere o campo de cada coluna pelo nome do cabeçalho. Cada campo só é usado uma vez. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const field = LOOKUP.get(normalizeHeader(h));
    if (field && !used.has(field)) {
      used.add(field);
      mapping[h] = field;
    } else {
      mapping[h] = '';
    }
  }
  // "Nome" e "Nome completo" ao mesmo tempo: o nome completo deixa de ser preciso.
  if (used.has('full_name') && used.has('first_name') && used.has('last_name')) {
    for (const h of headers) if (mapping[h] === 'full_name') mapping[h] = '';
  }
  return mapping;
}

// ───────── Conversão em linhas a importar ─────────

export interface MapIssue {
  /** Linha do ficheiro (a 1 é o cabeçalho). */
  row: number;
  message: string;
  /** error: a linha não é importada; warning: é importada sem o campo indicado. */
  severity: 'error' | 'warning';
}

export interface MappedRows {
  rows: ImportRow[];
  /** Linha do ficheiro de cada elemento de `rows` (para traduzir os erros devolvidos pelo servidor). */
  lines: number[];
  issues: MapIssue[];
}

const LANGUAGES: Record<string, Language> = {
  pt: 'pt', 'pt pt': 'pt', por: 'pt', portugues: 'pt', portuguese: 'pt',
  en: 'en', 'en gb': 'en', 'en us': 'en', eng: 'en', ingles: 'en', english: 'en',
};

export function parseLanguage(value: string): Language | null {
  return LANGUAGES[normalizeHeader(value)] ?? null;
}

export function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,;|]/).map((t) => t.trim()).filter(Boolean))];
}

/** "Ana Maria Costa" → Ana / Maria Costa; "Costa, Ana" → Ana / Costa. */
export function splitFullName(value: string): { first: string; last: string } {
  const text = value.trim().replace(/\s+/g, ' ');
  const comma = text.split(',');
  if (comma.length === 2 && comma[0].trim() && comma[1].trim()) {
    return { first: comma[1].trim(), last: comma[0].trim() };
  }
  const [first = '', ...rest] = text.split(' ');
  return { first, last: rest.join(' ') };
}

/**
 * Formas de tratamento femininas abreviadas à brasileira ou sem ponto ("Dra.", "Profa", "Engª")
 * passam à forma portuguesa ("Dr.ª", "Prof.ª", "Eng.ª"). As restantes ficam como estão (sem espaços à volta).
 */
export function normalizeSalutation(value: string): string {
  const text = value.trim();
  const m = /^(dr|sr|eng|prof|arq)\.?\s?[aª]\.?$/i.exec(text);
  return m ? `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()}.ª` : text;
}

/** Aplica a correspondência de colunas, normaliza e valida cada linha. */
export function mapRows(rows: CsvRow[], mapping: ColumnMapping): MappedRows {
  const out: MappedRows = { rows: [], lines: [], issues: [] };
  const columns = Object.entries(mapping).filter(([, f]) => f) as [string, ImportField][];
  const seen = new Map<string, number>();

  for (const { line, values } of rows) {
    const get = (field: ImportField) => {
      const col = columns.find(([, f]) => f === field)?.[0];
      return col ? (values[col] ?? '').trim() : '';
    };
    const issue = (message: string, severity: MapIssue['severity'] = 'warning') => out.issues.push({ row: line, message, severity });

    let first = get('first_name');
    let last = get('last_name');
    const full = get('full_name');
    if (full) {
      const split = splitFullName(full);
      if (!first) {
        first = split.first;
        last ||= split.last;
      } else if (!last) {
        last = full.startsWith(first) ? full.slice(first.length).trim() : split.last;
      }
    }
    first = first.replace(/\s+/g, ' ');
    last = last.replace(/\s+/g, ' ');
    if (!first) {
      issue('Falta o nome.', 'error');
      continue;
    }
    if (first.length > 120) {
      issue('O nome tem mais de 120 caracteres.', 'error');
      continue;
    }

    const rawEmail = get('email');
    const email = normalizeEmail(rawEmail);
    if (email && !isValidEmail(email)) {
      issue(`Email inválido: «${rawEmail}».`, 'error');
      continue;
    }

    const rawPhone = get('phone');
    let phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) {
      issue(`Telemóvel «${rawPhone}» não reconhecido; o contacto é importado sem telemóvel.`);
      phone = null;
    }

    const rawLanguage = get('language');
    let language: Language | undefined;
    if (rawLanguage) {
      language = parseLanguage(rawLanguage) ?? undefined;
      if (!language) issue(`Idioma «${rawLanguage}» não reconhecido; fica Português.`);
    }

    const key = email ? `e:${email}` : phone ? `p:${phone}` : null;
    if (key) {
      const previous = seen.get(key);
      if (previous) {
        issue(`${email ? 'Email' : 'Telemóvel'} repetido (linha ${previous}): os dados são combinados com essa linha.`);
      } else {
        seen.set(key, line);
      }
    }

    const row: ImportRow = { first_name: first };
    const optional: [keyof ImportRow, string | undefined][] = [
      ['last_name', last], ['salutation', normalizeSalutation(get('salutation'))], ['email', email ?? undefined], ['phone', phone ?? undefined],
      ['organization', get('organization')], ['job_title', get('job_title')], ['segment', get('segment')], ['notes', get('notes')],
    ];
    for (const [k, v] of optional) if (v) (row as unknown as Record<string, unknown>)[k] = v;
    const tags = splitTags(get('tags'));
    if (tags.length) row.tags = tags;
    if (language) row.language = language;

    out.rows.push(row);
    out.lines.push(line);
  }
  return out;
}

// ───────── Escrita ─────────

const NEEDS_QUOTES = /[;"\r\n]|^\s|\s$/;

/**
 * Protege contra fórmulas ao abrir no Excel (=, @, +, -). Os telefones ("+351 912 …") ficam
 * como estão: só dígitos e separadores não executam nada.
 */
function guardFormula(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`;
  if (/^[+-]/.test(value) && !/^[+-][\d\s().-]*$/.test(value)) return `'${value}`;
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = guardFormula(String(value));
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV para o Excel em português: BOM UTF-8, separador ";" e fim de linha CRLF. */
export function toCsv(table: (string | number | null | undefined)[][]): string {
  return '\uFEFF' + table.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export const CONTACT_CSV_HEADERS = [
  'Tratamento', 'Nome', 'Apelido', 'Email', 'Telemóvel', 'Entidade', 'Cargo', 'Segmento', 'Etiquetas', 'Idioma', 'Notas',
];

const LANGUAGE_LABEL: Record<Language, string> = { pt: 'Português', en: 'Inglês' };

/** Exportação de contactos. As colunas são as mesmas da importação, para o ficheiro poder ser reimportado. */
export function contactsToCsv(contacts: Contact[]): string {
  const header = [...CONTACT_CSV_HEADERS, 'Comunicações', 'Data do consentimento', 'Origem', 'Criado em'];
  return toCsv([
    header,
    ...contacts.map((c) => [
      c.salutation, c.first_name, c.last_name, c.email, formatPhone(c.phone), c.organization, c.job_title, c.segment,
      c.tags.join(', '), LANGUAGE_LABEL[c.language] ?? c.language, c.notes,
      c.anonymized_at ? 'Dados apagados' : c.marketing_consent ? 'Sim' : 'Não',
      formatDateTime(c.marketing_consent_at), c.source, formatDateTime(c.created_at),
    ]),
  ]);
}

/** Modelo para descarregar na página de importação. */
export function templateCsv(): string {
  return toCsv([
    CONTACT_CSV_HEADERS,
    ['Exmo. Senhor', 'João', 'Ferreira da Silva', 'joao.silva@exemplo.pt', '912 345 678', 'Fundação Exemplo',
      'Presidente do Conselho de Administração', 'Institucional', 'vip, orador', 'Português', 'Contactar através do secretariado.'],
    ['Dr.ª', 'Helena', 'Marques', 'helena.marques@exemplo.com', '+44 20 7946 0958', 'Atlântida Capital',
      'Diretora de Comunicação', 'Clientes', 'imprensa', 'Inglês', ''],
  ]);
}
