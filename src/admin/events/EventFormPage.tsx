import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import {
  ArrowDown, ArrowUp, CheckCircle2, Circle, Copy, ExternalLink, ImageOff, Lock, MapPin, Plus, QrCode, RefreshCw, ShieldCheck, Sparkles,
  Trash2,
} from 'lucide-react';
import './events.css';
import { api, ApiError, type EventRecord, type EventStatus } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatLongDate, formatNumber, formatRelative, formatShortDate, formatTime, fromLocalInput } from '../../lib/format';
import { EVENT_STATUS } from '../../lib/status';
import { slugify } from '../../lib/slug';
import { usePermissions } from '../../app/AuthProvider';
import {
  Alert, Badge, Button, ButtonAnchor, ButtonLink, Card, Checkbox, Dialog, Field, Input, PageHeader, Select, Textarea,
  useConfirm, useToast,
} from '../../ui';
import { useEventContext } from './EventLayout';
import {
  contrastWithWhite, copyableValues, daysBetween, DEFAULT_ACCENT, DRESS_CODES, FIELD_PRESETS, FIELD_TYPES, isHexColor, isHttpUrl,
  invitationSentence, mapsSearchUrl, newFieldDraft, resolveFieldKeys, suggestConsentText, TIMEZONES, timezoneCity,
  toEventInput, toFormValues, validateEvent, withName,
  type EventFormValues, type FieldDraft, type FormErrors,
} from './eventForm';

export function EventFormPage() {
  const { eventId } = useParams();
  return eventId ? <EditEventForm /> : <CreateEventForm />;
}

function CreateEventForm() {
  return (
    <>
      <PageHeader
        title="Novo evento"
        description="Defina os dados essenciais. Pode guardar como rascunho e completar mais tarde: os convidados só têm acesso quando o evento for aberto."
        back={{ to: '/admin/eventos', label: 'Eventos' }}
      />
      <EventForm event={null} />
    </>
  );
}

function EditEventForm() {
  const { event, setEvent } = useEventContext();
  return (
    <>
      <div className="evf-head">
        <h2>Definições</h2>
        <p>Alterações ao texto, à data ou ao local aparecem de imediato na página do convite de cada convidado.</p>
      </div>
      <EventForm key={event.id} event={event} onSaved={setEvent} />
    </>
  );
}

// ───────── Secções ─────────

const SECTIONS: { id: string; title: string; keys: string[] }[] = [
  { id: 'evf-identificacao', title: 'Identificação', keys: ['name', 'slug', 'host_name', 'invitation_text', 'description'] },
  { id: 'evf-data-local', title: 'Data e local', keys: ['starts_at', 'ends_at', 'timezone', 'rsvp_deadline', 'venue_name', 'venue_address', 'venue_maps_url', 'dress_code'] },
  { id: 'evf-convidados', title: 'Convidados e contacto', keys: ['capacity', 'default_plus_ones', 'contact_email', 'contact_phone'] },
  { id: 'evf-aprovacao', title: 'Aprovação da equipa', keys: ['requires_approval'] },
  { id: 'evf-formulario', title: 'Formulário de resposta', keys: ['field:'] },
  { id: 'evf-imagem', title: 'Imagem', keys: ['accent', 'logo_url', 'theme'] },
  { id: 'evf-privacidade', title: 'Privacidade (RGPD)', keys: ['privacy_controller', 'privacy_policy_url', 'marketing_consent_text'] },
  { id: 'evf-estado', title: 'Estado', keys: ['status'] },
];

const sectionHasError = (keys: string[], errors: FormErrors) =>
  Object.keys(errors).some((e) => keys.some((k) => (k.endsWith(':') ? e.startsWith(k) : e === k)));

type TextKey = { [K in keyof EventFormValues]: EventFormValues[K] extends string ? K : never }[keyof EventFormValues];

const STATUS_ORDER: EventStatus[] = ['draft', 'open', 'closed', 'archived'];

const APPROVAL_OPTIONS: { value: boolean; label: string; hint: string; icon: ReactNode }[] = [
  {
    value: true,
    label: 'Com aprovação',
    hint: 'Quem confirma fica por aprovar até a equipa escolher o tipo de acesso. Só então recebe o código QR e a lista de acessos.',
    icon: <ShieldCheck aria-hidden />,
  },
  {
    value: false,
    label: 'Sem aprovação',
    hint: 'Quem confirma recebe logo a credencial (código QR).',
    icon: <QrCode aria-hidden />,
  },
];
// Um evento que ainda não existe não pode nascer fechado nem arquivado.
const NEW_EVENT_STATUSES: EventStatus[] = ['draft', 'open'];

// ───────── Formulário ─────────

