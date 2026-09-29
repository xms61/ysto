// A whole-number field that commits on Enter or when it loses focus, so typing "15" never sends "1" first.
// A value out of range is pulled into it.
import { useState } from 'react';
import { INPUT } from './ui.tsx';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

export function NumberField({ label, value, min, max, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // A new value from the server replaces whatever was typed.
  if (value !== shown) {
    setShown(value);
    setText(String(value));
  }

  function commit() {
    const typed = Number.parseInt(text, 10);
    const next = Number.isNaN(typed) ? value : Math.min(max, Math.max(min, typed));
    setText(String(next));
    if (next !== value) onCommit(next);
  }

  return (
    <label className="flex flex-col gap-1.5 font-medium">
      {label}
      <input
        className={INPUT}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
    </label>
  );
}
