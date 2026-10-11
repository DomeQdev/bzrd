/**
 * Snapping (Figma-like) for BZRD.
 *  - points: path nodes, strip edge end-corners, symbol corners/centres
 *  - edges: strip edges, line paths and area outlines, as arc-length parametrised polylines
 *    → a snap remembers WHICH edge and WHERE on it (param), so drawing can follow that edge (tracing)
 *  - edge-to-edge for strips: when drawing a strip of half-width h, its centreline lands h away from the edge
 *  - box guides while dragging objects, angle constraint with Shift
 */
import type { BzObject, Vec2 } from '../model/types';
import { flatten, offsetPolyline } from './path';
import { stripLayout, objectBounds, stripOutline } from './draw';

export interface Polyline {
  pts: Vec2[];
  closed: boolean;
  /** cumulative arc length at each point */
  cum: number[];
  /** total length (incl. closing segment when closed) */
  length: number;
  objId: string;
  role: 'edge' | 'center';
}

export interface SnapPoint extends Vec2 {
  /** 'node' = path node (good for continuing a path), 'corner' = edge end / symbol corner */
  kind: 'node' | 'corner';
  poly?: Polyline;
  param?: number;
}

export interface SnapTarget {
  points: SnapPoint[];
  edges: Polyline[];
  centers: Polyline[];
  boxes: Array<{ id: string; x0: number; y0: number; x1: number; y1: number }>;
}

export function toWorld(obj: BzObject, v: Vec2): Vec2 {
  const r = (obj.rotation * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: obj.x + v.x * c - v.y * s, y: obj.y + v.x * s + v.y * c };
}

function mkPoly(pts: Vec2[], closed: boolean, objId: string, role: Polyline['role']): Polyline {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  let length = cum[cum.length - 1] ?? 0;
  if (closed && pts.length > 1) length += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  return { pts, closed, cum, length, objId, role };
}

export function buildSnapTargets(objects: BzObject[], exclude: Set<string>): SnapTarget {
  const points: SnapPoint[] = [];
  const edges: Polyline[] = [];
  const centers: Polyline[] = [];
  const boxes: SnapTarget['boxes'] = [];
  for (const o of objects) {
    if (exclude.has(o.id) || o.visible === false) continue;
    const b = objectBounds(o);
    const corners = [toWorld(o, { x: b.x, y: b.y }), toWorld(o, { x: b.x + b.w, y: b.y }), toWorld(o, { x: b.x + b.w, y: b.y + b.h }), toWorld(o, { x: b.x, y: b.y + b.h })];
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    boxes.push({ id: o.id, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    if (o.type === 'strip' || o.type === 'line') {
      for (const n of o.path.nodes) points.push({ ...toWorld(o, n), kind: 'node' });
      if (o.path.nodes.length < 2) continue;
      if (o.type === 'strip') {
        const lay = stripLayout(o, 0.5);
        const ats = [lay.top, lay.bot, ...lay.dividers.map((d) => d.at)];
        ats.forEach((at, k) => {
          const pl = mkPoly(offsetPolyline(lay.flat, at).map((p) => toWorld(o, p)), o.path.closed, o.id, 'edge');
          edges.push(pl);
          if (k < 2 && !o.path.closed && pl.pts.length > 1) {
            points.push({ ...pl.pts[0], kind: 'corner', poly: pl, param: 0 });
            points.push({ ...pl.pts[pl.pts.length - 1], kind: 'corner', poly: pl, param: pl.length });
          }
        });
        centers.push(mkPoly(lay.flat.pts.map((p) => toWorld(o, p)), o.path.closed, o.id, 'center'));
      } else {
        const f = flatten(o.path, 0.4);
        const pl = mkPoly(f.pts.map((p) => toWorld(o, p)), o.path.closed, o.id, 'edge');
        edges.push(pl);
        if (!o.path.closed && pl.pts.length > 1) {
          points.push({ ...pl.pts[0], kind: 'corner', poly: pl, param: 0 });
          points.push({ ...pl.pts[pl.pts.length - 1], kind: 'corner', poly: pl, param: pl.length });
        }
      }
    } else {
      points.push({ ...toWorld(o, { x: 0, y: 0 }), kind: 'corner' });
      for (const c of corners) points.push({ ...c, kind: 'corner' });
    }
  }
  return { points, edges, centers, boxes };
}

export interface SnapResult {
  x: number;
  y: number;
  kind: 'point' | 'edge' | 'center' | 'grid' | 'none';
  /** the polyline we snapped to (edges, centres, and corners that lie on an edge) */
  poly?: Polyline;
  /** arc-length position on `poly` */
  param?: number;
  /** for strips drawn edge-to-edge: which side of the edge the new centreline is on (+1 / -1) */
  side?: 1 | -1;
  /** cross guide when the point was aligned with the START / END of the edge (same start line as the neighbour) */
  guide?: [Vec2, Vec2];
}

interface Nearest { dist: number; x: number; y: number; tx: number; ty: number; param: number }

export function nearestOnPolyline(pl: Polyline, q: Vec2): Nearest {
  const pts = pl.pts;
  let best: Nearest = { dist: Infinity, x: 0, y: 0, tx: 1, ty: 0, param: 0 };
  const segs = pl.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) continue;
    let u = ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2;
    u = Math.max(0, Math.min(1, u));
    const x = a.x + dx * u, y = a.y + dy * u;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < best.dist) { const l = Math.sqrt(l2); best = { dist: d, x, y, tx: dx / l, ty: dy / l, param: pl.cum[i] + l * u }; }
  }
  return best;
}

