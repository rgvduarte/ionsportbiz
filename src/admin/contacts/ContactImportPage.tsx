import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload, Users,
} from 'lucide-react';
import { api, errorMessage, type EventRecord, type ImportResult } from '../../lib/api';
import {
  IMPORT_FIELDS, mapRows, parseCsv, suggestMapping, templateCsv, decodeCsv, type ColumnMapping, type ImportField, type ParsedCsv,
} from '../../lib/csv';
import { formatNumber, fullName } from '../../lib/format';
import { formatPhone } from '../../lib/phone';
import { useAsync } from '../../lib/useAsync';
import {
  Alert, Badge, Button, ButtonLink, Card, Checkbox, Field, Input, PageHeader, Select, Skeleton, useToast,
} from '../../ui';
import { eventOptionLabel, invitableEvents } from './InviteToEventDialog';
import { downloadFile, languageLabel } from './shared';
import './contacts.css';

const MAX_ROWS = 5000;
const MAX_BYTES = 10 * 1024 * 1024;
const ISSUE_LIMIT = 200;

type Step = 'file' | 'map' | 'options' | 'done';

const STEPS: { key: Exclude<Step, 'done'>; title: string; hint: string }[] = [
  { key: 'file', title: 'Ficheiro', hint: 'Escolher o CSV' },
  { key: 'map', title: 'Colunas', hint: 'Corresponder e verificar' },
  { key: 'options', title: 'Importação', hint: 'Opções e confirmação' },
];

