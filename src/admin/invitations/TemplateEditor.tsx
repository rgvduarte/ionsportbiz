import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, MessageCircle, Trash2 } from 'lucide-react';
import type { EventRecord, InvitationRow, MessageTemplate } from '../../lib/api';
import { api } from '../../lib/api';
import { inviteUrl } from '../../lib/config';
import { formalName } from '../../lib/format';
import { WHATSAPP_COMFORTABLE_LENGTH } from '../../lib/whatsapp';
import { buildTemplateVars, renderMessage, renderTemplate, TEMPLATE_VARIABLES, unknownVariables, usesVariable, type TemplateContact } from '@shared/template';
import { buildEmailHtml } from '@shared/email-html';
import { Alert, Button, Dialog, Field, Input, Select, Textarea, useConfirm, useToast } from '../../ui';
import { defaultTemplates } from './guestList';

/** Modelo existente, ou novo num canal (por omissão com o texto sugerido; `blank` começa vazio). */
export type EditorTarget = { template: MessageTemplate } | { channel: MessageTemplate['channel']; blank?: boolean };

type Channel = MessageTemplate['channel'];

const SAMPLE = '__exemplo__';
const SAMPLE_CONTACT: TemplateContact & { email: string; token: string } = {
  salutation: 'Exma. Senhora',
  first_name: 'Helena',
  last_name: 'Marques Ferreira',
  organization: 'Instituto Aurora',
  language: 'pt',
  email: 'helena.ferreira@exemplo.pt',
  token: 'ExemploDeLinkPessoal01',
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TemplateEditor({ target, event, guests, readOnly, onClose, onSaved, onDelete }: {
  target: EditorTarget;
  event: EventRecord;
  /** Convidados reais para a pré-visualização. */
  guests: InvitationRow[];
  readOnly: boolean;
  onClose: () => void;
  onSaved: (t: MessageTemplate, isNew: boolean) => void;
  onDelete: (t: MessageTemplate) => Promise<boolean>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const existing = 'template' in target ? target.template : null;
  const suggested = useMemo(() => defaultTemplates(event), [event]);
  const suggestionFor = (c: Channel) => suggested.find((s) => s.channel === c);

  const initialChannel: Channel = existing?.channel ?? ('channel' in target ? target.channel : 'email');
  const blank = 'blank' in target && !!target.blank;
  const initial = {
    name: existing?.name ?? '',
    channel: initialChannel,
    subject: existing?.subject ?? (blank ? '' : suggestionFor(initialChannel)?.subject ?? ''),
    body: existing?.body ?? (blank ? '' : suggestionFor(initialChannel)?.body ?? ''),
  };
  const [name, setName] = useState(initial.name);
  const [channel, setChannel] = useState<Channel>(initial.channel);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [previewId, setPreviewId] = useState(guests[0]?.id ?? SAMPLE);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<'subject' | 'body'>('body');

  const dirty = name !== initial.name || channel !== initial.channel || subject !== initial.subject || body !== initial.body;
  const isEmail = channel === 'email';

  const changeChannel = (next: Channel) => {
    // Num modelo novo ainda por alterar, troca também o texto sugerido.
    if (!existing && !blank && body === (suggestionFor(channel)?.body ?? '')) {
      setBody(suggestionFor(next)?.body ?? '');
      if (next === 'email') setSubject(suggestionFor('email')?.subject ?? '');
    }
    setChannel(next);
  };

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const useSubject = isEmail && lastField.current === 'subject';
    const el = useSubject ? subjectRef.current : bodyRef.current;
    const value = useSubject ? subject : body;
    const setter = useSubject ? setSubject : setBody;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setter(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const guest = guests.find((g) => g.id === previewId);
  const person = guest ?? SAMPLE_CONTACT;
  // Sem permissão de edição, o link é fictício: o link pessoal é uma credencial do convidado.
  const link = inviteUrl((!readOnly && guest?.token) || SAMPLE_CONTACT.token);
  const vars = useMemo(() => buildTemplateVars({ event, contact: person, link }), [event, person, link]);
  const renderedSubject = renderTemplate(subject, vars).replace(/\s+/g, ' ').trim();
  const renderedBody = renderMessage(body, vars);
  const en = person.language === 'en';

  const debouncedBody = useDebounced(renderedBody, 250);
  const debouncedSubject = useDebounced(renderedSubject, 250);
  const emailHtml = useMemo(() => buildEmailHtml({
    subject: debouncedSubject || event.name,
    bodyText: debouncedBody,
    ctaLabel: en ? 'Open the invitation' : 'Abrir o convite',
    ctaUrl: link,
    accent: event.branding?.accent,
    logoUrl: event.branding?.logo_url,
    footer: [
      en ? 'This invitation is personal and non-transferable.' : 'Este convite é pessoal e intransmissível.',
      event.contact_email ? (en ? `For any questions: ${event.contact_email}` : `Para qualquer esclarecimento: ${event.contact_email}`) : '',
      event.privacy_controller ? (en ? `Data controller: ${event.privacy_controller}` : `Responsável pelo tratamento dos dados: ${event.privacy_controller}`) : '',
    ].filter(Boolean).join('\n'),
    lang: en ? 'en' : 'pt',
  }), [debouncedSubject, debouncedBody, en, link, event]);

  const unknown = unknownVariables(`${isEmail ? subject : ''}\n${body}`);
  const hasLink = usesVariable(body, 'link');
  const errors = {
    name: !name.trim() ? 'Indique um nome para o modelo.' : name.trim().length > 120 ? 'No máximo 120 caracteres.' : null,
    subject: isEmail && !subject.trim() ? 'Indique o assunto do email.' : null,
    body: !body.trim() ? 'Escreva a mensagem.' : null,
  };
  const valid = !errors.name && !errors.subject && !errors.body;

  const requestClose = async () => {
    if (saving) return;
    if (!readOnly && dirty && !(await confirm({ title: 'Descartar alterações?', message: 'As alterações a este modelo não foram guardadas.', confirmLabel: 'Descartar', cancelLabel: 'Continuar a editar', danger: true }))) return;
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || readOnly) return;
    setSaving(true);
    try {
      const saved = await api.templates.save({
        id: existing?.id,
        event_id: event.id,
        channel,
        name: name.trim(),
        subject: isEmail ? subject.trim() : null,
        body,
      });
      onSaved(saved, !existing);
    } catch (err) {
      toast.error(err);
      setSaving(false);
    }
  };

  const channelOptions: { value: Channel; label: string; icon: React.ReactNode }[] = [
    { value: 'email', label: 'Email', icon: <Mail aria-hidden /> },
    { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle aria-hidden /> },
    ...(channel === 'sms' ? [{ value: 'sms' as Channel, label: 'SMS', icon: <MessageCircle aria-hidden /> }] : []),
  ];

  const title = readOnly ? 'Modelo de mensagem' : existing ? 'Editar modelo' : 'Novo modelo';
  const show = (msg: string | null) => (submitted ? msg : null);

  return (
    <Dialog
      open
      size="lg"
      onClose={() => void requestClose()}
      title={title}
      description={readOnly ? 'Só a equipa com permissão de edição pode alterar os modelos.' : 'As variáveis são substituídas pelos dados de cada convidado no momento do envio.'}
      footer={
        <div className="inv-dialog-footer">
          <div>
            {existing && !readOnly && (
              <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => void onDelete(existing)} disabled={saving}>Eliminar</Button>
            )}
          </div>
          <div className="ui-row">
            <Button onClick={() => void requestClose()} disabled={saving}>{readOnly ? 'Fechar' : 'Cancelar'}</Button>
            {!readOnly && <Button variant="primary" type="submit" form="tpl-form" loading={saving}>Guardar modelo</Button>}
          </div>
        </div>
      }
    >
      <div className="tpl-editor">
        <form id="tpl-form" className="tpl-editor__form" onSubmit={(e) => void submit(e)} noValidate>
          <Field label="Nome do modelo" required error={show(errors.name)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Convite formal" readOnly={readOnly} autoFocus={!readOnly && !existing} />
          </Field>

          <div className="ui-field">
            <span className="ui-field__label" id="tpl-channel-label">Canal</span>
            <div
              className="tpl-seg"
              role="radiogroup"
              aria-labelledby="tpl-channel-label"
              onKeyDown={(e) => {
                // Setas mudam de canal, como num grupo de opções nativo.
                if (readOnly || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                const i = channelOptions.findIndex((o) => o.value === channel);
                const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
                const next = channelOptions[(i + step + channelOptions.length) % channelOptions.length];
                const group = e.currentTarget;
                changeChannel(next.value);
                requestAnimationFrame(() => group.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus());
              }}
            >
              {channelOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  data-value={o.value}
                  aria-checked={channel === o.value}
                  tabIndex={channel === o.value ? 0 : -1}
                  className="tpl-seg__btn"
                  disabled={readOnly}
                  onClick={() => changeChannel(o.value)}
                >
                  {o.icon}{o.label}
                </button>
              ))}
            </div>
          </div>

          {isEmail && (
            <Field label="Assunto" required error={show(errors.subject)}>
              <Input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => { lastField.current = 'subject'; }}
                maxLength={200}
                placeholder="Ex.: Convite — {{evento}}"
                readOnly={readOnly}
              />
            </Field>
          )}

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="tpl-body">Mensagem{!readOnly && <span className="req" aria-hidden>*</span>}</label>
            {!readOnly && (
              <div className="tpl-vars" role="group" aria-label="Inserir variável">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="tpl-var"
                    title={`${v.label} — ex.: ${v.example}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => { lastField.current = 'body'; }}
              rows={isEmail ? 13 : 10}
              className="tpl-body"
              readOnly={readOnly}
              aria-invalid={show(errors.body) ? true : undefined}
              aria-describedby="tpl-body-hint"
              spellCheck
            />
            <div className="tpl-body__foot" id="tpl-body-hint">
              {show(errors.body)
                ? <span className="ui-field__error" role="alert">{errors.body}</span>
                : <span>Uma linha em branco separa parágrafos.{isEmail ? ' Uma linha só com {{link}} dá lugar ao botão.' : ''}</span>}
              {!isEmail && (
                <span className={['tabular', renderedBody.length > WHATSAPP_COMFORTABLE_LENGTH && 'tpl-count--long'].filter(Boolean).join(' ')}>
                  {renderedBody.length.toLocaleString('pt-PT')} caracteres
                </span>
              )}
            </div>
          </div>

          {unknown.length > 0 && (
            <Alert tone="warning">
              {unknown.length === 1 ? 'A variável ' : 'As variáveis '}
              {unknown.map((u) => `{{${u}}}`).join(', ')} não {unknown.length === 1 ? 'existe e fica' : 'existem e ficam'} em branco.
            </Alert>
          )}
          {!hasLink && !isEmail && (
            <Alert tone="warning">A mensagem não inclui {'{{link}}'}: o convidado não terá como abrir o convite e responder.</Alert>
          )}
          {!isEmail && renderedBody.length > WHATSAPP_COMFORTABLE_LENGTH && (
            <Alert tone="info">Mensagem longa: no telemóvel, um texto curto, com o link, é mais eficaz.</Alert>
          )}
        </form>

        <aside className="tpl-editor__preview" aria-label="Pré-visualização">
          <div className="tpl-preview__head">
            <span className="tpl-preview__label">Pré-visualização</span>
            <Select
              aria-label="Pré-visualizar para"
              value={guest ? previewId : SAMPLE}
              onChange={(e) => setPreviewId(e.target.value)}
              options={[
                { value: SAMPLE, label: 'Exemplo fictício' },
                ...guests.map((g) => ({ value: g.id, label: formalName(g) })),
              ]}
            />
          </div>
          {isEmail ? (
            <div className="tpl-mail">
              <dl className="tpl-mail__head">
                <div><dt>Para</dt><dd>{guest?.email ?? SAMPLE_CONTACT.email}</dd></div>
                <div><dt>Assunto</dt><dd className="tpl-mail__subject">{renderedSubject || <span className="muted">Sem assunto</span>}</dd></div>
              </dl>
              <EmailFrame html={emailHtml} />
            </div>
          ) : (
            <div className="tpl-wa">
              <div className="tpl-wa__bubble">
                {renderedBody ? <WhatsappText text={renderedBody} /> : <span className="muted">A mensagem aparece aqui.</span>}
                <span className="tpl-wa__time" aria-hidden>agora</span>
              </div>
            </div>
          )}
          {guest && !guest.email && isEmail && (
            <p className="tpl-preview__note">Este convidado não tem email: não receberá este envio.</p>
          )}
        </aside>
      </div>
    </Dialog>
  );
}

/** Email numa moldura isolada (sem scripts), reduzida para caber na coluna. */
function EmailFrame({ html }: { html: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(720);
  const WIDTH = 640;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (doc) setHeight(Math.max(320, doc.documentElement.scrollHeight));
  };

  return (
    <div ref={wrap} className="tpl-mail__frame" style={{ height: Math.ceil(height * scale) }}>
      <iframe
        ref={frame}
        title="Pré-visualização do email"
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={onLoad}
        tabIndex={-1}
        style={{ width: WIDTH, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}

/** Texto de WhatsApp com os links destacados (como na aplicação). */
function WhatsappText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return <span className="tpl-wa__text">{parts.map((p, i) => (i % 2 ? <span key={i} className="tpl-wa__link">{p}</span> : p))}</span>;
}
