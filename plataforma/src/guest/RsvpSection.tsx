import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, CircleSlash, Clock, Minus, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import type { GuestView, RsvpField } from '../lib/api/types';
import { formatDate, formatLongDate, formatTime } from '../lib/format';
import { Alert, Button, Checkbox, Field, Input, Select, Textarea, useToast } from '../ui';
import { errorText, useGuestStrings } from './i18n';
import { Section } from './parts';
import { cleanAnswers, eventIsPast, initialAnswers, safeUrl, validateRsvp, type AnswerValue, type FormErrors } from './utils';

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
  const canRespond = e.rsvp_open && !inv.checked_in_at;
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
  if (answered && !editing) {
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
    <Section id="gi-rsvp" eyebrow={t.rsvpEyebrow} title={t.rsvpTitle} intro={!answered && canRespond ? t.rsvpIntro : undefined}>
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
    <div className={`gi-done gi-done--${accepted ? 'accepted' : 'declined'}`}>
      <div className="gi-done__head">
        <span className="gi-done__icon" aria-hidden>{accepted ? <Check /> : <CircleSlash />}</span>
        <div>
          <h3 className="gi-done__title" ref={headingRef} tabIndex={-1}>{accepted ? t.acceptedTitle : t.declinedTitle}</h3>
          <p className="gi-done__body">
            {!accepted ? t.declinedBody : !past ? t.acceptedBody : inv.checked_in_at ? t.attendedBody : t.acceptedPastBody}
          </p>
        </div>
      </div>
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
        {inv.responded_at && (
          <p className="gi-done__meta">
            {t.respondedOn(`${formatDate(inv.responded_at, e.timezone, t.locale)}, ${formatTime(inv.responded_at, e.timezone, t.locale)}`)}
            {canChange && deadline && <> {t.changeUntil(deadline)}</>}
          </p>
        )}
        {canChange && <Button onClick={onChange}>{t.changeAnswer}</Button>}
      </div>
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
      toast.success(accept ? t.toastAccepted : t.toastDeclined);
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
