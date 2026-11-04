import type { DesignInput } from './types';

/** Same defaults as the backend engine and the notebook. */
export const DEFAULT_INPUT: DesignInput = {
  reliability: 95, so: 0.45, w18: 115.6, dpsi: 2.2,
  useDbmLayer: true, useCappingLayer: false, mrMethod: 'cbr',
  cbr: { subgrade: 5, capping: 15, subbase: 30, base: 80 },
  mrPsi: { subgrade: 7500, capping: 15000, subbase: 15000, base: 30000, dbm: 400000 },
  a: { ac: 0.44, dbm: 0.34, base: 0.14, subbase: 0.11, capping: 0.08 },
  m: { base: 1, subbase: 1, capping: 1 }, // AC and DBM are asphalt: no m
  thicknessMm: {},
  roundUpToMm: null,
  enforceAashtoMinimums: false,
};

/** Saved inputs only contain what differs from the defaults; fill in the rest. */
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

/** "3.5" or "3,5" -> 3.5; "" -> null; anything unreadable -> NaN. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

const UNITS_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, inch: 25.4, inches: 25.4 };

/** "250", "250mm", "25 cm", "10in", "25,5" -> millimetres; "" -> null; unreadable -> NaN. */
export function parseThickness(text: string): number | null {
  if (text.trim() === '') return null;
  const match = /^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-zA-Z]*)\s*$/.exec(text.replace(',', '.'));
  if (!match) return NaN;
  const unit = (match[2] || 'mm').toLowerCase();
  return unit in UNITS_MM ? Number(match[1]) * UNITS_MM[unit] : NaN;
}

export const fixed = (v: number, digits = 3) => Number(v).toFixed(digits);
export const thousands = (v: number) => Math.round(v).toLocaleString('en-US');
