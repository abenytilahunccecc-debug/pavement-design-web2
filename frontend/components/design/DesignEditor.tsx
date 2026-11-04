'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DEFAULT_INPUT, fixed, withDefaults } from '@/lib/design-defaults';
import type { DesignInput, DesignResult, LayerKey } from '@/lib/types';
import { Button, ErrorBox, inputClass } from '../ui';
import { Alert, Calculator, CheckCircle, ChevronRight, XCircle } from '../icons';
import { DesignInputsPanel } from './DesignInputsPanel';
import { DesignResults } from './DesignResults';

interface Props {
  initialInputs?: Partial<DesignInput>;
  initialName?: string;
  /** Called with the name and inputs when the user clicks Save; omit for the public calculator. */
  onSave?: (name: string, inputs: DesignInput) => Promise<void>;
  saveLabel?: string;
}

/** After this long without an answer the waiting message changes (Render's free plan wakes up slowly). */
const SLOW_AFTER_S = 60;

/** Inputs on the left, live results on the right (recalculated by the API as you type). */
export function DesignEditor({ initialInputs, initialName = '', onSave, saveLabel = 'Save design' }: Props) {
  const [inputs, setInputs] = useState<DesignInput>(() => withDefaults(initialInputs));
  const [name, setName] = useState(initialName);
  const [result, setResult] = useState<DesignResult | null>(null);
  // Two kinds of failure, shown separately: the API rejected an input (400), or the server failed / did not answer.
  const [inputErrors, setInputErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [calculating, setCalculating] = useState(false);
  const [waitedS, setWaitedS] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const requestId = useRef(0);
  const verdictRef = useRef<HTMLElement>(null);
  const [verdictVisible, setVerdictVisible] = useState(false);

  const update = useCallback((patch: Partial<DesignInput>) => {
    setInputs((current) => ({ ...current, ...patch }));
    setSaveMessage(null);
  }, []);

  const setThickness = useCallback((key: LayerKey, mm: number | null) => {
    setInputs((current) => ({ ...current, thicknessMm: { ...current.thicknessMm, [key]: mm } }));
    setSaveMessage(null);
  }, []);

  const setValidity = useCallback((field: string, valid: boolean) => {
    setInvalidFields((current) => {
      if (valid === !current.has(field)) return current;
      const next = new Set(current);
      if (valid) next.delete(field); else next.add(field);
      return next;
    });
  }, []);

  const stale = invalidFields.size > 0 || inputErrors.length > 0 || serverError.length > 0;

  // Recalculate 300 ms after the last change (only the newest answer is shown). "attempt" re-runs it on "Try again".
  useEffect(() => {
    if (invalidFields.size > 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setCalculating(true);
      setWaitedS(0);
      try {
        const next = await api.designs.calculate(cleanInputs(inputs));
        if (id === requestId.current) { setResult(next); setInputErrors([]); setServerError([]); }
      } catch (error) {
        if (id !== requestId.current) return;
        if (error instanceof ApiError && !error.isServerProblem) { setInputErrors(error.messages); setServerError([]); }
        else { setServerError(error instanceof ApiError ? error.messages : [String(error)]); setInputErrors([]); }
      } finally {
        if (id === requestId.current) setCalculating(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputs, invalidFields, attempt]);

  // Seconds spent waiting, so the message can change when the server is slow to wake up.
  useEffect(() => {
    if (!calculating) return;
    const tick = setInterval(() => setWaitedS((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [calculating]);

  // The bottom summary bar hides while the full verdict panel is on screen.
  useEffect(() => {
    const element = verdictRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVerdictVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [result]);

  const save = async () => {
    if (!onSave) return;
    if (!name.trim()) { setSaveMessage('Give the design a name before saving.'); return; }
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSave(name.trim(), cleanInputs(inputs));
      setSaveMessage('Saved ✓');
    } catch (error) {
      setSaveMessage(error instanceof ApiError ? error.messages.join(' ') : 'Saving failed');
    } finally {
      setSaving(false);
    }
  };

  const waitingText = waitedS >= SLOW_AFTER_S
    ? 'The server is waking up, almost there…'
    : 'Calculating the design… (the free server can take up to a minute to wake up)';

  return (
    <div>
      <div className="shadow-card mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {onSave && (
          <label className="min-w-0 flex-1 basis-64 text-sm text-muted">
            <span className="mb-1 block">Design name</span>
            <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setSaveMessage(null); }}
              placeholder="e.g. Section A, km 12+000" maxLength={150} />
          </label>
        )}
        {onSave && <Button onClick={save} disabled={saving || stale || !result}>{saving ? 'Saving…' : saveLabel}</Button>}
        <Button variant="secondary" onClick={() => { setInputs({ ...DEFAULT_INPUT }); setSaveMessage(null); }}>
          Reset to defaults
        </Button>
        <span className="inline-flex items-center gap-2 text-sm text-muted" aria-live="polite">
          {calculating && <Calculator size={15} className="animate-pulse" />}
          {calculating ? (waitedS >= SLOW_AFTER_S ? 'Waking up the server…' : 'Calculating…') : saveMessage}
        </span>
      </div>

      <ErrorBox title="Please check these inputs" messages={inputErrors} />
      <ErrorBox title="The design could not be calculated" messages={serverError}
        action={serverError.length > 0 && (
          <Button variant="secondary" disabled={calculating} onClick={() => setAttempt((n) => n + 1)}>
            {calculating ? 'Trying again…' : 'Try again'}
          </Button>
        )} />

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <DesignInputsPanel inputs={inputs} result={result} update={update} setValidity={setValidity} />
        <div id="design-results" className="min-w-0 scroll-mt-24">
          {result ? (
            <DesignResults result={result} inputs={inputs} stale={stale} setThickness={setThickness} setValidity={setValidity}
              verdictRef={verdictRef} />
          ) : serverError.length || inputErrors.length ? null : (
            <div className="flex items-center justify-center gap-3 py-16 text-center text-sm text-muted" role="status" aria-live="polite">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
              {waitingText}
            </div>
          )}
        </div>
      </div>

      <SummaryBar result={result} stale={stale} calculating={calculating} waitedS={waitedS}
        hasServerError={serverError.length > 0} hidden={verdictVisible} />
    </div>
  );
}

/**
 * Phones and tablets (below 1024 px): the results sit under the inputs, so a bar at the bottom of the screen
 * shows the verdict while you edit. Tapping it scrolls to the full result. Hidden while the verdict panel is visible.
 */
function SummaryBar({ result, stale, calculating, waitedS, hasServerError, hidden }:
  { result: DesignResult | null; stale: boolean; calculating: boolean; waitedS: number; hasServerError: boolean; hidden: boolean }) {
  let tone: 'ok' | 'bad' | 'wait';
  let title: string;
  let detail = '';
  if (hasServerError) { tone = 'bad'; title = 'Server problem'; detail = 'Tap to see the message'; }
  else if (!result) { tone = 'wait'; title = waitedS >= SLOW_AFTER_S ? 'Waking up the server…' : 'Calculating…'; }
  else if (stale) { tone = 'wait'; title = 'Results not updated'; detail = 'Fix the red field'; }
  else {
    tone = result.adequate ? 'ok' : 'bad';
    title = result.adequate ? 'ADEQUATE' : 'NOT ADEQUATE';
    detail = `SN ${fixed(result.totalSn)} / ${fixed(result.requiredTotalSn)} · ${fixed(result.totalThicknessMm, 0)} mm`;
  }
  const Icon = tone === 'ok' ? CheckCircle : tone === 'bad' ? XCircle : Alert;
  const iconClass = tone === 'ok' ? 'bg-ok-solid' : tone === 'bad' ? 'bg-bad-solid' : 'bg-warn-solid';

  return (
    <div className={`print-hidden sticky bottom-3 z-30 mt-6 transition-opacity duration-200 lg:hidden ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      aria-hidden={hidden}>
      <button type="button" tabIndex={hidden ? -1 : 0}
        onClick={() => document.getElementById('design-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="shadow-float flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-panel ${iconClass}`}>
          <Icon size={18} className={tone === 'wait' && calculating ? 'animate-pulse' : ''} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          {detail && <span className="num block truncate text-[13px] text-muted">{detail}</span>}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-muted">
          Full result<ChevronRight size={15} className="rotate-90" />
        </span>
      </button>
    </div>
  );
}

/** What is sent to the API: thickness only for layers that exist and were actually typed. */
function cleanInputs(inputs: DesignInput): DesignInput {
  const active: LayerKey[] = ['ac', 'base', 'subbase', ...(inputs.useDbmLayer ? ['dbm' as const] : []),
    ...(inputs.useCappingLayer ? ['capping' as const] : [])];
  const thicknessMm = Object.fromEntries(
    Object.entries(inputs.thicknessMm).filter(([key, mm]) => active.includes(key as LayerKey) && mm != null),
  );
  return { ...inputs, thicknessMm };
}
