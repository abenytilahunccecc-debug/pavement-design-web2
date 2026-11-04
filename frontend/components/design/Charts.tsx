'use client';
import { useId, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { DesignResult, LayerKey, UnboundKey } from '@/lib/types';
import { fixed, thousands } from '@/lib/design-defaults';
import { Download } from '../icons';
import { MATERIALS, PavementDefs, patternId, type MaterialKey } from './pavementTextures';

// Colours that change with the theme are written as var(--token, light fallback):
// on screen they follow light/dark mode; in an exported file (no page CSS) the light value is used.
const INK = 'currentColor';
const BAD = 'var(--bad, #b42318)';
const OK = 'var(--ok, #15803d)';
const SANS = '"Times New Roman", Times, Tinos, "Liberation Serif", "Noto Serif", serif';
const MONO = SANS;

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** Resilient modulus shown for the AC wearing course on the cross-section (always 450,000 psi). */
const AC_MR_PSI = 450_000;
const subscript = (symbol: string) => symbol.replace(/\d/g, (d) => SUB[Number(d)]);

interface Block {
  key: MaterialKey;
  name: string;
  thicknessMm: number | null;   // null for the subgrade (semi-infinite)
  property: string;
  ok: boolean;
  y: number;
  h: number;
  clamped: boolean;
}

/** Key property shown next to each layer. */
function propertyText(result: DesignResult, key: LayerKey, a: number, m: number, symbol: string): string {
  const n = symbol.slice(1);
  const coefficient = `${subscript(symbol)} ${fixed(a, 2)}`;
  // AC and DBM are asphalt: no drainage coefficient. The AC modulus is shown for the report only (not used in the SN design).
  if (key === 'ac') return `${coefficient} · MR ${thousands(AC_MR_PSI)} psi`;
  if (key === 'dbm') {
    const mr = result.mrPsi.dbm;
    return `${coefficient}${mr ? ` · MR ${thousands(mr)} psi` : ''}`;
  }
  const cbr = result.cbr[key as UnboundKey];
  return `${coefficient} · m${subscript(n)} ${fixed(m, 2)}${cbr !== undefined ? ` · ${result.cbrIsEstimated ? '≈' : ''}CBR ${fixed(cbr, 0)} %` : ''}`;
}

/** Subgrade line: CBR and/or MR. */
function subgradeProperty(result: DesignResult): string {
  const mr = result.mrPsi.subgrade, cbr = result.cbr.subgrade;
  return [cbr !== undefined ? `${result.cbrIsEstimated ? '≈' : ''}CBR ${fixed(cbr, 1)} %` : '', mr ? `MR ${thousands(mr)} psi` : '']
    .filter(Boolean).join(' · ');
}

function niceStep(total: number) {
  for (const step of [10, 20, 25, 50, 100, 150, 200, 250, 500]) if (total / step <= 8) return step;
  return 1000;
}

/**
 * Realistic pavement cross-section: textured layers drawn to scale (thin layers get a minimum height),
 * labels with leader lines, a depth scale and a legend. Only the layers in the result are drawn.
 */
export function CrossSection({ result, ref, title = true, compact = false }:
  { result: DesignResult; ref?: Ref<SVGSVGElement>; title?: boolean; compact?: boolean }) {
  const prefix = `ps${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // compact = phone-width drawing: blocks, depth scale and numbered layers (the names are listed under it in HTML).
  // Seen from the front-left, like a photographed core: front face, left side face and the asphalt top.
  const W = compact ? 310 : 740;
  const titleH = title && !compact ? 44 : 8;
  const depth = compact ? 11 : 24, sideW = compact ? 28 : 64;   // the side and top faces recede up and to the left
  const x0 = (compact ? 46 : 70) + sideW, bw = compact ? 180 : 250;   // front face of the block
  const top = titleH + depth + 6;                 // top edge of the front face
  const pavementPx = 300, minPx = 10, subgradePx = 78;
  const total = result.totalThicknessMm || 1;
  const scale = pavementPx / total;               // px per mm

  const blocks: Block[] = [];
  let y = top;
  for (const layer of result.layers) {
    if (!(layer.thicknessMm > 0)) continue;
    const true_h = layer.thicknessMm * scale;
    const h = Math.max(minPx, true_h);
    blocks.push({
      key: layer.key, name: layer.name, thicknessMm: layer.thicknessMm, ok: layer.checkOk, y, h, clamped: h > true_h + 0.01,
      property: propertyText(result, layer.key, layer.a, layer.m, layer.coefficientSymbol),
    });
    y += h;
  }
  const pavementBottom = y;
  blocks.push({
    key: 'subgrade', name: 'Subgrade', thicknessMm: null, ok: true, y, h: subgradePx, clamped: false,
    property: subgradeProperty(result),
  });
  const blockBottom = y + subgradePx;

  // Slightly uneven layer boundaries (smooth, repeatable). Boundary i is the top of blocks[i]; the road surface is flat.
  const sideLen = Math.hypot(sideW, depth);
  const amplitude = (i: number) => {
    if (i === 0) return 0;
    const asphalt = (k: MaterialKey) => k === 'ac' || k === 'dbm';
    const a = asphalt(blocks[i - 1].key) && asphalt(blocks[i].key) ? 0.7 : blocks[i].key === 'subgrade' ? 2.6 : 1.8;
    return Math.min(a * (compact ? 0.6 : 1), blocks[i - 1].h / 4, blocks[i].h / 4);
  };
  const wave = (i: number, d: number) =>
    amplitude(i) * (0.6 * Math.sin(d * 0.045 + i * 1.7) + 0.4 * Math.sin(d * 0.11 + i * 0.9));
  const STEPS = compact ? 18 : 36;
  const frontEdge = (i: number): Array<[number, number]> =>
    Array.from({ length: STEPS + 1 }, (_, k) => { const v = (k / STEPS) * bw; return [x0 + v, blocks[i].y + wave(i, v)]; });
  const sideEdge = (i: number): Array<[number, number]> =>   // from the front corner to the back
    Array.from({ length: 9 }, (_, k) => { const u = k / 8; return [x0 - u * sideW, blocks[i].y - u * depth + wave(i, -u * sideLen)]; });
  const flatFront = (yb: number): Array<[number, number]> => [[x0, yb], [x0 + bw, yb]];
  const flatSide = (yb: number): Array<[number, number]> => [[x0, yb], [x0 - sideW, yb - depth]];
  const pts = (list: Array<[number, number]>) =>
    list.map(([px, py]) => `${Math.round(px * 10) / 10},${Math.round(py * 10) / 10}`).join(' ');

  // Labels: start level with the layer middle, then push apart so two-line labels never overlap.
  const gap = compact ? 24 : 38;
  const labelY: number[] = [];
  blocks.forEach((b, i) => labelY.push(Math.max(b.y + b.h / 2, i ? labelY[i - 1] + gap : top + 8)));
  const labelX = x0 + bw + 40;
  const scaleX = x0 - sideW - 14;                 // depth scale, left of the side face

  // Depth scale.
  const step = niceStep(total);
  const ticks: number[] = [];
  for (let mm = 0; mm < total - 0.5; mm += step) ticks.push(mm);
  const anyClamped = blocks.some((b) => b.clamped);
  const tickY = (mm: number) => {
    // Follow the drawn layers so the scale stays honest even when a thin layer was enlarged.
    let acc = 0;
    for (const b of blocks) {
      if (b.thicknessMm === null) break;
      if (mm <= acc + b.thicknessMm) return b.y + ((mm - acc) / b.thicknessMm) * b.h;
      acc += b.thicknessMm;
    }
    return pavementBottom;
  };

  // Legend.
  const legendTop = Math.max(blockBottom, labelY[labelY.length - 1] + 22) + 30;
  const perRow = 3, legendRowH = 24, legendColW = W / perRow;
  const legendRows = Math.ceil(blocks.length / perRow);
  const H = compact ? Math.max(blockBottom, labelY[labelY.length - 1] + 14) + 6
    : legendTop + legendRows * legendRowH + (anyClamped ? 22 : 6);

  const fadeMask = `url(#${prefix}-fade-mask)`;
  const summary = blocks.map((b) => `${b.name}${b.thicknessMm !== null ? ` ${fixed(b.thicknessMm, 0)} mm` : ''}`).join(', ');

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={`h-auto w-full text-ink ${compact ? '' : 'min-w-[560px]'}`}
      role="img" aria-labelledby={`${prefix}-title`} style={{ fontFamily: SANS }} xmlns="http://www.w3.org/2000/svg">
      <title id={`${prefix}-title`}>{`Pavement cross-section: ${summary}. Total ${fixed(result.totalThicknessMm, 1)} mm.`}</title>
      <PavementDefs prefix={prefix} />

      {title && !compact && (
        <g>
          <text x={0} y={18} fontSize={15} fontWeight={650} fill={INK}>Pavement structure</text>
          <text x={0} y={36} fontSize={11.5} fill={INK} fillOpacity={0.62}>
            AASHTO 1993 · SN {fixed(result.totalSn)} provided / {fixed(result.requiredTotalSn)} required
          </text>
          <text x={W} y={18} fontSize={15} fontWeight={650} textAnchor="end" fill={INK} style={{ fontFamily: MONO }}>
            {fixed(result.totalThicknessMm, 0)} mm
          </text>
          <text x={W} y={36} fontSize={11.5} textAnchor="end" fill={result.adequate ? OK : BAD} fontWeight={600}>
            {result.adequate ? 'ADEQUATE' : 'NOT ADEQUATE'}
          </text>
        </g>
      )}

      {/* Soft shadow on the ground, cast to the left. */}
      <ellipse cx={x0 - sideW * 0.4} cy={blockBottom - depth * 0.6} rx={bw * 0.55} ry={compact ? 8 : 16} fill="#000"
        fillOpacity={0.22} filter={`url(#${prefix}-blur)`} />

      {/* Layers: each band runs from its (slightly uneven) top boundary to the next one, on the side and front faces. */}
      {blocks.map((b, i) => {
        const fill = `url(#${patternId(prefix, b.key)})`;
        const isSub = b.key === 'subgrade';
        const front = [...frontEdge(i), ...(isSub ? flatFront(blockBottom) : frontEdge(i + 1)).reverse()];
        const side = [...sideEdge(i).reverse(), ...(isSub ? flatSide(blockBottom) : sideEdge(i + 1))];
        return (
          <g key={b.key} mask={isSub ? fadeMask : undefined}>
            <polygon points={pts(side)} fill={fill} />
            <polygon points={pts(side)} fill="#000" fillOpacity={0.24} />
            <polygon points={pts(front)} fill={fill} />
            {!b.ok && (
              <rect x={x0 + 1} y={b.y + 1} width={bw - 2} height={b.h - 2} fill="none" stroke={BAD} strokeWidth={2} strokeDasharray="6 3" />
            )}
          </g>
        );
      })}
      {/* Boundaries: a faint shadow line, plus the light tack coat between the two asphalt layers. */}
      {blocks.slice(1).map((b, j) => {
        const i = j + 1;
        const edge = pts([...sideEdge(i).reverse(), ...frontEdge(i)]);
        const asphaltJoint = blocks[i - 1].key === 'ac' && b.key === 'dbm';
        return (
          <g key={`edge-${b.key}`} fill="none">
            <polyline points={edge} stroke="#000" strokeOpacity={0.3} strokeWidth={0.9} />
            {asphaltJoint && <polyline points={edge} stroke="#e6e6e6" strokeOpacity={0.75} strokeWidth={compact ? 0.8 : 1.2}
              transform="translate(0 0.9)" />}
          </g>
        );
      })}
      {/* Front corner edge catches the light. */}
      <line x1={x0} x2={x0} y1={top} y2={pavementBottom} stroke="#fff" strokeOpacity={0.16} strokeWidth={1} />
      {blocks.length > 1 && (() => {
        const first = blocks[0];
        const topFace = `${x0},${first.y} ${x0 + bw},${first.y} ${x0 + bw - sideW},${first.y - depth} ${x0 - sideW},${first.y - depth}`;
        return (
          <g>
            <polygon points={topFace} fill={`url(#${patternId(prefix, first.key)})`} />
            <polygon points={topFace} fill={`url(#${prefix}-sheen)`} />
            <polyline points={`${x0 - sideW},${first.y - depth} ${x0},${first.y} ${x0 + bw},${first.y}`}
              fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={1} />
          </g>
        );
      })()}

      {/* Depth scale (mm). */}
      <g fill={INK} stroke={INK} fontSize={10.5} style={{ fontFamily: MONO }}>
        <line x1={scaleX} x2={scaleX} y1={top} y2={pavementBottom} strokeOpacity={0.55} />
        <text x={scaleX} y={top - 8} textAnchor="middle" stroke="none" fillOpacity={0.6} style={{ fontFamily: SANS }}>mm</text>
        {ticks.map((mm) => {
          const ty = tickY(mm);
          const tooClose = pavementBottom - ty < 11;
          return (
            <g key={mm}>
              <line x1={scaleX - 5} x2={scaleX} y1={ty} y2={ty} strokeOpacity={0.55} />
              {!tooClose && <text x={scaleX - 9} y={ty + 3.5} textAnchor="end" stroke="none" fillOpacity={0.62}>{mm}</text>}
            </g>
          );
        })}
        <line x1={scaleX - 8} x2={scaleX} y1={pavementBottom} y2={pavementBottom} strokeOpacity={0.8} />
        <text x={scaleX - 11} y={pavementBottom + 3.5} textAnchor="end" stroke="none" fontWeight={700}>{fixed(total, 0)}</text>
      </g>

      {/* Compact: a numbered badge per layer, matching the list under the drawing. */}
      {compact && blocks.map((b, i) => {
        const anchorX = x0 + bw - 7, anchorY = b.y + b.h / 2;
        const cx = x0 + bw + 26, cy = labelY[i];
        return (
          <g key={`badge-${b.key}`}>
            <circle cx={anchorX} cy={anchorY} r={2.2} fill="#fff" stroke="#000" strokeOpacity={0.5} strokeWidth={0.7} />
            <polyline points={`${anchorX + 2.2},${anchorY} ${cx - 11},${cy}`} fill="none" stroke={INK} strokeOpacity={0.4} strokeWidth={1} />
            <circle cx={cx} cy={cy} r={10} fill={b.ok ? INK : BAD} />
            <text x={cx} y={cy + 4.5} fontSize={12.5} fontWeight={700} textAnchor="middle" fill="var(--surface, #fff)">{i + 1}</text>
          </g>
        );
      })}

      {/* Labels with leader lines. */}
      {!compact && blocks.map((b, i) => {
        const anchorX = x0 + bw - 8, anchorY = b.y + b.h / 2;
        const ly = labelY[i];
        return (
          <g key={`label-${b.key}`}>
            <circle cx={anchorX} cy={anchorY} r={2.4} fill="#fff" stroke="#000" strokeOpacity={0.5} strokeWidth={0.8} />
            <polyline points={`${anchorX + 2.4},${anchorY} ${labelX - 14},${ly - 4} ${labelX - 6},${ly - 4}`}
              fill="none" stroke={INK} strokeOpacity={0.4} strokeWidth={1} />
            <text x={labelX} y={ly} fontSize={13} fontWeight={600} fill={b.ok ? INK : BAD}>
              {b.name}
              <tspan dx={8} fontWeight={400} fontSize={12} fillOpacity={0.62}>{MATERIALS[b.key].material}</tspan>
            </text>
            {b.thicknessMm !== null && (
              <text x={W} y={ly} fontSize={13} fontWeight={650} textAnchor="end" fill={b.ok ? INK : BAD} style={{ fontFamily: MONO }}>
                {fixed(b.thicknessMm, 0)} mm
              </text>
            )}
            <text x={labelX} y={ly + 16} fontSize={11} fill={b.ok ? INK : BAD} fillOpacity={b.ok ? 0.62 : 1} style={{ fontFamily: MONO }}>
              {b.ok ? '' : 'NOT OK · '}{b.property}
            </text>
          </g>
        );
      })}

      {/* Legend. */}
      {!compact && <g fontSize={11.5}>
        <line x1={0} x2={W} y1={legendTop - 16} y2={legendTop - 16} stroke={INK} strokeOpacity={0.12} />
        {blocks.map((b, i) => {
          const lx = (i % perRow) * legendColW, ly = legendTop + Math.floor(i / perRow) * legendRowH;
          return (
            <g key={`legend-${b.key}`}>
              <rect x={lx} y={ly - 10} width={26} height={14} rx={2} fill={`url(#${patternId(prefix, b.key)})`}
                stroke={INK} strokeOpacity={0.25} />
              <text x={lx + 34} y={ly + 1} fill={INK} fillOpacity={0.8}>{MATERIALS[b.key].material}</text>
            </g>
          );
        })}
        {anyClamped && (
          <text x={0} y={H - 6} fontSize={10.5} fill={INK} fillOpacity={0.55}>
            Drawn to scale; very thin layers are enlarged to stay visible (the depth scale follows the drawing).
          </text>
        )}
      </g>}
    </svg>
  );
}

// ---------- Export ----------

function exportableSvg(svg: SVGSVGElement): { text: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const [, , width, height] = (svg.getAttribute('viewBox') ?? '0 0 700 500').split(' ').map(Number);
  const pad = 24;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`);
  clone.setAttribute('width', String(width + pad * 2));
  clone.setAttribute('height', String(height + pad * 2));
  clone.removeAttribute('class');
  // Reports are printed on white: always export the light version.
  clone.setAttribute('style', 'color:#111113;font-family:"Times New Roman", Times, Tinos, "Liberation Serif", "Noto Serif", serif');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(-pad)); bg.setAttribute('y', String(-pad));
  bg.setAttribute('width', String(width + pad * 2)); bg.setAttribute('height', String(height + pad * 2));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.querySelector('defs')?.nextSibling ?? clone.firstChild);
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  return { text, width: width + pad * 2, height: height + pad * 2 };
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: SVGSVGElement, name = 'pavement-structure.svg') {
  save(new Blob([exportableSvg(svg).text], { type: 'image/svg+xml' }), name);
}

export async function downloadPng(svg: SVGSVGElement, name = 'pavement-structure.png', pixelRatio = 3) {
  const { text, width, height } = exportableSvg(svg);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas not available');
    context.scale(pixelRatio, pixelRatio);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) save(blob, name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Card with the cross-section and its PNG / SVG export buttons. */
export function CrossSectionPanel({ result, fileName = 'pavement-structure' }: { result: DesignResult; fileName?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // Narrow space (phones): show the compact drawing that fits the screen instead of a sideways-scrolling one.
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 560));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Arriving from the start page's "Report-ready cross-sections" tile (/calculator#cross-section).
  useLayoutEffect(() => {
    if (window.location.hash === '#cross-section') boxRef.current?.closest('section')?.scrollIntoView({ block: 'start' });
  }, []);

  const button = 'inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink transition hover:bg-raised disabled:opacity-50';
  return (
    <section id="cross-section" className="shadow-card scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Cross-section</h2>
          <p className="text-[13px] text-muted">Layers to scale with materials and key properties. Exports print on white.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={button} disabled={busy}
            onClick={async () => { if (!svgRef.current) return; setBusy(true); try { await downloadPng(svgRef.current, `${fileName}.png`); } finally { setBusy(false); } }}>
            <Download size={14} />PNG
          </button>
          <button type="button" className={button} onClick={() => svgRef.current && downloadSvg(svgRef.current, `${fileName}.svg`)}>
            <Download size={14} />SVG
          </button>
        </div>
      </div>
      <div ref={boxRef}>
        {compact && <CompactCrossSection result={result} />}
        {/* The full drawing is what PNG / SVG export, so it stays in the page (hidden) on narrow screens. */}
        <div className={compact ? 'hidden' : '-mx-1 overflow-x-auto px-1'}>
          <CrossSection result={result} ref={svgRef} />
        </div>
      </div>
    </section>
  );
}

/** Phone layout: summary line, the narrow drawing, then one numbered line per layer in normal-size text. */
function CompactCrossSection({ result }: { result: DesignResult }) {
  const rows = [
    ...result.layers.filter((l) => l.thicknessMm > 0).map((l) => ({
      key: l.key as MaterialKey, name: l.name, thicknessMm: l.thicknessMm as number | null, ok: l.checkOk,
      property: propertyText(result, l.key, l.a, l.m, l.coefficientSymbol),
    })),
    { key: 'subgrade' as MaterialKey, name: 'Subgrade', thicknessMm: null, ok: true, property: subgradeProperty(result) },
  ];
  return (
    <div>
      <p className="num mb-3 text-[13px] text-muted">
        SN {fixed(result.totalSn)} provided / {fixed(result.requiredTotalSn)} required · {fixed(result.totalThicknessMm, 0)} mm ·{' '}
        <span className={`font-semibold ${result.adequate ? 'text-ok' : 'text-bad'}`}>{result.adequate ? 'ADEQUATE' : 'NOT ADEQUATE'}</span>
      </p>
      <CrossSection result={result} compact />
      <ol className="mt-4 space-y-2.5">
        {rows.map((row, i) => (
          <li key={row.key} className="flex gap-3">
            <span className={`num mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-surface ${row.ok ? 'bg-ink' : 'bg-bad'}`}>{i + 1}</span>
            <div className="min-w-0">
              <p className={row.ok ? 'text-ink' : 'text-bad'}>
                <span className="font-semibold">{row.name}</span>
                {row.thicknessMm !== null && <span className="num font-semibold"> · {fixed(row.thicknessMm, 0)} mm</span>}
                {!row.ok && <span className="font-semibold"> · NOT OK</span>}
              </p>
              <p className="text-[13px] text-muted">{MATERIALS[row.key].material} · <span className="num">{row.property}</span></p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Horizontal bars: cumulative SN at the bottom of each layer, with the required SN marked in red. */
export function SnChart({ result }: { result: DesignResult }) {
  const width = 520, left = 120, right = 92, rowHeight = 44, top = 34;
  const max = Math.max(result.requiredTotalSn, result.totalSn, ...result.layers.map((l) => l.requiredSn)) * 1.08 || 1;
  const scale = (v: number) => left + (v / max) * (width - left - right);
  const height = top + result.layers.length * rowHeight + 10;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full text-ink" role="img" style={{ fontFamily: SANS }}
      aria-label="Cumulative structural number against the requirement for each layer">
      <rect x={left} y={8} width={12} height={10} rx={2} fill="var(--chart)" />
      <text x={left + 18} y={17} fontSize={12} fill="currentColor" fillOpacity={0.75}>Cumulative SN</text>
      <line x1={left + 132} y1={6} x2={left + 132} y2={20} stroke={BAD} strokeWidth={2.5} />
      <text x={left + 140} y={17} fontSize={12} fill="currentColor" fillOpacity={0.75}>Required at layer bottom</text>
      {result.layers.map((layer, i) => {
        const y = top + i * rowHeight;
        const rx = scale(layer.requiredSn);
        return (
          <g key={layer.key}>
            <text x={left - 10} y={y + 19} fontSize={12} fill="currentColor" textAnchor="end">{layer.name}</text>
            <rect x={left} y={y + 7} width={width - left - right} height={18} rx={9} fill="currentColor" fillOpacity={0.06} />
            <rect x={left} y={y + 7} width={Math.max(0, scale(layer.cumulativeSn) - left)} height={18} rx={9}
              fill={layer.checkOk ? 'var(--chart)' : BAD} />
            <line x1={rx} y1={y + 2} x2={rx} y2={y + 30} stroke={BAD} strokeWidth={2.5} strokeLinecap="round" />
            <text x={Math.max(scale(layer.cumulativeSn), rx) + 8} y={y + 20} fontSize={11} fill="currentColor" fillOpacity={0.65}
              style={{ fontFamily: MONO }}>
              {fixed(layer.cumulativeSn)} / {fixed(layer.requiredSn)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
