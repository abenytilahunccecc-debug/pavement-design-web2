'use client';
import type { RefObject } from 'react';
import type { DesignInput, DesignResult, LayerKey } from '@/lib/types';
import { fixed } from '@/lib/design-defaults';
import { Alert, CheckCircle, XCircle } from '../icons';
import { Card } from '../ui';
import { CrossSectionPanel, SnChart } from './Charts';
import { ThicknessField } from './fields';

interface Props {
  result: DesignResult;
  inputs: DesignInput;
  stale: boolean;
  setThickness: (key: LayerKey, mm: number | null) => void;
  setValidity: (field: string, valid: boolean) => void;
  /** Lets the editor know when the verdict is on screen (to hide its bottom summary bar). */
  verdictRef?: RefObject<HTMLElement | null>;
}

/** Wide layout: one row per layer. Below 46 rem of available width each layer becomes a card instead. */
const ROW = '@min-[46rem]:grid @min-[46rem]:grid-cols-[2rem_minmax(8rem,1fr)_8rem_4rem_4rem_5rem_4.5rem_5.5rem] @min-[46rem]:items-center @min-[46rem]:gap-x-2';

/** Right-hand side: verdict, layer table with thickness boxes, notes and drawings. */
export function DesignResults({ result, inputs, stale, setThickness, setValidity, verdictRef }: Props) {
  const r = result;
  const detail = r.adequate
    ? `Total SN ${fixed(r.totalSn)} ≥ required ${fixed(r.requiredTotalSn)}, and every layer passes its check.`
    : r.totalOk
      ? `The total SN is met, but the layer check failed for: ${r.failedLayers.join(', ')}.`
      : `Total SN ${fixed(r.totalSn)} < required ${fixed(r.requiredTotalSn)} (short by ${fixed(r.requiredTotalSn - r.totalSn)}).`
        + (r.failedLayers.length ? ` Layer check failed for: ${r.failedLayers.join(', ')}.` : '');

  const tone = stale ? 'stale' : r.adequate ? 'ok' : 'bad';
  const VerdictIcon = tone === 'stale' ? Alert : tone === 'ok' ? CheckCircle : XCircle;

  return (
    <div className="space-y-4" aria-live="polite">
      {/* Verdict: a dark panel, like the feature card in the reference design. */}
      <section ref={verdictRef} className="shadow-float overflow-hidden rounded-2xl bg-[#111113] p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === 'ok' ? 'bg-[#16a34a]' : tone === 'bad' ? 'bg-[#dc2626]' : 'bg-[#b54708]'}`}>
            <VerdictIcon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-white/60">Design verdict</p>
            <p className="text-2xl font-semibold tracking-[-0.02em]">
              {stale ? 'Results not updated' : r.adequate ? 'Design is ADEQUATE' : 'Design is NOT ADEQUATE'}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {[['Total SN', fixed(r.totalSn)], ['Required SN', fixed(r.requiredTotalSn)],
            ['Total thickness', `${fixed(r.totalThicknessMm, 1)} mm`], ['ZR', fixed(r.zr)]].map(([label, value]) => (
            <div key={label} className="bg-[#111113] px-4 py-3">
              <dt className="text-[13px] uppercase tracking-[0.1em] text-white/60">{label}</dt>
              <dd className="num mt-0.5 text-lg font-semibold text-white">{stale ? '—' : value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-white/75">
          {stale ? 'An input cannot be read, so these results are out of date. Fix the red field and they update automatically.' : detail}
        </p>
      </section>

      <Card className={`@container ${stale ? 'opacity-50' : ''}`}>
        <h2 className="font-semibold text-ink">Layer-by-layer design</h2>
        {/* Column headings: only in the wide (row) layout; in the card layout every value has its own label. */}
        <div aria-hidden="true"
          className={`mt-4 hidden border-b border-line pb-2 text-[13px] font-medium text-subtle ${ROW}`}>
          <span>#</span><span>Layer</span><span>Thickness (mm)</span><span>Min (mm)</span>
          <span>SN added</span><span>Cumulative</span><span>Required</span><span>Check</span>
        </div>
        <ul className="mt-4 space-y-3 @min-[46rem]:mt-0 @min-[46rem]:space-y-0">
          {r.layers.map((layer) => {
            const check = layer.checkOk
              ? <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ok"><CheckCircle size={16} />OK</span>
              : <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-bad"><XCircle size={16} />NOT OK</span>;
            return (
              <li key={layer.key} className={`rounded-xl border border-line p-4 @min-[46rem]:rounded-none @min-[46rem]:border-0 @min-[46rem]:border-b @min-[46rem]:px-0 @min-[46rem]:py-3 @min-[46rem]:last:border-b-0 ${ROW} ${layer.checkOk ? '' : 'border-bad/40 bg-bad-soft'}`}>
                {/* Number, name and (card layout) the check result */}
                <div className="flex items-start justify-between gap-3 @min-[46rem]:contents">
                  <span className="hidden num text-subtle @min-[46rem]:block">{layer.number}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink"><span className="num mr-1.5 text-subtle @min-[46rem]:hidden">{layer.number}</span>{layer.name}</p>
                    <p className="text-[13px] text-subtle">
                      on {layer.supports} · {layer.coefficientSymbol} = {layer.a}
                      {layer.key === 'ac' ? '' : ` · m${layer.coefficientSymbol.slice(1)} = ${layer.m}`}
                    </p>
                  </div>
                  <span className="shrink-0 @min-[46rem]:hidden">{check}</span>
                </div>
                {/* Thickness box */}
                <div className="mt-3 @min-[46rem]:mt-0">
                  <p className="mb-1 text-[13px] text-muted @min-[46rem]:hidden">Thickness (mm)</p>
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                    <ThicknessField label={`${layer.name} thickness`} value={inputs.thicknessMm[layer.key]}
                      placeholderMm={layer.suggestedThicknessMm} onChange={(mm) => setThickness(layer.key, mm)}
                      onValidity={(ok) => setValidity(`thickness.${layer.key}`, ok)} />
                    {layer.thicknessIsCustom && (
                      <button type="button" onClick={() => setThickness(layer.key, null)}
                        className="inline-flex min-h-8 items-center whitespace-nowrap rounded-lg px-2 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:bg-raised hover:decoration-ink">use min</button>
                    )}
                  </div>
                </div>
                {/* Values: labelled in the card layout, under the column headings in the row layout */}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 @sm:grid-cols-4 @min-[46rem]:contents">
                  {([['Min (mm)', fixed(layer.minThicknessMm, 1), 'text-muted'], ['SN added', fixed(layer.snContribution), 'text-ink'],
                    ['Cumulative', fixed(layer.cumulativeSn), 'text-ink'], ['Required', fixed(layer.requiredSn), 'text-ink']] as const)
                    .map(([label, value, color]) => (
                      <div key={label}>
                        <dt className="text-[13px] text-muted @min-[46rem]:sr-only">{label}</dt>
                        <dd className={`num ${color}`}>{value}</dd>
                      </div>
                    ))}
                </dl>
                <span className="hidden @min-[46rem]:block">{check}</span>
              </li>
            );
          })}
        </ul>
        {(r.layers.some((l) => l.notes.length) || r.warnings.length > 0) && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {r.layers.flatMap((l) => l.notes.map((note) => (
              <li key={`${l.key}-${note}`} className={note.includes('below the minimum') ? 'text-bad' : 'text-muted'}>
                Layer {l.number} ({l.name}): {note}
              </li>
            )))}
            {r.warnings.map((w) => <li key={w} className="text-warn">{w}</li>)}
          </ul>
        )}
      </Card>

      <div className={`space-y-4 ${stale ? 'opacity-50' : ''}`}>
        <CrossSectionPanel result={r} />
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Cumulative SN vs required</h2>
          <SnChart result={r} />
        </Card>
      </div>
    </div>
  );
}
