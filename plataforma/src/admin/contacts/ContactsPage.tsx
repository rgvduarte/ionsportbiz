import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Download, EyeOff, FileUp, MailPlus, Plus, SearchX, ShieldCheck, Users, X } from 'lucide-react';
import { api, type Contact, type ContactQuery } from '../../lib/api';
import { contactsToCsv } from '../../lib/csv';
import { formatDateTime, formatNumber, formatShortDate, fullName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { usePermissions } from '../../app/AuthProvider';
import {
  ActionMenu, Alert, Avatar, Badge, Button, ButtonLink, Card, EmptyState, LoadError, PageHeader, Pagination, SearchInput, Select, Skeleton,
  SortHeader, useToast,
} from '../../ui';
import { ContactFormDialog } from './ContactFormDialog';
import { InviteToEventDialog } from './InviteToEventDialog';
import { ErasureBanner, ErasureQueue } from './ErasureRequests';
import { pendingErasureRequests } from './erasureApi';
import { ConsentBadge, TagList, datedName, downloadFile } from './shared';
import './contacts.css';

const PAGE_SIZE = 25;
type SortColumn = NonNullable<ContactQuery['sort']>['column'];

// Parâmetros do endereço em português, para os links partilhados serem legíveis.
const SORT_PARAM: Record<SortColumn, string> = { last_name: 'nome', organization: 'entidade', created_at: 'criado' };
const SORT_FROM_PARAM = Object.fromEntries(Object.entries(SORT_PARAM).map(([k, v]) => [v, k])) as Record<string, SortColumn>;

function readQuery(sp: URLSearchParams): ContactQuery {
  const consent = sp.get('comunicacoes');
  const rawSort = sp.get('ordem') ?? 'nome';
  const desc = rawSort.startsWith('-');
  const column = SORT_FROM_PARAM[desc ? rawSort.slice(1) : rawSort] ?? 'last_name';
  return {
    search: sp.get('q')?.trim() || undefined,
    segment: sp.get('segmento') || undefined,
    tag: sp.get('etiqueta') || undefined,
    consent: consent === 'sim' ? true : consent === 'nao' ? false : undefined,
    page: Math.max(0, (Number(sp.get('pagina')) || 1) - 1),
    pageSize: PAGE_SIZE,
    sort: { column, ascending: !desc },
  };
}

export function ContactsPage() {
  const can = usePermissions();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => readQuery(params), [params]);
  const queryKey = JSON.stringify(query);
  const filtered = !!(query.search || query.segment || query.tag || query.consent !== undefined);

  const list = useAsync(() => api.contacts.list(query), [queryKey]);
  // Pedidos de eliminação por tratar: aviso no topo e fila própria (?rgpd=pendentes).
  const erasure = useAsync(() => pendingErasureRequests(), []);
  const showErasure = params.get('rgpd') === 'pendentes';
  const erasurePending = useMemo(() => new Set((erasure.data ?? []).map((r) => r.contact_id)), [erasure.data]);
  const facets = useAsync(() => Promise.all([api.contacts.segments(), api.contacts.tags()]), []);
  const [segments, tags] = facets.data ?? [[], []];

  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const update = useCallback((patch: Record<string, string | null>, keepPage = false) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!keepPage) next.delete('pagina');
      return next;
    }, { replace: true });
  }, [setParams]);

  const onSearch = useCallback((v: string) => update({ q: v.trim() || null }), [update]);
  // Abrir ou fechar a fila de pedidos fica no histórico, para o botão Voltar funcionar.
  const showErasureQueue = (open: boolean) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (open) next.set('rgpd', 'pendentes');
    else next.delete('rgpd');
    return next;
  });
  // Limpa os filtros mas mantém a ordenação escolhida.
  const clearFilters = () => setParams(() => {
    const next = new URLSearchParams();
    const sort = params.get('ordem');
    if (sort) next.set('ordem', sort);
    return next;
  }, { replace: true });

  // Se a página pedida deixou de existir (ex.: depois de eliminar), volta à última.
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  useEffect(() => {
    if (list.data && !list.data.rows.length && query.page > 0 && total > 0) {
      update({ pagina: String(Math.ceil(total / PAGE_SIZE)) }, true);
    }
  }, [list.data, query.page, total, update]);

  // ───────── Seleção ─────────
  const pageIds = rows.filter((r) => !r.anonymized_at).map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const headerCheck = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheck.current) headerCheck.current.indeterminate = pageSelected > 0 && pageSelected < pageIds.length;
  }, [pageSelected, pageIds.length]);

  const toggle = (c: Contact) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(c.id)) next.delete(c.id);
    else next.set(c.id, c);
    return next;
  });
  const togglePage = () => setSelected((prev) => {
    const next = new Map(prev);
    const selectable = rows.filter((r) => !r.anonymized_at);
    const all = selectable.every((r) => next.has(r.id));
    for (const r of selectable) {
      if (all) next.delete(r.id);
      else next.set(r.id, r);
    }
    return next;
  });
  const clearSelection = () => setSelected(new Map());

  // ───────── Exportação ─────────
  const exportAll = async () => {
    setExporting(true);
    try {
      const all: Contact[] = [];
      for (let page = 0; ; page++) {
        const res = await api.contacts.list({ ...query, page, pageSize: 1000 });
        all.push(...res.rows);
        if (all.length >= res.total || !res.rows.length) break;
      }
      downloadFile(datedName('contactos', 'csv'), contactsToCsv(all), 'text/csv;charset=utf-8');
      toast.success(`${formatNumber(all.length)} ${all.length === 1 ? 'contacto exportado' : 'contactos exportados'}.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setExporting(false);
    }
  };

  const exportSelection = () => {
    const chosen = [...selected.values()];
    downloadFile(datedName('contactos-selecao', 'csv'), contactsToCsv(chosen), 'text/csv;charset=utf-8');
    toast.success(`${formatNumber(chosen.length)} ${chosen.length === 1 ? 'contacto exportado' : 'contactos exportados'}.`);
  };

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, c: Contact) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, label')) return;
    // Um clique ao lado da caixa de seleção também seleciona.
    if (target.closest('td.check')) {
      if (can.edit && !c.anonymized_at) toggle(c);
      return;
    }
    if (e.metaKey || e.ctrlKey) window.open(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/admin/contactos/${c.id}`, '_blank');
    else navigate(`/admin/contactos/${c.id}`);
  };

  const setSort = (s: { column: SortColumn; ascending: boolean }) =>
    update({ ordem: s.column === 'last_name' && s.ascending ? null : `${s.ascending ? '' : '-'}${SORT_PARAM[s.column]}` });

  const colSpan = can.edit ? 7 : 6;
  const firstLoad = list.loading && !list.data;

  // A exportação em massa fica com quem edita, como a exportação RGPD de um contacto (contact_export).
  const headerActions = can.edit ? (
    <div className="ct-page-actions">
      <ButtonLink to="/admin/contactos/importar" icon={<FileUp />} className="ct-wide-only">Importar</ButtonLink>
      <Button icon={<Download />} onClick={() => void exportAll()} loading={exporting} disabled={!total} className="ct-wide-only">Exportar CSV</Button>
      <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)} className="ct-page-actions__primary">Novo contacto</Button>
      <span className="ct-narrow-only">
        <ActionMenu label="Mais ações" items={[
          { label: 'Importar contactos', icon: <FileUp />, onSelect: () => navigate('/admin/contactos/importar') },
          { label: exporting ? 'A exportar…' : 'Exportar CSV', icon: <Download />, onSelect: () => void exportAll(), disabled: !total || exporting },
        ]} />
      </span>
    </div>
  ) : undefined;

  return (
    <>
      <div className="ct-page-head">
        <PageHeader
          title="Contactos"
          description="Pessoas que pode convidar para os eventos. Cada contacto é único e reutilizado entre eventos, com o histórico de convites e respostas."
          actions={headerActions}
        />
      </div>

      {!showErasure && !!erasure.data?.length && (
        <ErasureBanner requests={erasure.data} onOpen={() => showErasureQueue(true)} />
      )}

      {showErasure ? (
        <ErasureQueue requests={erasure} isAdmin={can.admin} onClose={() => showErasureQueue(false)} />
      ) : (
        <Card padded={false} className="ct-list">
          <div className="ui-toolbar ct-toolbar" role="search">
            <SearchInput
              className="ui-toolbar__grow"
              value={query.search ?? ''}
              onSearch={onSearch}
              placeholder="Nome, email, entidade ou telemóvel"
            />
            <Select
              aria-label="Segmento"
              value={query.segment ?? ''}
              onChange={(e) => update({ segmento: e.target.value || null })}
              placeholder="Segmento: todos"
              options={[...new Set([...segments, ...(query.segment ? [query.segment] : [])])].map((s) => ({ value: s, label: s }))}
            />
            <Select
              aria-label="Etiqueta"
              value={query.tag ?? ''}
              onChange={(e) => update({ etiqueta: e.target.value || null })}
              placeholder="Etiqueta: todas"
              options={[...new Set([...tags, ...(query.tag ? [query.tag] : [])])].map((t) => ({ value: t, label: t }))}
            />
            <Select
              aria-label="Comunicações"
              value={query.consent === undefined ? '' : query.consent ? 'sim' : 'nao'}
              onChange={(e) => update({ comunicacoes: e.target.value || null })}
              placeholder="Comunicações: todos"
              options={[{ value: 'sim', label: 'Aceitam comunicações' }, { value: 'nao', label: 'Sem consentimento' }]}
            />
            {filtered && (
              <Button variant="ghost" size="sm" icon={<X />} onClick={clearFilters}>Limpar filtros</Button>
            )}
          </div>

          {can.edit && selected.size > 0 && (
            <div className="ui-bulkbar ct-bulkbar" role="region" aria-label="Ações para os contactos selecionados">
              <strong className="tabular">
                {selected.size === 1 ? '1 contacto selecionado' : `${formatNumber(selected.size)} contactos selecionados`}
              </strong>
              <div className="ui-row">
                <Button size="sm" variant="primary" icon={<MailPlus />} onClick={() => setInviting(true)}>Convidar para evento…</Button>
                <Button size="sm" icon={<Download />} onClick={exportSelection}>Exportar seleção</Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>Limpar seleção</Button>
              </div>
            </div>
          )}

          {!!list.error && !!list.data && (
            <div className="ct-inline-error">
              <Alert tone="danger">
                Não foi possível atualizar a lista. <button type="button" className="ct-link-btn" onClick={list.reload}>Tentar novamente</button>
              </Alert>
            </div>
          )}

          {!!list.error && !list.data ? (
            <LoadError error={list.error} onRetry={list.reload} />
          ) : !firstLoad && total === 0 ? (
            filtered ? (
              <EmptyState icon={<SearchX />} title="Nenhum contacto corresponde aos filtros"
                actions={<Button onClick={clearFilters}>Limpar filtros</Button>}>
                Experimente outra pesquisa ou retire alguns filtros.
              </EmptyState>
            ) : (
              <EmptyState icon={<Users />} title="Ainda não há contactos"
                actions={can.edit ? (
                  <>
                    <ButtonLink to="/admin/contactos/importar" icon={<FileUp />}>Importar ficheiro CSV</ButtonLink>
                    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>Novo contacto</Button>
                  </>
                ) : undefined}>
                {can.edit
                  ? 'Importe a sua lista a partir de um ficheiro CSV (exportado do Excel) ou acrescente os contactos um a um.'
                  : 'Quando a equipa acrescentar contactos, aparecem aqui.'}
              </EmptyState>
            )
          ) : (
            <>
              <div className={['ui-table-wrap', list.loading && list.data ? 'ct-busy' : ''].filter(Boolean).join(' ')} aria-busy={list.loading}>
                <table className="ui-table ct-table">
                  <caption className="visually-hidden">Lista de contactos</caption>
                  <thead>
                    <tr>
                      {can.edit && (
                        <th className="check" scope="col">
                          <input
                            ref={headerCheck}
                            type="checkbox"
                            className="ct-check"
                            aria-label="Selecionar os contactos desta página"
                            checked={pageIds.length > 0 && pageSelected === pageIds.length}
                            onChange={togglePage}
                            disabled={!pageIds.length}
                          />
                        </th>
                      )}
                      <th scope="col"><SortHeader column="last_name" label="Nome" sort={query.sort} onSort={setSort} /></th>
                      <th scope="col" className="ct-hide-md"><SortHeader column="organization" label="Entidade" sort={query.sort} onSort={setSort} /></th>
                      <th scope="col" className="ct-hide-lg">Segmento</th>
                      <th scope="col" className="ct-hide-lg">Etiquetas</th>
                      <th scope="col" className="ct-hide-md">Comunicações</th>
                      <th scope="col" className="ct-hide-md"><SortHeader column="created_at" label="Criado" sort={query.sort} onSort={setSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {firstLoad
                      ? Array.from({ length: 8 }, (_, i) => (
                        <tr key={i}>
                          <td colSpan={colSpan}><Skeleton height={18} width={`${60 + ((i * 17) % 35)}%`} /></td>
                        </tr>
                      ))
                      : rows.map((c) => {
                        const isSelected = selected.has(c.id);
                        const anonymized = !!c.anonymized_at;
                        return (
                          <tr key={c.id} data-href className={[isSelected && 'is-selected', anonymized && 'ct-row--anon'].filter(Boolean).join(' ')}
                            onClick={(e) => onRowClick(e, c)}>
                            {can.edit && (
                              <td className="check">
                                <input type="checkbox" className="ct-check" checked={isSelected} onChange={() => toggle(c)}
                                  disabled={anonymized} aria-label={`Selecionar ${fullName(c)}`} />
                              </td>
                            )}
                            <td>
                              <div className="ct-person">
                                {anonymized
                                  ? <span className="ui-avatar ct-avatar-anon" aria-hidden><EyeOff /></span>
                                  : <Avatar name={fullName(c)} />}
                                <div className="ct-person__text">
                                  <Link to={`/admin/contactos/${c.id}`} className="ct-person__name">
                                    {anonymized ? 'Contacto anonimizado' : fullName(c)}
                                  </Link>
                                  {c.marketing_consent && (
                                    <span className="ct-consent-mark" title="Aceita comunicações futuras">
                                      <ShieldCheck aria-hidden /><span className="visually-hidden">Aceita comunicações futuras</span>
                                    </span>
                                  )}
                                  {c.email && <div className="secondary ct-ellipsis">{c.email}</div>}
                                  {c.organization && <div className="secondary ct-ellipsis ct-only-md">{c.organization}</div>}
                                  {erasurePending.has(c.id) && (
                                    <div className="ct-person__flag"><Badge tone="danger" title="Pediu a eliminação dos dados pessoais">Eliminação pedida</Badge></div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="ct-hide-md">
                              {c.organization ? <div className="ct-ellipsis">{c.organization}</div> : <span className="muted">—</span>}
                              {c.job_title && <div className="secondary ct-ellipsis">{c.job_title}</div>}
                            </td>
                            <td className="ct-hide-lg">{c.segment ?? <span className="muted">—</span>}</td>
                            <td className="ct-hide-lg"><TagList tags={c.tags} /></td>
                            <td className="ct-hide-md"><ConsentBadge contact={c} /></td>
                            <td className="ct-hide-md tabular" title={formatDateTime(c.created_at)}>{formatShortDate(c.created_at)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {!firstLoad && (
                <Pagination page={query.page} pageSize={PAGE_SIZE} total={total} onPage={(p) => update({ pagina: p > 0 ? String(p + 1) : null }, true)} />
              )}
            </>
          )}
        </Card>
      )}

      <ContactFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setCreating(false);
          navigate(`/admin/contactos/${c.id}`);
        }}
      />
      <InviteToEventDialog
        open={inviting}
        onClose={() => setInviting(false)}
        contactIds={[...selected.keys()]}
        onDone={(created) => { if (created > 0) clearSelection(); }}
      />
    </>
  );
}
