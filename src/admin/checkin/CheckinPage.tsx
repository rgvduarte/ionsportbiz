import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';
import {
  ArrowLeft, CalendarDays, CalendarPlus, Check, CircleCheckBig, CircleX, History, Keyboard, MapPin, ScanLine, Search,
  TriangleAlert, Undo2, UserCheck, Users, X,
} from 'lucide-react';
import './checkin.css';
import { api, toApiError, type CheckinRecord, type EventRecord, type EventStats } from '../../lib/api';
import { useAuth } from '../../app/AuthProvider';
import { useCurrentEvent } from '../useCurrentEvent';
import { INVITATION_STATUS } from '../../lib/status';
import { formatLongDate, formatNumber, formatPercent, formatShortDate, formatTime } from '../../lib/format';
import {
  Badge, Button, ButtonLink, EmptyState, Input, LoadError, Progress, SearchInput, Select, Skeleton, useConfirm, useToast,
} from '../../ui';
import { QrScanner } from './QrScanner';
import { AccessList, ApprovalBadge, passColor, PassChip, PassDot } from '../passes';
import {
  BLOCKED_TEXT, CODE_LENGTH, capitalize, forcedLabel, foreignRecentKeys, formatCode, isLookupInput, needsForce, personName, plural, recentKey,
  UNAPPROVED_TEXT, verdict,
} from './code';

const RETURN_AFTER_MS = 2500;
const STATS_EVERY_MS = 15_000;

type Tab = 'scan' | 'search';
type Panel =
  | { kind: 'loading' }
  | { kind: 'record'; record: CheckinRecord }
  | { kind: 'notfound'; input: string }
  | { kind: 'success'; record: CheckinRecord; companions: number; firstEntry: boolean; forced: boolean };

interface RecentEntry {
  key: string;
  at: string;
  record: CheckinRecord;
  companions: number;
  forced: boolean;
  undone?: boolean;
}

// ───────── Página ─────────

export function CheckinPage() {
  const { can, session } = useAuth();
  const userId = session?.user.id ?? null;
  const { events, loading, error, reload, current, select } = useCurrentEvent();
  const options = useMemo(
    () => events.filter((e) => e.status !== 'archived').sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [events],
  );
  const event = current && current.status !== 'archived' ? current : options[0] ?? null;

  if (error && !events.length) return <LoadError error={error} onRetry={reload} />;
  if (loading && !events.length) {
    return (
      <div className="ck" aria-busy="true">
        <div className="ck-top">
          <div className="ck-top__event"><Skeleton width={120} height={14} /><Skeleton height={44} style={{ marginTop: 10 }} /></div>
          <div className="ck-count"><Skeleton width={160} height={36} /><Skeleton height={8} style={{ marginTop: 12 }} /></div>
        </div>
        <Skeleton height={360} style={{ borderRadius: 'var(--radius-xl)' }} />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="ck">
        <EmptyState
          icon={<CalendarDays />}
          title="Não há eventos para check-in"
          actions={can.edit ? <ButtonLink to="/admin/eventos/novo" variant="primary" icon={<CalendarPlus />}>Criar evento</ButtonLink> : undefined}
        >
          {can.edit
            ? 'Crie um evento e adicione convidados para começar a registar entradas.'
            : 'Ainda não existe nenhum evento ativo. Contacte a organização do evento.'}
        </EmptyState>
      </div>
    );
  }
  return (
    <CheckinDesk
      key={`${userId}:${event.id}`}
      event={event}
      events={options}
      onSelect={select}
      canEdit={can.edit}
      userId={userId}
    />
  );
}

// ───────── Balcão de check-in (um evento) ─────────

