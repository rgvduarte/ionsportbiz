/*
 * Título que entra palavra a palavra (sobe e desfoca para nítido), adaptado do "Kinetic Text Reveal"
 * da Componentry (https://componentry.dev, licença MIT, aviso em THIRD_PARTY_NOTICES.md). Sem Tailwind e com `m.span` (LazyMotion strict).
 * Os leitores de ecrã leem o texto inteiro uma só vez; as palavras animadas ficam escondidas deles.
 */
import { m } from 'motion/react';
import { ease, motionTokens } from '../../lib/motion/tokens';

export function KineticText({ text, delay = 0, stagger = 0.06 }: { text: string; delay?: number; stagger?: number }) {
  let word = 0;
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span className="kt" aria-hidden>
        {text.split(/(\s+)/).map((part, i) =>
          !part.trim() ? (
            part
          ) : (
            <span key={`${i}-${part}`} className="kt-mask">
              <m.span
                className="kt-word"
                initial={{ opacity: 0, y: '0.55em', filter: `blur(${motionTokens.blur.soft + 2}px)` }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.72, ease: ease(motionTokens.ease.standard), delay: delay + word++ * stagger }}
              >
                {part}
              </m.span>
            </span>
          ),
        )}
      </span>
    </>
  );
}
