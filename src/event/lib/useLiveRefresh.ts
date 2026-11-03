import { useEffect, useRef } from 'react';
import { useStore } from './store';

/**
 * Pede o convite ao servidor ao abrir o ecrã, ao voltar à app e, enquanto se espera pela equipa
 * (ou pela resposta), de 30 em 30 segundos: a aprovação aparece sem ter de recarregar.
 */
export function useLiveRefresh(waiting: boolean) {
  const { refresh } = useStore();
  const last = useRef(0);
  useEffect(() => {
    const run = () => {
      // "focus" e "visibilitychange" chegam muitas vezes juntos: um pedido chega.
      if (Date.now() - last.current < 2000) return;
      last.current = Date.now();
      void refresh();
    };
    run();
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') { last.current = Date.now(); void refresh(); }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [waiting, refresh]);
}
