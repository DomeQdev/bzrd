/**
 * Polish horizontal-marking pictograms (strzałki kierunkowe P-8, naprowadzające P-9), defined once in METERS
 * and used both for lane glyphs (canvas) and for the symbol library (SVG).
 *
 * Frame: x = lateral (+ = right of travel), y = longitudinal (+ = direction of travel). Tail at y = 0.
 * Proportions follow the Polish pattern: long (5 m) slender arrows, narrow shaft, elongated head,
 * turn arrows bend with a smooth curve and point sideways (slightly forward).
 */
import type { Vec2 } from '../model/types';

export type PictoId = 'p8a' | 'p8b' | 'p8c' | 'p8d' | 'p8e' | 'p8f' | 'p8g' | 'p8h' | 'p9a' | 'p9b';

type Prim = { kind: 'fill'; pts: Vec2[] } | { kind: 'stroke'; pts: Vec2[]; w: number };

const SHAFT_W = 0.18;      // szerokość trzonu
const HEAD_LEN = 1.7;      // grot strzałki na wprost
const HEAD_HW = 0.3;       // połowa szerokości grotu na wprost
const TURN_HEAD_LEN = 0.95;
const TURN_HEAD_HW = 0.28;
const L = 5.0;             // długość strzałki (teren zabudowany)

function head(E: Vec2, d: Vec2, len: number, hw: number): Prim {
  const n = { x: -d.y, y: d.x };
  return { kind: 'fill', pts: [{ x: E.x + d.x * len, y: E.y + d.y * len }, { x: E.x + n.x * hw, y: E.y + n.y * hw }, { x: E.x - n.x * hw, y: E.y - n.y * hw }] };
}
function quad(p0: Vec2, c: Vec2, p2: Vec2, steps = 14): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, m = 1 - t;
    out.push({ x: m * m * p0.x + 2 * m * t * c.x + t * t * p2.x, y: m * m * p0.y + 2 * m * t * c.y + t * t * p2.y });
  }
  return out;
}
const unit = (v: Vec2): Vec2 => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };

/** straight arrow: shaft + long head */
function straight(): Prim[] {
  const yHead = L - HEAD_LEN;
  return [{ kind: 'stroke', pts: [{ x: 0, y: 0 }, { x: 0, y: yHead + 0.02 }], w: SHAFT_W }, head({ x: 0, y: yHead }, { x: 0, y: 1 }, HEAD_LEN, HEAD_HW)];
}
/** turn branch leaving the shaft at y0, bending to `side` (-1 left, +1 right) */
function branch(side: -1 | 1, y0: number): Prim[] {
  const P0 = { x: 0, y: y0 }, C = { x: 0, y: y0 + 0.7 }, P2 = { x: side * 0.6, y: y0 + 0.92 };
  const d = unit({ x: P2.x - C.x, y: P2.y - C.y });
  return [{ kind: 'stroke', pts: quad(P0, C, P2), w: SHAFT_W }, head(P2, d, TURN_HEAD_LEN, TURN_HEAD_HW)];
}
function turn(side: -1 | 1): Prim[] {
  const y0 = L - 1.45;
  return [{ kind: 'stroke', pts: [{ x: 0, y: 0 }, { x: 0, y: y0 + 0.01 }], w: SHAFT_W }, ...branch(side, y0)];
}
/** U-turn to the left (right-hand traffic): up the shaft, half circle over the top, back down with the head */
function uturn(): Prim[] {
  const yTop = 3.4, r = 0.6, cx = -r;
  const arc: Vec2[] = [];
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; arc.push({ x: cx + r * Math.cos(a), y: yTop + r * Math.sin(a) }); }
  const yEnd = 2.55;
  return [
    { kind: 'stroke', pts: [{ x: 0, y: 0 }, { x: 0, y: yTop }, ...arc.slice(1), { x: cx - r, y: yEnd }], w: SHAFT_W },
    head({ x: cx - r, y: yEnd }, { x: 0, y: -1 }, TURN_HEAD_LEN, TURN_HEAD_HW),
  ];
}
/** P-9: arrow that drifts to `side` (lane ends / zmiana pasa) */
function merge(side: -1 | 1): Prim[] {
  const P0 = { x: 0, y: 1.4 }, C = { x: 0, y: 2.7 }, P2 = { x: side * 0.85, y: 3.55 };
  const d = unit({ x: P2.x - C.x, y: P2.y - C.y });
  return [{ kind: 'stroke', pts: [{ x: 0, y: 0 }, ...quad(P0, C, P2)], w: SHAFT_W }, head(P2, d, 1.25, 0.32)];
}

