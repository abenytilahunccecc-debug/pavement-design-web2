/**
 * Layer-by-layer AASHTO 1993 flexible pavement design.
 *
 * Port of the tested Python engine (pavement_design/design.py). designPavement(input)
 * returns, for every layer, the minimum thickness, the thickness used, its SN
 * contribution and its check, plus the overall verdict. A thickness left empty
 * uses the suggested minimum, exactly like pressing Enter in the notebook.
 */
import {
  DEFAULT_CORRELATION, MRCorrelation, aashtoMinimumThicknessMm, cbrFromMr, mrFromCbr, requiredSn, zR,
} from './aashto.js';

export const SN_TOLERANCE = 1e-9; // absorbs floating-point error in cumulative SN sums

export type LayerKey = 'ac' | 'dbm' | 'base' | 'subbase' | 'capping';
export type UnboundKey = 'subgrade' | 'capping' | 'subbase' | 'base';
export type SupportKey = UnboundKey | 'dbm';

/** Layers from top to bottom: key -> [name, heading, coefficient number]. */
export const LAYERS: Record<LayerKey, [string, string, number]> = {
  ac: ['AC Course', 'AC COURSE (Asphalt Concrete)', 1],
  dbm: ['DBM Course', 'DBM COURSE (Dense Bituminous Macadam)', 2],
  base: ['Base Course', 'CRUSHED AGGREGATE BASE', 3],
  subbase: ['Subbase', 'AGGREGATE SUBBASE', 4],
  capping: ['Capping Layer', 'CAPPING LAYER', 5],
};
export const SUPPORT_NAMES: Record<SupportKey, string> = {
  dbm: 'DBM Course', base: 'Base Course', subbase: 'Subbase', capping: 'Capping Layer', subgrade: 'Subgrade',
};

/** Input limits shared with the notebook (the API DTOs use the same numbers). */
export const LIMITS = {
  reliability: [50, 99.99], so: [0, 1], dpsi: [0, 5], aAc: [0, 1], a: [0, 1], m: [0.4, 1.4], thicknessMm: [0, 3000],
} as const;

export interface DesignInput {
  reliability: number;          // %
  so: number;                   // overall standard deviation
  w18: number;                  // design ESALs, millions
  dpsi: number;                 // serviceability loss
  useDbmLayer: boolean;
  useCappingLayer: boolean;
  mrMethod: 'cbr' | 'mr';       // 'cbr' = MR from CBR (unbound layers), 'mr' = MR entered directly
  cbr: Partial<Record<UnboundKey, number>>;          // the DBM is asphalt: no CBR
  mrPsi: Partial<Record<SupportKey, number>>;        // mrPsi.dbm is always used for the DBM
  a: Partial<Record<LayerKey, number>>;
  m: Partial<Record<Exclude<LayerKey, 'ac'>, number>>; // AC and DBM are asphalt: m is always 1 (m.dbm is ignored)
  thicknessMm: Partial<Record<LayerKey, number | null>>; // missing/null = suggested minimum
  roundUpToMm: number | null;
  enforceAashtoMinimums: boolean;
  correlation?: MRCorrelation;
}

export const DEFAULT_INPUT: DesignInput = {
  reliability: 95, so: 0.45, w18: 115.6, dpsi: 2.2,
  useDbmLayer: true, useCappingLayer: false, mrMethod: 'cbr',
  cbr: { subgrade: 5, capping: 15, subbase: 30, base: 80 },
  mrPsi: { subgrade: 7500, capping: 15000, subbase: 15000, base: 30000, dbm: 400000 },
  a: { ac: 0.44, dbm: 0.34, base: 0.14, subbase: 0.11, capping: 0.08 },
  m: { base: 1, subbase: 1, capping: 1 },
  thicknessMm: {},
  roundUpToMm: null,
  enforceAashtoMinimums: false,
};

/** Fill anything not given from the defaults (per-layer groups are merged key by key). */
export function withDefaults(partial: Partial<DesignInput> = {}): DesignInput {
  return {
    ...DEFAULT_INPUT,
    ...partial,
    cbr: { ...DEFAULT_INPUT.cbr, ...partial.cbr },
    mrPsi: { ...DEFAULT_INPUT.mrPsi, ...partial.mrPsi },
    a: { ...DEFAULT_INPUT.a, ...partial.a },
    m: { ...DEFAULT_INPUT.m, ...partial.m },
    thicknessMm: { ...partial.thicknessMm },
    roundUpToMm: partial.roundUpToMm ?? null,
  };
}