function CheckinDesk({ event, events, onSelect, canEdit, userId }: {
  event: EventRecord;
  events: EventRecord[];
  onSelect: (id: string) => void;
  canEdit: boolean;
  userId: string | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('scan');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useRecent(userId, event.id);
  const live = useLiveStats(event.id);
  const manualRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  const close = useCallback(() => {
    request.current++;
    setPanel(null);
  }, []);

  const lookup = useCallback(async (raw: string) => {
    const id = ++request.current;
    setPanel({ kind: 'loading' });
    try {
      const record = await api.checkin.lookup(event.id, raw);
      if (id !== request.current) return;
      setPanel(record ? { kind: 'record', record } : { kind: 'notfound', input: raw });
    } catch (err) {
      if (id !== request.current) return;
      setPanel(null);
      toast.error(err);
    }
  }, [event.id, toast]);

  const register = async (record: CheckinRecord, companionIds: string[], force: boolean) => {
    setBusy(true);
    try {
      const result = await api.checkin.checkIn(record.invitation_id, companionIds, force);
      const firstEntry = !record.checked_in_at && !!result.checked_in_at;
      const companions = result.companions.filter((c) => c.checked_in_at).length
        - record.companions.filter((c) => c.checked_in_at).length;
      navigator.vibrate?.(60);
      setPanel({ kind: 'success', record: result, companions, firstEntry, forced: force && firstEntry });
      setRecent((all) => [
        { key: `${result.invitation_id}:${Date.now()}`, at: new Date().toISOString(), record: result, companions, forced: force && firstEntry },
        ...all,
      ].slice(0, 30));
      live.refresh();
    } catch (err) {
      toast.error(err);
      // A aprovação mudou desde a leitura (ex.: a equipa repôs a aprovação): mostra o estado atual e a opção de forçar.
      if (toApiError(err).code === 'not_approved') {
        const fresh = await api.checkin.search(event.id, personName(record)).then(
          (rows) => rows.find((r) => r.invitation_id === record.invitation_id),
          () => undefined,
        );
        setPanel({ kind: 'record', record: fresh ?? { ...record, approval_status: 'pending', pass_type: null } });
      }
    } finally {
      setBusy(false);
    }
  };

  const undo = async (record: CheckinRecord) => {
    const ok = await confirm({
      title: 'Anular a entrada?',
      message: `A entrada de ${personName(record)}${record.companions.some((c) => c.checked_in_at) ? ' e dos acompanhantes' : ''} deixa de contar. Fica registado na linha do tempo do convite.`,
      confirmLabel: 'Anular entrada',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await api.checkin.undo(record.invitation_id);
      setPanel({ kind: 'record', record: result });
      setRecent((all) => all.map((r) => (r.record.invitation_id === result.invitation_id ? { ...r, record: result, undone: true } : r)));
      live.refresh();
      toast.success('Entrada anulada.');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Depois de uma entrada, volta sozinho à leitura.
  useEffect(() => {
    if (panel?.kind !== 'success') return;
    const t = setTimeout(close, RETURN_AFTER_MS);
    return () => clearTimeout(t);
  }, [panel, close]);

  // Escape fecha o resultado (se não houver um diálogo aberto por cima).
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.ui-overlay')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, close]);

  // Teclado físico ou leitor USB: o campo do código fica pronto a receber o próximo.
  useEffect(() => {
    if (panel || tab !== 'scan') return;
    if (window.matchMedia?.('(pointer: fine)').matches) manualRef.current?.focus({ preventScroll: true });
  }, [panel, tab]);

  const focusManual = () => {
    setTab('scan');
    requestAnimationFrame(() => manualRef.current?.focus());
  };
  const searchInstead = () => {
    close();
    setTab('search');
  };

  return (
    <div className="ck">
      <DeskHeader event={event} events={events} onSelect={onSelect} live={live} />

      <div className="ck-body">
        <section className="ck-capture" aria-label="Identificar convidado">
          <div className="ck-seg" role="tablist" aria-label="Modo">
            <button type="button" role="tab" id="ck-tab-scan" aria-controls="ck-pane" aria-selected={tab === 'scan'} onClick={() => setTab('scan')}>
              <ScanLine aria-hidden />Ler código
            </button>
            <button type="button" role="tab" id="ck-tab-search" aria-controls="ck-pane" aria-selected={tab === 'search'} onClick={() => setTab('search')}>
              <Search aria-hidden />Pesquisar
            </button>
          </div>

          <div id="ck-pane" role="tabpanel" aria-labelledby={tab === 'scan' ? 'ck-tab-scan' : 'ck-tab-search'}>
            {tab === 'scan' ? (
              <div className="ui-stack">
                <QrScanner onScan={(v) => void lookup(v)} paused={!!panel} onManualEntry={focusManual} onSearchInstead={searchInstead} />
                <ManualEntry inputRef={manualRef} disabled={panel?.kind === 'loading'} onSubmit={(v) => void lookup(v)} />
              </div>
            ) : (
              <SearchPanel eventId={event.id} timeZone={event.timezone} onPick={(record) => setPanel({ kind: 'record', record })} />
            )}
          </div>
        </section>

        <aside className="ck-side">
          {panel ? (
            <div className={['ck-sheet', `ck-sheet--${panel.kind === 'success' ? 'success' : panel.kind === 'notfound' ? 'danger' : 'plain'}`].join(' ')}>
              <div className="ck-sheet__inner">
                {panel.kind === 'loading' && <PanelLoading onClose={close} />}
                {panel.kind === 'record' && (
                  <ResultPanel
                    key={`${panel.record.invitation_id}:${panel.record.checked_in_at ?? ''}`}
                    record={panel.record}
                    event={event}
                    canEdit={canEdit}
                    busy={busy}
                    onClose={close}
                    onUndo={() => void undo(panel.record)}
                    onRegister={async (ids, force) => {
                      const v = verdict(panel.record);
                      if (force && (v.kind === 'blocked' || v.kind === 'unapproved')) {
                        const ok = await confirm({
                          title: v.kind === 'unapproved' ? 'Dar entrada sem aprovação?' : 'Dar entrada sem confirmação?',
                          message: `${v.kind === 'unapproved' ? UNAPPROVED_TEXT[v.approval].text : BLOCKED_TEXT[v.status].text} Confirme que tem indicação da organização para deixar entrar ${personName(panel.record)}.`,
                          confirmLabel: 'Dar entrada',
                          danger: true,
                        });
                        if (!ok) return;
                      }
                      await register(panel.record, ids, force);
                    }}
                  />
                )}
                {panel.kind === 'notfound' && <NotFoundPanel input={panel.input} event={event} onClose={close} onSearch={searchInstead} />}
                {panel.kind === 'success' && <SuccessPanel panel={panel} event={event} onClose={close} />}
              </div>
            </div>
          ) : (
            <div className="ck-idle">
              <div className="ck-idle__icon"><UserCheck aria-hidden /></div>
              <strong>Pronto para o próximo convidado</strong>
              <p>
                {tab === 'scan'
                  ? 'Leia o código QR do bilhete, introduza o código de 10 caracteres ou pesquise pelo nome.'
                  : 'Escolha um convidado nos resultados da pesquisa para ver os detalhes e registar a entrada.'}
              </p>
            </div>
          )}

          <RecentList
            entries={recent}
            event={event}
            onOpen={(r) => setPanel({ kind: 'record', record: r })}
            onClear={() => setRecent([])}
          />
        </aside>
      </div>
    </div>
  );
}

// ───────── Cabeçalho: evento e contagem ─────────

function DeskHeader({ event, events, onSelect, live }: {
  event: EventRecord;
  events: EventRecord[];
  onSelect: (id: string) => void;
  live: LiveStats;
}) {
  const tz = event.timezone;
  const today = formatShortDate(new Date().toISOString(), tz) === formatShortDate(event.starts_at, tz);
  const { stats, failed } = live;
  const inside = stats?.checked_in ?? 0;
  const expected = stats?.expected_attendees ?? 0;
  return (
    <header className="ck-top">
      <div className="ck-top__event">
        <h1 className="ck-title">Check-in</h1>
        <Select
          aria-label="Evento"
          className="ck-top__select"
          value={event.id}
          onChange={(e) => onSelect(e.target.value)}
          options={events.map((e) => ({ value: e.id, label: `${e.name} · ${formatShortDate(e.starts_at, e.timezone)}` }))}
        />
        <div className="ck-top__meta">
          <span><CalendarDays aria-hidden />{capitalize(formatLongDate(event.starts_at, tz))}, {formatTime(event.starts_at, tz)}</span>
          {event.venue_name && <span><MapPin aria-hidden />{event.venue_name}</span>}
          {!today && <Badge tone="warning" dot>O evento não é hoje</Badge>}
        </div>
      </div>
      <div className="ck-count" aria-live="polite" aria-atomic="true">
        <div className="ck-count__label"><Users aria-hidden />Entradas</div>
        {stats ? (
          <>
            <div className="ck-count__value">
              <strong className="tabular">{formatNumber(inside)}</strong>
              <span className="tabular">/ {formatNumber(expected)} esperados</span>
            </div>
            <Progress value={expected ? inside / expected : 0} color="var(--c-success)" />
            <div className="ck-count__hint">
              {expected ? `${formatPercent(inside, expected)} das pessoas esperadas` : 'Ainda não há presenças confirmadas'}
              {failed && <span className="ck-count__stale"> · a atualizar…</span>}
            </div>
          </>
        ) : failed ? (
          <div className="ck-count__hint">Contagem indisponível de momento.</div>
        ) : (
          <><Skeleton width={150} height={34} /><Skeleton height={8} style={{ marginTop: 12 }} /></>
        )}
      </div>
    </header>
  );
}

// ───────── Código manual ─────────

function ManualEntry({ inputRef, onSubmit, disabled }: {
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) {
      setError('Introduza o código do bilhete.');
      return;
    }
    if (!isLookupInput(v)) {
      setError(`O código tem ${CODE_LENGTH} caracteres (letras e algarismos).`);
      return;
    }
    setError(null);
    setValue('');
    onSubmit(v);
  };
  return (
    <form className="ck-manual" onSubmit={submit} noValidate>
      <label className="ck-manual__label" htmlFor="ck-code">
        <Keyboard aria-hidden />Introduzir código
      </label>
      <div className="ck-manual__row">
        <Input
          ref={inputRef}
          id="ck-code"
          className="ck-manual__input"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          placeholder="ABCDE-FGHJK"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'ck-code-error' : 'ck-code-hint'}
        />
        <Button type="submit" variant="primary" size="lg" disabled={disabled}>Procurar</Button>
      </div>
      {error
        ? <div className="ui-field__error" id="ck-code-error" role="alert">{error}</div>
        : <div className="ui-field__hint" id="ck-code-hint">Está no bilhete, por baixo do código QR. Espaços e hífenes são ignorados.</div>}
    </form>
  );
}

// ───────── Pesquisa ─────────

function SearchPanel({ eventId, timeZone, onPick }: { eventId: string; timeZone: string; onPick: (r: CheckinRecord) => void }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ loading: boolean; rows: CheckinRecord[] | null; error: unknown }>({ loading: false, rows: null, error: null });
  const [tick, setTick] = useState(0);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setState({ loading: false, rows: null, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.checkin.search(eventId, q).then(
      (rows) => alive && setState({ loading: false, rows, error: null }),
      (error) => alive && setState({ loading: false, rows: null, error }),
    );
    return () => { alive = false; };
  }, [eventId, q, tick]);

  return (
    <div className="ck-search">
      <SearchInput
        value={query}
        onSearch={setQuery}
        autoFocus
        className="ck-search__input"
        placeholder="Nome, apelido, entidade ou acompanhante"
      />
      {q.length < 2 ? (
        <p className="ck-search__hint">Escreva pelo menos 2 letras. São mostrados primeiro os convidados com presença confirmada.</p>
      ) : state.error ? (
        <LoadError error={state.error} onRetry={() => setTick((t) => t + 1)} />
      ) : state.loading && !state.rows ? (
        <ul className="ck-results" aria-busy="true">
          {[0, 1, 2].map((i) => <li key={i} className="ck-result ck-result--skeleton"><Skeleton width="60%" height={16} /><Skeleton width="40%" height={12} /></li>)}
        </ul>
      ) : state.rows && state.rows.length === 0 ? (
        <EmptyState icon={<Search />} title="Nenhum convidado encontrado" actions={<Button onClick={() => setQuery('')}>Limpar pesquisa</Button>}>
          Não há convites neste evento para «{q}». Verifique a ortografia ou pesquise pela entidade.
        </EmptyState>
      ) : state.rows ? (
        <>
          <ul className={['ck-results', state.loading && 'is-stale'].filter(Boolean).join(' ')} aria-label="Resultados">
            {state.rows.map((r) => {
              const status = INVITATION_STATUS[r.status];
              const companionsIn = r.companions.filter((c) => c.checked_in_at).length;
              return (
                <li key={r.invitation_id}>
                  <button type="button" className="ck-result" onClick={() => onPick(r)}>
                    <span className="ck-result__main">
                      <span className="ck-result__name">{personName(r)}</span>
                      <span className="ck-result__meta">
                        {[r.organization, r.companions.length ? plural(r.companions.length, 'acompanhante', 'acompanhantes') : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="ck-result__side">
                      {r.checked_in_at ? (
                        <Badge tone="success" dot>Entrou às {formatTime(r.checked_in_at, timeZone)}{companionsIn ? ` (+${companionsIn})` : ''}</Badge>
                      ) : r.status === 'accepted' && r.approval_status !== 'approved' ? (
                        <ApprovalBadge status={r.approval_status} />
                      ) : (
                        <Badge tone={status.tone}>{status.label}</Badge>
                      )}
                      {r.pass_type && <PassChip name={r.pass_type.name} color={r.pass_type.color} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {state.rows.length >= 25 && <p className="ck-search__hint">São mostrados os primeiros 25 resultados. Refine a pesquisa.</p>}
        </>
      ) : null}
    </div>
  );
}

// ───────── Resultado ─────────

function PanelHead({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="ck-panel__head">
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onClose} className="ck-panel__back">Voltar</Button>
      <div className="ui-row">{children}</div>
    </div>
  );
}

function PanelLoading({ onClose }: { onClose: () => void }) {
  return (
    <div className="ck-panel" aria-busy="true">
      <PanelHead onClose={onClose} />
      <div role="status" className="ck-panel__loading">
        <Skeleton width={110} height={14} />
        <Skeleton width="70%" height={34} style={{ marginTop: 10 }} />
        <Skeleton width="45%" height={16} style={{ marginTop: 10 }} />
        <span className="visually-hidden">A procurar o convite…</span>
      </div>
    </div>
  );
}

function ResultPanel({ record, event, canEdit, busy, onClose, onRegister, onUndo }: {
  record: CheckinRecord;
  event: EventRecord;
  canEdit: boolean;
  busy: boolean;
  onClose: () => void;
  onRegister: (companionIds: string[], force: boolean) => Promise<void>;
  onUndo: () => void;
}) {
  const v = verdict(record);
  const pending = record.companions.filter((c) => !c.checked_in_at);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(pending.map((c) => c.id)));
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const ids = pending.filter((c) => chosen.has(c.id)).map((c) => c.id);
  const n = ids.length;
  const status = INVITATION_STATUS[record.status];
  const toggle = (id: string) => setChosen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const extra = n ? <span className="ck-cta__sub">+ {plural(n, 'acompanhante', 'acompanhantes')}</span> : null;

  return (
    <div className="ck-panel">
      <PanelHead onClose={onClose}>
        <Badge tone={status.tone} dot>{status.label}</Badge>
        {record.status === 'accepted' && record.approval_status !== 'approved' && <ApprovalBadge status={record.approval_status} />}
        {record.wave && <Badge tone="gold">{record.wave}</Badge>}
      </PanelHead>

      <div className="ck-person">
        {record.salutation && <div className="ck-person__salutation">{record.salutation}</div>}
        <h2 className="ck-person__name" ref={heading} tabIndex={-1}>{personName(record)}</h2>
        {record.organization && <div className="ck-person__org">{record.organization}</div>}
      </div>

      {record.pass_type ? (
        <section className="ck-pass" style={{ '--pass-color': passColor(record.pass_type.color) } as CSSProperties} aria-label="Tipo de acesso">
          <div className="ck-pass__label">Tipo de acesso</div>
          <PassChip name={record.pass_type.name} color={record.pass_type.color} size="lg" />
          {record.pass_type.accesses.length > 0 && <AccessList accesses={record.pass_type.accesses} className="ck-pass__list" />}
        </section>
      ) : record.approval_status === 'approved' && event.requires_approval ? (
        <p className="ck-panel__note">Aprovado sem tipo de acesso atribuído.</p>
      ) : null}

      {v.kind === 'already' && (
        <div className="ck-notice ck-notice--warning" role="status">
          <TriangleAlert aria-hidden />
          <div>
            <strong>Entrada já registada às {formatTime(v.at, event.timezone)}</strong>
            <p>
              {v.pending
                ? `Falta registar ${plural(v.pending, 'acompanhante', 'acompanhantes')}. Pode fazê-lo agora.`
                : 'Não volte a dar entrada: confirme a identidade se tiver dúvidas.'}
            </p>
          </div>
        </div>
      )}
      {v.kind === 'blocked' && (
        <div className={`ck-notice ck-notice--${v.severe ? 'danger' : 'warning'}`} role="alert">
          {v.severe ? <CircleX aria-hidden /> : <TriangleAlert aria-hidden />}
          <div>
            <strong>{BLOCKED_TEXT[v.status].title}</strong>
            <p>{BLOCKED_TEXT[v.status].text} Só dê entrada com indicação da organização.</p>
          </div>
        </div>
      )}
      {v.kind === 'unapproved' && (
        <div className={`ck-notice ck-notice--${v.severe ? 'danger' : 'warning'}`} role="alert">
          {v.severe ? <CircleX aria-hidden /> : <TriangleAlert aria-hidden />}
          <div>
            <strong>{UNAPPROVED_TEXT[v.approval].title}</strong>
            <p>{UNAPPROVED_TEXT[v.approval].text} Só dê entrada com indicação da organização.</p>
          </div>
        </div>
      )}

      {record.companions.length > 0 && (
        <fieldset className="ck-companions">
          <legend>Acompanhantes</legend>
          <ul>
            {record.companions.map((c) => {
              const inside = !!c.checked_in_at;
              return (
                <li key={c.id}>
                  <label className={['ck-companion', inside && 'is-in'].filter(Boolean).join(' ')}>
                    <input
                      type="checkbox"
                      checked={inside || chosen.has(c.id)}
                      disabled={inside || busy}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="ck-companion__name">{c.full_name}</span>
                    {inside && <span className="ck-companion__in">Entrou às {formatTime(c.checked_in_at, event.timezone)}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      {record.plus_ones_allowed > record.companions.length && (
        <p className="ck-panel__note">
          {record.companions.length
            ? `O convite admite ${plural(record.plus_ones_allowed, 'acompanhante', 'acompanhantes')}; foram indicados ${record.companions.length}.`
            : `O convite admite ${plural(record.plus_ones_allowed, 'acompanhante', 'acompanhantes')}, mas não foram indicados nomes.`}
        </p>
      )}

      <div className="ck-panel__actions">
        {v.kind === 'ready' && (
          <Button variant="primary" size="lg" block className="ck-cta" icon={<Check />} loading={busy} onClick={() => void onRegister(ids, false)}>
            <span className="ck-cta__label">Registar entrada{extra}</span>
          </Button>
        )}
        {v.kind === 'already' && v.pending > 0 && (
          // Se a entrada foi dada sem confirmação, os acompanhantes também precisam de p_force.
          <Button variant="primary" size="lg" block className="ck-cta" icon={<Check />} loading={busy} disabled={!n} onClick={() => void onRegister(ids, needsForce(record))}>
            {n ? `Registar ${plural(n, 'acompanhante', 'acompanhantes')}` : 'Selecione os acompanhantes'}
          </Button>
        )}
        {(v.kind === 'blocked' || v.kind === 'unapproved') && (
          <Button variant={v.severe ? 'danger' : 'secondary'} size="lg" block className="ck-cta ck-cta--force" loading={busy} onClick={() => void onRegister(ids, true)}>
            <span className="ck-cta__label">Dar entrada mesmo assim{extra}</span>
          </Button>
        )}
        {v.kind === 'ready'
          ? <Button size="lg" block onClick={onClose}>Cancelar</Button>
          : <Button size="lg" block onClick={onClose} icon={<ScanLine />}>Próximo convidado</Button>}
        {canEdit && record.checked_in_at && (
          <Button variant="danger-ghost" block icon={<Undo2 />} disabled={busy} onClick={onUndo}>Anular entrada</Button>
        )}
      </div>
    </div>
  );
}

function NotFoundPanel({ input, event, onClose, onSearch }: { input: string; event: EventRecord; onClose: () => void; onSearch: () => void }) {
  const isLink = /^[a-z]+:\/\//i.test(input.trim());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="ck-panel ck-panel--center" role="alert">
      <div className="ck-big-icon ck-big-icon--danger"><CircleX aria-hidden /></div>
      <h2 className="ck-panel__title" ref={heading} tabIndex={-1}>Convite não encontrado</h2>
      <p className="ck-panel__text">
        {isLink ? 'O link lido' : <>O código <span className="mono">{formatCode(input)}</span></>} não corresponde a nenhum convite de «{event.name}».
      </p>
      <p className="ck-panel__text muted">Confirme que o evento selecionado é o correto, ou pesquise pelo nome do convidado.</p>
      <div className="ck-panel__actions">
        <Button variant="primary" size="lg" block icon={<ScanLine />} onClick={onClose}>Ler outro código</Button>
        <Button size="lg" block icon={<Search />} onClick={onSearch}>Pesquisar por nome</Button>
      </div>
    </div>
  );
}

function SuccessPanel({ panel, event, onClose }: { panel: Extract<Panel, { kind: 'success' }>; event: EventRecord; onClose: () => void }) {
  const { record, companions, firstEntry, forced } = panel;
  const title = firstEntry ? 'Entrada registada' : companions ? 'Acompanhantes registados' : 'Sem alterações';
  const lines = [
    firstEntry && companions ? `com ${plural(companions, 'acompanhante', 'acompanhantes')}` : null,
    !firstEntry && companions ? plural(companions, 'acompanhante registado', 'acompanhantes registados') : null,
  ].filter(Boolean);
  return (
    <div className="ck-panel ck-panel--center ck-success" role="status" aria-live="assertive">
      <div className="ck-big-icon ck-big-icon--success"><CircleCheckBig aria-hidden /></div>
      <div className="ck-success__title">{title}</div>
      <div className="ck-success__name">{personName(record)}</div>
      {lines.length > 0 && <div className="ck-success__extra">{lines.join(' · ')}</div>}
      {record.pass_type && (
        <div className="ck-success__pass"><PassDot color={record.pass_type.color} />{record.pass_type.name}</div>
      )}
      <div className="ck-success__time">
        {formatTime(record.checked_in_at, event.timezone)}
        {forced ? (record.status === 'accepted' ? ' · sem aprovação da equipa' : ' · sem confirmação de presença') : ''}
      </div>
      <div className="ck-success__countdown" aria-hidden><span style={{ animationDuration: `${RETURN_AFTER_MS}ms` }} /></div>
      <Button size="lg" className="ck-success__next" icon={<ScanLine />} onClick={onClose}>Próximo convidado</Button>
    </div>
  );
}

// ───────── Últimas entradas (neste dispositivo) ─────────

function RecentList({ entries, event, onOpen, onClear }: {
  entries: RecentEntry[];
  event: EventRecord;
  onOpen: (r: CheckinRecord) => void;
  onClear: () => void;
}) {
  const shown = entries.slice(0, 12);
  return (
    <section className="ck-recent" aria-labelledby="ck-recent-title">
      <header className="ck-recent__head">
        <h2 id="ck-recent-title"><History aria-hidden />Últimas entradas</h2>
        {entries.length > 0 && <Button variant="ghost" size="sm" icon={<X />} onClick={onClear}>Limpar lista</Button>}
      </header>
      {shown.length === 0 ? (
        <p className="ck-recent__empty">As entradas que registar neste dispositivo aparecem aqui, para consulta rápida.</p>
      ) : (
        <ul className="ck-recent__list">
          {shown.map((e) => (
            <li key={e.key}>
              <button type="button" className={['ck-recent__item', e.undone && 'is-undone'].filter(Boolean).join(' ')} onClick={() => onOpen(e.record)}>
                <span className="ck-recent__time tabular">{formatTime(e.at, event.timezone)}</span>
                <span className="ck-recent__who">
                  <span className="ck-recent__name">
                    {e.record.pass_type && <span title={e.record.pass_type.name}><PassDot color={e.record.pass_type.color} /></span>}
                    {personName(e.record)}
                  </span>
                  {e.record.organization && <span className="ck-recent__org">{e.record.organization}</span>}
                </span>
                <span className="ck-recent__tags">
                  {e.companions > 0 && <Badge>+{e.companions}</Badge>}
                  {e.forced && <Badge tone="warning">{forcedLabel(e.record)}</Badge>}
                  {e.undone && <Badge tone="danger">Anulada</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────── Estado ─────────

interface LiveStats {
  stats: EventStats | null;
  failed: boolean;
  refresh: () => void;
}

/** Contagem de entradas, atualizada a cada 15 s (e logo depois de cada registo). Falhas não interrompem a porta. */
function useLiveStats(eventId: string): LiveStats {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = (force = false) => {
      if (!force && document.hidden) return;
      api.events.stats(eventId).then(
        (s) => { if (alive) { setStats(s); setFailed(false); } },
        () => { if (alive) setFailed(true); },
      );
    };
    run(true);
    const t = setInterval(run, STATS_EVERY_MS);
    return () => { alive = false; clearInterval(t); };
  }, [eventId, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return useMemo(() => ({ stats, failed, refresh }), [stats, failed, refresh]);
}

/**
 * Entradas registadas por este utilizador nesta sessão do browser, por evento. Ao abrir o balcão
 * apagam-se as de outros utilizadores (outra pessoa que usou o mesmo separador antes).
 */
function useRecent(userId: string | null, eventId: string) {
  const key = userId ? recentKey(userId, eventId) : null;
  const [entries, setEntries] = useState<RecentEntry[]>(() => {
    if (!key) return [];
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? (parsed as RecentEntry[]).filter((e) => e && typeof e.key === 'string' && e.record) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (!userId) return;
    try {
      const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i) ?? '');
      for (const k of foreignRecentKeys(keys, userId)) sessionStorage.removeItem(k);
    } catch { /* sem armazenamento: nada a limpar */ }
  }, [userId]);
  useEffect(() => {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(entries)); } catch { /* sem armazenamento: fica só em memória */ }
  }, [key, entries]);
  return [entries, setEntries] as const;
}
