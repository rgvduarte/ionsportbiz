import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './styles/tokens.css';
import './styles/base.css';
import { ConfirmProvider, ToastProvider } from './ui';
import { AuthProvider } from './app/AuthProvider';
import { initNative } from './native/init';
import { consumeAuthRedirect } from './lib/authRedirect';

void initNative();

// Um separador aberto durante uma publicação nova pode pedir ficheiros que já não existem, ou a rede falha a meio
// (vite:preloadError). Recarrega uma vez para obter a versão atual; a marca evita ciclos e expira passados 30 s.
const RELOAD_KEY = 'ion:reload-after-preload-error';
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// O router só é criado depois de tratado um eventual regresso de um link de acesso (ver authRedirect).
const { router } = await consumeAuthRedirect().then(() => import('./app/router'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>,
);
