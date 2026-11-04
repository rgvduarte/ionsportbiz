import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, Check, CircleAlert, Eye, LoaderCircle, MapPin, Minus, Plus, RefreshCw, Sparkles, TicketX, WifiOff, X } from 'lucide-react';
import type { GuestView, RsvpField } from '../../lib/api/types';
import { TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { useI18n, type I18nKey } from '../lib/i18n';
import { credentialState, passColors } from '../lib/invite';
import {
  canRespond, cleanAnswers, consentToSend, eventDays, eventIsPast, initialAnswers, rsvpErrorCode, rsvpFields, safeUrl, STALE_ERRORS,
  validateRsvp, type AnswerValue, type FormErrors,
} from '../lib/rsvp';
import { useProfile, useStore } from '../lib/store';
import { KineticText } from '../components/KineticText';

const NOTE_MAX = 1000;
type Step = 'choice' | 'accept' | 'decline';

/** Resposta ao convite (/convite): o convite em poucas linhas e dois botões; depois, só o que for preciso. */
export default function Invite() {
  const { t } = useI18n();
  const { state, sync, refresh } = useStore();
  const [step, setStep] = useState<Step>('choice');
  const view = state.view;

  // Cada passo começa no topo do ecrã.
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  // Se o prazo fechar entretanto (ou a equipa decidir), volta à escolha, que explica porquê.
  const open = !!view && canRespond(view);
  useEffect(() => { if (!open) setStep('choice'); }, [open]);

  if (!view) {
    return (
      <>
        <TopBar title={t('invite.title')} />
        <main className="screen pad invite">
          {sync === 'offline' ? (
            <section className="cred-state">
              <span className="cred-state-icon" aria-hidden><WifiOff size={28} /></span>
              <h2>{t('cred.offlineTitle')}</h2>
              <div className="cred-state-body"><p>{t('welcome.errOffline')}</p></div>
              <div className="cred-state-actions">
                <button className="btn btn-primary" onClick={() => void refresh()}><RefreshCw size={18} /> {t('common.retry')}</button>
              </div>
            </section>
          ) : sync === 'unavailable' ? (
            <section className="cred-state">
              <span className="cred-state-icon" aria-hidden><TicketX size={28} /></span>
              <h2>{t('cred.unavailableTitle')}</h2>
              <div className="cred-state-body"><p>{t('cred.unavailableBody')}</p></div>
            </section>
          ) : (
            <div className="invite-skel" aria-busy aria-label={t('card.loading')}>
              <span className="skel skel-line short" />
              <span className="skel skel-block" />
              <span className="skel skel-btn" />
              <span className="skel skel-btn" />
            </div>
          )}
        </main>
      </>
    );
  }

  if (step === 'choice') return <Choice view={view} onChoose={setStep} />;
  return <ReplyForm key={step} view={view} accept={step === 'accept'} onBack={() => setStep('choice')} />;
}

// ───────── O convite e a escolha ─────────

function Choice({ view, onChoose }: { view: GuestView; onChoose: (s: Step) => void }) {
  const { t, locale } = useI18n();
  const { state } = useStore();
  const p = useProfile();
  const { invitation: inv, event: e } = view;
  const preview = !!state.preview;
  const cs = credentialState(inv);
  const respondable = canRespond(view);
  const days = eventDays(e, locale);
  const venue = [e.venue_name, e.venue_address].filter(Boolean).join(', ');
  const text = [e.host_name, e.invitation_text].map((x) => x?.trim()).filter(Boolean).join(' ');
  const deadline = e.rsvp_deadline
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: e.timezone }).format(new Date(e.rsvp_deadline))
    : null;
  // Acesso já reservado pela equipa antes da resposta (convidados aprovados de antemão).
  const reserved = inv.approval_status === 'approved' && cs === 'unconfirmed' ? inv.pass_type : null;
  const colors = passColors(reserved?.color);
  const answered = cs !== 'unconfirmed';

  let closedReason: I18nKey | null = null;
  if (!respondable) {
    closedReason = cs === 'rejected' ? 'card.rejectedTitle'
      : inv.checked_in_at ? 'invite.checkedIn'
        : eventIsPast(e) ? 'invite.past' : 'cred.rsvpClosed';
  }

  return (
    <>
      <TopBar title={t('invite.title')} />
      <main className="screen pad invite">
        {p.firstName && <p className="greeting">{t('home.hello')}, <strong>{p.firstName}</strong></p>}

        <section className="invite-event">
          <h1 className="invite-name"><KineticText text={e.name} delay={0.1} /></h1>
          <ul className="facts invite-facts">
            <li>
              <CalendarDays size={18} />
              <span>{days.map((d) => <span key={d} className="invite-day">{d}</span>)}</span>
            </li>
            {venue && (
              <li><MapPin size={18} /><span>{venue}</span></li>
            )}
          </ul>
          {text && <p className="invite-text">{text}</p>}
          {reserved && (
            <p className="invite-reserved">
              <Sparkles size={16} /> {t('invite.reserved')}
              <span className="pass-chip" style={colors ? { background: colors.accent, color: colors.on } : undefined}>{reserved.name}</span>
            </p>
          )}
        </section>

        {respondable ? (
          <div className="invite-actions">
            {answered && (
              <p className="invite-current">
                {t('invite.yourReply')} <strong>{cs === 'declined' ? t('invite.notAttending') : t('invite.attending')}</strong>
              </p>
            )}
            <button className="btn btn-primary btn-lg btn-block" onClick={() => onChoose('accept')} disabled={preview}>
              <Check size={22} strokeWidth={3} /> {t('invite.accept')}
            </button>
            <button className="btn btn-outline btn-lg btn-block" onClick={() => onChoose('decline')} disabled={preview}>
              <X size={22} /> {t('invite.decline')}
            </button>
            {preview && <p className="preview-note"><Eye size={16} /> {t('preview.noSubmit')}</p>}
            {deadline && !preview && <p className="muted small center">{t('invite.deadline', { date: deadline })}</p>}
          </div>
        ) : (
          <div className="invite-actions">
            {closedReason && <p className="invite-closed">{t(closedReason)}</p>}
            <Link to="/" className="btn btn-primary btn-lg btn-block">{t('invite.goHome')}</Link>
          </div>
        )}
      </main>
    </>
  );
}

