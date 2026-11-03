import type { Language } from '../lib/api/types';
import { useGuestStrings } from './i18n';

const LANGS: Language[] = ['pt', 'en'];

/** PT | EN. Cada botão anuncia o nome da língua na própria língua. */
export function LanguageToggle({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  const t = useGuestStrings();
  return (
    <div className="gi-lang" role="group" aria-label={t.languageLabel}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className="gi-lang__btn"
          aria-pressed={value === l}
          lang={l === 'pt' ? 'pt-PT' : 'en'}
          aria-label={t.languageNames[l]}
          onClick={() => onChange(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
