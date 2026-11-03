// Imagens em public/: o caminho é relativo à base da app (raiz do domínio, subpasta do GitHub Pages ou Capacitor).
export function asset(path: string): string {
  if (!path || /^(https?:|data:|blob:|\/)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path}`;
}