// ───────── Confirmar ou recusar: só o que for preciso ─────────

function ReplyForm({ view, accept, onBack }: { view: GuestView; accept: boolean; onBack: () => void }) {
  const { t } = useI18n();
  const { respond, refresh } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const id = useId();
  const { invitation: inv, event: e, contact: c } = view;
  const max = accept ? inv.plus_ones_allowed : 0;
  const fields = accept ? rsvpFields(e) : [];
  const previous = inv.companions.map((m) => m.full_name).slice(0, inv.plus_ones_allowed);
  // Só se pergunta a quem ainda não deu consentimento; a caixa começa sempre desmarcada.
  const consentAsked = !!e.marketing_consent_text && !c.marketing_consent;
  const policy = safeUrl(e.privacy_policy_url);

  const [withCompanions, setWithCompanions] = useState(previous.length > 0);
  const [companions, setCompanions] = useState<string[]>(previous.length ? previous : ['']);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => initialAnswers(rsvpFields(e), inv.answers ?? {}));
  const [note, setNote] = useState(inv.guest_note ?? '');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const active = max > 0 && withCompanions ? companions : [];
  const clear = (key: string) => setErrors((er) => {
    if (!(key in er)) return er;
    const next = { ...er };
    delete next[key];
    return next;
  });

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setSubmitError(null);
    if (accept) {
      const found = validateRsvp(fields, answers, active, {
        required: t('invite.required'), requiredCheck: t('invite.requiredCheck'), companion: t('invite.companionError'),
      });
      setErrors(found);
      if (Object.keys(found).length) {
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
    }
    setBusy(true);
    try {
      await respond({
        accept,
        answers: accept ? cleanAnswers(fields, answers) : {},
        companions: active.map((n) => ({ full_name: n.trim() })),
        note: note.trim() || null,
        marketingConsent: consentToSend(consentAsked, c.marketing_consent, consent),
      });
      toast(accept ? t('invite.toastAccepted') : t('invite.toastDeclined'));
      navigate('/', { replace: true });
    } catch (err) {
      const code = rsvpErrorCode(err);
      setSubmitError(t(`rsvpErr.${code}`));
      if (STALE_ERRORS.has(code)) void refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title={t('invite.title')} onBack={onBack} />
      <main className="screen pad invite">
        <h1 className="display-sm invite-step-title">{accept ? t('invite.acceptTitle') : t('invite.declineTitle')}</h1>
        {!accept && <p className="muted">{t('invite.declineIntro')}</p>}

        <form ref={formRef} className="form invite-form" onSubmit={onSubmit} noValidate>
          {max > 0 && (
            <fieldset className="invite-group">
              <legend>{t('invite.companions')}</legend>
              <p className="muted small">{max === 1 ? t('invite.companionsOne') : t('invite.companionsMany', { n: max })}</p>
              <div className="segmented" role="radiogroup" aria-label={t('invite.companions')}>
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={withCompanions === v}
                    className={withCompanions === v ? 'on' : ''}
                    onClick={() => { setWithCompanions(v); setErrors({}); }}
                  >
                    {v ? t('common.yes') : t('common.no')}
                  </button>
                ))}
              </div>
              {withCompanions && companions.map((name, i) => (
                <div key={i} className="invite-companion">
                  <label>
                    <span>{max > 1 ? t('invite.companionNameN', { n: i + 1 }) : t('invite.companionName')}</span>
                    <input
                      value={name}
                      maxLength={160}
                      autoComplete="off"
                      autoCapitalize="words"
                      aria-invalid={!!errors[`companion-${i}`]}
                      aria-describedby={errors[`companion-${i}`] ? `${id}-c${i}` : undefined}
                      onChange={(ev) => { const v = ev.target.value; setCompanions((all) => all.map((n, j) => (j === i ? v : n))); clear(`companion-${i}`); }}
                    />
                  </label>
                  {companions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label={t('invite.removeCompanion', { n: i + 1 })}
                      onClick={() => { setCompanions((all) => all.filter((_, j) => j !== i)); setErrors({}); }}
                    >
                      <Minus size={18} />
                    </button>
                  )}
                  {errors[`companion-${i}`] && <p id={`${id}-c${i}`} className="field-error">{errors[`companion-${i}`]}</p>}
                </div>
              ))}
              {withCompanions && companions.length < max && (
                <button type="button" className="btn btn-ghost btn-sm invite-add" onClick={() => setCompanions((all) => [...all, ''])}>
                  <Plus size={16} /> {t('invite.addCompanion')}
                </button>
              )}
            </fieldset>
          )}

          {fields.map((f) => (
            <FieldInput key={f.key} field={f} value={answers[f.key]} error={errors[f.key]} onChange={(v) => { setAnswers((a) => ({ ...a, [f.key]: v })); clear(f.key); }} />
          ))}

          <label>
            <span>{t('invite.note')} <em className="opt">· {t('invite.optional')}</em></span>
            <textarea value={note} maxLength={NOTE_MAX} rows={2} onChange={(ev) => setNote(ev.target.value)} />
          </label>

          {consentAsked && (
            <div className="check-row">
              <input id={`${id}-consent`} type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
              <label htmlFor={`${id}-consent`}>
                {e.marketing_consent_text}
                {policy && (
                  <> <a href={policy} target="_blank" rel="noopener noreferrer" className="link" onClick={(ev) => ev.stopPropagation()}>{t('invite.consentPolicy')}</a></>
                )}
              </label>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <p className="form-error" role="alert"><CircleAlert size={18} /> {t('invite.formError')}</p>
          )}
          {submitError && (
            <p className="form-error" role="alert"><CircleAlert size={18} /> {submitError}</p>
          )}

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? <><LoaderCircle size={20} className="spin" /> {t('invite.sending')}</> : t('invite.send')}
          </button>
        </form>
      </main>
    </>
  );
}

