import { useMemo, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowUp, Pencil, Plus, QrCode, Sparkles, Ticket, Trash2, X } from 'lucide-react';
import './events.css';
import { api, type EventRecord, type InvitationRow, type PassType } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatNumber } from '../../lib/format';
import { usePermissions } from '../../app/AuthProvider';
import {
  ActionMenu, Alert, Button, Card, Dialog, EmptyState, Field, Input, LoadError, Skeleton, Textarea, useConfirm, useToast,
} from '../../ui';
import { AccessList, passColor, PassChip } from '../passes';
import { approvalListUrl, isPreApproved } from '../invitations/approval';
import { useEventContext } from './EventLayout';
import { isHexColor } from './eventForm';
import {
  accessSuggestions, ACCESS_MAX, DESCRIPTION_MAX, moveItem, NAME_MAX, PASS_COLORS, splitAccesses, SUGGESTED_PASS_TYPES, toPassTypeForm,
  toPassTypeInput, validatePassType, type PassTypeFormValues,
} from './passTypes';

const people = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

interface Usage {
  /** Confirmados e aprovados com este tipo. */
  approved: number;
  /** Os mesmos, com acompanhantes. */
  attendees: number;
  /** Aprovados antes de responderem. */
  preApproved: number;
}

export function PassTypesPage() {
  const { event } = useEventContext();
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const types = useAsync(() => api.passTypes.list(event.id), [event.id]);
  // Os números de utilização são complementares: se falharem, os cartões mostram-se sem eles.
  const stats = useAsync(() => api.events.stats(event.id).catch(() => null), [event.id]);
  const rows = useAsync(() => api.invitations.list(event.id).catch(() => null as InvitationRow[] | null), [event.id]);
  const [editing, setEditing] = useState<PassType | 'new' | null>(null);
  const [seeding, setSeeding] = useState(false);

  const list = useMemo(() => types.data ?? [], [types.data]);
  const usage = useMemo(() => {
    const map = new Map<string, Usage>();
    for (const t of list) map.set(t.id, { approved: 0, attendees: 0, preApproved: 0 });
    for (const b of stats.data?.by_pass_type ?? []) {
      const u = map.get(b.pass_type_id);
      if (u) Object.assign(u, { approved: b.approved, attendees: b.attendees });
    }
    for (const r of rows.data ?? []) {
      const u = r.pass_type_id ? map.get(r.pass_type_id) : undefined;
      if (u && isPreApproved(r)) u.preApproved++;
    }
    return map;
  }, [list, stats.data, rows.data]);
  // Aprovados (com presença confirmada) a quem falta o tipo: ex.: depois de eliminar um tipo.
  const withoutType = stats.data
    ? Math.max(0, stats.data.approval.approved - stats.data.by_pass_type.reduce((n, b) => n + b.approved, 0))
    : 0;

  const refresh = () => {
    types.reload();
    stats.reload();
    rows.reload();
  };

  const onSaved = (saved: PassType, isNew: boolean) => {
    setEditing(null);
    toast.success(isNew ? `Tipo de acesso «${saved.name}» criado.` : `Tipo de acesso «${saved.name}» atualizado.`);
    refresh();
  };

  const onDelete = async (p: PassType) => {
    const u = usage.get(p.id);
    const affected = (u?.approved ?? 0) + (u?.preApproved ?? 0);
    const ok = await confirm({
      title: `Eliminar «${p.name}»?`,
      message: affected ? (
        <>
          <strong>{people(affected, 'convidado aprovado usa', 'convidados aprovados usam')}</strong> este tipo de acesso. Continuam aprovados e com o
          código QR, mas ficam sem tipo de acesso: deixam de ver a lista de acessos e a receção deixa de ver o tipo. Pode atribuir-lhes outro
          tipo na lista de convidados, com «Aprovar…».
        </>
      ) : (
        <>Nenhum convidado aprovado usa este tipo de acesso. Esta ação não pode ser anulada.</>
      ),
      confirmLabel: 'Eliminar tipo de acesso',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.passTypes.remove(p.id);
      toast.success(`Tipo de acesso «${p.name}» eliminado.`);
      refresh();
    } catch (err) {
      toast.error(err);
    }
  };

  const createSuggested = async () => {
    setSeeding(true);
    const taken = new Set(list.map((t) => t.name.toLowerCase()));
    const missing = SUGGESTED_PASS_TYPES.filter((s) => !taken.has(s.name.toLowerCase()));
    let sort = list.length ? Math.max(...list.map((t) => t.sort)) + 1 : 0;
    try {
      for (const s of missing) await api.passTypes.save({ ...s, event_id: event.id, sort: sort++ });
      toast.success(`Criados ${missing.map((s) => s.name).join(' e ')}. Ajuste os acessos se for preciso.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setSeeding(false);
      refresh();
    }
  };

  let body: React.ReactNode;
  if (types.error && !types.data) {
    body = <Card><LoadError error={types.error} onRetry={types.reload} /></Card>;
  } else if (!types.data) {
    body = (
      <div className="pt-grid" aria-busy="true" aria-label="A carregar os tipos de acesso">
        {[0, 1].map((i) => (
          <div key={i} className="pt-card"><Skeleton width="50%" height={22} /><Skeleton width="80%" style={{ marginTop: 14 }} /><Skeleton height={80} style={{ marginTop: 14 }} /></div>
        ))}
      </div>
    );
  } else if (!list.length) {
    body = (
      <Card>
        <EmptyState
          icon={<Ticket />}
          title="Ainda não há tipos de acesso"
          actions={can.edit && (
            <>
              <Button variant="primary" icon={<Sparkles />} loading={seeding} onClick={() => void createSuggested()}>Criar VIP Pass e Conference Pass</Button>
              <Button icon={<Plus />} onClick={() => setEditing('new')} disabled={seeding}>Criar outro tipo</Button>
            </>
          )}
        >
          <span className="ev-measure">
            {event.requires_approval ? 'Quem confirma presença fica por aprovar. ' : ''}Ao aprovar, a equipa escolhe o tipo de acesso — por exemplo, VIP Pass ou Conference Pass.
            Só então o convidado recebe o código QR com a lista do que o acesso inclui, e a receção vê o tipo à porta. O convidado nunca escolhe o tipo.
          </span>
          {can.edit && (
            <div className="pt-suggest" aria-label="Sugestões">
              {SUGGESTED_PASS_TYPES.map((s) => (
                <div key={s.name} className="pt-suggest__item" style={{ '--pass-color': passColor(s.color) } as CSSProperties}>
                  <PassChip name={s.name} color={s.color} />
                  <AccessList accesses={s.accesses} />
                </div>
              ))}
            </div>
          )}
        </EmptyState>
      </Card>
    );
  } else {
    body = (
      <>
        <div className="pt-grid">
          {list.map((p) => (
            <PassCard
              key={p.id}
              pass={p}
              usage={stats.data || rows.data ? usage.get(p.id) : undefined}
              canEdit={can.edit}
              onEdit={() => setEditing(p)}
              onDelete={() => void onDelete(p)}
            />
          ))}
        </div>
        {withoutType > 0 && event.requires_approval && (
          <p className="pt-footnote">
            {people(withoutType, 'convidado confirmado está aprovado', 'convidados confirmados estão aprovados')} sem tipo de acesso.{' '}
            <Link to={approvalListUrl(event.id, 'approved')}>Ver na lista de convidados</Link>
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="prg-head">
        <div className="prg-head__text">
          <h2>Acessos</h2>
          <p>
            Tipos de acesso que a equipa atribui ao aprovar cada convidado. O convidado vê o tipo e o que inclui junto do código QR; a receção vê-o à porta.
          </p>
        </div>
        {can.edit && list.length > 0 && (
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>Novo tipo de acesso</Button>
        )}
      </div>
      {!event.requires_approval && (
        <Alert tone="info" className="pt-alert">
          Este evento não exige aprovação: quem confirma recebe logo o código QR, sem tipo de acesso. Para atribuir um tipo, aprove os convidados
          na lista{can.edit ? <>, ou ative a aprovação em <Link to={`/admin/eventos/${event.id}/definicoes`} className="inv-alert-link">Definições</Link></> : null}.
        </Alert>
      )}
      {body}
      {editing && (
        <PassTypeDialog
          event={event}
          pass={editing === 'new' ? null : editing}
          others={list.filter((t) => editing === 'new' || t.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function PassCard({ pass: p, usage, canEdit, onEdit, onDelete }: {
  pass: PassType;
  usage: Usage | undefined;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="pt-card" style={{ '--pass-color': passColor(p.color) } as CSSProperties} aria-label={p.name}>
      <header className="pt-card__head">
        <PassChip name={p.name} color={p.color} size="lg" />
        {canEdit && (
          <ActionMenu
            label={`Ações para ${p.name}`}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: onEdit },
              { label: 'Eliminar', icon: <Trash2 />, onSelect: onDelete, danger: true, separator: true },
            ]}
          />
        )}
      </header>
      {p.description && <p className="pt-card__desc">{p.description}</p>}
      <div className="pt-card__label">Inclui</div>
      <AccessList accesses={p.accesses} />
      <footer className="pt-card__foot">
        {usage ? (
          <>
            <span className="pt-card__count">
              <strong className="tabular">{formatNumber(usage.approved)}</strong>{' '}
              {usage.approved === 1 ? 'convidado aprovado' : 'convidados aprovados'}
              {usage.attendees > usage.approved && <span className="muted"> · {people(usage.attendees, 'pessoa', 'pessoas')} com acompanhantes</span>}
            </span>
            {usage.preApproved > 0 && (
              <span className="pt-card__pre">+ {people(usage.preApproved, 'pré-aprovado', 'pré-aprovados')} ainda sem resposta</span>
            )}
          </>
        ) : (
          <span className="muted">Ordem {p.sort}</span>
        )}
      </footer>
    </article>
  );
}

// ───────── Criar ou editar ─────────

function PassTypeDialog({ event, pass, others, onClose, onSaved }: {
  event: EventRecord;
  pass: PassType | null;
  others: PassType[];
  onClose: () => void;
  onSaved: (p: PassType, isNew: boolean) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<PassTypeFormValues>(() => toPassTypeForm(pass, others));
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errors = validatePassType(values, others);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);
  const set = (patch: Partial<PassTypeFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const suggestions = accessSuggestions(others, values.accesses).slice(0, 6);

  const addAccesses = (text: string) => {
    const items = splitAccesses(text);
    if (!items.length) return;
    set({ accesses: splitAccesses([...values.accesses, ...items].join('\n')) });
    setDraft('');
  };
  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAccesses(draft);
    }
  };
  const focusAccess = (i: number, dir: 'up' | 'down') =>
    requestAnimationFrame(() => document.getElementById(`pt-acc-${i}-${dir}`)?.focus());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // O que ficou escrito no campo de acrescentar também conta.
    const accesses = draft.trim() ? splitAccesses([...values.accesses, draft].join('\n')) : values.accesses;
    const next = { ...values, accesses };
    setValues(next);
    setDraft('');
    setSubmitted(true);
    if (Object.keys(validatePassType(next, others)).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const saved = await api.passTypes.save(toPassTypeInput(next, event.id, pass?.id));
      onSaved(saved, !pass);
    } catch (err) {
      setSaving(false);
      const message = err instanceof Error ? err.message : String(err);
      if ((err as { code?: string }).code === 'duplicate') setServerError(message);
      else toast.error(err);
    }
  };

  const color = isHexColor(values.color) ? values.color : null;
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={pass ? `Editar «${pass.name}»` : 'Novo tipo de acesso'}
      description="Atribuído pela equipa ao aprovar a presença. O convidado vê o nome e a lista de acessos junto do código QR."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="pt-form" loading={saving}>{pass ? 'Guardar alterações' : 'Criar tipo de acesso'}</Button>
        </>
      }
    >
      <form id="pt-form" className="pt-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="pt-form__fields">
          <Field label="Nome" required error={show('name') ?? serverError}>
            <Input
              value={values.name}
              onChange={(e) => { set({ name: e.target.value }); setServerError(null); }}
              maxLength={NAME_MAX}
              placeholder="Ex.: VIP Pass"
              autoFocus
            />
          </Field>
          <Field label="Descrição" error={show('description')} hint="Opcional. Aparece ao convidado por baixo do nome.">
            <Textarea value={values.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={DESCRIPTION_MAX} />
          </Field>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="pt-acc-new">Acessos incluídos</label>
            {values.accesses.length > 0 && (
              <ol className="pt-acc">
                {values.accesses.map((a, i) => (
                  <li key={i} className="pt-acc__item">
                    <span className="pt-acc__num" aria-hidden>{i + 1}.</span>
                    <Input
                      value={a}
                      maxLength={ACCESS_MAX}
                      aria-label={`Acesso ${i + 1}`}
                      onChange={(e) => set({ accesses: values.accesses.map((x, j) => (j === i ? e.target.value : x)) })}
                      onBlur={() => set({ accesses: values.accesses.filter((x) => x.trim()) })}
                    />
                    <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp />} id={`pt-acc-${i}-up`} aria-label={`Mover «${a}» para cima`}
                      disabled={i === 0} onClick={() => { set({ accesses: moveItem(values.accesses, i, -1) }); focusAccess(i - 1, 'up'); }} />
                    <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown />} id={`pt-acc-${i}-down`} aria-label={`Mover «${a}» para baixo`}
                      disabled={i === values.accesses.length - 1} onClick={() => { set({ accesses: moveItem(values.accesses, i, 1) }); focusAccess(i + 1, 'down'); }} />
                    <Button size="sm" variant="danger-ghost" iconOnly icon={<X />} aria-label={`Retirar «${a}»`}
                      onClick={() => set({ accesses: values.accesses.filter((_, j) => j !== i) })} />
                  </li>
                ))}
              </ol>
            )}
            <div className="pt-acc__add">
              <Input
                id="pt-acc-new"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKey}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (/[\n;]/.test(text)) { e.preventDefault(); addAccesses(text); }
                }}
                maxLength={ACCESS_MAX}
                placeholder={values.accesses.length ? 'Acrescentar outro acesso' : 'Ex.: VIP Gala Dinner'}
                aria-describedby="pt-acc-hint"
              />
              <Button icon={<Plus />} onClick={() => addAccesses(draft)} disabled={!draft.trim()}>Acrescentar</Button>
            </div>
            {show('accesses')
              ? <div className="ui-field__error" role="alert">{show('accesses')}</div>
              : <div className="ui-field__hint" id="pt-acc-hint">Pela ordem em que o convidado os vê. Prima Enter para acrescentar; pode colar vários, um por linha.</div>}
            {suggestions.length > 0 && (
              <div className="evf-chips" role="group" aria-label="Acessos sugeridos">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="evf-chip" onClick={() => addAccesses(s)}><Plus aria-hidden />{s}</button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-form__row">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="pt-color">Cor</label>
              <div className="evf-color">
                <input
                  type="color"
                  value={color ?? '#8e8e8e'}
                  onChange={(e) => set({ color: e.target.value })}
                  aria-label="Escolher cor"
                />
                <Input
                  id="pt-color"
                  value={values.color}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    set({ color: v && !v.startsWith('#') ? `#${v}` : v });
                  }}
                  maxLength={7}
                  spellCheck={false}
                  placeholder="Sem cor"
                  aria-invalid={show('color') ? true : undefined}
                  aria-describedby="pt-color-hint"
                />
              </div>
              <div className="pt-swatches" role="group" aria-label="Cores sugeridas">
                {PASS_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="pt-swatch"
                    style={{ background: c }}
                    aria-label={`Usar a cor ${c.toUpperCase()}`}
                    aria-pressed={values.color.toLowerCase() === c}
                    onClick={() => set({ color: c })}
                  />
                ))}
              </div>
              {show('color')
                ? <div className="ui-field__error" id="pt-color-hint" role="alert">{show('color')}</div>
                : <div className="ui-field__hint" id="pt-color-hint">Ajuda a receção a distinguir os acessos (ex.: pulseiras da mesma cor).</div>}
            </div>
            <Field label="Ordem" required error={show('sort')} hint="O menor aparece primeiro.">
              <Input type="number" inputMode="numeric" min={0} max={999} step={1} value={values.sort} onChange={(e) => set({ sort: e.target.value })} />
            </Field>
          </div>
        </div>

        <aside className="pt-form__preview" aria-label="Pré-visualização">
          <div className="tpl-preview__label">Como o convidado vê</div>
          <div className="pt-preview" style={{ '--pass-color': passColor(color) } as CSSProperties}>
            <div className="pt-preview__qr" aria-hidden><QrCode /></div>
            <PassChip name={values.name.trim() || 'Nome do acesso'} color={color} size="lg" />
            {values.description.trim() && <p className="pt-card__desc">{values.description.trim()}</p>}
            <AccessList accesses={splitAccesses([...values.accesses, draft].join('\n'))} />
          </div>
          <p className="pt-form__note">A página do convidado mostra estes dados só depois de a equipa aprovar a presença.</p>
        </aside>
      </form>
    </Dialog>
  );
}
