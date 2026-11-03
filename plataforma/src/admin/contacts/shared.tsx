import type { Contact, Language } from '../../lib/api';
import { Badge } from '../../ui';

export const SALUTATIONS = [
  'Exmo. Senhor', 'Exma. Senhora', 'Dr.', 'Dr.ª', 'Eng.', 'Eng.ª', 'Prof.', 'Prof.ª', 'Arq.', 'Arq.ª', 'Sr.', 'Sr.ª',
];

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
];

export const languageLabel = (l: Language) => LANGUAGES.find((x) => x.value === l)?.label ?? l;

/** Descarrega um ficheiro gerado no browser. */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "contactos-2026-11-03" */
export function datedName(prefix: string, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`;
}

/** Nome de ficheiro seguro a partir do nome de uma pessoa. */
export function slugify(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contacto';
}

/** Na tabela (coluna «Comunicações») chega o rótulo curto; fora dela, `long` diz o que é aceite. */
export function ConsentBadge({ contact, long = false }: { contact: Pick<Contact, 'marketing_consent' | 'anonymized_at'>; long?: boolean }) {
  if (contact.anonymized_at) return <Badge>Anonimizado</Badge>;
  return contact.marketing_consent
    ? <Badge tone="success" dot title="Aceitou receber comunicações futuras">{long ? 'Aceita comunicações' : 'Aceita'}</Badge>
    : <Badge dot title="Sem consentimento para comunicações futuras">{long ? 'Sem consentimento para comunicações' : 'Não aceita'}</Badge>;
}

/** Etiquetas como badges, até `max`, com "+n" para as restantes. */
export function TagList({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (!tags.length) return <span className="muted">—</span>;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className="ct-tags">
      {shown.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
      {rest > 0 && <Badge title={tags.slice(max).join(', ')}>+{rest}</Badge>}
    </span>
  );
}