/** Torna legíveis as mensagens técnicas devolvidas pela base de dados para uma linha. */
function rowMessage(message: string): string {
  if (/email/i.test(message) && /check|inválido/i.test(message)) return 'Email inválido.';
  if (/phone|telem/i.test(message)) return 'Telemóvel inválido.';
  if (/first_name/i.test(message)) return 'Nome em falta ou com mais de 120 caracteres.';
  if (/plus_ones/i.test(message)) return 'Número de acompanhantes inválido.';
  if (/^Falta o nome/i.test(message)) return 'Falta o nome.';
  return message;
}

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function ContactImportPage() {
  const toast = useToast();
  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const [invite, setInvite] = useState(false);
  const [eventId, setEventId] = useState('');
  const [wave, setWave] = useState('');
  const [plusOnes, setPlusOnes] = useState('0');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: ImportResult; event: EventRecord | null; lines: number[] } | null>(null);

  const mapped = useMemo(() => (csv ? mapRows(csv.rows, mapping) : null), [csv, mapping]);
  const hasName = Object.values(mapping).some((f) => f === 'first_name' || f === 'full_name');

  // Ao mudar de passo, leva o utilizador ao topo (em ecrãs pequenos o fim do passo anterior fica longe).
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const readFile = async (f: File) => {
    setFileError(null);
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls', 'numbers', 'ods'].includes(ext)) {
      setFileError('Este ficheiro é uma folha de cálculo. No Excel, use Ficheiro › Guardar como › «CSV UTF-8 (delimitado por vírgulas)» e escolha o ficheiro .csv.');
      return;
    }
    if (ext !== 'csv' && ext !== 'txt' && f.type !== 'text/csv') {
      setFileError('Escolha um ficheiro .csv.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError(`O ficheiro tem ${formatBytes(f.size)}. O máximo é 10 MB; divida-o em partes.`);
      return;
    }
    setReading(true);
    try {
      const parsed = parseCsv(decodeCsv(await f.arrayBuffer()));
      if (!parsed.headers.length || !parsed.rows.length) {
        setFileError('O ficheiro não tem registos. A primeira linha deve ter os nomes das colunas e as seguintes os contactos.');
        return;
      }
      setFile({ name: f.name, size: f.size });
      setCsv(parsed);
      setMapping(suggestMapping(parsed.headers));
      setStep('map');
    } catch {
      setFileError('Não foi possível ler o ficheiro. Confirme que é um CSV e tente novamente.');
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setStep('file');
    setFile(null);
    setCsv(null);
    setMapping({});
    setFileError(null);
    setInvite(false);
    setWave('');
    setResult(null);
    setImportError(null);
  };

  const runImport = async (event: EventRecord | null) => {
    if (!mapped) return;
    const plus = Number(plusOnes);
    setImporting(true);
    setImportError(null);
    try {
      const data = await api.contacts.import(mapped.rows, event ? { eventId: event.id, wave: wave.trim() || undefined, plusOnes: plus } : undefined);
      setResult({ data, event, lines: mapped.lines });
      setStep('done');
      if (data.errors.length) toast.info(`Importação concluída com ${data.errors.length} ${data.errors.length === 1 ? 'erro' : 'erros'}.`);
      else toast.success('Importação concluída.');
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const currentIndex = step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <PageHeader
        title="Importar contactos"
        back={{ to: '/admin/contactos', label: 'Contactos' }}
        description="Acrescente ou atualize contactos a partir de um ficheiro CSV exportado do Excel, do Outlook ou de outro sistema."
      />

      <ol className="ct-steps" aria-label="Passos da importação">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === currentIndex ? 'step' : undefined} className={i < currentIndex ? 'is-done' : undefined}>
            <span className="ct-steps__num">{i < currentIndex ? <Check aria-label="Concluído" /> : i + 1}</span>
            <span className="ct-steps__text">{s.title}<small>{s.hint}</small></span>
          </li>
        ))}
      </ol>

      {step === 'file' && <FileStep onFile={(f) => void readFile(f)} error={fileError} reading={reading} />}

      {step === 'map' && csv && mapped && file && (
        <MapStep
          file={file}
          csv={csv}
          mapping={mapping}
          setMapping={setMapping}
          mapped={mapped}
          hasName={hasName}
          onBack={reset}
          onNext={() => setStep('options')}
        />
      )}

      {step === 'options' && mapped && file && (
        <OptionsStep
          fileName={file.name}
          valid={mapped.rows.length}
          rejected={new Set(mapped.issues.filter((i) => i.severity === 'error').map((i) => i.row)).size}
          invite={invite}
          setInvite={setInvite}
          eventId={eventId}
          setEventId={setEventId}
          wave={wave}
          setWave={setWave}
          plusOnes={plusOnes}
          setPlusOnes={setPlusOnes}
          importing={importing}
          error={importError}
          onBack={() => setStep('map')}
          onImport={(event) => void runImport(event)}
        />
      )}

      {step === 'done' && result && <ResultStep result={result} onAgain={reset} />}
    </>
  );
}

// ───────── 1. Ficheiro ─────────

function FileStep({ onFile, error, reading }: { onFile: (f: File) => void; error: string | null; reading: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const inputId = useId();

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div className="ui-grid-sidebar">
      <Card title="Escolher ficheiro" subtitle="Formato CSV, até 5000 contactos e 10 MB.">
        <div className="ui-stack">
          {error && <Alert tone="danger">{error}</Alert>}
          <div
            className={['ct-drop', over && 'is-over'].filter(Boolean).join(' ')}
            role="button"
            tabIndex={0}
            aria-describedby={`${inputId}-hint`}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.current?.click();
              }
            }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="ct-drop__icon">{reading ? <RefreshCw className="ui-spin" aria-hidden /> : <Upload aria-hidden />}</span>
            <span className="ct-drop__title">{reading ? 'A ler o ficheiro…' : 'Arraste o ficheiro para aqui'}</span>
            <span className="ct-drop__hint" id={`${inputId}-hint`}>ou clique para escolher um ficheiro .csv do computador</span>
          </div>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".csv,text/csv,.txt"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Ficheiro CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card title="Como preparar o ficheiro">
        <div className="ct-guide">
          <section>
            <h3>No Excel</h3>
            <ol>
              <li>Coloque os nomes das colunas na primeira linha e um contacto por linha.</li>
              <li>Escolha <strong>Ficheiro › Guardar como</strong> e o formato <strong>CSV UTF-8 (delimitado por vírgulas)</strong>.</li>
            </ol>
          </section>
          <section>
            <h3>Colunas</h3>
            <ul>
              <li><strong>Nome</strong> é obrigatório (ou «Nome completo»).</li>
              <li>Indique o <strong>email</strong> ou o <strong>telemóvel</strong>: são usados para não criar repetidos.</li>
              <li>Telemóveis portugueses podem ir sem indicativo; os estrangeiros começam por + ou 00.</li>
              <li>Várias etiquetas na mesma célula separam-se por vírgulas.</li>
            </ul>
          </section>
          <Button icon={<Download />} onClick={() => downloadFile('modelo-contactos.csv', templateCsv(), 'text/csv;charset=utf-8')}>
            Descarregar modelo
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ───────── 2. Colunas ─────────

