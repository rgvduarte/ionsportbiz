import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

function useModalBehaviour(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel.current) {
        // Mantém o foco dentro do painel.
        const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      // Primeiro campo editável (os só de leitura e desativados não recebem o foco inicial).
      const target = panel.current?.querySelector<HTMLElement>('[autofocus], input:not([readonly]):not([disabled]):not([type="hidden"]), '
        + 'select:not([disabled]), textarea:not([readonly]):not([disabled]), button:not(.ui-dialog__close):not([disabled])');
      (target ?? panel.current)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  return panel;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ open, onClose, title, description, footer, children, size }: OverlayProps & { size?: 'lg' }) {
  const panel = useModalBehaviour(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={['ui-dialog', size && `ui-dialog--${size}`].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}>
        <header className="ui-dialog__header">
          <div>
            <h2 className="ui-dialog__title">{title}</h2>
            {description && <p className="ui-dialog__desc">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly className="ui-dialog__close" aria-label="Fechar" onClick={onClose} icon={<X />} />
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer && <footer className="ui-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, footer, children }: OverlayProps) {
  const panel = useModalBehaviour(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="ui-drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}>
        <header className="ui-dialog__header">
          <div>
            <h2 className="ui-dialog__title">{title}</h2>
            {description && <p className="ui-dialog__desc">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly className="ui-dialog__close" aria-label="Fechar" onClick={onClose} icon={<X />} />
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer && <footer className="ui-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// ───────── Confirmação ─────────

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = useCallback((value: boolean) => {
    setState((s) => {
      s?.resolve(value);
      return null;
    });
  }, []);
  const onCancel = useCallback(() => close(false), [close]);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onClose={onCancel}
        title={state?.title ?? ''}
        footer={
          <>
            <Button onClick={onCancel}>{state?.cancelLabel ?? 'Cancelar'}</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {state?.message && <div style={{ color: 'var(--c-text-2)' }}>{state.message}</div>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** `if (await confirm({ title: 'Apagar?', danger: true })) …` */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