function FieldInput({ field, value, error, onChange }: {
  field: RsvpField;
  value: AnswerValue | undefined;
  error: string | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const req = field.required ? <span aria-hidden> *</span> : null;
  const described = error ? `${id}-err` : undefined;
  const errorText = error && <p id={`${id}-err`} className="field-error">{error}</p>;

  if (field.type === 'checkbox') {
    return (
      <div className="check-row">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          required={field.required}
          aria-invalid={!!error}
          aria-describedby={described}
          onChange={(ev) => onChange(ev.target.checked)}
        />
        <label htmlFor={id}>{field.label}{req}</label>
        {errorText}
      </div>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return (
    <label>
      <span>{field.label}{req}</span>
      {field.type === 'textarea' ? (
        <textarea value={text} rows={2} maxLength={1000} aria-invalid={!!error} aria-describedby={described} onChange={(ev) => onChange(ev.target.value)} />
      ) : field.type === 'select' ? (
        <select value={text} aria-invalid={!!error} aria-describedby={described} onChange={(ev) => onChange(ev.target.value)}>
          <option value="">{t('invite.select')}</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={text} maxLength={500} aria-invalid={!!error} aria-describedby={described} onChange={(ev) => onChange(ev.target.value)} />
      )}
      {errorText}
    </label>
  );
}
