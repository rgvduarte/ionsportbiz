import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import './admin.css';
import ionLogo from '../assets/brand/ion-logo.png';
import { useAuth } from '../app/AuthProvider';
import { api, errorMessage } from '../lib/api';
import { Alert, Button, Field, Input, useDocumentTitle } from '../ui';

export function LoginPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  const [email, setEmail] = useState(api.mode === 'demo' ? 'admin@demo.pt' : '');
  const [password, setPassword] = useState(api.mode === 'demo' ? 'demo' : '');
  const [busy, setBusy] = useState<'password' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  useDocumentTitle('Entrar');

  if (session?.staff) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('password');
    setError(null);
    try {
      await api.auth.signIn(email.trim(), password);
      await refresh();
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onMagicLink = async () => {
    if (!email.trim()) {
      setError('Indique o seu email.');
      return;
    }
    setBusy('link');
    setError(null);
    try {
      await api.auth.sendMagicLink(email.trim());
      setLinkSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="login">
      <aside className="login__aside">
        <div>
          <img className="login__logo" src={ionLogo} alt="ion — International Business & Sports Conference" width={200} height={123} />
          <h1>Gestão de convidados</h1>
          <p>Lista de convidados, envio de convites, confirmações e receção no dia do evento, num só lugar.</p>
        </div>
        <p className="login__foot" style={{ fontSize: 'var(--text-sm)' }}>Acesso reservado à equipa organizadora.</p>
      </aside>
      <main className="login__main">
        <form className="login__card ui-stack" onSubmit={onSubmit} noValidate>
          <div>
            <h2>Entrar</h2>
            <p className="muted">Use as credenciais da sua conta de equipa.</p>
          </div>
          {api.mode === 'demo' && (
            <Alert tone="info">
              Modo demonstração: qualquer palavra-passe serve. Para ver outros papéis use editor@demo.pt, porta@demo.pt ou leitura@demo.pt.
            </Alert>
          )}
          {linkSent && <Alert tone="success">Enviámos um link de acesso para {email}. Abra-o neste dispositivo.</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email" required>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Palavra-passe" required>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy === 'password'} disabled={!!busy}>Entrar</Button>
          <Button variant="ghost" block loading={busy === 'link'} disabled={!!busy} onClick={() => void onMagicLink()}>
            Receber link de acesso por email
          </Button>
        </form>
      </main>
    </div>
  );
}