export interface LayerResult {
  key: LayerKey;
  number: number;               // position from the top (1 = AC course)
  name: string;
  heading: string;
  coefficientSymbol: string;    // e.g. "a3" (coefficients keep their material number)
  a: number;
  m: number;
  supports: string;             // the layer directly below
  requiredSn: number;           // SN required on top of `supports`
  minThicknessMm: number;       // computed minimum, rounded up to 0.1 mm
  suggestedThicknessMm: number; // minimum after optional AASHTO minimum / rounding
  thicknessMm: number;          // thickness used (chosen, or the suggestion)
  thicknessIsCustom: boolean;
  snContribution: number;
  cumulativeSn: number;
  checkOk: boolean;
  notes: string[];
}

export interface DesignResult {
  zr: number;
  mrPsi: Partial<Record<SupportKey, number>>;
  cbr: Partial<Record<UnboundKey, number>>;
  cbrIsEstimated: boolean;
  requiredSnOn: Partial<Record<SupportKey, number>>;
  layers: LayerResult[];
  totalSn: number;
  requiredTotalSn: number;
  totalThicknessMm: number;
  totalOk: boolean;
  failedLayers: string[];
  adequate: boolean;
  warnings: string[];
}

export class DesignInputError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('; '));
  }
}

export function layerKeys(inp: DesignInput): LayerKey[] {
  return ['ac', ...(inp.useDbmLayer ? ['dbm' as const] : []), 'base', 'subbase',
    ...(inp.useCappingLayer ? ['capping' as const] : [])];
}

export function supportKeys(inp: DesignInput): SupportKey[] {
  return [...(layerKeys(inp).slice(1) as SupportKey[]), 'subgrade'];
}

/** Every out-of-range or missing value (the API validates the same rules earlier). */
export function validateInput(inp: DesignInput): void {
  const problems: string[] = [];
  const check = (label: string, value: unknown, low: number, high: number, lowInclusive = true) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      problems.push(`${label} must be a number`);
    } else if ((lowInclusive ? value < low : value <= low) || value > high) {
      problems.push(`${label} must be ${lowInclusive ? 'at least' : 'greater than'} ${low} and at most ${high} (got ${value})`);
    }
  };
  check('reliability', inp.reliability, ...LIMITS.reliability);
  check('so', inp.so, ...LIMITS.so, false);
  check('w18', inp.w18, 0, Infinity, false);
  check('dpsi', inp.dpsi, ...LIMITS.dpsi, false);
  if (inp.mrMethod !== 'cbr' && inp.mrMethod !== 'mr') problems.push(`mrMethod must be 'cbr' or 'mr' (got ${inp.mrMethod})`);
  for (const key of supportKeys(inp)) {
    const useCbr = inp.mrMethod === 'cbr' && key !== 'dbm';
    const value = useCbr ? inp.cbr[key as UnboundKey] : inp.mrPsi[key];
    check(`${useCbr ? 'cbr' : 'mrPsi'}.${key}`, value, 0, Infinity, false);
  }
  for (const key of layerKeys(inp)) {
    if (key === 'ac') {
      check('a.ac', inp.a.ac, ...LIMITS.aAc, false);
    } else {
      check(`a.${key}`, inp.a[key], ...LIMITS.a);
      if (key !== 'dbm') check(`m.${key}`, inp.m[key], ...LIMITS.m);
    }
    const t = inp.thicknessMm[key];
    if (t !== undefined && t !== null) check(`thicknessMm.${key}`, t, ...LIMITS.thicknessMm);
  }
  if (inp.roundUpToMm !== null) check('roundUpToMm', inp.roundUpToMm, 0, 1000, false);
  if (problems.length) throw new DesignInputError(problems);
}

/** Minimum thickness (mm), rounded UP to 0.1 mm so the value shown always passes. */
function minimumMm(remainingSn: number, a: number, m: number): number {
  const dMinInches = a * m !== 0 ? Math.max(0, remainingSn / (a * m)) : 0;
  return Math.ceil(dMinInches * 254 - 1e-6) / 10;
}

/** Python-style "%g" for the small rounding steps shown in notes (5 -> "5", 2.5 -> "2.5"). */
const g = (v: number) => String(Number(v.toPrecision(6)));

