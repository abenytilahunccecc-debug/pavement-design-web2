// Material textures for the pavement cross-section, drawn as seamless SVG <pattern>s.
// Shapes come from a seeded random generator, so the server and browser draw identical textures.
import type { ReactElement } from 'react';

export type MaterialKey = 'ac' | 'dbm' | 'base' | 'subbase' | 'capping' | 'subgrade';

export interface Material {
  /** Short material description shown in labels and the legend. */
  material: string;
  /** Representative colour (legend fallback, side faces). */
  color: string;
}

export const MATERIALS: Record<MaterialKey, Material> = {
  ac: { material: 'HMA wearing course', color: '#1c1c1e' },
  dbm: { material: 'DBM binder course', color: '#19191b' },
  base: { material: 'Crushed stone', color: '#8a8d92' },
  subbase: { material: 'Natural gravel', color: '#a8916f' },
  capping: { material: 'Selected fill (lateritic)', color: '#b84f1d' },
  subgrade: { material: 'Natural soil', color: '#4a3627' },
};

/** Small, fast, seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

interface Spec {
  w: number;
  h: number;
  bg: string;
  seed: number;
  /** Angular stones (crushed aggregate). */
  angular?: { count: number; r: [number, number]; colors: string[]; stroke?: string; shade?: number };
  /** Rounded / sub-angular stones (gravel, nodules). */
  rounded?: { count: number; r: [number, number]; colors: string[]; stroke?: string; squash?: [number, number]; shade?: number };
  /** Fine particles. */
  fines?: { count: number; r: [number, number]; colors: string[] };
  /** Faint horizontal compaction lines. */
  lines?: { count: number; color: string };
}

// Colours and stone sizes follow a photographed pavement core: black asphalt with light specks, dark DBM aggregate,
// grey crushed stone, orange lateritic fill with rounded nodules, and brown soil. `shade` = highlight strength:
// each stone gets a soft shadow (lower right) and a highlight (upper left), so it reads as a 3-D stone.
const SPECS: Record<MaterialKey, Spec> = {
  ac: {
    w: 56, h: 36, bg: '#1c1c1e', seed: 11,
    fines: { count: 230, r: [0.25, 0.75], colors: ['#3a3a3d', '#55555a', '#7a7a80', '#9b9ba0', '#111112', '#2a2a2d', '#c4c4c8'] },
    angular: { count: 22, r: [0.8, 1.7], colors: ['#3c3c40', '#4d4d52', '#2e2e31', '#5e5e63'], shade: 0.08 },
  },
  dbm: {
    w: 110, h: 70, bg: '#161618', seed: 23,
    fines: { count: 200, r: [0.3, 0.8], colors: ['#3a3a3e', '#4c4c51', '#0e0e0f', '#606065'] },
    angular: { count: 240, r: [1.8, 4.6], colors: ['#2b2b2e', '#36363a', '#222225', '#414146', '#2f2f33', '#4a4a4f'], stroke: '#0b0b0c', shade: 0.07 },
  },
  base: {
    w: 140, h: 90, bg: '#7f8287', seed: 37,
    fines: { count: 240, r: [0.35, 0.8], colors: ['#6d7075', '#c4c7cb', '#5e6166', '#9a9da2'] },
    angular: { count: 230, r: [2.6, 6.2], colors: ['#a7aab0', '#8f9298', '#bfc2c7', '#7a7d83', '#9c9fa5', '#b3b6bb', '#6f7278'], stroke: '#4d5055', shade: 0.12 },
  },
  subbase: {
    w: 128, h: 84, bg: '#a08967', seed: 53,
    fines: { count: 280, r: [0.3, 0.75], colors: ['#8f7a59', '#c2ad8c', '#7a6648', '#b49e7c'] },
    rounded: { count: 170, r: [1.6, 5], colors: ['#b9a383', '#9a845f', '#c8b392', '#8a7553', '#ae9877', '#d2bf9f'], stroke: '#6a5940', squash: [0.6, 0.95], shade: 0.1 },
  },
  capping: {
    w: 120, h: 80, bg: '#b24c1c', seed: 71,
    fines: { count: 260, r: [0.3, 0.9], colors: ['#cf6a33', '#9e4119', '#e3955f', '#8a3512', '#c25a26'] },
    rounded: { count: 80, r: [1.2, 7], colors: ['#c9632b', '#a5451a', '#d97a45', '#8c3913', '#c0582a', '#e08d5a'], stroke: '#73300f', squash: [0.7, 1], shade: 0.1 },
  },
  subgrade: {
    w: 80, h: 54, bg: '#4a3627', seed: 89,
    fines: { count: 170, r: [0.35, 1.1], colors: ['#5e4533', '#3b2a1d', '#6c513d', '#2f2116', '#55402f'] },
    rounded: { count: 14, r: [1, 3], colors: ['#6f5845', '#5a4433', '#7d6550'], squash: [0.6, 0.9], shade: 0.07 },
  },
};

/** Draws `shape(dx, dy)` once per tile copy it overlaps, so shapes cut by an edge reappear on the opposite edge. */
function wrapped(x: number, y: number, r: number, w: number, h: number, shape: (dx: number, dy: number, k: string) => ReactElement) {
  const out: ReactElement[] = [];
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      if (x + dx + r > 0 && x + dx - r < w && y + dy + r > 0 && y + dy - r < h) out.push(shape(dx, dy, `${dx}:${dy}`));
    }
  }
  return out;
}

