/*
 * Algarismo de painel de partidas (split-flap), adaptado do "Split Flap Display" da Componentry
 * (https://componentry.dev, licença MIT, aviso em THIRD_PARTY_NOTICES.md). Reescrito sem Tailwind e só para algarismos:
 * - ao abrir, cada placa roda de 0 até ao valor, em onda (o atraso cresce da esquerda para a direita);
 * - depois, cada mudança é uma única placa a cair, como num relógio de placas.
 * Com "reduzir movimento" no sistema, o algarismo muda sem animação.
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';

const STEP_MS = 70; // cada placa da onda de abertura
const TICK_MS = 340; // uma placa normal (ex.: mudança de segundo)

type Face = { shown: string; prev: string; flip: number; ms: number };

export function FlapDigit({ digit, delay = 0 }: { digit: string; delay?: number }) {
  const reduce = useReducedMotion();
  const [face, setFace] = useState<Face>({ shown: '0', prev: '0', flip: 0, ms: STEP_MS });
  const current = useRef('0');
  // A onda de abertura só termina uma vez; até lá, uma mudança de valor recomeça-a a partir de onde ia.
  const settled = useRef(false);

  useEffect(() => {
    const timers: number[] = [];
    const flipTo = (next: string, ms: number) => {
      current.current = next;
      setFace((f) => ({ shown: next, prev: f.shown, flip: f.flip + 1, ms }));
    };
    const target = Number(digit);
    if (reduce || Number.isNaN(target)) {
      settled.current = true;
      if (digit !== current.current) {
        current.current = digit;
        setFace((f) => ({ shown: digit, prev: digit, flip: f.flip, ms: 0 }));
      }
    } else if (!settled.current) {
      let n = Number(current.current);
      let at = delay;
      while (n !== target) {
        n = (n + 1) % 10;
        const v = String(n);
        timers.push(window.setTimeout(() => flipTo(v, STEP_MS), at));
        at += STEP_MS;
      }
      timers.push(window.setTimeout(() => { settled.current = true; }, at));
    } else if (digit !== current.current) {
      flipTo(digit, TICK_MS);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [digit, delay, reduce]);

  return (
    <span className="flap" style={{ '--flap-ms': `${face.ms}ms` } as CSSProperties}>
      {/* Fixas: em cima o algarismo novo, em baixo o anterior (tapado pela placa que cai). */}
      <span className="flap-half flap-top"><span>{face.shown}</span></span>
      <span className="flap-half flap-bottom"><span>{face.prev}</span></span>
      {face.flip > 0 && (
        <Fragment key={face.flip}>
          <span className="flap-half flap-top flap-fall"><span>{face.prev}</span></span>
          <span className="flap-half flap-bottom flap-land"><span>{face.shown}</span></span>
        </Fragment>
      )}
    </span>
  );
}