function EventForm({ event, onSaved }: { event: EventRecord | null; onSaved?: (e: EventRecord) => void }) {
  const can = usePermissions();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [initial, setInitial] = useState(() => toFormValues(event));
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const errors = useMemo(() => validateEvent(values), [values]);
  // A regra "abrir exige responsável RGPD" aparece logo; as restantes depois da primeira tentativa de gravar.
  const visible: FormErrors = useMemo(() => {
    const base = submitted ? errors : errors.status ? { status: errors.status, privacy_controller: errors.privacy_controller } : {};
    return { ...base, ...serverErrors };
  }, [submitted, errors, serverErrors]);
  const err = (k: string) => visible[k];
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const errorCount = Object.keys(visible).filter((k) => k !== 'status').length;

  const update = useCallback((patch: Partial<EventFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setServerErrors((se) => {
      const keys = Object.keys(patch).filter((k) => k in se);
      if (!keys.length) return se;
      const next = { ...se };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, []);
  const bind = (k: TextKey) => ({
    value: values[k],
    onChange: (e: { target: { value: string } }) => update({ [k]: e.target.value } as Partial<EventFormValues>),
  });

  // ── Sair com alterações por guardar ──
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypass = useRef(false);
  const blocker = useBlocker(useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
      !bypass.current && dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
    [],
  ));
  const asking = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return;
    asking.current = true;
    void confirm({
      title: 'Sair sem guardar?',
      message: 'Tem alterações por guardar neste evento. Se sair agora, perdem-se.',
      confirmLabel: 'Sair sem guardar',
      cancelLabel: 'Continuar a editar',
      danger: true,
    }).then((ok) => {
      asking.current = false;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Leva ao primeiro campo com erro depois de o React desenhar os erros (sem aviso flutuante:
  // a barra de gravação já indica quantos campos faltam corrigir).
  const [focusRequest, setFocusRequest] = useState(0);
  const focusFirstError = () => setFocusRequest((n) => n + 1);
  useEffect(() => {
    if (!focusRequest) return;
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      return;
    }
    const section = SECTIONS.find((x) => sectionHasError(x.keys, visibleRef.current));
    if (section) scrollTo(section.id);
  }, [focusRequest]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      const input = toEventInput(values, event);
      if (event) {
        const updated = await api.events.update(event.id, input);
        onSaved?.(updated);
        const next = toFormValues(updated);
        setInitial(next);
        setValues(next);
        setSubmitted(false);
        setSaving(false);
        toast.success('Alterações guardadas.');
      } else {
        const created = await api.events.create(input);
        bypass.current = true;
        toast.success('Evento criado. Já pode convidar contactos.');
        navigate(`/admin/eventos/${created.id}`);
      }
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.code === 'duplicate') {
        setServerErrors({ slug: 'Este endereço curto já está a ser usado noutro evento. Escolha outro.' });
        focusFirstError();
      } else {
        toast.error(error);
      }
    }
  };

  const onDiscard = async () => {
    const ok = await confirm({
      title: 'Descartar alterações?',
      message: 'O formulário volta aos valores guardados.',
      confirmLabel: 'Descartar',
      danger: true,
    });
    if (!ok) return;
    setValues(initial);
    setSubmitted(false);
    setServerErrors({});
  };

  const onDeleted = () => {
    bypass.current = true;
    navigate('/admin/eventos', { replace: true });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelector<HTMLElement>('h2 > [tabindex="-1"]')?.focus({ preventScroll: true });
  };

  const accentHex = isHexColor(values.accent) ? values.accent : DEFAULT_ACCENT;
  const accentStyle = {
    '--evf-accent': accentHex,
    '--evf-on-accent': contrastWithWhite(accentHex) >= 4.5 ? '#ffffff' : '#000000',
  } as CSSProperties;

  const checklist: [string, boolean][] = [
    ['Nome e data de início', !!values.name.trim() && !!values.starts_at],
    ['Local', !!(values.venue_name.trim() || values.venue_address.trim())],
    ['Texto do convite', !!(values.host_name.trim() || values.invitation_text.trim())],
    ['Prazo de resposta', !!values.rsvp_deadline],
    ['Responsável pelo tratamento', !!values.privacy_controller.trim()],
  ];

  return (
    <>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="evf" style={accentStyle}>
        <div className="evf-sections">
          {!event && (
            <CopyFromEvent
              onCopy={(source) => {
                update(copyableValues(source));
                toast.info(`Definições copiadas de “${source.name}”. Indique agora o nome, as datas e o texto do convite.`);
              }}
            />
          )}

          <Section id="evf-identificacao" title="Identificação" subtitle="Como o evento é apresentado aos convidados.">
            <div className="evf-grid">
              <Field label="Nome do evento" required error={err('name')} className="span-2">
                <Input
                  value={values.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setValues((v) => withName(v, name));
                    // O endereço curto pode ter mudado com o nome: o erro de repetido deixa de se aplicar.
                    setServerErrors((se) => (se.slug ? {} : se));
                  }}
                  maxLength={160}
                  placeholder="Ex.: Encontro Anual 2027"
                  autoFocus={!event}
                />
              </Field>
              <div className="evf-group span-2">
                <Field
                  label="Endereço curto"
                  required
                  error={err('slug')}
                  hint={event
                    ? 'Identificador único do evento. Mudá-lo não afeta os links pessoais já enviados.'
                    : 'Identificador único do evento, gerado a partir do nome. Só letras minúsculas, números e hífenes.'}
                >
                  <Input
                    className="evf-mono"
                    value={values.slug}
                    onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-'), slugAuto: false })}
                    maxLength={60}
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="encontro-anual-2027"
                  />
                </Field>
                {values.name.trim() && values.slug !== slugify(values.name) && (
                  <div>
                    <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => update({ slug: slugify(values.name), slugAuto: !event })}>
                      Gerar a partir do nome
                    </Button>
                  </div>
                )}
              </div>
              <Field label="Quem convida" className="span-2" error={err('host_name')} hint="Início da frase do convite. Ex.: O Conselho de Administração da Fundação Exemplo">
                <Input {...bind('host_name')} placeholder="O Conselho de Administração da …" />
              </Field>
              <div className="evf-group span-2">
                <Field
                  label="Texto do convite"
                  error={err('invitation_text')}
                  hint="Continua a frase de quem convida. Ex.: tem a honra de convidar V. Exa. para o Encontro Anual, seguido de jantar."
                >
                  <Textarea {...bind('invitation_text')} rows={3} placeholder="tem a honra de convidar V. Exa. para …" />
                </Field>
                <div className="evf-preview" aria-live="polite">
                  <div className="evf-preview__label">Pré-visualização</div>
                  <p className="evf-preview__text">
                    {invitationSentence(values.host_name, values.invitation_text) || (
                      <span className="placeholder">O Conselho de Administração … tem a honra de convidar V. Exa. para …</span>
                    )}
                  </p>
                </div>
              </div>
              <Field label="Descrição" className="span-2" hint="Informação adicional na página do convite: o que vai acontecer, a quem se destina, notas práticas.">
                <Textarea {...bind('description')} rows={4} />
              </Field>
            </div>
          </Section>

          <Section id="evf-data-local" title="Data e local" subtitle={`Horas no fuso do evento (hora de ${timezoneCity(values.timezone)}).`}>
            <DateAndPlace values={values} update={update} bind={bind} err={err} />
          </Section>

          <Section id="evf-convidados" title="Convidados e contacto" subtitle="Lotação, acompanhantes e contacto para dúvidas.">
            <div className="evf-grid">
              <Field
                label="Lotação"
                error={err('capacity')}
                hint="Pessoas no total, incluindo acompanhantes. Com a lotação completa, novas confirmações são recusadas. Vazio: sem limite."
              >
                <Input {...bind('capacity')} type="number" min={1} step={1} inputMode="numeric" placeholder="Sem limite" />
              </Field>
              <Field
                label="Acompanhantes por convite"
                required
                error={err('default_plus_ones')}
                hint="Valor inicial dos novos convites (0 a 10). Pode ser ajustado convidado a convidado."
              >
                <Input {...bind('default_plus_ones')} type="number" min={0} max={10} step={1} inputMode="numeric" />
              </Field>
              <Field label="Email para dúvidas" error={err('contact_email')} hint="Aparece no convite.">
                <Input {...bind('contact_email')} type="email" autoComplete="off" placeholder="eventos@instituicao.pt" />
              </Field>
              <Field label="Telefone para dúvidas" error={err('contact_phone')} hint="Aparece no convite.">
                <Input {...bind('contact_phone')} type="tel" autoComplete="off" placeholder="+351 210 000 000" />
              </Field>
            </div>
          </Section>

          <Section id="evf-aprovacao" title="Aprovação da equipa" subtitle="O que acontece quando um convidado confirma presença.">
            <Approval event={event} value={values.requires_approval} onChange={(requires_approval) => update({ requires_approval })} />
          </Section>

          <Section
            id="evf-formulario"
            title="Formulário de resposta"
            subtitle="Perguntas adicionais no convite, além de aceitar ou recusar e dos nomes dos acompanhantes."
          >
            <FieldsBuilder fields={values.fields} onChange={(fields) => update({ fields })} err={err} />
          </Section>

          <Section id="evf-imagem" title="Imagem" subtitle="Cor e logótipo usados na página do convite.">
            <Branding values={values} update={update} err={err} />
          </Section>

          <Section id="evf-privacidade" title="Privacidade (RGPD)" subtitle="Informação legal mostrada ao convidado antes de responder.">
            <div className="evf-grid">
              <Field
                label="Responsável pelo tratamento dos dados"
                className="span-2"
                error={err('privacy_controller')}
                hint="Entidade que trata os dados dos convidados, com morada. Obrigatório para abrir o evento."
              >
                <Input {...bind('privacy_controller')} placeholder="Fundação Exemplo, Avenida da Liberdade 100, 1250-000 Lisboa" />
              </Field>
              <Field label="Política de privacidade" className="span-2" error={err('privacy_policy_url')} hint="Endereço da página com a política de privacidade da entidade.">
                <Input {...bind('privacy_policy_url')} type="url" inputMode="url" placeholder="https://" />
              </Field>
              <div className="evf-group span-2">
                <Field
                  label="Consentimento para comunicações futuras"
                  error={err('marketing_consent_text')}
                  hint="Texto da caixa opcional que o convidado pode assinalar. Fica guardado com a data, como prova do consentimento."
                >
                  <Textarea {...bind('marketing_consent_text')} rows={3} />
                </Field>
                {values.marketing_consent_text.trim() !== suggestConsentText(values.privacy_controller) && (
                  <div>
                    <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={() => update({ marketing_consent_text: suggestConsentText(values.privacy_controller) })}>
                      {values.marketing_consent_text.trim() ? 'Substituir pelo texto sugerido' : 'Usar texto sugerido'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section id="evf-estado" title="Estado" subtitle="Controla o acesso dos convidados ao convite.">
            <fieldset className="evf-status">
              <legend className="visually-hidden">Estado do evento</legend>
              <div className="evf-status__grid">
                {(event ? STATUS_ORDER : NEW_EVENT_STATUSES).map((s) => (
                  <label key={s} className="evf-status__option">
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={values.status === s}
                      onChange={() => update({ status: s })}
                      aria-invalid={values.status === s && err('status') ? true : undefined}
                      aria-describedby={`evf-status-${s}`}
                    />
                    <span>
                      <span className="evf-status__name"><Badge tone={EVENT_STATUS[s].tone} dot>{EVENT_STATUS[s].label}</Badge></span>
                      <span className="evf-status__hint" id={`evf-status-${s}`}>{EVENT_STATUS[s].hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {err('status') && <div style={{ marginTop: 12 }}><Alert tone="danger">{err('status')}</Alert></div>}
            </fieldset>
          </Section>

          {event && can.admin && (
            <Card title="Zona de risco" className="evf-danger">
              <div className="evf-danger__row">
                <p>
                  Eliminar o evento apaga definitivamente os convites, as respostas, os acompanhantes, o programa, os modelos de mensagem
                  e o histórico deste evento. Os contactos continuam no CRM. Para manter o histórico, prefira o estado <strong>Arquivado</strong>.
                </p>
                <Button variant="danger" icon={<Trash2 />} onClick={() => setDeleteOpen(true)}>Eliminar evento</Button>
              </div>
            </Card>
          )}

          <div className={['evf-savebar', (dirty || !event) && 'is-floating'].filter(Boolean).join(' ')} role="region" aria-label="Gravar evento">
            <div className={['evf-savebar__state', dirty && 'is-dirty'].filter(Boolean).join(' ')} aria-live="polite">
              {submitted && errorCount > 0 ? (
                <span style={{ color: 'var(--c-danger)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="evf-savebar__dot" />{errorCount === 1 ? '1 campo por corrigir' : `${errorCount} campos por corrigir`}
                </span>
              ) : dirty ? (
                <><span className="evf-savebar__dot" />Alterações por guardar</>
              ) : event ? (
                <>Sem alterações por guardar · última gravação {formatRelative(event.updated_at)}</>
              ) : (
                <>Os campos assinalados com * são obrigatórios.</>
              )}
            </div>
            <div className="evf-savebar__actions">
              {event
                ? <Button onClick={() => void onDiscard()} disabled={!dirty || saving}>Descartar</Button>
                : <ButtonLink to="/admin/eventos">Cancelar</ButtonLink>}
              <Button type="submit" variant="primary" loading={saving} disabled={!!event && !dirty}>
                {event ? 'Guardar alterações' : 'Criar evento'}
              </Button>
            </div>
          </div>
        </div>

        <aside className="evf-aside" aria-label="Navegação do formulário">
          <div className="evf-aside__panel">
            <div className="evf-nav__title">Nesta página</div>
            <ul className="evf-nav">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); scrollTo(s.id); }}>
                    {s.title}
                    {sectionHasError(s.keys, visible) && (
                      <span className="evf-nav__dot" title="Tem campos por corrigir"><span className="visually-hidden">(com campos por corrigir)</span></span>
                    )}
                  </a>
                </li>
              ))}
              {event && can.admin && (
                <li><button type="button" className="evf-nav__danger" onClick={() => setDeleteOpen(true)}>Eliminar evento</button></li>
              )}
            </ul>
          </div>
          <div className="evf-aside__panel">
            <div className="evf-check__title">Verificação</div>
            <ul className="evf-check">
              {checklist.map(([label, done]) => (
                <li key={label} className={done ? 'is-done' : 'is-todo'}>
                  {done ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
                  <span>{label}<span className="visually-hidden">{done ? ': preenchido' : ': por preencher'}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </form>
      {/* Fora do <form>: os eventos de um portal propagam-se pela árvore do React. */}
      {event && deleteOpen && (
        <DeleteEventDialog event={event} onClose={() => setDeleteOpen(false)} onDeleted={onDeleted} />
      )}
    </>
  );
}

/** Num evento novo: reutilizar local, contacto, perguntas, imagem e privacidade de um evento anterior. */
function CopyFromEvent({ onCopy }: { onCopy: (e: EventRecord) => void }) {
  const { data } = useAsync(() => api.events.list(), []);
  const [chosen, setChosen] = useState('');
  if (!data?.length) return null;
  const source = data.find((e) => e.id === chosen);
  return (
    <div className="evf-copy">
      <div className="evf-copy__text">
        <strong>Partir de um evento anterior</strong>
        <span>Copia o local, o contacto, as perguntas, a imagem e a informação de privacidade.</span>
      </div>
      <div className="evf-copy__actions">
        <Select
          aria-label="Evento a copiar"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          placeholder="Escolher evento…"
          options={data.map((e) => ({ value: e.id, label: `${e.name} (${formatShortDate(e.starts_at, e.timezone)})` }))}
        />
        <Button icon={<Copy />} disabled={!source} onClick={() => source && onCopy(source)}>Copiar</Button>
      </div>
    </div>
  );
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="evf-anchor">
      <Card title={<span tabIndex={-1}>{title}</span>} subtitle={subtitle}>{children}</Card>
    </div>
  );
}

type Update = (patch: Partial<EventFormValues>) => void;
type Bind = (k: TextKey) => { value: string; onChange: (e: { target: { value: string } }) => void };
type Err = (k: string) => string | undefined;

// ───────── Data e local ─────────

function DateAndPlace({ values, update, bind, err }: { values: EventFormValues; update: Update; bind: Bind; err: Err }) {
  const tz = values.timezone;
  const startIso = values.starts_at ? fromLocalInput(values.starts_at, tz) : null;
  const endDays = daysBetween(values.starts_at, values.ends_at);
  const deadlineDays = daysBetween(values.rsvp_deadline, values.starts_at);
  const deadlineIso = values.rsvp_deadline ? fromLocalInput(values.rsvp_deadline, tz) : null;
  const durationMin = startIso && values.ends_at
    ? Math.round((new Date(fromLocalInput(values.ends_at, tz) ?? startIso).getTime() - new Date(startIso).getTime()) / 60_000)
    : null;
  const timezones = TIMEZONES.some((t) => t.value === tz) ? TIMEZONES : [...TIMEZONES, { value: tz, label: tz }];
  const suggestedMaps = mapsSearchUrl(values.venue_name, values.venue_address);
  const hasPlace = !!(values.venue_name.trim() || values.venue_address.trim());

  let durationHint = 'Opcional.';
  if (durationMin !== null && durationMin >= 0) {
    const h = Math.floor(durationMin / 60);
    const m = durationMin % 60;
    durationHint = `Duração: ${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}${!h && !m ? '0 min' : ''}${endDays ? ` (termina ${endDays === 1 ? 'no dia seguinte' : `${endDays} dias depois`})` : ''}.`;
  }

  return (
    <div className="evf-grid">
      <div className="evf-subhead">Data e hora</div>
      <Field
        label="Início"
        required
        error={err('starts_at')}
        hint={startIso ? `${capitalize(formatLongDate(startIso, tz))}, ${formatTime(startIso, tz)}` : 'Data e hora de início.'}
      >
        <Input type="datetime-local" {...bind('starts_at')} />
      </Field>
      <Field label="Fim" error={err('ends_at')} hint={durationHint}>
        <Input type="datetime-local" {...bind('ends_at')} min={values.starts_at || undefined} />
      </Field>
      <Field label="Fuso horário" hint="Mudar o fuso mantém as horas indicadas acima.">
        <Select value={tz} onChange={(e) => update({ timezone: e.target.value })} options={timezones} />
      </Field>
      <Field
        label="Prazo de resposta"
        error={err('rsvp_deadline')}
        hint={deadlineIso && deadlineDays !== null && deadlineDays >= 0
          ? `${capitalize(formatLongDate(deadlineIso, tz))}, ${formatTime(deadlineIso, tz)} · ${deadlineDays === 0 ? 'no próprio dia do evento' : deadlineDays === 1 ? '1 dia antes do evento' : `${deadlineDays} dias antes do evento`}. Depois do prazo, o convite deixa de aceitar respostas.`
          : 'Opcional. Depois do prazo, o convite deixa de aceitar respostas.'}
      >
        <Input type="datetime-local" {...bind('rsvp_deadline')} max={values.starts_at || undefined} />
      </Field>

      <div className="evf-subhead">Local</div>
      <Field label="Nome do local" error={err('venue_name')}>
        <Input {...bind('venue_name')} placeholder="Ex.: Palácio da Ajuda" />
      </Field>
      <Field label="Morada" error={err('venue_address')}>
        <Input {...bind('venue_address')} autoComplete="off" placeholder="Rua, número, código postal e localidade" />
      </Field>
      <div className="evf-group span-2">
        <Field label="Link do mapa" error={err('venue_maps_url')} hint="Abre o percurso no telemóvel do convidado.">
          <Input {...bind('venue_maps_url')} type="url" inputMode="url" placeholder="https://maps.google.com/…" />
        </Field>
        {(hasPlace || isHttpUrl(values.venue_maps_url.trim())) && (
          <div className="ui-row">
            {hasPlace && values.venue_maps_url.trim() !== suggestedMaps && (
              <Button size="sm" variant="ghost" icon={<MapPin />} onClick={() => update({ venue_maps_url: suggestedMaps })}>
                {values.venue_maps_url.trim() ? 'Substituir por pesquisa no Google Maps' : 'Criar link do Google Maps a partir da morada'}
              </Button>
            )}
            {isHttpUrl(values.venue_maps_url.trim()) && (
              <ButtonAnchor size="sm" variant="ghost" icon={<ExternalLink />} href={values.venue_maps_url.trim()}>Testar link</ButtonAnchor>
            )}
          </div>
        )}
      </div>
      <div className="evf-group span-2">
        <Field label="Código de vestuário" error={err('dress_code')} hint="Opcional. Escolha uma sugestão ou escreva outro.">
          <Input {...bind('dress_code')} placeholder="Ex.: Traje formal" />
        </Field>
        <div className="evf-chips" role="group" aria-label="Sugestões de código de vestuário">
          {DRESS_CODES.map((d) => (
            <button
              key={d}
              type="button"
              className="evf-chip"
              aria-pressed={values.dress_code.trim() === d}
              onClick={() => update({ dress_code: values.dress_code.trim() === d ? '' : d })}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ───────── Aprovação da equipa ─────────

function Approval({ event, value, onChange }: { event: EventRecord | null; value: boolean; onChange: (v: boolean) => void }) {
  const changed = event && event.requires_approval !== value;
  return (
    <fieldset className="evf-status">
      <legend className="visually-hidden">Aprovação da equipa</legend>
      <div className="evf-status__grid">
        {APPROVAL_OPTIONS.map((o) => (
          <label key={String(o.value)} className="evf-status__option">
            <input
              type="radio"
              name="requires_approval"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-describedby={`evf-approval-${o.value}`}
            />
            <span>
              <span className="evf-status__name evf-approval__name">{o.icon}{o.label}</span>
              <span className="evf-status__hint" id={`evf-approval-${o.value}`}>{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {changed && (
        <div style={{ marginTop: 12 }}>
          <Alert tone="info">
            {value
              ? 'Aplica-se às próximas confirmações. Quem já confirmou e foi aprovado mantém a credencial.'
              : 'Aplica-se às próximas confirmações. Quem já confirmou e está por aprovar continua por aprovar até a equipa decidir, na lista de convidados.'}
          </Alert>
        </div>
      )}
      <p className="evf-approval__note">
        {value ? 'A equipa escolhe o tipo de acesso ao aprovar; o convidado nunca o escolhe. Também pode aprovar antes da resposta (ex.: convidados de honra). ' : ''}
        {event
          ? <>Os tipos de acesso (ex.: VIP Pass, Conference Pass) definem-se no separador <Link to={`/admin/eventos/${event.id}/acessos`}>Acessos</Link>.</>
          : 'Depois de criar o evento, defina os tipos de acesso (ex.: VIP Pass, Conference Pass) no separador Acessos.'}
      </p>
    </fieldset>
  );
}

// ───────── Perguntas do formulário de resposta ─────────

function FieldsBuilder({ fields, onChange, err }: { fields: FieldDraft[]; onChange: (f: FieldDraft[]) => void; err: Err }) {
  const confirm = useConfirm();
  const keys = resolveFieldKeys(fields);
  const focusLabel = (uid: string) => requestAnimationFrame(() => document.getElementById(`evf-q-${uid}`)?.focus());

  const add = (label = '', type: FieldDraft['type'] = 'text') => {
    const f = newFieldDraft(label, type);
    onChange([...fields, f]);
    focusLabel(f.uid);
  };
  const patch = (uid: string, p: Partial<FieldDraft>) => onChange(fields.map((f) => (f.uid === uid ? { ...f, ...p } : f)));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...fields];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`evf-q-${next[index + dir].uid}-${dir < 0 ? 'up' : 'down'}`)?.focus());
  };
  const remove = async (f: FieldDraft) => {
    if (f.key) {
      const ok = await confirm({
        title: 'Remover pergunta?',
        message: 'As respostas já dadas a esta pergunta ficam guardadas, mas a pergunta deixa de aparecer no convite.',
        confirmLabel: 'Remover',
        danger: true,
      });
      if (!ok) return;
    }
    onChange(fields.filter((x) => x.uid !== f.uid));
  };

  const presets = FIELD_PRESETS.filter((p) => !fields.some((f) => f.label.trim().toLowerCase() === p.label.toLowerCase()));

  return (
    <>
      {fields.length ? (
        <ol className="evf-fields">
          {fields.map((f, i) => (
            <li key={f.uid} className="evf-field">
              <div className="evf-field__head">
                <span className="evf-field__num">{i + 1}.</span>
                <span className="evf-field__key" title={f.key ? 'Identificador fixo: pode já haver respostas guardadas com ele.' : 'Identificador usado nas exportações.'}>
                  {f.key && <Lock size={11} aria-hidden style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />}
                  {keys[i]}
                </span>
                <div className="evf-field__tools">
                  <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp />} id={`evf-q-${f.uid}-up`}
                    aria-label={`Mover a pergunta ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown />} id={`evf-q-${f.uid}-down`}
                    aria-label={`Mover a pergunta ${i + 1} para baixo`} disabled={i === fields.length - 1} onClick={() => move(i, 1)} />
                  <Button size="sm" variant="danger-ghost" iconOnly icon={<Trash2 />}
                    aria-label={`Remover a pergunta ${i + 1}`} onClick={() => void remove(f)} />
                </div>
              </div>
              <div className="evf-field__body">
                <Field label="Pergunta" required error={err(`field:${f.uid}:label`)}>
                  <Input id={`evf-q-${f.uid}`} value={f.label} maxLength={200} placeholder="Ex.: Restrições alimentares"
                    onChange={(e) => patch(f.uid, { label: e.target.value })} />
                </Field>
                <Field label="Tipo de resposta">
                  <Select value={f.type} options={FIELD_TYPES} onChange={(e) => patch(f.uid, { type: e.target.value as FieldDraft['type'] })} />
                </Field>
                {f.type === 'select' && (
                  <Field label="Opções" required className="span-2" error={err(`field:${f.uid}:options`)} hint="Uma opção por linha.">
                    <Textarea value={f.optionsText} rows={3} placeholder={'Carne\nPeixe\nVegetariano'}
                      onChange={(e) => patch(f.uid, { optionsText: e.target.value })} />
                  </Field>
                )}
                <div className="span-2">
                  <Checkbox
                    label={f.type === 'checkbox' ? 'Obrigatório (o convidado tem de assinalar)' : 'Resposta obrigatória para quem confirma presença'}
                    checked={f.required}
                    onChange={(e) => patch(f.uid, { required: e.target.checked })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="evf-fields-empty">
          Sem perguntas adicionais. O convidado indica se aceita ou recusa e, quando permitido, os nomes dos acompanhantes.
        </div>
      )}
      <div className="evf-fields-add">
        <Button icon={<Plus />} onClick={() => add()}>Adicionar pergunta</Button>
        {presets.length > 0 && <span className="evf-fields-add__label">Sugestões:</span>}
        {presets.map((p) => (
          <button key={p.label} type="button" className="evf-chip" onClick={() => add(p.label, p.type)}>
            <Plus aria-hidden />{p.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ───────── Imagem ─────────

function Branding({ values, update, err }: { values: EventFormValues; update: Update; err: Err }) {
  const [failed, setFailed] = useState<string | null>(null);
  const logo = values.logo_url.trim();
  const showLogo = isHttpUrl(logo) && failed !== logo;
  // Sobre fundo claro, uma cor muito clara (ex.: verde-lima) perde legibilidade nos textos e ligações.
  const lowContrast = values.theme === 'light' && isHexColor(values.accent) && contrastWithWhite(values.accent) < 3;
  const startIso = values.starts_at ? fromLocalInput(values.starts_at, values.timezone) : null;
  return (
    <div className="evf-grid">
      <div className="ui-stack">
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="evf-accent">Cor de destaque</label>
          <div className="evf-color">
            <input
              type="color"
              value={isHexColor(values.accent) ? values.accent.toLowerCase() : DEFAULT_ACCENT}
              onChange={(e) => update({ accent: e.target.value })}
              aria-label="Escolher cor de destaque"
            />
            <Input
              id="evf-accent"
              value={values.accent}
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ accent: v && !v.startsWith('#') ? `#${v}` : v });
              }}
              maxLength={7}
              spellCheck={false}
              aria-invalid={err('accent') ? true : undefined}
              aria-describedby="evf-accent-hint"
            />
            {values.accent.toLowerCase() !== DEFAULT_ACCENT && (
              <Button size="sm" variant="ghost" onClick={() => update({ accent: DEFAULT_ACCENT })}>Repor</Button>
            )}
          </div>
          {err('accent')
            ? <div className="ui-field__error" id="evf-accent-hint" role="alert">{err('accent')}</div>
            : <div className="ui-field__hint" id="evf-accent-hint">Usada nos botões e nos detalhes do convite.</div>}
        </div>
        {lowContrast && <Alert tone="warning">Cor muito clara para fundo claro: os textos e ligações perdem legibilidade. Escolha o fundo escuro ou um tom mais escuro.</Alert>}
        <div className="ui-field" role="radiogroup" aria-labelledby="evf-theme-label">
          <span className="ui-field__label" id="evf-theme-label">Fundo da página do convidado</span>
          <div className="ui-row">
            {([['light', 'Claro'], ['dark', 'Escuro']] as const).map(([value, label]) => (
              <label key={value} className="ui-check" style={{ marginRight: 16 }}>
                <input type="radio" name="evf-theme" checked={values.theme === value} onChange={() => update({ theme: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="ui-field__hint">O escuro acompanha marcas com cores vivas e logótipos pensados para fundo preto.</div>
        </div>
        <Field label="Logótipo" error={err('logo_url')} hint="Endereço de uma imagem PNG ou SVG, de preferência com fundo transparente.">
          <Input value={values.logo_url} onChange={(e) => update({ logo_url: e.target.value })} type="url" inputMode="url" placeholder="https://" />
        </Field>
      </div>
      <div>
        <div className="ui-field__label" style={{ marginBottom: 6 }}>Pré-visualização</div>
        <div className={['evf-brand', values.theme === 'dark' && 'evf-brand--dark'].filter(Boolean).join(' ')} aria-hidden>
          <div className="evf-brand__bar" />
          <div className="evf-brand__body">
            {showLogo ? (
              <img className="evf-brand__logo" src={logo} alt="" onError={() => setFailed(logo)} onLoad={() => setFailed(null)} />
            ) : logo ? (
              <span className="evf-brand__logo-missing"><ImageOff size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Não foi possível carregar o logótipo</span>
            ) : null}
            <span className="evf-brand__name">{values.name.trim() || 'Nome do evento'}</span>
            {(startIso || values.venue_name.trim()) && (
              <span className="evf-brand__meta">
                {[startIso && formatDate(startIso, values.timezone), values.venue_name.trim()].filter(Boolean).join(' · ')}
              </span>
            )}
            <span className="evf-brand__btn">Confirmar presença</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Eliminar evento ─────────

function DeleteEventDialog({ event, onClose, onDeleted }: { event: EventRecord; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const counts = useAsync(async () => {
    // A lista inclui os convites cancelados, que as estatísticas do evento não contam mas que também são apagados.
    const [invitations, sessions] = await Promise.allSettled([api.invitations.list(event.id), api.events.sessions(event.id)]);
    return {
      invitations: invitations.status === 'fulfilled' ? invitations.value.length : null,
      cancelled: invitations.status === 'fulfilled' ? invitations.value.filter((i) => i.status === 'cancelled').length : 0,
      sessions: sessions.status === 'fulfilled' ? sessions.value.length : null,
    };
  }, [event.id]);
  const matches = typed.trim() === event.name.trim();

  const onDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    try {
      await api.events.remove(event.id);
      toast.success(`Evento “${event.name}” eliminado.`);
      onDeleted();
    } catch (error) {
      setDeleting(false);
      toast.error(error);
    }
  };

  const c = counts.data;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Eliminar evento"
      description="Esta ação é definitiva e não pode ser anulada."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon={<Trash2 />} disabled={!matches} loading={deleting} onClick={() => void onDelete()}>
            Eliminar definitivamente
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--c-text-2)' }}>São apagados de forma permanente:</p>
      <ul className="evf-delete-list">
        <li>
          {c?.invitations != null
            ? `${formatNumber(c.invitations)} ${c.invitations === 1 ? 'convite' : 'convites'}${c.cancelled ? ` (incluindo ${formatNumber(c.cancelled)} ${c.cancelled === 1 ? 'cancelado' : 'cancelados'})` : ''}`
            : 'Os convites'}, com as respostas, os acompanhantes e as entradas registadas;
        </li>
        <li>{c?.sessions != null ? `${formatNumber(c.sessions)} ${c.sessions === 1 ? 'sessão' : 'sessões'} do programa` : 'O programa'};</li>
        <li>os modelos de mensagem e o histórico de atividade deste evento.</li>
      </ul>
      <p style={{ color: 'var(--c-text-2)', marginBottom: 16 }}>Os contactos continuam no CRM. Os links pessoais já enviados deixam de funcionar.</p>
      <form onSubmit={(e) => { e.preventDefault(); void onDelete(); }}>
        <Field label={<>Para confirmar, escreva o nome do evento: <strong>{event.name}</strong></>}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
