import { useLayoutEffect } from 'react';

/**
 * As páginas do convidado usam o tema claro (papel), mesmo com o back-office em tema escuro.
 * A classe fica no <html> para que os diálogos e avisos, desenhados fora da página, também a herdem.
 */
export function useLightTheme(enabled = true): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add('theme-light');
    return () => root.classList.remove('theme-light');
  }, [enabled]);
}
