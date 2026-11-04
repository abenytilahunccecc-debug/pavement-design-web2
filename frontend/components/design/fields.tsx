'use client';
import { useEffect, useId, useState } from 'react';
import { parseNumber, parseThickness } from '@/lib/design-defaults';
import { inputClass } from '../ui';

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onValidity?: (valid: boolean) => void;
  hint?: string;
  min?: number;
  max?: number;
  unit?: string;
  hideLabel?: boolean;
}

/**
 * Number input that accepts "3,5" as well as "3.5". The text the user types is kept as-is;
 * the number is only passed on when it can be read (and is within min/max).
 */
export function NumberField({ label, value, onChange, onValidity, hint, min, max, unit, hideLabel }: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  const messageId = useId();

  // Follow outside changes (e.g. "Reset to defaults") unless the text already shows that number.
  // (Adjusting state while rendering is React's recommended pattern for this.)
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== undefined && parseNumber(text) !== value) {
      setText(String(value));
      setInvalid(false);
    }
  }

  // A field that disappears (e.g. capping switched off) no longer blocks the calculation.
  useEffect(() => () => onValidity?.(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (next: string) => {
    setText(next);
    const parsed = parseNumber(next);
    const ok = parsed !== null && !Number.isNaN(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max);
    setInvalid(!ok);
    onValidity?.(ok);
    if (ok) onChange(parsed as number);
  };

  return (
    <label className="block text-sm text-muted">
      <span className={hideLabel ? 'sr-only' : 'mb-1 block'}>{label}</span>
      <span className="relative block">
        <input
          type="text" inputMode="decimal" value={text} onChange={(e) => handle(e.target.value)}
          aria-invalid={invalid} aria-describedby={invalid || hint ? messageId : undefined}
          className={`${inputClass} num ${unit ? 'pr-16' : ''} ${invalid ? 'border-bad bg-bad-soft' : ''}`}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-subtle">{unit}</span>}
      </span>
      {invalid && (
        <span id={messageId} className="mt-1 block text-[13px] text-bad">
          Enter a number{min !== undefined || max !== undefined ? ` between ${min ?? '…'} and ${max ?? '…'}` : ''}
        </span>
      )}
      {!invalid && hint && <span id={messageId} className="mt-1 block text-[13px] text-subtle">{hint}</span>}
    </label>
  );
}

interface ThicknessFieldProps {
  label: string;
  value: number | null | undefined;
  placeholderMm: number | undefined;
  onChange: (mm: number | null) => void;
  onValidity?: (valid: boolean) => void;
}

/** Thickness box: empty = use the minimum; accepts 250, 250mm, 25cm, 10in, 25,5. */
export function ThicknessField({ label, value, placeholderMm, onChange, onValidity }: ThicknessFieldProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  const messageId = useId();

  // "use min" / "Reset to defaults" clear the box from outside.
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value == null && text !== '' && !invalid) setText('');
  }

  useEffect(() => () => onValidity?.(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (next: string) => {
    setText(next);
    const mm = parseThickness(next);
    const ok = mm === null || (!Number.isNaN(mm) && mm >= 0 && mm <= 3000);
    setInvalid(!ok);
    onValidity?.(ok);
    if (ok) onChange(mm);
  };

  return (
    <span className="block">
      <input
        type="text" inputMode="decimal" aria-label={label} value={text} onChange={(e) => handle(e.target.value)}
        placeholder={placeholderMm === undefined ? '' : `${placeholderMm.toFixed(1)} (min)`}
        aria-invalid={invalid} aria-describedby={invalid ? messageId : undefined}
        className={`${inputClass} num w-32 py-2 ${invalid ? 'border-bad bg-bad-soft' : ''}`}
      />
      {invalid && (
        <span id={messageId} className="mt-1 block max-w-48 text-[13px] text-bad">
          Enter a thickness from 0 to 3000 mm, e.g. 250, 25cm or 10in. Leave empty for the minimum.
        </span>
      )}
    </span>
  );
}
