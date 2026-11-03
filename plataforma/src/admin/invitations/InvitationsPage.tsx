import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Ban, Download, FileUp, Layers, MailCheck, Send, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import './invitations.css';
import { api, type InvitationRow } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formalName, formatDateTime, formatNumber, formatTime, fullName } from '../../lib/format';
import { usePermissions } from '../../app/AuthProvider';
import {
  ActionMenu, Alert, Avatar, Button, ButtonLink, Card, Dialog, EmptyState, Field, Input, LoadError, Pagination, Progress,
  SearchInput, Select, Skeleton, useConfirm, useToast,
} from '../../ui';
import { useEventContext } from '../events/EventLayout';
import {
  attendanceCsv, attendanceFileName, countByStatus, filterRows, headcount, NO_WAVE, runBulk, STATUS_FILTERS,
  type BulkResult, type StatusFilter,
} from './guestList';
import { ChannelIcon, channelLabel, downloadBlob, plural, StatusBadge, When } from './parts';
import { AddGuestsDialog } from './AddGuestsDialog';
import { SendDialog } from './SendDialog';
import { InvitationDrawer } from './InvitationDrawer';

const PAGE_SIZE = 50;

type DialogKind = 'add' | 'send' | 'wave' | null;

export function InvitationsPage() {
  const { event } = useEventContext();
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const list = useAsync(() => api.invitations.list(event.id), [event.id]);
  const templates = useAsync(() => api.templates.list(event.id), [event.id]);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [wave, setWave] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const filtered = useMemo(() => filterRows(rows, { status, wave, search }), [rows, status, wave, search]);
  const counts = useMemo(() => countByStatus(rows, { wave, search }), [rows, wave, search]);
  const totals = useMemo(() => headcount(rows), [rows]);
  const waves = useMemo(() => [...new Set(rows.map((r) => r.wave).filter((w): w is string => !!w))].sort((a, b) => a.localeCompare(b, 'pt-PT')), [rows]);
  const hasNoWave = rows.some((r) => !r.wave);
  const invitedContactIds = useMemo(() => new Set(rows.map((r) => r.contact_id)), [rows]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  // Mudar de filtro limpa a seleção: as ações em lote nunca afetam convidados escondidos.
  useEffect(() => {
    setSelected(new Set());
    setPage(0);
  }, [status, wave, search, event.id]);

  const openId = params.get('convite');
  const openDrawer = useCallback((id: string) => {
    setParams((p) => { const next = new URLSearchParams(p); next.set('convite', id); return next; }, { replace: false });
  }, [setParams]);
  const closeDrawer = useCallback(() => {
    setParams((p) => { const next = new URLSearchParams(p); next.delete('convite'); return next; }, { replace: true });
  }, [setParams]);

  const reload = list.reload;
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const pageIds = visible.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => setSelected((s) => {
    const next = new Set(s);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id)); else pageIds.forEach((id) => next.add(id));
    return next;
  });

  const report = (r: BulkResult, done: (n: number) => string) => {
    if (r.ok) toast.success(done(r.ok));
    if (r.failed) toast.error(`${plural(r.failed, 'convite não foi alterado', 'convites não foram alterados')}: ${r.error instanceof Error ? r.error.message : 'erro desconhecido'}`);
  };

  const finishBulk = () => {
    setSelected(new Set());
    reload();
  };

  const onMarkSent = async () => {
    // Só convites ainda sem resposta: quem já respondeu ou foi cancelado fica como está.
    const ids = selectedRows.filter((r) => r.status === 'draft' || r.status === 'sent' || r.status === 'opened').map((r) => r.id);
    if (!ids.length) return toast.info('Os convites selecionados já têm resposta ou estão cancelados.');
    const ok = await confirm({
      title: `Marcar ${plural(ids.length, 'convite', 'convites')} como enviado${ids.length === 1 ? '' : 's'}?`,
      message: 'Use quando o convite foi entregue por outra via — em mão, por telefone ou pelo secretariado. Os convites por enviar passam a «Enviado» e o envio fica registado no histórico.',
      confirmLabel: 'Marcar como enviado',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const n = await api.invitations.markSent(ids, 'manual');
      toast.success(`${plural(n, 'convite marcado', 'convites marcados')} como enviado${n === 1 ? '' : 's'}.`);
      finishBulk();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    const targets = selectedRows.filter((r) => r.status !== 'cancelled');
    if (!targets.length) return toast.info('Os convites selecionados já estão cancelados.');
    const ok = await confirm({
      title: `Cancelar ${plural(targets.length, 'convite', 'convites')}?`,
      message: 'Os convidados deixam de conseguir abrir o convite pessoal e não entram na contagem do evento. Pode reativar cada convite mais tarde, na ficha do convidado.',
      confirmLabel: 'Cancelar convites',
      cancelLabel: 'Voltar',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await runBulk(targets, (t) => api.invitations.update(t.id, { status: 'cancelled' }));
    setBusy(false);
    report(r, (n) => `${plural(n, 'convite cancelado', 'convites cancelados')}.`);
    finishBulk();
  };

  const onRemove = async () => {
    const targets = selectedRows;
    const ok = await confirm({
      title: `Remover ${plural(targets.length, 'convidado', 'convidados')} da lista?`,
      message: 'São eliminados o convite, as respostas, os acompanhantes e o histórico neste evento. Os contactos mantêm-se no CRM. Esta ação não pode ser anulada.',
      confirmLabel: 'Remover da lista',
      cancelLabel: 'Voltar',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await runBulk(targets, (t) => api.invitations.remove(t.id));
    setBusy(false);
    report(r, (n) => `${plural(n, 'convidado removido', 'convidados removidos')} da lista.`);
    finishBulk();
  };

  const onExport = () => {
    if (!filtered.length) return;
    downloadBlob(attendanceFileName(event), attendanceCsv(filtered, event), 'text/csv;charset=utf-8');
    toast.success(`Lista exportada: ${plural(filtered.length, 'convidado', 'convidados')}.`);
  };

  const filtersActive = status !== 'all' || !!wave || !!search;
  const clearFilters = () => {
    setStatus('all');
    setWave('');
    setSearch('');
  };

  const statusLine = (
    <>
      {plural(totals.invited, 'convidado', 'convidados')} · {plural(totals.accepted, 'confirmado', 'confirmados')}
      {totals.checkedIn > 0 && <> · {plural(totals.checkedIn, 'entrada', 'entradas')}</>}
    </>
  );

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <LoadError error={list.error} onRetry={reload} />;
  } else if (!list.data) {
    body = <TableSkeleton />;
  } else if (!rows.length) {
    body = (
      <EmptyState
        icon={<Users />}
        title="Ainda não há convidados"
        actions={can.edit && (
          <>
            <Button variant="primary" icon={<UserPlus />} onClick={() => setDialog('add')}>Adicionar convidados</Button>
            <ButtonLink to="/admin/contactos/importar" icon={<FileUp />}>Importar ficheiro</ButtonLink>
          </>
        )}
      >
        <span className="inv-measure">
          {can.edit
            ? 'Escolha contactos do CRM ou importe um ficheiro CSV (pode exportá-lo do Excel). Cada convidado recebe um link pessoal para responder e um código para a entrada no dia do evento.'
            : 'A equipa ainda não adicionou convidados a este evento.'}
        </span>
      </EmptyState>
    );
  } else if (!filtered.length) {
    body = (
      <EmptyState
        icon={<Users />}
        title="Nenhum convidado corresponde aos filtros"
        actions={<Button onClick={clearFilters}>Limpar filtros</Button>}
      >
        Experimente outro estado, outra vaga ou outra pesquisa.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <div className="ui-table-wrap">
          <table className={['ui-table', 'inv-table', busy && 'inv-busy'].filter(Boolean).join(' ')}>
            <thead>
              <tr>
                {can.edit && (
                  <th className="check">
                    <input
                      type="checkbox"
                      className="inv-check"
                      aria-label="Selecionar os convidados desta página"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                      onChange={togglePage}
                    />
                  </th>
                )}
                <th>Convidado</th>
                <th className="inv-hide-md">Estado</th>
                <th className="inv-hide-md">Vaga</th>
                <th className="inv-hide-md num" title="Acompanhantes indicados / permitidos">Acomp.</th>
                <th className="inv-hide-lg">Envio</th>
                <th className="inv-hide-lg">Resposta</th>
                <th className="inv-hide-md">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <GuestRow
                  key={r.id}
                  row={r}
                  tz={event.timezone}
                  selectable={can.edit}
                  selected={selected.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  onOpen={() => openDrawer(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        )}
      </>
    );
  }

  const eventClosedForSending = event.status === 'draft' || event.status === 'archived';
  const draftCount = rows.filter((r) => r.status === 'draft').length;

  return (
    <>
      <div className="inv-head">
        <div className="inv-head__text">
          <h2>Convidados</h2>
          <div className="inv-head__sub">{list.data ? statusLine : <Skeleton width={260} />}</div>
        </div>
        <div className="inv-head__aside">
          {list.data && (
            <div className="inv-capacity" role="group" aria-label="Pessoas esperadas">
              <div className="inv-capacity__nums">
                <strong className="tabular">{formatNumber(totals.expected)}</strong>
                <span>{event.capacity ? ` de ${formatNumber(event.capacity)} lugares` : ' pessoas esperadas'}</span>
              </div>
              {event.capacity ? (
                <Progress value={totals.expected / event.capacity} color={totals.expected > event.capacity ? 'var(--c-danger)' : undefined} />
              ) : null}
              <div className="inv-capacity__hint">{event.capacity ? 'Pessoas esperadas, com acompanhantes' : 'Com acompanhantes'}</div>
            </div>
          )}
          {can.edit && (
            <div className="inv-head__actions">
              <Button icon={<UserPlus />} onClick={() => setDialog('add')}>
                <span>Adicionar<span className="inv-hide-sm"> convidados</span></span>
              </Button>
              <Button variant="primary" icon={<Send />} onClick={() => setDialog('send')} disabled={!list.data || !rows.length}>
                <span>Enviar<span className="inv-hide-sm"> convites</span></span>{draftCount > 0 && <><span className="inv-btn-count" aria-hidden>{draftCount}</span><span className="visually-hidden"> ({draftCount} por enviar)</span></>}
              </Button>
            </div>
          )}
        </div>
      </div>

      {event.status === 'draft' && (
        <Alert tone="warning" className="inv-alert">
          O evento está em rascunho: pode preparar a lista, mas os links pessoais só abrem quando o estado do evento passar a «Aberto»
          {can.edit ? <>, em <Link to={`/admin/eventos/${event.id}/definicoes`} className="inv-alert-link">Definições</Link></> : null}.
        </Alert>
      )}
      {event.status === 'archived' && (
        <Alert tone="info" className="inv-alert">O evento está arquivado: os links pessoais já não funcionam.</Alert>
      )}

      <Card padded={false} className="inv-card">
        <div className="inv-segments" role="group" aria-label="Filtrar por estado">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={['inv-segment', f.value === 'cancelled' && 'inv-segment--muted'].filter(Boolean).join(' ')}
              aria-pressed={status === f.value}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
              <span className="inv-segment__count tabular">{list.data ? counts[f.value] : '–'}</span>
            </button>
          ))}
        </div>
        <div className="ui-toolbar inv-toolbar">
          <SearchInput value={search} onSearch={setSearch} placeholder="Pesquisar por nome, email ou entidade" className="ui-toolbar__grow" />
          {(waves.length > 0 || hasNoWave) && (
            <Select
              aria-label="Filtrar por vaga"
              value={wave}
              onChange={(e) => setWave(e.target.value)}
              placeholder="Todas as vagas"
              options={[...waves.map((w) => ({ value: w, label: w })), ...(hasNoWave && waves.length ? [{ value: NO_WAVE, label: 'Sem vaga' }] : [])]}
            />
          )}
          <Button icon={<Download />} onClick={onExport} disabled={!filtered.length} title="Exportar a lista apresentada (CSV para Excel)">
            Exportar
          </Button>
        </div>

        {can.edit && selected.size > 0 && (
          <div className="ui-bulkbar inv-bulkbar" role="region" aria-label="Ações para os selecionados">
            <div className="inv-bulkbar__info">
              <strong>{plural(selected.size, 'selecionado', 'selecionados')}</strong>
              {allPageSelected && selected.size < filtered.length && (
                <button type="button" className="inv-link-btn" onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}>
                  Selecionar os {formatNumber(filtered.length)} da lista
                </button>
              )}
            </div>
            <div className="ui-row">
              <Button size="sm" icon={<Send />} onClick={() => setDialog('send')} disabled={busy}>Enviar email</Button>
              <Button size="sm" icon={<MailCheck />} onClick={() => void onMarkSent()} disabled={busy}>Marcar como enviado</Button>
              <Button size="sm" icon={<Layers />} onClick={() => setDialog('wave')} disabled={busy}>Alterar vaga</Button>
              <ActionMenu
                label="Mais ações"
                items={[
                  { label: 'Cancelar convites', icon: <Ban />, onSelect: () => void onCancel(), danger: true },
                  { label: 'Remover da lista', icon: <Trash2 />, onSelect: () => void onRemove(), danger: true },
                ]}
              />
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          </div>
        )}

        {!!list.error && list.data && <div className="inv-inline-error"><LoadError error={list.error} onRetry={reload} /></div>}
        {body}
      </Card>

      {filtersActive && list.data && filtered.length > 0 && (
        <p className="inv-footnote">
          {plural(filtered.length, 'convite corresponde', 'convites correspondem')} aos filtros.{' '}
          <button type="button" className="inv-link-btn" onClick={clearFilters}>Limpar filtros</button>
        </p>
      )}

      {dialog === 'add' && (
        <AddGuestsDialog
          event={event}
          invitedContactIds={invitedContactIds}
          waves={waves}
          onClose={() => setDialog(null)}
          onAdded={() => { setDialog(null); reload(); }}
        />
      )}
      {dialog === 'send' && (
        <SendDialog
          event={event}
          rows={rows}
          selectedIds={selected.size ? selected : null}
          templates={templates.data}
          templatesError={templates.error}
          blocked={eventClosedForSending}
          onClose={() => setDialog(null)}
          onSent={() => { setDialog(null); finishBulk(); }}
        />
      )}
      {dialog === 'wave' && (
        <WaveDialog
          rows={selectedRows}
          waves={waves}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setDialog(null);
            report(r, (n) => `Vaga alterada em ${plural(n, 'convite', 'convites')}.`);
            finishBulk();
          }}
        />
      )}
      {openId && (
        <InvitationDrawer
          id={openId}
          event={event}
          templates={templates.data}
          waves={waves}
          onClose={closeDrawer}
          onChanged={reload}
          onRemoved={() => { closeDrawer(); reload(); }}
        />
      )}
    </>
  );
}

