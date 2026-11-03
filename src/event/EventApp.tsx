import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Eye } from 'lucide-react';
import './event.css';
import { TabBar } from './components/TabBar';
import { ToastProvider } from './components/Toast';
import { I18nProvider, useI18n } from './lib/i18n';
import { StoreProvider, useStore } from './lib/store';
import Agenda from './screens/Agenda';
import Credential from './screens/Credential';
import Home from './screens/Home';
import Invite from './screens/Invite';
import InviteEntry from './InviteEntry';
import More, { EditProfile, Info, NewsDetail, NewsList, Partners } from './screens/More';
import Networking, { AttendeeDetail } from './screens/Networking';
import SessionDetail from './screens/SessionDetail';
import { SpeakerDetail, SpeakerList } from './screens/Speakers';
import Welcome from './screens/Welcome';
import { Boot } from './components/ui';

/** A app é só para convidados: sem convite guardado neste dispositivo, mostra a entrada. */
function Shell() {
  const { state, ready } = useStore();
  const { pathname } = useLocation();
  // Bloco com chavetas: nos browsers recentes scrollTo devolve uma Promise, e o React trataria o valor
  // devolvido como função de limpeza do efeito ("l is not a function").
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (!state.token) return ready ? <Navigate to="/welcome" replace /> : <Boot />;
  return (
    <div className="app">
      <Outlet />
      <TabBar />
    </div>
  );
}

/** Pré-visualização da equipa: sempre visível, para ninguém a confundir com o convite do dispositivo. */
function PreviewBar() {
  const { state, exitPreview } = useStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!state.preview) return null;
  return (
    <div className="preview-bar" role="note">
      <Eye size={16} aria-hidden />
      <span>{t('preview.banner')}</span>
      <button onClick={() => { exitPreview(); navigate('/', { replace: true }); }}>{t('preview.exit')}</button>
    </div>
  );
}

/** Classe na raiz: a barra de pré-visualização empurra o topo da app. */
function Root({ children }: { children: ReactNode }) {
  const { state } = useStore();
  return <div className={`ev${state.preview ? ' is-preview' : ''}`}>{children}</div>;
}

function LangAttr() {
  const { lang } = useI18n();
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = previous; };
  }, [lang]);
  return null;
}

/** App do evento para participantes (vinda do ionAPP). O router é o da plataforma: esta árvore vive em "/*". */
export function EventApp() {
  return (
    <I18nProvider>
      <LangAttr />
      <StoreProvider>
        {/* O aviso (toast) fica dentro de .ev, onde estão os estilos dele. */}
        <Root>
          <ToastProvider>
            <PreviewBar />
            <Routes>
              {/* Link pessoal do convite: entra diretamente na app (sem página intermédia). */}
              <Route path="/c/:token" element={<InviteEntry />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route element={<Shell />}>
                <Route index element={<Home />} />
                <Route path="convite" element={<Invite />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda/:id" element={<SessionDetail />} />
                <Route path="speakers" element={<SpeakerList />} />
                <Route path="speakers/:id" element={<SpeakerDetail />} />
                <Route path="credential" element={<Credential />} />
                <Route path="networking" element={<Networking />} />
                <Route path="networking/:id" element={<AttendeeDetail />} />
                <Route path="more" element={<More />} />
                <Route path="more/profile" element={<EditProfile />} />
                <Route path="partners" element={<Partners />} />
                <Route path="info" element={<Info />} />
                <Route path="news" element={<NewsList />} />
                <Route path="news/:id" element={<NewsDetail />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ToastProvider>
        </Root>
      </StoreProvider>
    </I18nProvider>
  );
}
