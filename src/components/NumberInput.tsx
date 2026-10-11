import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: number;
  className?: string;
  title?: string;
  disabled?: boolean;
}

/** Figma-style numeric field: free typing (comma or dot, minus), commit on Enter/blur, arrow keys step, Esc reverts. */
export function NumberInput({ value, onChange, step = 0.1, min, max, suffix, decimals = 2, className, title, disabled }: Props) {
  const fmt = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 10 ** decimals) / 10 ** decimals) : '');
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, focused]);

  const commit = (raw: string) => {
    const t = raw.trim().replace(',', '.').replace(/[^\d.\-+*/()\s]/g, '');
    if (!t) { setText(fmt(value)); return; }
    let v: number;
    try { v = /^[\d.\-+*/()\s]+$/.test(t) ? Number(Function(`"use strict";return (${t})`)()) : NaN; } catch { v = NaN; }
    if (!Number.isFinite(v)) { setText(fmt(value)); return; }
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setText(fmt(v));
    if (v !== value) onChange(v);
  };

  return (
    <span className={`num ${className ?? ''}`} title={title}>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onFocus={(e) => { setFocused(true); e.target.select(); }}
        onBlur={(e) => { setFocused(false); commit(e.target.value); }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { setText(fmt(value)); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const cur = Number((e.target as HTMLInputElement).value.replace(',', '.'));
            const base = Number.isFinite(cur) ? cur : value;
            const d = (e.shiftKey ? step * 10 : step) * (e.key === 'ArrowUp' ? 1 : -1);
            let v = Math.round((base + d) * 1000) / 1000;
            if (min !== undefined) v = Math.max(min, v);
            if (max !== undefined) v = Math.min(max, v);
            setText(fmt(v));
            onChange(v);
          }
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}
