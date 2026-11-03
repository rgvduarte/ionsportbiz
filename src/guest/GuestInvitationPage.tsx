import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, Eye, Link2Off, RefreshCw, WifiOff } from 'lucide-react';
import { api } from '../lib/api';
import type { Language } from '../lib/api/types';
import { useAsync } from '../lib/useAsync';
import { isNative } from '../native/platform';
import { savedInvitations } from '../native/savedInvitations';
import { Button, ButtonLink } from '../ui';
import { GuestI18n, guestStrings } from './i18n';
import { InfoSection, PrivacyFooter } from './InfoSection';
import { InvitationCard } from './InvitationCard';
import { LanguageToggle } from './LanguageToggle';
import { accentStyle, eventTheme, InvitationSkeleton, StateMessage } from './parts';
import { ProgrammeSection } from './ProgrammeSection';
import { RsvpSection } from './RsvpSection';
import { TicketSection } from './TicketSection';
import { guestPhase } from './utils';
import './guest.css';
import { useLightTheme } from './useLightTheme';

/** Convite pessoal (/c/:token). Sem conta: o token do link é a credencial. */
export function GuestInvitationPage() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const { data: view, error, loading, reload, setData } = useAsync(
    () => api.guest.view(token, { track: !preview }),
    [token, preview],
  );
  const [chosenLang, setChosenLang] = useState<Language | null>(null);
  // Os conteúdos do evento só existem em português: por omissão a página inteira fica em português
  // (evita misturar textos do evento em PT com a interface em EN); o convidado pode mudar no seletor.
  const lang = chosenLang ?? 'pt';
  const t = guestStrings(lang);
  const accent = view?.event.branding?.accent;
  const theme = view ? eventTheme(view.event) : 'light';
  const style = useMemo(() => accentStyle(accent, theme), [accent, theme]);
  useLightTheme(theme === 'light');

  // Língua e título do documento, repostos ao sair.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = t.htmlLang;
    return () => { document.documentElement.lang = previous; };
  }, [t.htmlLang]);

  // A barra do browser no telemóvel acompanha a cor do evento.
  const themeColor = theme === 'dark' ? '#000000' : (style as Record<string, string>)['--gi-accent'];
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = themeColor;
    return () => { meta.content = previous; };
  }, [themeColor]);

  const eventName = view?.event.name;
  useEffect(() => {
    if (!eventName) return;
    const previous = document.title;
    document.title = t.documentTitle(eventName);
    return () => { document.title = previous; };
  }, [eventName, t]);

  // Na app, o convite aberto fica em "Os meus convites". Com a presença aprovada fica também guardado
  // no browser, para a app do evento ("/") encontrar a credencial neste dispositivo.
  // Na pré-visualização da equipa nada se guarda (o convite não é de quem o está a ver).
  const approved = !!view && guestPhase(view.invitation) === 'approved';
  useEffect(() => {
    if (preview || !view || !(isNative || approved)) return;
    void savedInvitations.add({ token, eventName: view.event.name, startsAt: view.event.starts_at, timezone: view.event.timezone });
  }, [view, token, preview, approved]);

  let content;
  if (!view && loading) {
    content = <InvitationSkeleton label={t.loading} />;
  } else if (!view && error) {
    content = (
      <StateMessage
        icon={<WifiOff />}
        title={t.loadErrorTitle}
        actions={<Button variant="primary" size="lg" icon={<RefreshCw />} className="gi-btn-primary" onClick={reload}>{t.retry}</Button>}
      >
        {t.loadErrorBody}
      </StateMessage>
    );
  } else if (!view) {
    content = (
      <StateMessage
        icon={<Link2Off />}
        title={t.invalidTitle}
        actions={isNative ? <ButtonLink to="/app" size="lg">{t.backToApp}</ButtonLink> : undefined}
      >
        {t.invalidBody}
      </StateMessage>
    );
  } else {
    content = (
      <>
        <InvitationCard view={view} />
        <RsvpSection view={view} token={token} preview={preview} onUpdated={setData} onStale={reload} />
        <TicketSection view={view} token={token} preview={preview} />
        <ProgrammeSection view={view} />
        <InfoSection view={view} />
      </>
    );
  }

  return (
    <GuestI18n.Provider value={t}>
      <div className="gi" data-theme={theme} style={style} lang={t.htmlLang}>
        {preview && (
          <div className="gi-preview" role="note">
            <Eye aria-hidden />
            {t.previewBanner}
          </div>
        )}
        <div className="gi-band" aria-hidden />
        <header className="gi-top">
          {isNative ? (
            <Link to="/app" className="gi-top__back">
              <ChevronLeft aria-hidden />
              {t.backToApp}
            </Link>
          ) : (
            <span />
          )}
          <LanguageToggle value={lang} onChange={setChosenLang} />
        </header>
        <main className="gi-main" aria-busy={loading || undefined}>{content}</main>
        {view && <PrivacyFooter view={view} token={token} preview={preview} />}
      </div>
    </GuestI18n.Provider>
  );
}