/** Point + unit tangent at arc length `param` (wraps for closed polylines). */
export function pointAt(pl: Polyline, param: number): { x: number; y: number; tx: number; ty: number } {
  const pts = pl.pts;
  const n = pts.length;
  if (n === 1) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
  let s = param;
  if (pl.closed) s = ((s % pl.length) + pl.length) % pl.length;
  else s = Math.max(0, Math.min(pl.length, s));
  const segs = pl.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const s0 = pl.cum[i];
    const s1 = i + 1 < n ? pl.cum[i + 1] : pl.length;
    if (s <= s1 || i === segs - 1) {
      const l = s1 - s0 || 1;
      const u = Math.max(0, Math.min(1, (s - s0) / l));
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: (b.x - a.x) / tl, ty: (b.y - a.y) / tl };
    }
  }
  const last = pts[n - 1];
  return { x: last.x, y: last.y, tx: 1, ty: 0 };
}

/** Normal used for edge-to-edge offsets: (ty, -tx) of a tangent smoothed over ±0.4 m. */
function smoothNormal(pl: Polyline, param: number): Vec2 {
  const a = pointAt(pl, param - 0.4), b = pointAt(pl, param + 0.4);
  let tx = b.x - a.x, ty = b.y - a.y;
  const l = Math.hypot(tx, ty);
  if (l < 1e-9) { const p = pointAt(pl, param); tx = p.tx; ty = p.ty; } else { tx /= l; ty /= l; }
  return { x: ty, y: -tx };
}

/**
 * Snap a world point to targets within `tol` meters.
 * `halfWidth` > 0: the point is the CENTRELINE of a strip that wide → edges snap edge-to-edge
 * (centreline lands halfWidth away from the edge, on the side nearer to the cursor).
 */
