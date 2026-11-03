import { useState } from 'react';
import { ExternalLink, Mail, Phone, ShieldCheck } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { api } from '../lib/api';
import type { GuestView } from '../lib/api/types';
import { useConfirm, useToast } from '../ui';
import { useGuestStrings } from './i18n';
import { Section } from './parts';
import { safeUrl } from './utils';

function formatPhone(phone: string): string {
  try {
    return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
  } catch {
    return phone;
  }
}

/** Email e telefone da organização, como links (também usados na mensagem de presença não confirmada). */
export function ContactLinks({ event: e, className }: { event: Pick<GuestView['event'], 'contact_email' | 'contact_phone'>; className?: string }) {
  const t = useGuestStrings();
  if (!e.contact_email && !e.contact_phone) return null;
  return (
    <ul className={['gi-info__contacts', className].filter(Boolean).join(' ')}>
      {e.contact_email && (
        <li>
          <a className="gi-info__link" href={`mailto:${e.contact_email}`}>
            <Mail aria-hidden /><span className="visually-hidden">{t.email}: </span>{e.contact_email}
          </a>
        </li>
      )}
      {e.contact_phone && (
        <li>
          <a className="gi-info__link" href={`tel:${e.contact_phone.replace(/[^\d+]/g, '')}`}>
            <Phone aria-hidden /><span className="visually-hidden">{t.phone}: </span>{formatPhone(e.contact_phone)}
          </a>
        </li>
      )}
    </ul>
  );
}

/** Descrição do evento e contactos da organização. */
export function InfoSection({ view }: { view: GuestView }) {
  const t = useGuestStrings();
  const e = view.event;
  const hasContacts = !!(e.contact_email || e.contact_phone);
  if (!e.description && !hasContacts) return null;

  return (
    <Section id="gi-info" eyebrow={t.infoEyebrow} title={t.infoTitle}>
      <div className="gi-info">
        {e.description && (
          <div className="gi-info__block">
            <h3 className="gi-info__label">{t.aboutTitle}</h3>
            <p className="gi-info__text">{e.description}</p>
          </div>
        )}
        {hasContacts && (
          <div className="gi-info__block">
            <h3 className="gi-info__label">{t.contactsTitle}</h3>
            <p className="gi-info__text gi-info__muted">{t.contactsIntro}</p>
            <ContactLinks event={e} />
          </div>
        )}
      </div>
    </Section>
  );
}

/** Rodapé de privacidade: responsável, política e pedido de eliminação dos dados. */
export function PrivacyFooter({ view, token, preview }: { view: GuestView; token: string; preview: boolean }) {
  const t = useGuestStrings();
  const confirm = useConfirm();
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const e = view.event;
  const policy = safeUrl(e.privacy_policy_url);

  const requestErasure = async () => {
    const ok = await confirm({
      title: t.erasureConfirmTitle,
      message: t.erasureConfirmBody,
      confirmLabel: t.erasureConfirm,
      cancelLabel: t.cancel,
      danger: true,
    });
    if (!ok) return;
    if (preview) {
      toast.info(t.previewNoSubmit);
      return;
    }
    setState('busy');
    try {
      await api.guest.requestErasure(token);
      setState('done');
    } catch {
      setState('idle');
      toast.error(t.erasureError);
    }
  };

  return (
    <footer className="gi-footer">
      <div className="gi-footer__inner">
        <h2 className="gi-footer__title"><ShieldCheck aria-hidden />{t.privacyTitle}</h2>
        <p>{t.privacyText}</p>
        {e.privacy_controller && (
          <p>
            <span className="gi-footer__label">{t.privacyController}: </span>
            {e.privacy_controller}
          </p>
        )}
        <div className="gi-footer__links">
          {policy && (
            <a href={policy} target="_blank" rel="noopener noreferrer">
              {t.privacyPolicy}<ExternalLink aria-hidden />
            </a>
          )}
          {state !== 'done' && (
            <button type="button" className="gi-linkbtn" onClick={requestErasure} disabled={state === 'busy'} aria-busy={state === 'busy' || undefined}>
              {t.erasureRequest}
            </button>
          )}
        </div>
        {state === 'done' && <p className="gi-footer__done" role="status">{t.erasureDone}</p>}
      </div>
    </footer>
  );
}