function tileContent(spec: Spec): ReactElement[] {
  const rand = rng(spec.seed);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const between = ([a, b]: [number, number]) => a + rand() * (b - a);
  const out: ReactElement[] = [<rect key="bg" width={spec.w} height={spec.h} fill={spec.bg} />];

  if (spec.lines) {
    for (let i = 0; i < spec.lines.count; i++) {
      const y = r2(((i + 0.5) / spec.lines.count) * spec.h + (rand() - 0.5) * 4);
      out.push(<line key={`l${i}`} x1={0} x2={spec.w} y1={y} y2={y} stroke={spec.lines.color} strokeWidth={0.5} opacity={0.35} />);
    }
  }

  if (spec.fines) {
    const f = spec.fines;
    for (let i = 0; i < f.count; i++) {
      const x = rand() * spec.w, y = rand() * spec.h, r = between(f.r), fill = pick(f.colors);
      out.push(...wrapped(x, y, r, spec.w, spec.h, (dx, dy, k) =>
        <circle key={`f${i}${k}`} cx={r2(x + dx)} cy={r2(y + dy)} r={r2(r)} fill={fill} />));
    }
  }

  if (spec.rounded) {
    const s = spec.rounded;
    for (let i = 0; i < s.count; i++) {
      const x = rand() * spec.w, y = rand() * spec.h, rx = between(s.r);
      const ry = rx * (s.squash ? between(s.squash) : 1), angle = Math.round(rand() * 180), fill = pick(s.colors);
      out.push(...wrapped(x, y, rx * 1.3, spec.w, spec.h, (dx, dy, k) => {
        const cx = r2(x + dx), cy = r2(y + dy);
        return (
          <g key={`e${i}${k}`}>
            {s.shade && <ellipse cx={r2(cx + rx * 0.22)} cy={r2(cy + ry * 0.3)} rx={r2(rx)} ry={r2(ry)} fill="#000" fillOpacity={0.32}
              transform={`rotate(${angle} ${r2(cx + rx * 0.22)} ${r2(cy + ry * 0.3)})`} />}
            <ellipse cx={cx} cy={cy} rx={r2(rx)} ry={r2(ry)} fill={fill} transform={`rotate(${angle} ${cx} ${cy})`}
              stroke={s.stroke} strokeWidth={s.stroke ? 0.45 : undefined} strokeOpacity={0.7} />
            {s.shade && <ellipse cx={r2(cx - rx * 0.22)} cy={r2(cy - ry * 0.25)} rx={r2(rx * 0.5)} ry={r2(ry * 0.45)} fill="#fff"
              fillOpacity={s.shade} transform={`rotate(${angle} ${r2(cx - rx * 0.22)} ${r2(cy - ry * 0.25)})`} />}
          </g>
        );
      }));
    }
  }

  if (spec.angular) {
    const s = spec.angular;
    for (let i = 0; i < s.count; i++) {
      const x = rand() * spec.w, y = rand() * spec.h, r = between(s.r), fill = pick(s.colors);
      const sides = 4 + Math.floor(rand() * 3), start = rand() * Math.PI * 2;
      const offsets = Array.from({ length: sides }, (_, j) => {
        const a = start + (j / sides) * Math.PI * 2 + (rand() - 0.5) * 0.6, rr = r * (0.6 + rand() * 0.4);
        return [Math.cos(a) * rr, Math.sin(a) * rr * 0.8];
      });
      const pts = (ox: number, oy: number, k = 1) => offsets.map(([px, py]) => `${r2(ox + px * k)},${r2(oy + py * k)}`).join(' ');
      out.push(...wrapped(x, y, r * 1.3, spec.w, spec.h, (dx, dy, k) => (
        <g key={`p${i}${k}`}>
          {s.shade && <polygon fill="#000" fillOpacity={0.35} points={pts(x + dx + r * 0.22, y + dy + r * 0.3)} />}
          <polygon fill={fill} stroke={s.stroke} strokeWidth={s.stroke ? 0.5 : undefined} strokeOpacity={0.65}
            strokeLinejoin="round" points={pts(x + dx, y + dy)} />
          {s.shade && <polygon fill="#fff" fillOpacity={s.shade} points={pts(x + dx - r * 0.18, y + dy - r * 0.2, 0.5)} />}
        </g>
      )));
    }
  }
  return out;
}

// Built once per module load: identical on server and client.
const TILES = Object.fromEntries(
  (Object.keys(SPECS) as MaterialKey[]).map((key) => [key, tileContent(SPECS[key])]),
) as Record<MaterialKey, ReactElement[]>;

/** Pattern ids must be unique per drawing (several drawings can be on one page). */
export const patternId = (prefix: string, key: MaterialKey) => `${prefix}-tex-${key}`;

/** <defs> with one pattern per material, plus shading gradients used by the cross-section. */
export function PavementDefs({ prefix, scale = 1 }: { prefix: string; scale?: number }) {
  return (
    <defs>
      {(Object.keys(SPECS) as MaterialKey[]).map((key) => (
        <pattern key={key} id={patternId(prefix, key)} patternUnits="userSpaceOnUse"
          width={SPECS[key].w * scale} height={SPECS[key].h * scale}>
          <g transform={scale === 1 ? undefined : `scale(${scale})`}>{TILES[key]}</g>
        </pattern>
      ))}
      {/* Smoother, slightly lit top of the asphalt. */}
      <linearGradient id={`${prefix}-sheen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.04" />
      </linearGradient>
      {/* Soft ground shadow under the block. */}
      <filter id={`${prefix}-blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      {/* Subgrade fades out toward the bottom. */}
      <linearGradient id={`${prefix}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="1" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={`${prefix}-fade-mask`} maskContentUnits="objectBoundingBox">
        <rect width="1" height="1" fill={`url(#${prefix}-fade)`} />
      </mask>
    </defs>
  );
}