/** Run the full AASHTO 1993 layered design for one set of inputs. */
export function designPavement(input: DesignInput): DesignResult {
  validateInput(input);
  const inp = input;
  const corr = inp.correlation ?? DEFAULT_CORRELATION;
  const warnings: string[] = [];
  const zr = zR(inp.reliability);

  const supports = supportKeys(inp);
  const unbound = supports.filter((k): k is UnboundKey => k !== 'dbm'); // the DBM is asphalt: MR entered directly
  const mr: Partial<Record<SupportKey, number>> = {};
  const cbr: Partial<Record<UnboundKey, number>> = {};
  if (inp.useDbmLayer) mr.dbm = inp.mrPsi.dbm as number;
  for (const k of unbound) {
    if (inp.mrMethod === 'cbr') {
      cbr[k] = inp.cbr[k] as number;
      mr[k] = mrFromCbr(cbr[k] as number, corr);
    } else {
      mr[k] = inp.mrPsi[k] as number;
      cbr[k] = cbrFromMr(mr[k] as number, corr);
    }
  }

  const snOn: Partial<Record<SupportKey, number>> = {};
  for (const k of supports) {
    snOn[k] = requiredSn(inp.w18, mr[k] as number, zr, inp.so, inp.dpsi);
    if (snOn[k] === 0) {
      warnings.push(`SN = 0 already satisfies the design on the ${SUPPORT_NAMES[k]}; no structure is required above it.`);
    }
  }

  const keys = layerKeys(inp);
  const layers: LayerResult[] = [];
  let cumulative = 0;
  keys.forEach((key, index) => {
    const number = index + 1;
    const [name, heading, coeffNo] = LAYERS[key];
    const below: SupportKey = number < keys.length ? (keys[number] as SupportKey) : 'subgrade';
    const a = inp.a[key] as number;
    // AC and DBM are asphalt (bound) layers: no drainage coefficient, m = 1.
    const m = key === 'ac' || key === 'dbm' ? 1 : (inp.m[key as Exclude<LayerKey, 'ac'>] as number);
    const required = snOn[below] as number;
    const notes: string[] = [];

    const remaining = required - cumulative;
    if (a * m === 0) {
      notes.push(`Layer coefficient a${coeffNo} or drainage coefficient m${coeffNo} is zero, so this layer adds no structural number.`);
    }
    const minimum = minimumMm(remaining, a, m);
    if (number > 1 && remaining <= 0) {
      notes.push('The layers above already provide this SN, so any thickness passes this check.');
    }

    let suggested = minimum;
    if (inp.enforceAashtoMinimums) {
      const practical = aashtoMinimumThicknessMm(name, inp.w18);
      if (practical > suggested) {
        suggested = practical;
        notes.push(`AASHTO 1993 minimum thickness applies: ${practical.toFixed(1)} mm.`);
      }
    }
    if (inp.roundUpToMm) {
      const rounded = Math.ceil(suggested / inp.roundUpToMm - 1e-9) * inp.roundUpToMm;
      if (rounded !== suggested) notes.push(`Rounded up to the next ${g(inp.roundUpToMm)} mm: ${rounded.toFixed(1)} mm.`);
      suggested = rounded;
    }

    const chosen = inp.thicknessMm[key];
    const thickness = chosen === undefined || chosen === null ? suggested : chosen;
    const sn = (thickness / 25.4) * a * m;
    cumulative += sn;
    const ok = cumulative >= required - SN_TOLERANCE;
    if (!ok) {
      notes.push(`${thickness.toFixed(1)} mm is below the minimum ${minimum.toFixed(1)} mm `
        + `(short by ${(required - cumulative).toFixed(3)} SN). This layer does not protect `
        + `the ${SUPPORT_NAMES[below]} beneath it.`);
    }
    layers.push({
      key, number, name, heading, coefficientSymbol: `a${coeffNo}`, a, m, supports: SUPPORT_NAMES[below],
      requiredSn: required, minThicknessMm: minimum, suggestedThicknessMm: suggested, thicknessMm: thickness,
      thicknessIsCustom: chosen !== undefined && chosen !== null, snContribution: sn, cumulativeSn: cumulative,
      checkOk: ok, notes,
    });
  });

  const totalOk = cumulative >= (snOn.subgrade as number) - SN_TOLERANCE;
  const failedLayers = layers.filter((l) => !l.checkOk).map((l) => l.name);
  return {
    zr, mrPsi: mr, cbr, cbrIsEstimated: inp.mrMethod === 'mr', requiredSnOn: snOn, layers,
    totalSn: cumulative, requiredTotalSn: snOn.subgrade as number,
    totalThicknessMm: layers.reduce((sum, l) => sum + l.thicknessMm, 0),
    totalOk, failedLayers, adequate: totalOk && failedLayers.length === 0, warnings,
  };
}
