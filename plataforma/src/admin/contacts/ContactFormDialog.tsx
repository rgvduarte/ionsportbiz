import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, errorMessage, type Contact, type ContactInput, type Language, type Staff } from '../../lib/api';
import { formalName, fullName } from '../../lib/format';
import { formatPhone, isValidEmail, normalizeEmail, normalizePhone } from '../../lib/phone';
import { normalizeSalutation } from '../../lib/csv';
import { useAuth } from '../../app/AuthProvider';
import { Alert, Button, Dialog, Field, Input, Select, Textarea, useToast } from '../../ui';
import { LANGUAGES, SALUTATIONS } from './shared';
import { TagsInput } from './TagsInput';
import './contacts.css';

const OTHER = '__outro';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Sem contacto: cria um novo. */
  contact?: Contact | null;
  onSaved: (contact: Contact) => void;
}

export function ContactFormDialog(props: Props) {
  if (!props.open) return null;
  return <ContactForm {...props} />;
}

function ContactForm({ onClose, contact, onSaved }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const formId = useId();
  const editing = !!contact;

  // "Dra." (forma brasileira, de registos antigos) passa a "Dr.ª".
  const initialSalutation = normalizeSalutation(contact?.salutation ?? '');
  const [salutation, setSalutation] = useState(!initialSalutation || SALUTATIONS.includes(initialSalutation) ? initialSalutation : OTHER);
  const [salutationOther, setSalutationOther] = useState(SALUTATIONS.includes(initialSalutation) ? '' : initialSalutation);
  const [firstName, setFirstName] = useState(contact?.first_name ?? '');
  const [lastName, setLastName] = useState(contact?.last_name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(formatPhone(contact?.phone));
  const [organization, setOrganization] = useState(contact?.organization ?? '');
  const [jobTitle, setJobTitle] = useState(contact?.job_title ?? '');
  const [segment, setSegment] = useState(contact?.segment ?? '');
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [language, setLanguage] = useState<Language>(contact?.language ?? 'pt');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [ownerId, setOwnerId] = useState(contact ? contact.owner_id ?? '' : session?.user.id ?? '');

  const [errors, setErrors] = useState<Partial<Record<'firstName' | 'email' | 'phone', string>>>({});
  const [duplicate, setDuplicate] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Listas auxiliares: se falharem, os campos funcionam na mesma sem sugestões.
  const [segments, setSegments] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  useEffect(() => {
    api.contacts.segments().then(setSegments, () => undefined);
    api.contacts.tags().then(setKnownTags, () => undefined);
    api.staff.list().then(
      (s) => setStaff(s.filter((x) => (x.active && x.role !== 'checkin') || x.user_id === contact?.owner_id)),
      () => setStaff(null),
    );
  }, [contact?.owner_id]);

  const segmentListId = `${formId}-segments`;

  const checkEmail = async (value: string) => {
    const normalized = normalizeEmail(value);
    setDuplicate(null);
    if (!normalized) {
      setErrors((e) => ({ ...e, email: undefined }));
      return;
    }
    if (!isValidEmail(normalized)) {
      setErrors((e) => ({ ...e, email: 'Indique um email válido, por exemplo nome@entidade.pt.' }));
      return;
    }
    setErrors((e) => ({ ...e, email: undefined }));
    try {
      const res = await api.contacts.list({ search: normalized, page: 0, pageSize: 10 });
      setDuplicate(res.rows.find((c) => c.email === normalized && c.id !== contact?.id) ?? null);
    } catch {
      // A verificação de repetidos é só um aviso.
    }
  };

  const checkPhone = (value: string): string | null | undefined => {
    if (!value.trim()) {
      setErrors((e) => ({ ...e, phone: undefined }));
      return null;
    }
    const e164 = normalizePhone(value);
    if (!e164) {
      setErrors((e) => ({ ...e, phone: 'Número não reconhecido. Para números estrangeiros indique o indicativo (ex.: +44 20 7946 0958).' }));
      return undefined;
    }
    setErrors((e) => ({ ...e, phone: undefined }));
    setPhone(formatPhone(e164));
    return e164;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = 'Indique o nome.';
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) next.email = 'Indique um email válido, por exemplo nome@entidade.pt.';
    const e164 = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !e164) next.phone = 'Número não reconhecido. Para números estrangeiros indique o indicativo (ex.: +44 20 7946 0958).';
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      (document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [aria-invalid="true"]`))?.focus();
      return;
    }

    const input: ContactInput = {
      salutation: normalizeSalutation(salutation === OTHER ? salutationOther : salutation) || null,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      email: normalizedEmail,
      phone: e164,
      organization: organization.trim() || null,
      job_title: jobTitle.trim() || null,
      segment: segment.trim() || null,
      tags,
      language,
      notes: notes.trim() || null,
      ...(staff ? { owner_id: ownerId || null } : {}),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = editing ? await api.contacts.update(contact.id, input) : await api.contacts.create({ ...input, source: 'manual' });
      toast.success(editing ? 'Alterações guardadas.' : `Contacto ${fullName(saved)} criado.`);
      onSaved(saved);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={editing ? 'Editar contacto' : 'Novo contacto'}
      description={editing ? formalName(contact) : 'Os campos marcados com * são obrigatórios.'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            {editing ? 'Guardar alterações' : 'Criar contacto'}
          </Button>
        </>
      }
    >
      <form id={formId} className="ct-form" onSubmit={onSubmit} noValidate>
        {saveError && <Alert tone="danger">{saveError}</Alert>}

        <fieldset className="ct-form__section">
          <legend>Identificação</legend>
          <div className="ct-form__grid ct-form__grid--name">
            <Field label="Tratamento">
              <Select
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                placeholder="Sem tratamento"
                options={[...SALUTATIONS.map((s) => ({ value: s, label: s })), { value: OTHER, label: 'Outro…' }]}
              />
            </Field>
            <Field label="Nome" required error={errors.firstName}>
              <Input value={firstName} maxLength={120} autoComplete="off" onChange={(e) => setFirstName(e.target.value)} autoFocus={!editing} />
            </Field>
            <Field label="Apelido">
              <Input value={lastName} maxLength={120} autoComplete="off" onChange={(e) => setLastName(e.target.value)} />
            </Field>
            {salutation === OTHER && (
              <Field label="Outro tratamento" className="span-all" hint="Ex.: Sua Excelência, Embaixador, Juiz Conselheiro.">
                <Input value={salutationOther} maxLength={60} onChange={(e) => setSalutationOther(e.target.value)} autoFocus />
              </Field>
            )}
          </div>
        </fieldset>

        <fieldset className="ct-form__section">
          <legend>Contactos</legend>
          <div className="ct-form__grid">
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setDuplicate(null); }}
                onBlur={(e) => void checkEmail(e.target.value)}
              />
            </Field>
            <Field label="Telemóvel" error={errors.phone} hint="Números portugueses sem indicativo; estrangeiros com +.">
              <Input type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={(e) => checkPhone(e.target.value)} />
            </Field>
            {duplicate && (
              <Alert tone="warning" className="span-all">
                Já existe um contacto com este email:{' '}
                <Link to={`/admin/contactos/${duplicate.id}`} target="_blank" rel="noopener">{formalName(duplicate)}</Link>
                {duplicate.organization ? ` (${duplicate.organization})` : ''}. Pode guardar na mesma, por exemplo quando um secretariado gere os convites de várias pessoas.
              </Alert>
            )}
          </div>
        </fieldset>

        <fieldset className="ct-form__section">
          <legend>Entidade</legend>
          <div className="ct-form__grid">
            <Field label="Entidade">
              <Input value={organization} autoComplete="off" onChange={(e) => setOrganization(e.target.value)} />
            </Field>
            <Field label="Cargo">
              <Input value={jobTitle} autoComplete="off" onChange={(e) => setJobTitle(e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="ct-form__section">
          <legend>Classificação</legend>
          <div className="ct-form__grid">
            <Field label="Segmento" hint="Escolha um existente ou escreva um novo.">
              <Input value={segment} list={segmentListId} autoComplete="off" onChange={(e) => setSegment(e.target.value)} />
            </Field>
            <Field label="Idioma dos convites">
              <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)} options={LANGUAGES} />
            </Field>
            <Field label="Etiquetas" className="span-all" hint="Prima Enter ou vírgula para acrescentar.">
              <TagsInput value={tags} onChange={setTags} suggestions={knownTags} />
            </Field>
            {staff && (
              <Field label="Responsável" hint="Quem na equipa acompanha este contacto.">
                <Select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  placeholder="Sem responsável"
                  options={staff.map((s) => ({ value: s.user_id, label: s.full_name }))}
                />
              </Field>
            )}
          </div>
          <datalist id={segmentListId}>
            {segments.map((s) => <option key={s} value={s} />)}
          </datalist>
        </fieldset>

        <fieldset className="ct-form__section">
          <legend>Notas internas</legend>
          <Field label="Notas" hint="Visíveis apenas para a equipa. Não registe dados sensíveis (saúde, convicções, etc.).">
            <Textarea value={notes} rows={3} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </fieldset>
      </form>
    </Dialog>
  );
}