const DEFS: Record<PictoId, () => Prim[]> = {
  p8a: () => straight(),
  p8b: () => turn(-1),
  p8c: () => turn(1),
  p8d: () => [...straight(), ...branch(-1, 1.7)],
  p8e: () => [...straight(), ...branch(1, 1.7)],
  p8f: () => [{ kind: 'stroke', pts: [{ x: 0, y: 0 }, { x: 0, y: L - 1.44 }], w: SHAFT_W }, ...branch(-1, L - 1.45), ...branch(1, L - 1.45)],
  p8g: () => uturn(),
  p8h: () => [...straight(), ...branch(-1, 1.7), ...branch(1, 1.7)],
  p9a: () => merge(-1),
  p9b: () => merge(1),
};

const cache = new Map<PictoId, { prims: Prim[]; x0: number; x1: number; y0: number; y1: number }>();
function get(id: PictoId) {
  let c = cache.get(id);
  if (!c) {
    const prims = DEFS[id]();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of prims) {
      const pad = p.kind === 'stroke' ? p.w / 2 : 0;
      for (const v of p.pts) { x0 = Math.min(x0, v.x - pad); x1 = Math.max(x1, v.x + pad); y0 = Math.min(y0, v.y - pad); y1 = Math.max(y1, v.y + pad); }
    }
    c = { prims, x0, x1, y0, y1 };
    cache.set(id, c);
  }
  return c;
}

/** Real-world size of a pictogram (meters): lateral width × length. */
export function pictogramSize(id: PictoId): { w: number; h: number } {
  const c = get(id);
  return { w: c.x1 - c.x0, h: c.y1 - c.y0 };
}

/**
 * Draw a pictogram CENTRED (by its bounding box) at the current origin, in a frame where
 * +x = direction of travel and +y = right of travel (i.e. after ctx.rotate(heading)).
 * `length` = target length along travel (m); `fitWidth` = max lateral width (m) — scaled down to fit.
 */
export function drawPictogram(ctx: CanvasRenderingContext2D, id: PictoId, opts: { length?: number; fitWidth?: number; color?: string } = {}) {
  const c = get(id);
  const w = c.x1 - c.x0, h = c.y1 - c.y0;
  let k = (opts.length ?? h) / h;
  if (opts.fitWidth !== undefined && w * k > opts.fitWidth) k = Math.max(0.05, opts.fitWidth / w);
  const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
  const T = (v: Vec2) => ({ X: (v.y - cy) * k, Y: (v.x - cx) * k });
  ctx.save();
  ctx.fillStyle = opts.color ?? '#f4f4f4';
  ctx.strokeStyle = opts.color ?? '#f4f4f4';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  for (const p of c.prims) {
    ctx.beginPath();
    p.pts.forEach((v, i) => { const q = T(v); if (i === 0) ctx.moveTo(q.X, q.Y); else ctx.lineTo(q.X, q.Y); });
    if (p.kind === 'fill') { ctx.closePath(); ctx.fill(); }
    else { ctx.lineWidth = p.w * k; ctx.stroke(); }
  }
  ctx.restore();
}

/** Standalone SVG (forward = up) for the symbol library; colour token {{color}}. */
export function pictogramSvg(id: PictoId): string {
  const c = get(id);
  const S = 100; // px per meter in the viewBox
  const W = (c.x1 - c.x0) * S, H = (c.y1 - c.y0) * S;
  const P = (v: Vec2) => `${((v.x - c.x0) * S).toFixed(1)},${((c.y1 - v.y) * S).toFixed(1)}`;
  const body = c.prims.map((p) => p.kind === 'fill'
    ? `<polygon points="${p.pts.map(P).join(' ')}" fill="{{color}}"/>`
    : `<polyline points="${p.pts.map(P).join(' ')}" fill="none" stroke="{{color}}" stroke-width="${(p.w * S).toFixed(1)}" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">${body}</svg>`;
}
