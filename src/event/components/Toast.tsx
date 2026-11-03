import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert } from 'lucide-react';

type Tone = 'ok' | 'error';
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: Tone } | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((msg: string, tone: Tone = 'ok') => {
    setToast({ msg, tone });
    window.clearTimeout(timer.current);
    // Os erros ficam mais tempo: têm mais texto e pedem uma ação.
    timer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 4500 : 2200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`toast${toast ? ' show' : ''}${toast?.tone === 'error' ? ' toast-error' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            {toast.tone === 'error' ? <CircleAlert size={18} /> : <Check size={18} />} {toast.msg}
          </>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
