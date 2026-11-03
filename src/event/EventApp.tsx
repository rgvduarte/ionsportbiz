import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import './event.css';
import { TabBar } from './components/TabBar';
import { ToastProvider } from './components/Toast';
import { I18nProvider, useI18n } from './lib/i18n';
import { StoreProvider, useStore } from './lib/store';
import Agenda from './screens/Agenda';
import Credential from './screens/Credential';
import Home from './screens/Home';
import More, { EditProfile, Info, NewsDetail, NewsList, Partners } from './screens/More';
import Networking, { AttendeeDetail } from './screens/Networking';
import SessionDetail from './screens/SessionDetail';
import { SpeakerDetail, SpeakerList } from './screens/Speakers';
import Welcome from './screens/Welcome';

function Shell() {
  const { state } = useStore();
  const { pathname } = useLocation();
  // Bloco com chavetas: nos browsers recentes scrollTo devolve uma Promise, e o React trataria o valor
  // devolvido como função de limpeza do efeito ("l is not a function").
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (!state.profile) return <Navigate to="/welcome" replace />;
  return (
    <div className="app">
      <Outlet />
      <TabBar />
    </div>
  );
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
        <ToastProvider>
          <div className="ev">
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route element={<Shell />}>
                <Route index element={<Home />} />
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
          </div>
        </ToastProvider>
      </StoreProvider>
    </I18nProvider>
  );
}
