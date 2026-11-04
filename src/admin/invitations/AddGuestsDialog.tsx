import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, FileUp, UserPlus, Users } from 'lucide-react';
import { api, type Contact, type EventRecord, type InvitationRow } from '../../lib/api';
import { formalName, fullName } from '../../lib/format';
import { Alert, Avatar, Badge, Button, Dialog, EmptyState, Field, Input, LoadError, Loader, SearchInput, useToast } from '../../ui';
import { plural } from './parts';
import { preApproveProblem, PreApproveField, usePassQuota } from '../passes';

const PAGE_SIZE = 30;

export function AddGuestsDialog({ event, rows, invitedContactIds, waves, onClose, onAdded }: {
  event: EventRecord;
  /** Convites do evento (para a quota de cada tipo de acesso). */
  rows: InvitationRow[];
  invitedContactIds: ReadonlySet<string>;
  waves: string[];
  onClose: () => void;
  onAdded: (created: number) => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<Map<string, Contact>>(() => new Map());
  const [wave, setWave] = useState('');
  const [plusOnes, setPlusOnes] = useState(String(event.default_plus_ones));
  const [saving, setSaving] = useState(false);
  const quota = usePassQuota(event.id, rows);
  const [passTypeId, setPassTypeId] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.contacts.list({ search, page, pageSize: PAGE_SIZE, sort: { column: 'last_name', ascending: true } }).then(
      (res) => {
        if (!alive) return;
        setContacts((prev) => (page === 0 ? res.rows : [...prev, ...res.rows]));
        setTotal(res.total);
        setLoading(false);
      },
      (err) => {
        if (!alive) return;
        setError(err);
        setLoading(false);
      },
    );
    return () => { alive = false; };
  }, [search, page, tick]);

  const onSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const selectable = contacts.filter((c) => !invitedContactIds.has(c.id) && !c.anonymized_at);
  const allVisibleSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  const toggle = (c: Contact) => setSelected((s) => {
    const next = new Map(s);
    if (next.has(c.id)) next.delete(c.id); else next.set(c.id, c);
    return next;
  });
  const toggleVisible = () => setSelected((s) => {
    const next = new Map(s);
    if (allVisibleSelected) selectable.forEach((c) => next.delete(c.id)); else selectable.forEach((c) => next.set(c.id, c));
    return next;
  });

  const plus = Number(plusOnes);
  const plusValid = plusOnes.trim() !== '' && Number.isInteger(plus) && plus >= 0 && plus <= 10;

  const quotaProblem = preApproveProblem(quota, passTypeId, selected.size);
  const passName = quota.types?.find((t) => t.id === passTypeId)?.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.size || !plusValid || quotaProblem) return;
    setSaving(true);
    try {
      const ids = [...selected.keys()];
      const created = await api.invitations.create(event.id, ids, { wave: wave.trim() || null, plusOnes: plus, passTypeId: passTypeId || null });
      const skipped = ids.length - created;
      toast.success(`${plural(created, 'convidado adicionado', 'convidados adicionados')} à lista${passName && created ? `, pré-aprovado${created === 1 ? '' : 's'} com ${passName}` : ''}${skipped ? ` (${skipped} já estava${skipped === 1 ? '' : 'm'} convidado${skipped === 1 ? '' : 's'})` : ''}.`);
      onAdded(created);
    } catch (err) {
      toast.error(err);
      setSaving(false);
    }
  };

  let list: React.ReactNode;
  if (error && !contacts.length) {
    list = <LoadError error={error} onRetry={() => setTick((t) => t + 1)} />;
  } else if (loading && !contacts.length) {
    list = <Loader label="A procurar contactos…" />;
  } else if (!contacts.length) {
    list = (
      <EmptyState icon={<Users />} title={search ? 'Nenhum contacto encontrado' : 'Ainda não há contactos no CRM'}>
        {search ? 'Verifique a ortografia ou pesquise pela entidade ou pelo email.' : 'Importe uma lista para começar.'}
      </EmptyState>
    );
  } else {
    list = (
      <ul className="inv-pick" aria-label="Contactos">
        {contacts.map((c) => {
          const invited = invitedContactIds.has(c.id);
          const anonymized = !!c.anonymized_at;
          const disabled = invited || anonymized;
          const checked = invited || selected.has(c.id);
          return (
            <li key={c.id}>
              <label className={['inv-pick__item', disabled && 'is-disabled', !disabled && checked && 'is-checked'].filter(Boolean).join(' ')}>
                <input type="checkbox" className="inv-check" checked={checked} disabled={disabled} onChange={() => toggle(c)} />
                <Avatar name={fullName(c)} />
                <span className="inv-pick__text">
                  <span className="inv-pick__name">{formalName(c)}</span>
                  <span className="inv-pick__meta">{[c.organization, c.email ?? (c.phone ? 'Sem email' : 'Sem email nem telemóvel')].filter(Boolean).join(' · ')}</span>
                </span>
                {invited && <Badge tone="success"><Check size={12} aria-hidden />Já convidado</Badge>}
                {anonymized && <Badge>Dados apagados</Badge>}
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Dialog
      open
      onClose={saving ? () => undefined : onClose}
      size="lg"
      title="Adicionar convidados"
      description={`Escolha contactos do CRM para convidar para «${event.name}». Quem já está na lista aparece assinalado.`}
      footer={
        <div className="inv-dialog-footer">
          <Link to="/admin/contactos/importar" className="inv-footer-link"><FileUp size={16} aria-hidden />Importar ficheiro</Link>
          <div className="ui-row">
            <Button onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button variant="primary" type="submit" form="inv-add-form" icon={<UserPlus />} loading={saving} disabled={!selected.size || !plusValid || !!quotaProblem}>
              {selected.size ? `Adicionar ${plural(selected.size, 'convidado', 'convidados')}` : 'Adicionar'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="inv-add-form" className="inv-add" onSubmit={(e) => void submit(e)}>
        <div className="inv-add__search">
          <SearchInput value={search} onSearch={onSearch} placeholder="Pesquisar por nome, email ou entidade" autoFocus />
          <div className="inv-add__bar">
            <span className="muted">
              {loading && contacts.length ? 'A procurar…' : total ? plural(total, 'contacto', 'contactos') : ''}
              {selected.size > 0 && <> · <strong className="inv-add__count">{plural(selected.size, 'selecionado', 'selecionados')}</strong></>}
            </span>
            {selectable.length > 0 && (
              <button type="button" className="inv-link-btn" onClick={toggleVisible}>
                {allVisibleSelected ? 'Desmarcar os visíveis' : `Selecionar os visíveis (${selectable.length})`}
              </button>
            )}
          </div>
        </div>

        <div className="inv-add__list">
          {list}
          {contacts.length > 0 && contacts.length < total && (
            <div className="inv-add__more">
              <Button size="sm" loading={loading} onClick={() => setPage((p) => p + 1)}>Mostrar mais</Button>
            </div>
          )}
          {!!error && contacts.length > 0 && <Alert tone="danger">Não foi possível carregar mais contactos.</Alert>}
        </div>

        <div className="inv-add__options">
          <Field label="Vaga" hint="Opcional. Ex.: Convidados de honra, 1.ª vaga.">
            <Input value={wave} onChange={(e) => setWave(e.target.value)} list="inv-add-waves" maxLength={80} placeholder="Sem vaga" />
          </Field>
          <datalist id="inv-add-waves">
            {waves.map((w) => <option key={w} value={w} />)}
          </datalist>
          <Field label="Acompanhantes permitidos" hint={`Por omissão do evento: ${event.default_plus_ones}.`} error={plusValid ? null : 'Indique um número entre 0 e 10.'}>
            <Input type="number" inputMode="numeric" min={0} max={10} step={1} value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />
          </Field>
          <PreApproveField quota={quota} value={passTypeId} onChange={setPassTypeId} needed={selected.size} className="inv-add__pass" />
        </div>
      </form>
    </Dialog>
  );
}
