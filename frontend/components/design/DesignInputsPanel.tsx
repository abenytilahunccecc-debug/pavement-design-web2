'use client';
import type { DesignInput, DesignResult, LayerKey, SupportKey, UnboundKey } from '@/lib/types';
import { fixed, thousands } from '@/lib/design-defaults';
import { Card, selectClass } from '../ui';
import { NumberField } from './fields';

interface Props {
  inputs: DesignInput;
  result: DesignResult | null;
  update: (patch: Partial<DesignInput>) => void;
  setValidity: (field: string, valid: boolean) => void;
}

const SUPPORTS: Array<{ key: SupportKey; label: string }> = [
  { key: 'dbm', label: 'Surface / DBM (asphalt)' },
  { key: 'base', label: 'Base' },
  { key: 'subbase', label: 'Subbase' },
  { key: 'capping', label: 'Capping layer' },
  { key: 'subgrade', label: 'Subgrade' },
];

const COEFFICIENTS: Array<{ key: LayerKey; label: string; n: number }> = [
  { key: 'ac', label: 'AC course', n: 1 },
  { key: 'dbm', label: 'DBM', n: 2 },
  { key: 'base', label: 'Base', n: 3 },
  { key: 'subbase', label: 'Subbase', n: 4 },
  { key: 'capping', label: 'Capping', n: 5 },
];

/** AC and DBM are asphalt (bound) layers: they have no drainage coefficient m. */
const asphalt = (key: LayerKey) => key === 'ac' || key === 'dbm';

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-ink">
        <span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-on-primary">{number}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** The left-hand form: design conditions, structure, layer support, coefficients and options. */
