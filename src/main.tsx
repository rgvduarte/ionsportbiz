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
