import { useId, type ReactNode } from 'react';
import { m } from 'motion/react';
import { motionTokens } from '../../lib/motion/tokens';
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { initials } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { DEMO_CONTENT } from '../data/event';
import { asset } from '../lib/asset';

/** Barra do topo. `back` recua no histórico; `onBack` (ex.: passo anterior de um formulário) substitui esse comportamento. */
export function TopBar({ title, back, onBack, right }: { title?: string; back?: boolean; onBack?: () => void; right?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <header className="topbar">
      <div className="topbar-side">
        {back || onBack ? (
          <button className="icon-btn" onClick={onBack ?? (() => navigate(-1))} aria-label={t('common.back')}>
            <ChevronLeft size={26} />
          </button>
        ) : (
          <img src={asset('images/logo-full.webp')} alt="ion" className="topbar-logo" />
        )}
      </div>
      {title && <h1 className="topbar-title">{title}</h1>}
      <div className="topbar-side right">{right}</div>
    </header>
  );
}

/** Initials in the ion speech-bubble shape (circle with a tail at bottom-right). */
export function Avatar({ name, size = 48, tone = 'grad' }: { name: string; size?: number; tone?: 'grad' | 'lime' | 'red' }) {
  return (
    <span className={`avatar avatar-${tone}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button className={`chip${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      {color && <span className="dot" style={{ background: color }} />}
      {children}
    </button>
  );
}

/** Seletor segmentado: a pílula lima desliza para a opção escolhida (mola, sem ressalto). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  const pill = useId();
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && <m.span layoutId={pill} className="seg-pill" transition={motionTokens.spring.morph} aria-hidden />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DemoNote() {
  const { t } = useI18n();
  if (!DEMO_CONTENT) return null;
  return <p className="demo-note">{t('common.demo')}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Enquanto se lê o convite guardado no dispositivo (sem piscar a entrada). */
export function Boot() {
  return (
    <div className="boot" aria-busy>
      <img src={asset('images/logo-bubble.webp')} alt="ion" />
    </div>
  );
}
