import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

/** Etiquetas como "chips": Enter ou vírgula acrescentam, Backspace num campo vazio remove a última. */
export function TagsInput({ value, onChange, suggestions = [], id, placeholder = 'Escreva e prima Enter', ...aria }: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  id?: string;
  placeholder?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const [text, setText] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const parts = raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      // Reutiliza a grafia de uma etiqueta existente ("VIP" → "vip").
      const known = [...value, ...suggestions].find((s) => s.localeCompare(p, 'pt-PT', { sensitivity: 'base' }) === 0);
      const tag = known ?? p;
      if (!next.includes(tag)) next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && text.trim()) {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Enter') {
      // Sem texto, o Enter não submete o formulário por engano.
      e.preventDefault();
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const available = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="ct-chips" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {value.map((t) => (
        <span key={t} className="ct-chip">
          {t}
          <button type="button" aria-label={`Remover etiqueta ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            <X aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        list={available.length ? listId : undefined}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          // Escolher uma sugestão da lista (não escrever) acrescenta logo a etiqueta.
          const kind = (e.nativeEvent as InputEvent).inputType;
          if ((!kind || kind === 'insertReplacementText') && available.includes(v)) add(v);
          else setText(v);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => text.trim() && add(text)}
        autoComplete="off"
        {...aria}
      />
      {available.length > 0 && (
        <datalist id={listId}>
          {available.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
