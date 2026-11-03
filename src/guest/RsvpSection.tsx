import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, CircleSlash, Clock, Hourglass, Info, Minus, Plus, QrCode, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import type { GuestView, RsvpField } from '../lib/api/types';
import { formatDate, formatLongDate, formatTime } from '../lib/format';
import { Alert, Button, Checkbox, Field, Input, Select, Textarea, useToast } from '../ui';
import { errorText, useGuestStrings } from './i18n';
import { ContactLinks } from './InfoSection';
import { eventTheme, passStyle, Section } from './parts';
import {
  cleanAnswers, eventIsPast, guestPhase, initialAnswers, reservedPass, safeUrl, validateRsvp, type AnswerValue, type FormErrors,
} from './utils';

const NOTE_MAX = 1000;
/** Erros que significam que o convite mudou entretanto: volta a carregar para mostrar o estado certo. */
const STALE = new Set(['rsvp_closed', 'already_checked_in', 'not_found']);

type Choice = 'accept' | 'decline';

function without(errors: FormErrors, key: string): FormErrors {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

interface Props {
  view: GuestView;
  token: string;
  preview: boolean;
  onUpdated: (v: GuestView) => void;
  onStale: () => void;
}

export function RsvpSection({ view, token, preview, onUpdated, onStale }: Props) {
  const t = useGuestStrings();
  const { invitation: inv, event: e } = view;
  const answered = inv.status === 'accepted' || inv.status === 'declined';
  const phase = guestPhase(inv);
  // A equipa não pôde confirmar a presença: a resposta deixa de poder ser alterada aqui.
  const canRespond = e.rsvp_open && !inv.checked_in_at && phase !== 'rejected';
  const reserved = reservedPass(inv);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deadline = e.rsvp_deadline ? formatLongDate(e.rsvp_deadline, e.timezone, t.locale) : null;

  // Se o prazo fechar entretanto, sai do modo de edição.
  useEffect(() => {
    if (!canRespond) { setEditing(false); setChoice(null); }
  }, [canRespond]);

  const done = (v: GuestView) => {
    onUpdated(v);
    setEditing(false);
    setChoice(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  let body;
  if (phase === 'rejected') {
    body = <Rejected view={view} />;
  } else if (answered && !editing) {
    body = (
      <Summary view={view} headingRef={headingRef} canChange={canRespond} deadline={deadline} past={eventIsPast(e)} onChange={() => setEditing(true)} />
    );
  } else if (!canRespond) {
    const past = eventIsPast(e);
    body = (
      <div className="gi-notice">
        <Clock aria-hidden />
        <div>
          <p className="gi-notice__title">{past ? t.pastTitle : t.closedTitle}</p>
          <p>{past ? t.pastBody : t.closedBody}</p>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {reserved !== undefined && <ReservedPass view={view} pass={reserved} />}
        {deadline && <p className="gi-deadline"><Clock aria-hidden />{t.rsvpDeadline(deadline)}</p>}
        <div className="gi-choice" role="group" aria-label={t.rsvpTitle}>
          <button
            type="button"
            className="gi-choice__btn gi-choice__btn--accept"
            aria-pressed={choice === 'accept'}
            aria-controls={choice ? 'gi-rsvp-form' : undefined}
            onClick={() => setChoice('accept')}
          >
            <span className="gi-choice__icon" aria-hidden><Check /></span>
            {t.accept}
          </button>
          <button
            type="button"
            className="gi-choice__btn gi-choice__btn--decline"
            aria-pressed={choice === 'decline'}
            aria-controls={choice ? 'gi-rsvp-form' : undefined}
            onClick={() => setChoice('decline')}
          >
            <span className="gi-choice__icon" aria-hidden><X /></span>
            {t.decline}
          </button>
        </div>
        {e.requires_approval && inv.approval_status === 'pending' && (
          <p className="gi-fineprint"><Info aria-hidden />{t.approvalNote}</p>
        )}
        {choice && (
          <RsvpForm
            key={choice}
            choice={choice}
            view={view}
            token={token}
            preview={preview}
            onCancel={() => setChoice(null)}
            onDone={done}
            onStale={onStale}
          />
        )}
        {answered && !choice && (
          <div className="gi-actions">
            <Button variant="ghost" onClick={() => setEditing(false)}>{t.back}</Button>
          </div>
        )}
      </>
    );
  }

  return (
    <Section id="gi-rsvp" eyebrow={t.rsvpEyebrow} title={t.rsvpTitle} intro={!answered && canRespond && reserved === undefined ? t.rsvpIntro : undefined}>
      {body}
    </Section>
  );
}

// ───────── Resumo depois de responder ─────────

function Summary({ view, headingRef, canChange, deadline, past, onChange }: {
  view: GuestView;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  canChange: boolean;
  deadline: string | null;
  past: boolean;
  onChange: () => void;
}) {
  const t = useGuestStrings();
  const { invitation: inv, event: e } = view;
  const accepted = inv.status === 'accepted';
  const phase = guestPhase(inv);
  // Confirmou mas a equipa ainda não aprovou: sem credencial, com os passos que faltam.
  const awaiting = phase === 'awaiting_approval' && !past;
  const pass = phase === 'approved' ? inv.pass_type : null;
  const respondedOn = inv.responded_at
    ? `${formatDate(inv.responded_at, e.timezone, t.locale)}, ${formatTime(inv.responded_at, e.timezone, t.locale)}`
    : null;
  const rows: [string, string][] = [];
  if (accepted && inv.plus_ones_allowed > 0) {
    rows.push([t.summaryCompanions, inv.companions.map((m) => m.full_name).join(', ') || t.summaryNone]);
  }
  if (accepted) {
    for (const f of Array.isArray(e.rsvp_fields) ? e.rsvp_fields : []) {
      const v = inv.answers[f.key];
      if (v === undefined || v === null || v === '') continue;
      rows.push([f.label, typeof v === 'boolean' ? (v ? t.yesValue : t.noValue) : String(v)]);
    }
  }
  if (inv.guest_note) rows.push([t.summaryNote, inv.guest_note]);

  return (
    <div className={`gi-done gi-done--${awaiting ? 'awaiting' : accepted ? 'accepted' : 'declined'}`}>
      <div className="gi-done__head">
        <span className="gi-done__icon" aria-hidden>{awaiting ? <Hourglass /> : accepted ? <Check /> : <CircleSlash />}</span>
        <div>
          <h3 className="gi-done__title" ref={headingRef} tabIndex={-1}>
            {awaiting ? (
              <>
                {t.awaitingTitle}
                <span className="visually-hidden"> — </span>
                <span className="gi-done__status">{t.awaitingStatus}</span>
              </>
            ) : accepted ? t.acceptedTitle : t.declinedTitle}
          </h3>
          <p className="gi-done__body">
            {awaiting
              ? t.awaitingBody
              : !accepted ? t.declinedBody
                : !past ? (pass ? t.approvedBody(pass.name) : t.acceptedBody)
                  : inv.checked_in_at ? t.attendedBody : t.acceptedPastBody}
          </p>
        </div>
      </div>
      {awaiting && (
        <ol className="gi-steps" aria-label={t.stepsLabel}>
          <li className="gi-step gi-step--done">
            <span className="gi-step__dot" aria-hidden><Check /></span>
            <span className="gi-step__text">
              <span className="gi-step__title">{t.stepConfirmed}<span className="visually-hidden"> ({t.stepDone})</span></span>
              {respondedOn && <span className="gi-step__hint">{respondedOn}</span>}
            </span>
          </li>
          <li className="gi-step gi-step--current" aria-current="step">
            <span className="gi-step__dot" aria-hidden><Hourglass /></span>
            <span className="gi-step__text">
              <span className="gi-step__title">{t.stepApproval}<span className="visually-hidden"> ({t.stepCurrent})</span></span>
              <span className="gi-step__hint gi-step__hint--live">{t.stepApprovalNow}</span>
            </span>
          </li>
          <li className="gi-step">
            <span className="gi-step__dot" aria-hidden><QrCode /></span>
            <span className="gi-step__text">
              <span className="gi-step__title">{t.stepCredential}<span className="visually-hidden"> ({t.stepNext})</span></span>
              <span className="gi-step__hint">{t.stepCredentialHint}</span>
            </span>
          </li>
        </ol>
      )}
      {rows.length > 0 && (
        <dl className="gi-summary">
          {rows.map(([k, v]) => (
            <div key={k} className="gi-summary__row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="gi-done__foot">
        {respondedOn && (
          <p className="gi-done__meta">
            {t.respondedOn(respondedOn)}
            {canChange && deadline && <> {t.changeUntil(deadline)}</>}
          </p>
        )}
        {canChange && <Button onClick={onChange}>{t.changeAnswer}</Button>}
      </div>
    </div>
  );
}

// ───────── Presença não confirmada pela equipa ─────────

function Rejected({ view }: { view: GuestView }) {
  const t = useGuestStrings();
  const e = view.event;
  return (
    <div className="gi-done gi-done--rejected">
      <div className="gi-done__head">
        <span className="gi-done__icon" aria-hidden><Info /></span>
        <div>
          <h3 className="gi-done__title">{t.rejectedTitle}</h3>
          <p className="gi-done__body">{t.rejectedBody}</p>
        </div>
      </div>
      {(e.contact_email || e.contact_phone) && (
        <div className="gi-done__contacts">
          <p>{t.rejectedContacts}</p>
          <ContactLinks event={e} />
        </div>
      )}
    </div>
  );
}

// ───────── Acesso reservado antes da resposta ─────────

function ReservedPass({ view, pass }: { view: GuestView; pass: GuestView['invitation']['pass_type'] }) {
  const t = useGuestStrings();
  const style = passStyle(pass?.color, view.event.branding?.accent, eventTheme(view.event));
  return (
    <div className="gi-reserved" style={style}>
      <p className="gi-reserved__eyebrow"><Sparkles aria-hidden />{t.reservedEyebrow}</p>
      {/* O nome do acesso não se parte entre linhas ("VIP / Pass"). */}
      <p className="gi-reserved__title">{t.reservedTitle(pass ? pass.name.replace(/ /g, '\u00a0') : null)}</p>
      <p className="gi-reserved__body">{t.reservedBody}</p>
      {pass && pass.accesses.length > 0 && (
        <ul className="gi-reserved__list" aria-label={t.passIncludes}>
          {pass.accesses.map((a) => (
            <li key={a}><Check aria-hidden />{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────── Formulário ─────────

function RsvpForm({ choice, view, token, preview, onCancel, onDone, onStale }: {
  choice: Choice;
  view: GuestView;
  token: string;
  preview: boolean;
  onCancel: () => void;
  onDone: (v: GuestView) => void;
  onStale: () => void;
}) {
  const t = useGuestStrings();
  const toast = useToast();
  const id = useId();
  const { invitation: inv, event: e, contact: c } = view;
  const accept = choice === 'accept';
  const max = inv.plus_ones_allowed;
  const fields: RsvpField[] = Array.isArray(e.rsvp_fields) ? e.rsvp_fields : [];
  const previous = inv.companions.map((m) => m.full_name).slice(0, max);

  const [withCompanions, setWithCompanions] = useState(previous.length > 0);
  const [companions, setCompanions] = useState<string[]>(previous.length ? previous : ['']);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => initialAnswers(fields, inv.answers ?? {}));
  const [note, setNote] = useState(inv.guest_note ?? '');
  const [consent, setConsent] = useState(c.marketing_consent);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const activeCompanions = accept && max > 0 && withCompanions ? companions : [];
  const policy = safeUrl(e.privacy_policy_url);
  const hasRequired = accept && (fields.some((f) => f.required) || activeCompanions.length > 0);

  const setAnswer = (key: string, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setErrors((er) => without(er, key));
  };

  const setCompanion = (i: number, value: string) => {
    setCompanions((all) => all.map((n, j) => (j === i ? value : n)));
    setErrors((er) => without(er, `companion-${i}`));
  };

  const removeCompanion = (i: number) => {
    setCompanions((all) => (all.length === 1 ? [''] : all.filter((_, j) => j !== i)));
    setErrors({});
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitError(null);
    if (accept) {
      const found = validateRsvp(fields, answers, activeCompanions, {
        required: t.requiredError, requiredCheck: t.requiredCheckError, companion: t.companionError,
      });
      setErrors(found);
      if (Object.keys(found).length) {
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
    }
    if (preview) {
      toast.info(t.previewNoSubmit);
      return;
    }
    setBusy(true);
    try {
      const v = await api.guest.respond(token, {
        accept,
        answers: accept ? cleanAnswers(fields, answers) : {},
        companions: activeCompanions.map((n) => ({ full_name: n.trim() })),
        note: note.trim() || null,
        marketingConsent: e.marketing_consent_text && consent !== c.marketing_consent ? consent : null,
      });
      toast.success(!accept ? t.toastDeclined : guestPhase(v.invitation) === 'awaiting_approval' ? t.toastAcceptedPending : t.toastAccepted);
      onDone(v);
    } catch (err) {
      const message = errorText(t, err);
      setSubmitError(message);
      const code = (err as { code?: string } | null)?.code;
      if (code && STALE.has(code)) {
        toast.error(message);
        onStale();
      }
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] ?? null;

  return (
    <form id="gi-rsvp-form" ref={formRef} className="gi-form" onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} ref={titleRef} tabIndex={-1} className="gi-form__title">
        {accept ? t.acceptFormTitle : t.declineFormTitle}
      </h3>
      {!accept && <p className="gi-form__intro">{t.declineFormIntro}</p>}

      {accept && max > 0 && (
        <fieldset className="gi-fieldset">
          <legend className="gi-fieldset__legend">{t.companionsQuestion}</legend>
          <p className="gi-fieldset__hint">{t.companionsHint(max)}</p>
          <div className="gi-segment">
            {([false, true] as const).map((v) => (
              <label key={String(v)} className="gi-segment__opt">
                <input
                  type="radio"
                  name={`${id}-with`}
                  checked={withCompanions === v}
                  onChange={() => { setWithCompanions(v); setErrors({}); }}
                />
                <span>{v ? t.yes : t.no}</span>
              </label>
            ))}
          </div>
          {withCompanions && (
            <div className="gi-companions">
              {companions.map((name, i) => (
                <div key={i} className="gi-companion">
                  <Field label={t.companionName(i + 1, max > 1)} required error={err(`companion-${i}`)}>
                    <Input
                      value={name}
                      maxLength={160}
                      autoComplete="off"
                      autoCapitalize="words"
                      onChange={(ev) => setCompanion(i, ev.target.value)}
                    />
                  </Field>
                  {companions.length > 1 && (
                    <Button
                      variant="ghost"
                      iconOnly
                      className="gi-companion__remove"
                      aria-label={t.removeCompanion(i + 1)}
                      icon={<Minus />}
                      onClick={() => removeCompanion(i)}
                    />
                  )}
                </div>
              ))}
              {companions.length < max && (
                <Button variant="ghost" size="sm" icon={<Plus />} className="gi-companions__add" onClick={() => setCompanions((all) => [...all, ''])}>
                  {t.addCompanion}
                </Button>
              )}
            </div>
          )}
        </fieldset>
      )}

      {accept && fields.length > 0 && (
        <fieldset className="gi-fieldset">
          <legend className="gi-fieldset__legend">{t.additionalInfo}</legend>
          <div className="gi-fields">
            {fields.map((f) => (
              <RsvpFieldInput key={f.key} field={f} value={answers[f.key]} error={err(f.key)} onChange={(v) => setAnswer(f.key, v)} />
            ))}
          </div>
        </fieldset>
      )}

      <Field
        label={t.noteLabel}
        hint={note.length > NOTE_MAX * 0.8 ? t.noteCounter(note.length, NOTE_MAX) : undefined}
      >
        <Textarea value={note} maxLength={NOTE_MAX} rows={3} onChange={(ev) => setNote(ev.target.value)} />
      </Field>

      {e.marketing_consent_text && (
        <div className="gi-consent">
          <Checkbox label={e.marketing_consent_text} checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
          {policy && (
            <a className="gi-consent__link" href={policy} target="_blank" rel="noopener noreferrer">{t.consentPolicyLink}</a>
          )}
        </div>
      )}

      {hasRequired && <p className="gi-form__legend">{t.requiredLegend}</p>}
      {Object.keys(errors).length > 0 && <Alert tone="danger">{t.formErrorSummary}</Alert>}
      {submitError && <Alert tone="danger">{submitError}</Alert>}
      {preview && <p className="gi-form__preview">{t.previewNoSubmit}</p>}

      <div className="gi-actions">
        <Button type="submit" variant="primary" size="lg" loading={busy} className="gi-btn-primary">
          {accept ? t.submitAccept : t.submitDecline}
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel} disabled={busy}>{t.back}</Button>
      </div>
    </form>
  );
}

function RsvpFieldInput({ field, value, error, onChange }: {
  field: RsvpField;
  value: AnswerValue | undefined;
  error: string | null;
  onChange: (v: AnswerValue) => void;
}) {
  const t = useGuestStrings();
  const errId = useId();
  if (field.type === 'checkbox') {
    return (
      <div className="gi-field-check">
        <Checkbox
          label={<>{field.label}{field.required && <span className="req" aria-hidden> *</span>}</>}
          checked={value === true}
          required={field.required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(ev) => onChange(ev.target.checked)}
        />
        {error && <div className="ui-field__error" id={errId} role="alert">{error}</div>}
      </div>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return (
    <Field label={field.label} required={field.required} error={error}>
      {field.type === 'textarea' ? (
        <Textarea value={text} rows={3} maxLength={1000} onChange={(ev) => onChange(ev.target.value)} />
      ) : field.type === 'select' ? (
        <Select
          value={text}
          placeholder={t.selectPlaceholder}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          onChange={(ev) => onChange(ev.target.value)}
        />
      ) : (
        <Input value={text} maxLength={500} onChange={(ev) => onChange(ev.target.value)} />
      )}
    </Field>
  );
}
