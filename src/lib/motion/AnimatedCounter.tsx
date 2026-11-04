/*
 * Contador tipo conta-quilómetros: cada algarismo é uma roda que gira para o valor novo.
 * Adaptado do "Animated Counter" da Arc (https://uiarc.dev, licença MIT, aviso em THIRD_PARTY_NOTICES.md): sem CSS Modules,
 * com os componentes leves `m.*` (a raiz usa LazyMotion strict) e o formato pt-PT por omissão.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, m, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { motionTokens } from './tokens';
import './counter.css';

type Part = { key: string; digit: number; order: number } | { key: string; text: string };

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const reveal = { ...motionTokens.spring.smooth, visualDuration: motionTokens.duration.considered };
const presence = { initial: { width: 0, opacity: 0 }, animate: { width: 'auto', opacity: 1 }, exit: { width: 0, opacity: 0 } };

/** Separa o número formatado em colunas pela posição (unidades, dezenas…): 999 → 1000 mantém as unidades na mesma roda. */
function partsFor(value: number, decimals: number, locale: string): Part[] {
  const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, numberingSystem: 'latn' }).formatToParts(value);
  let place = parts.reduce((count, part) => count + (part.type === 'integer' ? part.value.length : 0), 0);
  let fraction = 0;
  let order = 0;
  return parts.flatMap((part, index): Part[] => {
    if (part.type === 'integer') return [...part.value].map((char) => ({ key: `i${--place}`, digit: Number(char), order: order++ }));
    if (part.type === 'fraction') return [...part.value].map((char) => ({ key: `f${fraction++}`, digit: Number(char), order: order++ }));
    return [{ key: part.type === 'group' ? `g${place}` : part.type === 'decimal' ? 'd' : `${part.type}${index}`, text: part.value }];
  });
}

/** Um algarismo da roda: a distância à posição da roda decide onde fica e quão visível está. */
function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, (current) => ((((digit - current) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, (current) => `${current}em`);
  const opacity = useTransform(offset, (current) => Math.max(0, 1 - Math.abs(current)));
  const visibility = useTransform(offset, (current) => (Math.abs(current) >= 1 ? 'hidden' : 'visible'));
  const filter = useTransform(offset, (current) =>
    Math.abs(current) < 0.02 || Math.abs(current) >= 1 ? 'none' : `blur(${(Math.abs(current) * motionTokens.blur.subtle).toFixed(2)}px)`,
  );
  return <m.span className="mc-glyph" style={{ y, opacity, filter, visibility }}>{digit}</m.span>;
}

/** Uma roda. Gira sempre no sentido em que o número total mudou, passando de 9 para 0 como um conta-quilómetros. */
function Column({ digit, direction, armed, delay, reduceMotion }: { digit: number; direction: number; armed: boolean; delay: number; reduceMotion: boolean }) {
  const position = useMotionValue(armed ? 0 : digit);
  const wheel = useRef({ digit: armed ? 0 : digit, target: armed ? 0 : digit, revealed: !armed });
  useEffect(() => {
    const state = wheel.current;
    if (armed || state.digit === digit) {
      if (!armed) state.revealed = true;
      return;
    }
    state.target += direction < 0 && state.revealed ? -((state.digit - digit + 10) % 10) : (digit - state.digit + 10) % 10;
    state.digit = digit;
    if (reduceMotion) position.jump(state.target);
    else animate(position, state.target, state.revealed ? motionTokens.spring.smooth : { ...reveal, delay });
    state.revealed = true;
  }, [armed, delay, digit, direction, position, reduceMotion]);
  return (
    <m.span className="mc-column" {...presence} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.morph}>
      <span className="mc-sizer">0</span>
      {DIGITS.map((item) => <Glyph key={item} position={position} digit={item} />)}
    </m.span>
  );
}

export interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  decimals?: number;
  /** Na primeira vez que fica visível, roda todos os algarismos a partir de zero. */
  animateOnView?: boolean;
  locale?: string;
}

export function AnimatedCounter({ value, suffix = '', decimals = 0, animateOnView = true, locale = 'pt-PT' }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = !!useReducedMotion();
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(1);
  if (value !== previous) {
    setPrevious(value);
    setDirection(value > previous ? 1 : -1);
  }
  const parts = partsFor(value, decimals, locale);
  const text = `${parts.map((part) => ('text' in part ? part.text : part.digit)).join('')}${suffix}`;
  const armed = animateOnView && !inView;
  return (
    <span ref={ref} className="mc-counter">
      <span className="visually-hidden">{text}</span>
      <span className="mc-value" aria-hidden="true">
        <AnimatePresence initial={false}>
          {parts.map((part) =>
            'digit' in part ? (
              <Column key={part.key} digit={part.digit} direction={direction} armed={armed} delay={Math.min(part.order * motionTokens.stagger.item, 0.25)} reduceMotion={reduceMotion} />
            ) : (
              <m.span key={part.key} className="mc-symbol" {...presence} transition={reduceMotion ? { duration: 0 } : motionTokens.spring.morph}>
                {part.text}
              </m.span>
            ),
          )}
        </AnimatePresence>
        {suffix && <span className="mc-symbol">{suffix}</span>}
      </span>
    </span>
  );
}
