import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

// As funcionalidades de animação (incl. layout partilhado) vêm num ficheiro à parte, carregado depois do primeiro ecrã.
const loadFeatures = () => import('./features').then((m) => m.default);

/**
 * Raiz das animações da plataforma (app do evento e back-office).
 * `strict`: só se usam os componentes leves `m.*`, nunca `motion.*` (que traria tudo no primeiro carregamento).
 * `reducedMotion="user"`: quem pediu ao sistema menos movimento fica só com opacidades, sem deslocações.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
