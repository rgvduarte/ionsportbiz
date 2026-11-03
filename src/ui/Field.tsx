import {
  cloneElement, forwardRef, isValidElement, useEffect, useId, useState,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { Search } from 'lucide-react';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Um único controlo (Input, Select, Textarea). Recebe id, aria-invalid e aria-describedby. */
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; required?: boolean; readOnly?: boolean }>;
}

export function Field({ label, hint, error, required: requiredProp, className, children }: FieldProps) {
  const id = useId();
  // Só de leitura: não se preenche, por isso não se marca como obrigatório.
  const required = requiredProp && !(isValidElement(children) && children.props.readOnly);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        required: children.props.required ?? required,
      })
    : children;
  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      <label className="ui-field__label" htmlFor={children.props.id ?? id}>
        {label}
        {required && <span className="req" aria-hidden>*</span>}
      </label>
      {control}
      {hint && !error && <div className="ui-field__hint" id={hintId}>{hint}</div>}
      {error && <div className="ui-field__error" id={errorId} role="alert">{error}</div>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={['ui-input', className].filter(Boolean).join(' ')} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={['ui-textarea', className].filter(Boolean).join(' ')} {...rest} />;
});

export interface SelectOption {
  value: string;
  label: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[]; placeholder?: string }>(
  function Select({ className, options, placeholder, ...rest }, ref) {
    return (
      <select ref={ref} className={['ui-select', className].filter(Boolean).join(' ')} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  },
);

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={['ui-check', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Pesquisa com atraso: chama onSearch 250 ms depois de parar de escrever. */
export function SearchInput({
  value, onSearch, placeholder = 'Pesquisar…', className, autoFocus,
}: { value: string; onSearch: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onSearch(text), 250);
    return () => clearTimeout(t);
  }, [text, value, onSearch]);
  return (
    <div className={['ui-input-wrap', className].filter(Boolean).join(' ')}>
      <Search aria-hidden />
      <input
        type="search"
        className="ui-input"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
