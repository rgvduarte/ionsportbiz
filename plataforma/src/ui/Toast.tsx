import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { errorMessage } from '../lib/api/errors';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; text: string }

interface ToastApi {
  success(text: string): void;
  info(text: string): void;
  /** Aceita um texto ou um erro (mostra a mensagem do ApiError). */
  error(err: unknown): void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId++;
    setItems((all) => [...all.slice(-3), { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const api = useMemo<ToastApi>(() => ({
    success: (t) => push('success', t),
    info: (t) => push('info', t),
    error: (e) => push('error', typeof e === 'string' ? e : errorMessage(e)),
  }), [push]);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={`ui-toast ui-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              <I aria-hidden />
              <span>{t.text}</span>
              <button type="button" className="ui-toast__close" aria-label="Fechar" onClick={() => dismiss(t.id)}><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
