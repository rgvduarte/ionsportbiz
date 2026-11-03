import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Eye, Lock, Minus, Pencil, ScanLine, ShieldCheck, UserPlus, Users } from 'lucide-react';
import './team.css';
import { api, type Staff, type StaffRole } from '../../lib/api';
import { useAuth } from '../../app/AuthProvider';
import { useAsync } from '../../lib/useAsync';
import { ROLE } from '../../lib/status';
import { formatDate } from '../../lib/format';
import {
  ActionMenu, Alert, Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, LoadError, PageHeader, SearchInput, Select,
  Skeleton, useConfirm, useToast,
} from '../../ui';

const ROLES: StaffRole[] = ['admin', 'editor', 'checkin', 'viewer'];
const ROLE_ICON: Record<StaffRole, ReactNode> = {
  admin: <ShieldCheck aria-hidden />,
  editor: <Pencil aria-hidden />,
  checkin: <ScanLine aria-hidden />,
  viewer: <Eye aria-hidden />,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

/** O que cada papel pode fazer (igual às regras da base de dados). */
const PERMISSIONS: { label: string; roles: StaffRole[] }[] = [
  { label: 'Consultar painel, eventos, contactos e respostas', roles: ['admin', 'editor', 'viewer'] },
  { label: 'Criar e editar eventos, contactos e convites', roles: ['admin', 'editor'] },
  { label: 'Importar contactos e enviar convites', roles: ['admin', 'editor'] },
  { label: 'Registar entradas à porta', roles: ['admin', 'editor', 'checkin'] },
  { label: 'Anular entradas registadas', roles: ['admin', 'editor'] },
  { label: 'Gerir a equipa e apagar dados pessoais (RGPD)', roles: ['admin'] },
];

export function TeamPage() {
  const { session, refresh } = useAuth();
  const me = session?.user.id ?? null;
  const toast = useToast();
  const confirm = useConfirm();
  const team = useAsync(() => api.staff.list(), []);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renaming, setRenaming] = useState<Staff | null>(null);

  const rows = team.data ?? [];
  const activeAdmins = rows.filter((s) => s.role === 'admin' && s.active).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-PT');
    return rows
      .filter((s) => !roleFilter || s.role === roleFilter)
      .filter((s) => !q || s.full_name.toLocaleLowerCase('pt-PT').includes(q) || s.email.includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || collator.compare(a.full_name, b.full_name));
  }, [rows, search, roleFilter]);

  const apply = async (member: Staff, patch: Partial<Pick<Staff, 'role' | 'active' | 'full_name'>>, success: string) => {
    setPending((p) => new Set(p).add(member.user_id));
    try {
      const updated = await api.staff.update(member.user_id, patch);
      team.setData((all) => (all ?? []).map((s) => (s.user_id === updated.user_id ? updated : s)));
      toast.success(success);
      // O próprio utilizador mudou de papel ou foi desativado: as permissões da sessão mudam.
      if (member.user_id === me) await refresh();
      return true;
    } catch (err) {
      toast.error(err);
      return false;
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(member.user_id);
        return next;
      });
    }
  };

  const changeRole = async (member: Staff, role: StaffRole) => {
    if (role === member.role) return;
    if (member.user_id === me) {
      const ok = await confirm({
        title: 'Alterar o seu próprio papel?',
        message: `Passa a ter o papel ${ROLE[role].label}. Deixa de ter acesso à gestão da equipa e esta alteração só pode ser revertida por outro administrador.`,
        confirmLabel: `Passar a ${ROLE[role].label}`,
        danger: member.role === 'admin',
      });
      if (!ok) return;
    }
    await apply(member, { role }, `${member.full_name} passou a ${ROLE[role].label}.`);
  };

  const toggleActive = async (member: Staff) => {
    const self = member.user_id === me;
    const ok = member.active
      ? await confirm({
          title: self ? 'Desativar a sua própria conta?' : `Desativar ${member.full_name}?`,
          message: self
            ? 'Perde o acesso imediatamente. Só outro administrador pode reativar a conta.'
            : 'Deixa de conseguir entrar no back-office e na receção dos eventos. O histórico mantém-se e pode reativar a conta quando quiser.',
          confirmLabel: 'Desativar',
          danger: true,
        })
      : await confirm({
          title: `Reativar ${member.full_name}?`,
          message: `Volta a ter acesso com o papel ${ROLE[member.role].label}.`,
          confirmLabel: 'Reativar',
        });
    if (!ok) return;
    await apply(member, { active: !member.active }, `Conta de ${member.full_name} ${member.active ? 'desativada' : 'reativada'}.`);
  };

  return (
    <>
      <PageHeader
        title="Equipa"
        description="Pessoas com acesso ao back-office e à receção dos eventos. Cada membro entra com o seu email; o papel define o que pode ver e fazer."
        actions={<Button variant="primary" icon={<UserPlus />} onClick={() => setInviteOpen(true)}>Convidar membro</Button>}
      />

      <div className="ui-stack ui-stack--lg">
        <Card
          padded={false}
          title="Membros"
          subtitle={team.data ? `${rows.length} ${rows.length === 1 ? 'membro' : 'membros'} · ${rows.filter((s) => s.active).length} ativos` : undefined}
        >
          <div className="ui-toolbar">
            <SearchInput value={search} onSearch={setSearch} placeholder="Pesquisar por nome ou email" className="ui-toolbar__grow" />
            <Select
              aria-label="Filtrar por papel"
              className="tm-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as StaffRole | '')}
              placeholder="Todos os papéis"
              options={ROLES.map((r) => ({ value: r, label: ROLE[r].label }))}
            />
          </div>

          {team.error && !team.data ? (
            <LoadError error={team.error} onRetry={team.reload} />
          ) : !team.data ? (
            <div className="tm-skeleton" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="tm-skeleton__row">
                  <Skeleton width={32} height={32} style={{ borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}><Skeleton width="40%" height={14} /><Skeleton width="25%" height={12} style={{ marginTop: 6 }} /></div>
                  <Skeleton width={140} height={34} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Nenhum membro encontrado"
              actions={<Button onClick={() => { setSearch(''); setRoleFilter(''); }}>Limpar filtros</Button>}
            >
              Nenhum membro da equipa corresponde à pesquisa ou ao papel escolhido.
            </EmptyState>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table tm-table">
                <thead>
                  <tr>
                    <th scope="col">Membro</th>
                    <th scope="col">Papel</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Desde</th>
                    <th scope="col" className="actions"><span className="visually-hidden">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const self = s.user_id === me;
                    const busy = pending.has(s.user_id);
                    const lastAdmin = s.role === 'admin' && s.active && activeAdmins <= 1;
                    return (
                      <tr key={s.user_id} className={s.active ? undefined : 'tm-row--inactive'}>
                        <td>
                          <div className="tm-person">
                            <Avatar name={s.full_name} />
                            <div className="tm-person__text">
                              <div className="primary">
                                {s.full_name}
                                {self && <Badge tone="accent">A sua conta</Badge>}
                              </div>
                              <div className="secondary">{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Papel">
                          <Select
                            aria-label={`Papel de ${s.full_name}`}
                            className="tm-role"
                            value={s.role}
                            disabled={busy || lastAdmin}
                            title={lastAdmin ? 'Tem de existir pelo menos um administrador ativo.' : undefined}
                            options={ROLES.map((r) => ({ value: r, label: ROLE[r].label }))}
                            onChange={(e) => void changeRole(s, e.target.value as StaffRole)}
                          />
                          {lastAdmin && <div className="tm-lock"><Lock aria-hidden />Único administrador ativo</div>}
                        </td>
                        <td data-label="Estado">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={s.active}
                            aria-label={`${s.full_name}: conta ${s.active ? 'ativa' : 'inativa'}`}
                            className="tm-switch"
                            disabled={busy || lastAdmin}
                            title={lastAdmin ? 'Tem de existir pelo menos um administrador ativo.' : undefined}
                            onClick={() => void toggleActive(s)}
                          >
                            <span className="tm-switch__track" aria-hidden><span className="tm-switch__thumb" /></span>
                            <span className="tm-switch__label">{s.active ? 'Ativo' : 'Inativo'}</span>
                          </button>
                        </td>
                        <td data-label="Desde" className="tm-since">{formatDate(s.created_at)}</td>
                        <td className="actions">
                          <ActionMenu
                            label={`Ações para ${s.full_name}`}
                            items={[{ label: 'Alterar nome', icon: <Pencil />, onSelect: () => setRenaming(s), disabled: busy }]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Papéis e permissões" subtitle="As regras são aplicadas pela base de dados, não apenas no ecrã.">
          <div className="tm-roles">
            {ROLES.map((r) => (
              <div key={r} className={`tm-roles__item tm-roles__item--${r}`}>
                <span className="tm-roles__icon">{ROLE_ICON[r]}</span>
                <div>
                  <div className="tm-roles__name">{ROLE[r].label}</div>
                  <div className="tm-roles__desc">{ROLE[r].description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="ui-table-wrap tm-matrix-wrap">
            <table className="tm-matrix">
              <caption className="visually-hidden">Permissões por papel</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">Permissão</span></th>
                  {ROLES.map((r) => <th key={r} scope="col">{ROLE[r].label}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.label}>
                    <th scope="row">{p.label}</th>
                    {ROLES.map((r) => (
                      <td key={r} data-role={ROLE[r].label}>
                        {p.roles.includes(r)
                          ? <span className="tm-yes"><Check aria-hidden /><span className="visually-hidden">Sim</span></span>
                          : <span className="tm-no"><Minus aria-hidden /><span className="visually-hidden">Não</span></span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert tone="info" className="tm-note">
            A equipa de <strong>Receção</strong> nunca vê o CRM: na porta só aparecem o nome, a entidade, o estado do convite e os
            acompanhantes de cada convidado — nunca o email, o telefone, as notas ou as respostas ao convite.
          </Alert>
        </Card>
      </div>

      <InviteDialog
        open={inviteOpen}
        team={rows}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); team.reload(); }}
      />
      <RenameDialog
        member={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (!renaming) return;
          if (await apply(renaming, { full_name: name }, 'Nome atualizado.')) setRenaming(null);
        }}
      />
    </>
  );
}

// ───────── Convidar ─────────

function InviteDialog({ open, team, onClose, onInvited }: { open: boolean; team: Staff[]; onClose: () => void; onInvited: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('checkin');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);

  const normalized = email.trim().toLowerCase();
  const existing = EMAIL.test(normalized) ? team.find((s) => s.email === normalized) : undefined;

  const reset = () => {
    setName('');
    setEmail('');
    setRole('checkin');
    setErrors({});
  };
  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Indique o nome.';
    else if (name.trim().length > 120) next.name = 'O nome tem no máximo 120 caracteres.';
    if (!EMAIL.test(normalized)) next.email = 'Indique um email válido.';
    setErrors(next);
    if (next.name || next.email) return;
    setSaving(true);
    try {
      await api.staff.invite({ email: normalized, full_name: name.trim(), role });
      toast.success(api.mode === 'demo'
        ? `Acesso criado para ${name.trim()}. No modo demonstração não é enviado email.`
        : existing ? `Conta de ${name.trim()} ativa com o papel ${ROLE[role].label}.` : `Convite enviado para ${normalized}.`);
      reset();
      onInvited();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Convidar membro da equipa"
      description="A pessoa recebe um email com um link para entrar. Não precisa de criar palavra-passe: pode sempre pedir um novo link de acesso."
      footer={
        <>
          <Button onClick={close} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon={<UserPlus />} loading={saving} onClick={() => void submit()}>
            {existing ? 'Reativar membro' : 'Enviar convite'}
          </Button>
        </>
      }
    >
      <form className="ui-stack" onSubmit={(e) => void submit(e)} noValidate>
        <div className="ui-form-grid">
          <Field label="Nome completo" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={120} placeholder="Ex.: Joana Reis" />
          </Field>
          <Field label="Email" required error={errors.email} hint="Use o email profissional da pessoa.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" inputMode="email" placeholder="nome@entidade.pt" />
          </Field>
        </div>

        {existing && (
          <Alert tone="info">
            Este email já pertence a <strong>{existing.full_name}</strong> ({existing.active ? 'ativo' : 'inativo'}, {ROLE[existing.role].label}).
            Ao continuar, a conta fica ativa com o papel escolhido.
          </Alert>
        )}

        <fieldset className="tm-picker">
          <legend className="ui-field__label">Papel</legend>
          <div className="tm-picker__grid">
            {ROLES.map((r) => (
              <label key={r} className={['tm-picker__card', role === r && 'is-selected'].filter(Boolean).join(' ')}>
                <input type="radio" name="tm-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span className="tm-picker__icon">{ROLE_ICON[r]}</span>
                <span className="tm-picker__text">
                  <span className="tm-picker__name">{ROLE[r].label}</span>
                  <span className="tm-picker__desc">{ROLE[r].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {/* Enter num campo envia o formulário. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

// ───────── Alterar nome ─────────

function RenameDialog({ member, onClose, onSave }: { member: Staff | null; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forId, setForId] = useState<string | null>(null);
  // Preenche o campo quando o diálogo abre para outro membro.
  if (member && member.user_id !== forId) {
    setForId(member.user_id);
    setName(member.full_name);
    setError(null);
  } else if (!member && forId) {
    setForId(null);
  }
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const v = name.trim();
    if (!v) { setError('Indique o nome.'); return; }
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={!!member}
      onClose={() => { if (!saving) onClose(); }}
      title="Alterar nome"
      description={member?.email}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Nome completo" required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
        </Field>
      </form>
    </Dialog>
  );
}
