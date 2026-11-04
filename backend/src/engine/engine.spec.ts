/**
 * Parity tests: the TypeScript engine must give the same results as the tested
 * Python engine (and therefore the notebook) for 63 designs — 13 named cases,
 * including the user's spreadsheet example, plus 50 random designs.
 * Regenerate the fixtures with tools/generate_engine_fixtures.py.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DesignInput, designPavement, DesignInputError, normalInvCdf, withDefaults, zR } from './index.js';

interface Fixture { name: string; input: Partial<DesignInput>; result: Record<string, any> }

const fixtures: Fixture[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('./__fixtures__/python-cases.json', import.meta.url)), 'utf-8'),
);
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

describe('TypeScript engine matches the Python engine', () => {
  it('has all 63 reference cases', () => {
    expect(fixtures.length).toBe(63);
  });

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, fixture) => {
    const expected = fixture.result;
    const actual = designPavement(withDefaults(fixture.input));

    expect(close(actual.zr, expected.zr, 1e-12)).toBe(true);
    expect(actual.cbrIsEstimated).toBe(expected.cbrIsEstimated);
    expect(actual.adequate).toBe(expected.adequate);
    expect(actual.totalOk).toBe(expected.totalOk);
    expect(actual.failedLayers).toEqual(expected.failedLayers);
    expect(actual.warnings).toEqual(expected.warnings);
    expect(close(actual.totalSn, expected.totalSn)).toBe(true);
    expect(close(actual.requiredTotalSn, expected.requiredTotalSn)).toBe(true);
    expect(close(actual.totalThicknessMm, expected.totalThicknessMm)).toBe(true);
    for (const group of ['mrPsi', 'cbr', 'requiredSnOn'] as const) {
      expect(Object.keys(actual[group]).sort()).toEqual(Object.keys(expected[group]).sort());
      for (const [k, v] of Object.entries(expected[group])) {
        expect(close((actual[group] as Record<string, number>)[k], v as number), `${group}.${k}`).toBe(true);
      }
    }
    expect(actual.layers.map((l) => l.key)).toEqual(expected.layers.map((l: any) => l.key));
    actual.layers.forEach((layer, i) => {
      const e = expected.layers[i];
      for (const field of ['number', 'name', 'heading', 'coefficientSymbol', 'supports', 'thicknessIsCustom',
        'checkOk', 'notes'] as const) {
        expect(layer[field], `${layer.name}.${field}`).toEqual(e[field]);
      }
      for (const field of ['a', 'm', 'requiredSn', 'minThicknessMm', 'suggestedThicknessMm', 'thicknessMm',
        'snContribution', 'cumulativeSn'] as const) {
        expect(close(layer[field], e[field]), `${layer.name}.${field}: ${layer[field]} vs ${e[field]}`).toBe(true);
      }
    });
  });
});

describe('engine details', () => {
  it('reproduces the user spreadsheet: R 98 %, W18 131e6, DBM MR 400,000 -> SN1 1.901, D1 4.32 in', () => {
    const r = designPavement(withDefaults({
      reliability: 98, w18: 131, mrMethod: 'mr', mrPsi: { base: 43500, dbm: 400000 },
    }));
    expect(r.zr).toBe(-2.045);
    expect(r.requiredSnOn.dbm).toBeCloseTo(1.901, 3);
    expect(r.layers[0].minThicknessMm).toBe(109.8); // 4.32 in = 10.97 cm, rounded up to 0.1 mm
  });

  it('uses the exact normal inverse for reliabilities not in the AASHTO table', () => {
    expect(zR(88)).toBeCloseTo(-1.17499, 5);
    expect(normalInvCdf(0.975)).toBeCloseTo(1.959964, 6);
    expect(() => zR(150)).toThrow(RangeError);
  });

  it('lists every invalid input at once', () => {
    try {
      designPavement(withDefaults({ reliability: 150, so: 0, m: { base: 2 }, thicknessMm: { ac: -5 } }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DesignInputError);
      const problems = (error as DesignInputError).problems.join(' | ');
      for (const field of ['reliability', 'so', 'm.base', 'thicknessMm.ac']) expect(problems).toContain(field);
    }
  });

  it('treats the DBM like the AC: asphalt, m = 1 whatever m.dbm says', () => {
    const plain = designPavement(withDefaults());
    const withM = designPavement(withDefaults({ m: { dbm: 0.5 } }));
    expect(withM.layers.find((l) => l.key === 'dbm')?.m).toBe(1);
    expect(withM.layers).toEqual(plain.layers);
  });

  it('designs 3, 4 or 5 layers', () => {
    expect(designPavement(withDefaults({ useDbmLayer: false })).layers).toHaveLength(3);
    expect(designPavement(withDefaults()).layers).toHaveLength(4);
    expect(designPavement(withDefaults({ useCappingLayer: true })).layers).toHaveLength(5);
  });
});
