import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';

export function SortHeader<T extends string>({ column, label, sort, onSort }: {
  column: T;
  label: ReactNode;
  sort: { column: T; ascending: boolean } | undefined;
  onSort: (s: { column: T; ascending: boolean }) => void;
}) {
  const active = sort?.column === column;
  const Icon = !active ? ArrowUpDown : sort.ascending ? ArrowUp : ArrowDown;
  return (
    <button type="button" className="ui-sort" onClick={() => onSort({ column, ascending: active ? !sort.ascending : true })}
      aria-label={`Ordenar por ${typeof label === 'string' ? label : column}`}>
      {label}
      <Icon aria-hidden />
    </button>
  );
}

/** page começa em 0. */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="ui-pagination">
      <span className="tabular">{from}–{to} de {total}</span>
      <div className="ui-row">
        <Button size="sm" iconOnly aria-label="Página anterior" icon={<ChevronLeft />} disabled={page === 0} onClick={() => onPage(page - 1)} />
        <span className="tabular">{page + 1} / {pages}</span>
        <Button size="sm" iconOnly aria-label="Página seguinte" icon={<ChevronRight />} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Linha separadora antes deste item. */
  separator?: boolean;
}

/** Menu de ações (ex.: "…" no fim de cada linha). */
export function ActionMenu({ items, label = 'Ações', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const visible = items.filter(Boolean);
  return (
    <div className="ui-menu" ref={root} onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <Button variant="ghost" size="sm" iconOnly aria-label={label} aria-haspopup="menu" aria-expanded={open} icon={<MoreHorizontal />} onClick={() => setOpen((o) => !o)} />
      )}
      {open && (
        <div className="ui-menu__list" role="menu">
          {visible.map((item, i) => (
            <div key={i}>
              {item.separator && <div className="ui-menu__sep" />}
              <button
                type="button"
                role="menuitem"
                className={['ui-menu__item', item.danger && 'ui-menu__item--danger'].filter(Boolean).join(' ')}
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onSelect(); }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