export function snapPoint(q: Vec2, t: SnapTarget, tol: number, halfWidth = 0, gridStep?: number): SnapResult {
  let best: SnapResult = { x: q.x, y: q.y, kind: 'none' };
  let bestD = tol;
  for (const p of t.points) {
    if (halfWidth > 0 && p.kind !== 'node') continue; // a strip centre on a neighbour's corner would overlap it
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestD) { bestD = d; best = { x: p.x, y: p.y, kind: 'point', poly: halfWidth > 0 ? undefined : p.poly, param: halfWidth > 0 ? undefined : p.param }; }
  }
  if (best.kind === 'point') return best;
  // longitudinal alignment: near the start / end of an open edge → jump exactly to it ("starts where the neighbour starts")
  const alignTol = tol * 1.6;
  const alignParam = (pl: Polyline, param: number): number | null => {
    if (pl.closed) return null;
    if (param < alignTol) return 0;
    if (pl.length - param < alignTol) return pl.length;
    return null;
  };
  for (const pl of t.edges) {
    if (pl.pts.length < 2) continue;
    const n = nearestOnPolyline(pl, q);
    if (!isFinite(n.dist)) continue;
    const al = alignParam(pl, n.param);
    const prm = al ?? n.param;
    const e = al === null ? { x: n.x, y: n.y } : pointAt(pl, al);
    if (halfWidth > 0) {
      if (n.dist > halfWidth + tol * 2) continue;
      const N = smoothNormal(pl, prm);
      const Nraw = smoothNormal(pl, n.param);
      for (const sgn of [1, -1] as const) {
        // compare with the un-aligned candidate so alignment never makes the snap "lose"
        const d = Math.hypot(n.x + Nraw.x * sgn * halfWidth - q.x, n.y + Nraw.y * sgn * halfWidth - q.y);
        if (d < bestD) {
          bestD = d;
          const cx = e.x + N.x * sgn * halfWidth, cy = e.y + N.y * sgn * halfWidth;
          best = { x: cx, y: cy, kind: 'edge', poly: pl, param: prm, side: sgn,
            guide: al === null ? undefined : [{ x: e.x - N.x * sgn * 6, y: e.y - N.y * sgn * 6 }, { x: e.x + N.x * sgn * (halfWidth * 2 + 6), y: e.y + N.y * sgn * (halfWidth * 2 + 6) }] };
        }
      }
    } else if (n.dist < bestD) {
      bestD = n.dist;
      best = { x: e.x, y: e.y, kind: al === null ? 'edge' : 'point', poly: pl, param: prm };
    }
  }
  if (best.kind !== 'none') return best;
  for (const pl of t.centers) {
    const n = nearestOnPolyline(pl, q);
    if (n.dist < bestD) { bestD = n.dist; best = { x: n.x, y: n.y, kind: 'center', poly: pl, param: n.param }; }
  }
  if (best.kind !== 'none') return best;
  if (gridStep) {
    const gx = Math.round(q.x / gridStep) * gridStep, gy = Math.round(q.y / gridStep) * gridStep;
    if (Math.hypot(gx - q.x, gy - q.y) < tol) return { x: gx, y: gy, kind: 'grid' };
  }
  return best;
}

// ───────────────────────── tracing (follow an edge between two snaps) ─────────────────────────

/** Ramer–Douglas–Peucker simplification. */
function simplify(pts: Vec2[], eps: number): Vec2[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  let maxD = -1, idx = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / L;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  const left = simplify(pts.slice(0, idx + 1), eps);
  const right = simplify(pts.slice(idx), eps);
  return [...left.slice(0, -1), ...right];
}

/**
 * Points strictly BETWEEN arc positions a and b along `pl`, offset by `offset` along the edge normal,
 * simplified to ~5 cm. For closed polylines the shorter way round is used.
 */
export function traceBetween(pl: Polyline, a: number, b: number, offset = 0): Vec2[] {
  let dir = b >= a ? 1 : -1;
  let span = Math.abs(b - a);
  if (pl.closed) {
    const fwd = (((b - a) % pl.length) + pl.length) % pl.length;
    if (fwd <= pl.length - fwd) { dir = 1; span = fwd; } else { dir = -1; span = pl.length - fwd; }
  }
  if (span < 0.5) return [];
  const step = 0.5;
  const samples: Vec2[] = [];
  for (let s = 0; s <= span + 1e-6; s += step) {
    const at = a + dir * Math.min(s, span);
    const p = pointAt(pl, at);
    const N = smoothNormal(pl, at);
    samples.push({ x: p.x + N.x * offset, y: p.y + N.y * offset });
  }
  const end = pointAt(pl, a + dir * span), Ne = smoothNormal(pl, a + dir * span);
  samples.push({ x: end.x + Ne.x * offset, y: end.y + Ne.y * offset });
  const simp = simplify(samples, 0.05);
  return simp.slice(1, -1);
}

/** Can two consecutive snaps be connected by following the same edge? */
export function canTrace(a: SnapResult | null | undefined, b: SnapResult | null | undefined): boolean {
  return !!a && !!b && !!a.poly && a.poly === b.poly && a.param !== undefined && b.param !== undefined && (a.side ?? 0) === (b.side ?? 0) && a.poly.role === 'edge';
}