function GuestRow({ row: r, tz, selectable, selected, onToggle, onOpen }: {
  row: InvitationRow;
  tz: string;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const name = formalName(r);
  const meta = [r.organization, r.job_title].filter(Boolean).join(' · ');
  const cancelled = r.status === 'cancelled';
  return (
    <tr className={[selected && 'is-selected', cancelled && 'inv-row--cancelled'].filter(Boolean).join(' ')} data-href onClick={onOpen}>
      {selectable && (
        <td className="check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="inv-check" checked={selected} onChange={onToggle} aria-label={`Selecionar ${fullName(r)}`} />
        </td>
      )}
      <td>
        <div className="inv-person">
          <Avatar name={fullName(r)} />
          <div className="inv-person__text">
            <button type="button" className="inv-person__name" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
              {name}
            </button>
            {meta && <div className="inv-person__meta">{meta}</div>}
            <div className="inv-person__mobile inv-only-md">
              <StatusBadge status={r.status} />
              {r.wave && <span className="inv-person__meta">{r.wave}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="inv-hide-md"><StatusBadge status={r.status} /></td>
      <td className="inv-hide-md">{r.wave ? <span className="inv-wave">{r.wave}</span> : <span className="muted">—</span>}</td>
      <td className="inv-hide-md num">
        {r.plus_ones_allowed > 0 || r.companions_count > 0
          ? <span title={`${r.companions_count} indicados de ${r.plus_ones_allowed} permitidos`}>{r.companions_count}/{r.plus_ones_allowed}</span>
          : <span className="muted">—</span>}
      </td>
      <td className="inv-hide-lg">
        {r.sent_at ? (
          <div className="inv-cell-stack">
            <span className="inv-sent" title={`${channelLabel(r.sent_channel)} · ${formatDateTime(r.sent_at, tz)}`}>
              {r.sent_channel && <ChannelIcon channel={r.sent_channel} />}
              <When iso={r.sent_at} tz={tz} />
            </span>
            {r.open_count > 0 && <span className="inv-cell-sub">Visto {r.open_count}×</span>}
          </div>
        ) : <span className="muted">—</span>}
      </td>
      <td className="inv-hide-lg"><When iso={r.responded_at} tz={tz} /></td>
      <td className="inv-hide-md">
        {r.checked_in_at ? (
          <span className="inv-in" title={formatDateTime(r.checked_in_at, tz)}>
            {formatTime(r.checked_in_at, tz)}
            {r.companions_checked_in > 0 && <span className="inv-cell-sub"> +{r.companions_checked_in}</span>}
          </span>
        ) : <span className="muted">—</span>}
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="inv-skeleton" aria-busy="true" aria-label="A carregar os convidados">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="inv-skeleton__row">
          <Skeleton width={32} height={32} style={{ borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <Skeleton width={`${40 + ((i * 13) % 30)}%`} height={14} />
            <Skeleton width="25%" height={12} style={{ marginTop: 6 }} />
          </div>
          <Skeleton width={84} height={22} style={{ borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

function WaveDialog({ rows, waves, onClose, onDone }: {
  rows: InvitationRow[];
  waves: string[];
  onClose: () => void;
  onDone: (r: BulkResult) => void;
}) {
  const shared = rows.every((r) => r.wave === rows[0]?.wave) ? rows[0]?.wave ?? '' : '';
  const [value, setValue] = useState(shared);
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await runBulk(rows, (row) => api.invitations.update(row.id, { wave: value.trim() || null }));
    setSaving(false);
    onDone(r);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Alterar vaga"
      description={`${plural(rows.length, 'convite selecionado', 'convites selecionados')}. As vagas organizam os envios e os números do painel.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="inv-wave-form" loading={saving}>
            {value.trim() ? 'Aplicar vaga' : 'Retirar vaga'}
          </Button>
        </>
      }
    >
      <form id="inv-wave-form" onSubmit={(e) => void submit(e)}>
        <Field label="Vaga" hint="Escolha uma existente ou escreva uma nova. Deixe em branco para retirar a vaga.">
          <Input value={value} onChange={(e) => setValue(e.target.value)} list="inv-wave-options" maxLength={80} placeholder="Ex.: Convidados de honra" autoFocus />
        </Field>
        <datalist id="inv-wave-options">
          {waves.map((w) => <option key={w} value={w} />)}
        </datalist>
      </form>
    </Dialog>
  );
}
