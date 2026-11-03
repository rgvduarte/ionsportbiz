import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">
        {msg && (
          <>
            <Check size={18} /> {msg}
          </>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