export function DesignInputsPanel({ inputs, result, update, setValidity }: Props) {
  const active = (key: SupportKey | LayerKey) =>
    (key !== 'dbm' || inputs.useDbmLayer) && (key !== 'capping' || inputs.useCappingLayer);
  const valid = (field: string) => (ok: boolean) => setValidity(field, ok);

  return (
    <div className="space-y-4">
      <Section number={1} title="Design conditions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField label="Reliability R" unit="%" value={inputs.reliability} min={50} max={99.99}
            onChange={(v) => update({ reliability: v })} onValidity={valid('reliability')} />
          <NumberField label="Standard deviation So" value={inputs.so} min={0.01} max={1}
            onChange={(v) => update({ so: v })} onValidity={valid('so')} />
          <NumberField label="Design traffic W18" unit="×10⁶ ESAL" value={inputs.w18} min={0.0001}
            onChange={(v) => update({ w18: v })} onValidity={valid('w18')} />
          <NumberField label="Serviceability loss ΔPSI" value={inputs.dpsi} min={0.01} max={5}
            onChange={(v) => update({ dpsi: v })} onValidity={valid('dpsi')} />
        </div>
      </Section>

      <Section number={2} title="Pavement structure">
        {([['useDbmLayer', 'DBM layer (Dense Bituminous Macadam) under the AC course'],
          ['useCappingLayer', 'Capping layer above the subgrade']] as const).map(([field, label]) => (
          <label key={field} className="mb-2 flex min-h-7 cursor-pointer items-start gap-2.5 py-0.5 text-sm text-ink">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--ink)]" checked={inputs[field]}
              onChange={(e) => update({ [field]: e.target.checked } as Partial<DesignInput>)} />
            {label}
          </label>
        ))}
      </Section>

      <Section number={3} title="Layer support (resilient modulus)">
        <div className="mb-3 inline-flex gap-1 rounded-full bg-raised p-1 text-sm" role="radiogroup" aria-label="Layer support input method">
          {([['cbr', 'From CBR'], ['mr', 'Enter MR (psi)']] as const).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={inputs.mrMethod === value}
              onClick={() => update({ mrMethod: value })}
              className={`min-h-9 rounded-full px-4 py-1.5 font-medium transition ${inputs.mrMethod === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-[13px] text-muted">
          {inputs.mrMethod === 'cbr'
            ? 'MR = 1500·CBR (CBR ≤ 5 %), else 145·17.6·CBR^0.64 psi, for base, subbase, capping and subgrade. The DBM is asphalt: its MR is always entered directly.'
            : 'Enter each layer\'s resilient modulus in psi. The CBR shown is only an estimate.'}
        </p>
        <div className="space-y-3">
          {SUPPORTS.filter((s) => active(s.key)).map(({ key, label }) => {
            const useCbr = inputs.mrMethod === 'cbr' && key !== 'dbm';
            const derived = result
              ? key === 'dbm' ? 'asphalt (MR)'
                : useCbr ? (result.mrPsi[key] !== undefined ? `→ ${thousands(result.mrPsi[key] as number)} psi` : '')
                  : (result.cbr[key as UnboundKey] !== undefined ? `≈ CBR ${fixed(result.cbr[key as UnboundKey] as number, 1)} %` : '')
              : '';
            return (
              <div key={`${key}-${useCbr ? 'cbr' : 'mr'}`} className="grid grid-cols-[1fr_auto] items-end gap-3">
                {useCbr ? (
                  <NumberField label={`${label} CBR`} unit="%" value={inputs.cbr[key as UnboundKey]} min={0.01}
                    onChange={(v) => update({ cbr: { ...inputs.cbr, [key]: v } })} onValidity={valid(`cbr.${key}`)} />
                ) : (
                  <NumberField label={`${label} MR`} unit="psi" value={inputs.mrPsi[key]} min={1}
                    onChange={(v) => update({ mrPsi: { ...inputs.mrPsi, [key]: v } })} onValidity={valid(`mrPsi.${key}`)} />
                )}
                <span className="num w-28 pb-3 text-right text-[13px] text-muted">{derived}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section number={4} title="Layer & drainage coefficients">
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_6rem_6rem] gap-3 text-[13px] font-medium uppercase tracking-[0.08em] text-subtle">
            <span>Layer</span><span>a</span><span>m</span>
          </div>
          {COEFFICIENTS.filter((c) => active(c.key)).map(({ key, label, n }) => (
            <div key={key} className="grid grid-cols-[1fr_6rem_6rem] items-center gap-3">
              <span className="text-sm text-ink">{label} <span className="text-subtle">(a{n}{asphalt(key) ? '' : `, m${n}`})</span></span>
              <NumberField label={`a${n} (${label})`} hideLabel value={inputs.a[key]} min={key === 'ac' ? 0.001 : 0} max={1}
                onChange={(v) => update({ a: { ...inputs.a, [key]: v } })} onValidity={valid(`a.${key}`)} />
              {asphalt(key) ? <span className="px-3.5 text-sm text-subtle" aria-label="No drainage coefficient">–</span> : (
                <NumberField label={`m${n} (${label})`} hideLabel value={inputs.m[key]} min={0.4} max={1.4}
                  onChange={(v) => update({ m: { ...inputs.m, [key]: v } })} onValidity={valid(`m.${key}`)} />
              )}
            </div>
          ))}
          <p className="text-[13px] text-subtle">Drainage coefficient m: AASHTO 1993 range 0.4 – 1.4. AC and DBM are asphalt: no m.</p>
        </div>
      </Section>

      <Section number={5} title="Options">
        <label className="mb-4 block text-sm text-muted">
          <span className="mb-1 block">Round suggested thickness up to</span>
          <select className={selectClass}
            value={inputs.roundUpToMm ?? ''} onChange={(e) => update({ roundUpToMm: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Off (exact minimum, 0.1 mm)</option>
            <option value="5">5 mm</option>
            <option value="10">10 mm</option>
            <option value="25">25 mm</option>
          </select>
        </label>
        <label className="flex min-h-7 cursor-pointer items-start gap-2.5 py-0.5 text-sm text-ink">
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--ink)]" checked={inputs.enforceAashtoMinimums}
            onChange={(e) => update({ enforceAashtoMinimums: e.target.checked })} />
          Apply AASHTO 1993 minimum AC and base thickness for the traffic level
        </label>
      </Section>
    </div>
  );
}