function MapStep({ file, csv, mapping, setMapping, mapped, hasName, onBack, onNext }: {
  file: { name: string; size: number };
  csv: ParsedCsv;
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  mapped: ReturnType<typeof mapRows>;
  hasName: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const errors = mapped.issues.filter((i) => i.severity === 'error');
  const warnings = mapped.issues.filter((i) => i.severity === 'warning');
  const rejectedRows = new Set(errors.map((i) => i.row)).size;
  const tooMany = csv.rows.length > MAX_ROWS;
  const canContinue = hasName && mapped.rows.length > 0 && !tooMany;
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const sample = (header: string) => csv.rows.find((r) => r.values[header])?.values[header] ?? '';

  const change = (header: string, field: ImportField | '') => {
    const next: ColumnMapping = { ...mapping };
    // Cada campo só pode vir de uma coluna.
    if (field) for (const h of Object.keys(next)) if (next[h] === field) next[h] = '';
    next[header] = field;
    setMapping(next);
  };

  const options = [{ value: '', label: 'Não importar' }, ...IMPORT_FIELDS];
  const delimiter = csv.delimiter === ';' ? 'ponto e vírgula' : csv.delimiter === ',' ? 'vírgula' : 'tabulação';

  return (
    <div className="ui-stack ui-stack--lg">
      <Card
        title="Correspondência de colunas"
        subtitle={`Reconhecemos ${mappedCount} de ${csv.headers.length} colunas. Confirme ou corrija o campo de cada uma.`}
        padded={false}
      >
        <div className="ct-file">
          <FileSpreadsheet aria-hidden />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ct-file__name">{file.name}</div>
            <div className="ct-file__meta">
              {formatNumber(csv.rows.length)} {csv.rows.length === 1 ? 'registo' : 'registos'} · {formatBytes(file.size)} · separador: {delimiter}
            </div>
          </div>
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={onBack}>Trocar ficheiro</Button>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table ct-map-table">
            <caption className="visually-hidden">Correspondência entre as colunas do ficheiro e os campos do contacto</caption>
            <thead>
              <tr>
                <th scope="col">Coluna do ficheiro</th>
                <th scope="col" className="ct-hide-md">Exemplo</th>
                <th scope="col">Campo do contacto</th>
              </tr>
            </thead>
            <tbody>
              {csv.headers.map((h) => (
                <tr key={h} className={mapping[h] ? undefined : 'is-ignored'}>
                  <td className="ct-map-col">
                    <div className="primary">{h}</div>
                    <div className="secondary ct-only-md ct-map-sample">{sample(h) || '—'}</div>
                  </td>
                  <td className="ct-hide-md"><div className="ct-map-sample" title={sample(h)}>{sample(h) || '—'}</div></td>
                  <td>
                    <Select aria-label={`Campo para a coluna ${h}`} value={mapping[h] ?? ''} options={options}
                      onChange={(e) => change(h, e.target.value as ImportField | '')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!hasName && <Alert tone="danger">Indique a coluna que tem o nome (ou o nome completo) para continuar.</Alert>}
      {tooMany && (
        <Alert tone="danger">
          O ficheiro tem {formatNumber(csv.rows.length)} registos. Cada importação aceita até {formatNumber(MAX_ROWS)}; divida o ficheiro em partes.
        </Alert>
      )}

      {hasName && (
        <>
          <Card title="Pré-visualização" subtitle="Primeiros contactos, tal como vão ficar guardados." padded={false}>
            {mapped.rows.length === 0 ? (
              <div className="ui-card__body"><p className="ct-help">Nenhuma linha válida para mostrar.</p></div>
            ) : (
              <div className="ui-table-wrap">
                <table className="ui-table ct-preview">
                  <thead>
                    <tr>
                      <th scope="col">Linha</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Email</th>
                      <th scope="col">Telemóvel</th>
                      <th scope="col">Entidade</th>
                      <th scope="col">Segmento</th>
                      <th scope="col">Etiquetas</th>
                      <th scope="col">Idioma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="tabular muted">{mapped.lines[i]}</td>
                        <td>
                          {r.salutation && <span className="muted">{r.salutation} </span>}
                          <span className="primary">{fullName(r)}</span>
                        </td>
                        <td>{r.email ?? <span className="muted">—</span>}</td>
                        <td className="tabular">{r.phone ? formatPhone(r.phone) : <span className="muted">—</span>}</td>
                        <td>{r.organization ?? <span className="muted">—</span>}{r.job_title && <div className="secondary">{r.job_title}</div>}</td>
                        <td>{r.segment ?? <span className="muted">—</span>}</td>
                        <td>{r.tags?.length ? <span className="ct-tags">{r.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</span> : <span className="muted">—</span>}</td>
                        <td>{languageLabel(r.language ?? 'pt')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Verificação">
            <div className="ui-stack">
              <div className="ct-summary">
                <SummaryItem label="Registos no ficheiro" value={csv.rows.length} />
                <SummaryItem label="Prontos a importar" value={mapped.rows.length} tone="success" />
                <SummaryItem label="Com erros (não importados)" value={rejectedRows} tone={rejectedRows ? 'danger' : undefined} />
                <SummaryItem label="Avisos" value={warnings.length} tone={warnings.length ? 'warning' : undefined} />
              </div>
              {mapped.issues.length > 0 && <IssuesTable issues={mapped.issues} />}
              <Alert tone="info">
                Contactos já existentes (mesmo email ou, sem email, mesmo telemóvel) são atualizados apenas nos campos vazios e
                recebem as etiquetas novas. Nenhum dado existente é apagado ou substituído.
              </Alert>
            </div>
          </Card>
        </>
      )}

      <div className="ct-footer-actions">
        <Button icon={<ArrowLeft />} onClick={onBack}>Escolher outro ficheiro</Button>
        <Button variant="primary" onClick={onNext} disabled={!canContinue}>
          Continuar <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' | 'warning' }) {
  return (
    <div className={['ct-summary__item', tone && `ct-summary__item--${tone}`].filter(Boolean).join(' ')}>
      <div className="ct-summary__label">{label}</div>
      <div className="ct-summary__value">{formatNumber(value)}</div>
    </div>
  );
}

function IssuesTable({ issues }: { issues: { row: number; message: string; severity?: 'error' | 'warning' }[] }) {
  const shown = issues.slice(0, ISSUE_LIMIT);
  return (
    <>
      <div className="ct-issues">
        <table className="ui-table">
          <caption className="visually-hidden">Problemas encontrados</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 80 }}>Linha</th>
              <th scope="col">Problema</th>
              <th scope="col" className="ct-hide-md" style={{ width: 130 }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i, n) => (
              <tr key={n}>
                <td className="tabular">{i.row}</td>
                <td>
                  {i.message}
                  <div className="ct-only-md" style={{ marginTop: 4 }}><IssueBadge severity={i.severity} /></div>
                </td>
                <td className="ct-hide-md"><IssueBadge severity={i.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {issues.length > ISSUE_LIMIT && <p className="ct-help">E mais {formatNumber(issues.length - ISSUE_LIMIT)}. Corrija os primeiros e volte a importar o ficheiro.</p>}
      <p className="ct-help">A linha 1 é a dos nomes das colunas.</p>
    </>
  );
}

function IssueBadge({ severity }: { severity?: 'error' | 'warning' }) {
  return severity === 'warning' ? <Badge tone="warning">Importado</Badge> : <Badge tone="danger">Não importado</Badge>;
}

// ───────── 3. Opções e importação ─────────

function OptionsStep(p: {
  fileName: string;
  valid: number;
  rejected: number;
  invite: boolean;
  setInvite: (v: boolean) => void;
  eventId: string;
  setEventId: (v: string) => void;
  wave: string;
  setWave: (v: string) => void;
  plusOnes: string;
  setPlusOnes: (v: string) => void;
  importing: boolean;
  error: string | null;
  onBack: () => void;
  onImport: (event: EventRecord | null) => void;
}) {
  const { setEventId, setPlusOnes } = p;
  const events = useAsync(() => api.events.list().then((l) => invitableEvents(l)), []);
  const event = events.data?.find((e) => e.id === p.eventId) ?? null;
  const [waves, setWaves] = useState<string[]>([]);
  const waveListId = useId();

  useEffect(() => {
    if (!p.eventId && events.data?.length) setEventId(events.data[0].id);
  }, [events.data, p.eventId, setEventId]);

  useEffect(() => {
    if (!event) return;
    setPlusOnes(String(event.default_plus_ones));
    let alive = true;
    api.invitations.waves(event.id).then((w) => alive && setWaves(w), () => alive && setWaves([]));
    return () => { alive = false; };
  }, [event, setPlusOnes]);

  const plus = Number(p.plusOnes);
  const plusInvalid = p.invite && (!Number.isInteger(plus) || plus < 0 || plus > 10);
  const blocked = p.invite && (!event || plusInvalid);
  const n = formatNumber(p.valid);

  return (
    <div className="ui-stack ui-stack--lg">
      <Card title="Convidar para um evento" subtitle="Opcional. Cria os convites ao mesmo tempo que importa os contactos.">
        <div className="ui-stack">
          <Checkbox
            label="Convidar estes contactos para um evento"
            checked={p.invite}
            disabled={!!events.error || events.data?.length === 0}
            onChange={(e) => p.setInvite(e.target.checked)}
          />
          {events.loading && !events.data ? (
            <Skeleton height={36} />
          ) : events.error ? (
            <Alert tone="warning">
              Não foi possível carregar os eventos, por isso só é possível importar os contactos.{' '}
              <button type="button" className="ct-link-btn" onClick={events.reload}>Tentar novamente</button>
            </Alert>
          ) : events.data?.length === 0 ? (
            <p className="ct-help">Não há eventos ativos. Pode convidar estes contactos mais tarde, a partir da lista de contactos.</p>
          ) : p.invite && (
            <>
              <div className="ui-form-grid">
                <Field label="Evento" required className="span-2">
                  <Select value={p.eventId} onChange={(e) => setEventId(e.target.value)} options={(events.data ?? []).map((e) => ({ value: e.id, label: eventOptionLabel(e) }))} />
                </Field>
                <Field label="Vaga" hint="Opcional. Ex.: Convidados de honra, 1.ª vaga.">
                  <Input value={p.wave} list={waves.length ? waveListId : undefined} maxLength={80} autoComplete="off" onChange={(e) => p.setWave(e.target.value)} />
                </Field>
                <Field label="Acompanhantes por convite" error={plusInvalid ? 'Entre 0 e 10.' : null}
                  hint={event ? `Por omissão do evento: ${event.default_plus_ones}.` : undefined}>
                  <Input type="number" min={0} max={10} step={1} inputMode="numeric" value={p.plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />
                </Field>
              </div>
              {waves.length > 0 && <datalist id={waveListId}>{waves.map((w) => <option key={w} value={w} />)}</datalist>}
              {event?.status === 'closed' && <Alert tone="warning">Este evento está fechado: os convidados veem o convite, mas já não podem responder.</Alert>}
            </>
          )}
        </div>
      </Card>

      <Card title="Confirmar importação">
        <div className="ui-stack">
          {p.error && <Alert tone="danger">{p.error}</Alert>}
          <ul className="ct-guide" style={{ paddingLeft: 18 }}>
            <li>
              Vão ser importados <strong>{n} {p.valid === 1 ? 'contacto' : 'contactos'}</strong> do ficheiro «{p.fileName}».
            </li>
            {p.rejected > 0 && <li>{formatNumber(p.rejected)} {p.rejected === 1 ? 'linha com erros não é importada' : 'linhas com erros não são importadas'}.</li>}
            <li>Quem já existir é atualizado apenas nos campos vazios.</li>
            {p.invite && event && (
              <li>
                Cada contacto fica convidado para <strong>{event.name}</strong>{p.wave.trim() ? <> ({p.wave.trim()})</> : null}, no estado «Por enviar».
                Quem já estiver convidado não é alterado.
              </li>
            )}
          </ul>
        </div>
      </Card>

      <div className="ct-footer-actions">
        <Button icon={<ArrowLeft />} onClick={p.onBack} disabled={p.importing}>Voltar às colunas</Button>
        <Button variant="primary" icon={<Upload />} loading={p.importing} disabled={blocked}
          onClick={() => p.onImport(p.invite ? event : null)}>
          Importar {n} {p.valid === 1 ? 'contacto' : 'contactos'}
        </Button>
      </div>
    </div>
  );
}

// ───────── Resultado ─────────

function ResultStep({ result, onAgain }: { result: { data: ImportResult; event: EventRecord | null; lines: number[] }; onAgain: () => void }) {
  const { data, event, lines } = result;
  const ok = data.errors.length === 0;
  const issues = data.errors.map((e) => ({ row: lines[e.row - 1] ?? e.row, message: rowMessage(e.message), severity: 'error' as const }));
  return (
    <Card>
      <div className="ui-stack ui-stack--lg">
        <div className="ct-result" role="status">
          <span className={['ct-result__icon', !ok && 'ct-result__icon--warning'].filter(Boolean).join(' ')}>
            {ok ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
          </span>
          <h2>{ok ? 'Importação concluída' : 'Importação concluída com erros'}</h2>
          <p>
            {formatNumber(data.inserted + data.updated)} {data.inserted + data.updated === 1 ? 'contacto processado' : 'contactos processados'}
            {event ? <> e {formatNumber(data.invited)} {data.invited === 1 ? 'convite criado' : 'convites criados'} para {event.name}</> : null}.
          </p>
        </div>
        <div className="ct-summary">
          <SummaryItem label="Contactos novos" value={data.inserted} tone="success" />
          <SummaryItem label="Contactos atualizados" value={data.updated} />
          {event && <SummaryItem label="Convites criados" value={data.invited} />}
          <SummaryItem label="Erros" value={data.errors.length} tone={data.errors.length ? 'danger' : undefined} />
        </div>
        {issues.length > 0 && <IssuesTable issues={issues} />}
        <div className="ct-footer-actions" style={{ justifyContent: 'center' }}>
          <Button icon={<RefreshCw />} onClick={onAgain}>Importar outro ficheiro</Button>
          {event && <ButtonLink to={`/admin/eventos/${event.id}`}>Abrir lista de convidados</ButtonLink>}
          <ButtonLink to="/admin/contactos" variant="primary" icon={<Users />}>Ver contactos</ButtonLink>
        </div>
      </div>
    </Card>
  );
}
