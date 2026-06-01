import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Select.css';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Select<T extends string>({ value, options, onChange, placeholder, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setHighlight(selectedIndex);
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
      else if (e.key === 'Home') { e.preventDefault(); setHighlight(0); }
      else if (e.key === 'End') { e.preventDefault(); setHighlight(options.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[highlight];
        if (opt) { onChange(opt.value); close(); }
      }
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, options, highlight, onChange, close, selectedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  function toggle() {
    if (disabled) return;
    setOpen((o) => !o);
  }

  function pick(opt: SelectOption<T>) {
    onChange(opt.value);
    close();
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={rootRef} className={`rselect ${open ? 'rselect-open' : ''} ${disabled ? 'rselect-disabled' : ''}`}>
      <button
        type="button"
        className="rselect-trigger"
        onClick={toggle}
        onKeyDown={onTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}>
        <span className={`rselect-value ${!selected ? 'rselect-placeholder' : ''}`}>
          {selected?.label ?? placeholder ?? 'Select…'}
        </span>
        <span className="rselect-chev" aria-hidden>▾</span>
      </button>
      {open && (
        <ul ref={listRef} className="rselect-menu" role="listbox">
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`rselect-option ${i === highlight ? 'rselect-option-hl' : ''} ${opt.value === value ? 'rselect-option-active' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(opt); }}>
              <div className="rselect-option-main">
                <span className="rselect-option-label">{opt.label}</span>
                {opt.description && <span className="rselect-option-desc">{opt.description}</span>}
              </div>
              {opt.value === value && <span className="rselect-option-check">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
