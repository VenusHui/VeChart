'use client';

import { useEffect, useRef, useState } from 'react';

interface ComboboxProps {
  options: string[];
  value: string | null;
  placeholder: string;
  onChange: (value: string | null) => void;
}

export function Combobox({ options, value, placeholder, onChange }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter((opt) => {
        const q = query.trim().toLowerCase();
        return opt.toLowerCase().startsWith(q) || opt.toLowerCase().includes(q);
      })
    : options;

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function select(opt: string) {
    if (value === opt) {
      onChange(null);
    } else {
      onChange(opt);
    }
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        select(filtered[highlightIndex]);
      } else if (query.trim()) {
        // Allow entering a new value not in the list
        onChange(query.trim());
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  function clear() {
    onChange(null);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="combobox" ref={containerRef}>
      <div className="combobox-input-wrap">
        <input
          ref={inputRef}
          className="combobox-input"
          type="text"
          placeholder={value ?? placeholder}
          value={open ? query : (value ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            className="combobox-clear"
            onClick={clear}
            type="button"
            aria-label="清除"
          >
            &times;
          </button>
        ) : (
          <span className="combobox-arrow" aria-hidden="true">&#x25BC;</span>
        )}
      </div>
      {open && filtered.length > 0 ? (
        <ul className="combobox-dropdown">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              className={`combobox-option${i === highlightIndex ? ' highlighted' : ''}${value === opt ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {opt}
            </li>
          ))}
        </ul>
      ) : open && filtered.length === 0 && query.trim() ? (
        <ul className="combobox-dropdown">
          <li
            className="combobox-option highlighted"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(query.trim());
              setOpen(false);
              setQuery('');
            }}
          >
            使用 &ldquo;{query.trim()}&rdquo;
          </li>
        </ul>
      ) : null}
    </div>
  );
}