// ───────────────────────── misc ─────────────────────────

/** Constrain angle from `from` to multiples of 15° (Shift). */
export function snapAngle(from: Vec2, to: Vec2, stepDeg = 15): Vec2 {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const step = (stepDeg * Math.PI) / 180;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
}

export interface GuideResult {
  dx: number;
  dy: number;
  guides: Array<{ axis: 'x' | 'y'; at: number; from: number; to: number }>;
}

/** Snap a moving box to other boxes' edges/centres (Figma red guides). */
export function snapBox(box: { x0: number; y0: number; x1: number; y1: number }, targets: SnapTarget['boxes'], tol: number): GuideResult {
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const xs = [box.x0, cx, box.x1], ys = [box.y0, cy, box.y1];
  let bestDx = 0, bestDy = 0, dX = tol, dY = tol;
  let gx: GuideResult['guides'][number] | null = null, gy: GuideResult['guides'][number] | null = null;
  for (const t of targets) {
    const txs = [t.x0, (t.x0 + t.x1) / 2, t.x1], tys = [t.y0, (t.y0 + t.y1) / 2, t.y1];
    for (const a of xs) for (const b of txs) {
      const d = Math.abs(a - b);
      if (d < dX) { dX = d; bestDx = b - a; gx = { axis: 'x', at: b, from: Math.min(box.y0, t.y0), to: Math.max(box.y1, t.y1) }; }
    }
    for (const a of ys) for (const b of tys) {
      const d = Math.abs(a - b);
      if (d < dY) { dY = d; bestDy = b - a; gy = { axis: 'y', at: b, from: Math.min(box.x0, t.x0), to: Math.max(box.x1, t.x1) }; }
    }
  }
  const guides: GuideResult['guides'] = [];
  if (gx) guides.push(gx);
  if (gy) guides.push(gy);
  return { dx: bestDx, dy: bestDy, guides };
}

/**
 * Edge-to-edge snapping while dragging: find the smallest translation that puts one of the moving
 * outline samples onto a target point or edge.
 */
export function snapOutline(samples: Vec2[], t: SnapTarget, tol: number): { dx: number; dy: number; hit: Vec2 | null; poly?: Polyline } {
  let best: { dx: number; dy: number; d: number; hit: Vec2 | null; poly?: Polyline } = { dx: 0, dy: 0, d: tol, hit: null };
  for (const s of samples) {
    for (const p of t.points) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < best.d) best = { dx: p.x - s.x, dy: p.y - s.y, d, hit: p };
    }
  }
  if (best.hit) return best;
  for (const s of samples) {
    for (const pl of t.edges) {
      if (pl.pts.length < 2) continue;
      const n = nearestOnPolyline(pl, s);
      if (n.dist < best.d) best = { dx: n.x - s.x, dy: n.y - s.y, d: n.dist, hit: { x: n.x, y: n.y }, poly: pl };
    }
  }
  return best;
}

/** Outline samples (world) of an object, decimated to ~n points. */
export function outlineSamples(obj: BzObject, n = 24): Vec2[] {
  if (obj.type === 'strip') {
    if (obj.path.nodes.length < 2) return [];
    const poly = stripOutline(obj);
    const step = Math.max(1, Math.floor(poly.length / n));
    const out: Vec2[] = [];
    for (let i = 0; i < poly.length; i += step) out.push(toWorld(obj, poly[i]));
    return out;
  }
  if (obj.type === 'line') {
    const f = flatten(obj.path, 0.5);
    const step = Math.max(1, Math.floor(f.pts.length / n));
    const out: Vec2[] = [];
    for (let i = 0; i < f.pts.length; i += step) out.push(toWorld(obj, f.pts[i]));
    out.push(toWorld(obj, f.pts[f.pts.length - 1]));
    return out;
  }
  const b = objectBounds(obj);
  return [toWorld(obj, { x: b.x, y: b.y }), toWorld(obj, { x: b.x + b.w, y: b.y }), toWorld(obj, { x: b.x + b.w, y: b.y + b.h }), toWorld(obj, { x: b.x, y: b.y + b.h }), toWorld(obj, { x: b.x + b.w / 2, y: b.y + b.h / 2 })];
}
