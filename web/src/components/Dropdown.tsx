import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../i18n/index.ts';

export interface DropdownOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

interface Props<V extends string> {
  options: DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
  searchable?: boolean;
  className?: string;
  testId?: string;
}

/** Custom select replacement: themed panel, check mark on the current item, ↑/↓/Enter, Esc to close. */
export function Dropdown<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  searchable,
  className,
  testId,
}: Props<V>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ''}`.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    (searchable ? searchRef.current : listRef.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = (focusButton = true) => {
    setOpen(false);
    setQuery('');
    if (focusButton) buttonRef.current?.focus();
  };

  const choose = (o: DropdownOption<V> | undefined) => {
    if (!o) return;
    onChange(o.value);
    close();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(filtered.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        choose(filtered[active]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <div className={`dropdown ${className ?? ''}`} ref={rootRef} onKeyDown={onKey} data-testid={testId}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${ariaLabel}: ${current?.label ?? value}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="dropdown-current">{current?.label ?? value}</span>
        <span className="dropdown-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="dropdown-panel">
          {searchable && (
            <input
              ref={searchRef}
              className="dropdown-search"
              value={query}
              placeholder={t('common.filter')}
              aria-label={t('common.filter')}
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
          >
            {filtered.length === 0 && <li className="dropdown-empty">{t('common.noMatch')}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`dropdown-option${i === active ? ' active' : ''}${o.value === value ? ' selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <span className="dropdown-check" aria-hidden>
                  {o.value === value ? '✓' : ''}
                </span>
                <span className="dropdown-label">{o.label}</span>
                {o.hint && <span className="dropdown-hint">{o.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
