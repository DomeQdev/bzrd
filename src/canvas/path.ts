/** Bezier path geometry: flattening, arc-length sampling, offsets, hit-testing, splitting. */
import type { PathData, PathNode, Vec2 } from '../model/types';

export interface Sample {
  x: number; y: number;
  /** unit tangent */
  tx: number; ty: number;
  /** unit normal (left side = -90° from tangent in screen coords → points to the "left" of travel) */
  nx: number; ny: number;
  /** arc length from path start */
  s: number;
  /** segment index + t (for splitting / node insertion) */
  seg: number; t: number;
}

export interface Flat {
  pts: Sample[];
  length: number;
  closed: boolean;
}

function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}
function cubicTangent(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  const x = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  return { x, y };
}

export function segmentCount(p: PathData) {
  return p.closed ? p.nodes.length : Math.max(0, p.nodes.length - 1);
}

export function segmentControl(p: PathData, i: number): [Vec2, Vec2, Vec2, Vec2] {
  const a = p.nodes[i];
  const b = p.nodes[(i + 1) % p.nodes.length];
  const c1 = a.hOut ?? { x: a.x, y: a.y };
  const c2 = b.hIn ?? { x: b.x, y: b.y };
  return [{ x: a.x, y: a.y }, c1, c2, { x: b.x, y: b.y }];
}

function isStraight(c: [Vec2, Vec2, Vec2, Vec2]) {
  return c[0].x === c[1].x && c[0].y === c[1].y && c[2].x === c[3].x && c[2].y === c[3].y;
}

/** Flatten with ~`step` meters between samples (adaptive per segment). */
export function flatten(p: PathData, step = 0.5): Flat {
  const pts: Sample[] = [];
  const n = segmentCount(p);
  if (p.nodes.length === 0) return { pts, length: 0, closed: p.closed };
  if (n === 0) {
    const a = p.nodes[0];
    pts.push({ x: a.x, y: a.y, tx: 1, ty: 0, nx: 0, ny: -1, s: 0, seg: 0, t: 0 });
    return { pts, length: 0, closed: false };
  }
  let s = 0;
  let prev: Vec2 | null = null;
  for (let i = 0; i < n; i++) {
    const c = segmentControl(p, i);
    const straight = isStraight(c);
    const approxLen = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) + Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y) + Math.hypot(c[3].x - c[2].x, c[3].y - c[2].y);
    const divs = straight ? 1 : Math.max(4, Math.min(200, Math.ceil(approxLen / step)));
    for (let k = 0; k <= divs; k++) {
      if (k === 0 && i > 0) continue; // shared point with previous segment
      const t = k / divs;
      const pt = straight ? { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t } : cubic(c[0], c[1], c[2], c[3], t);
      let tg = straight ? { x: c[3].x - c[0].x, y: c[3].y - c[0].y } : cubicTangent(c[0], c[1], c[2], c[3], t);
      let tl = Math.hypot(tg.x, tg.y);
      if (tl < 1e-9) {
        // degenerate tangent (coincident handles): use chord direction
        tg = { x: c[3].x - c[0].x, y: c[3].y - c[0].y };
        tl = Math.hypot(tg.x, tg.y) || 1;
      }
      if (prev) s += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
      pts.push({ x: pt.x, y: pt.y, tx: tg.x / tl, ty: tg.y / tl, nx: tg.y / tl, ny: -tg.x / tl, s, seg: i, t });
    }
  }
  // smooth normals at interior vertices so offsets don't gap at corners
  return { pts, length: s, closed: p.closed };
}

/** Sample at arc length s (clamped). */
export function sampleAt(f: Flat, s: number): Sample {
  const pts = f.pts;
  if (pts.length === 0) return { x: 0, y: 0, tx: 1, ty: 0, nx: 0, ny: -1, s: 0, seg: 0, t: 0 };
  if (s <= 0) return pts[0];
  if (s >= f.length) return pts[pts.length - 1];
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s <= s) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const span = b.s - a.s || 1;
  const u = (s - a.s) / span;
  const tx = a.tx + (b.tx - a.tx) * u, ty = a.ty + (b.ty - a.ty) * u;
  const tl = Math.hypot(tx, ty) || 1;
  // `a` may be the END sample of the previous bezier segment; it is then t=0 of b's segment
  const ta = a.seg === b.seg ? a.t : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: tx / tl, ty: ty / tl, nx: ty / tl, ny: -tx / tl, s, seg: b.seg, t: ta + (b.t - ta) * u };
}

const MITER_MIN_COS = 0.25; // miter limit: offsets grow at most 4x on very sharp corners

/** Left normal of a unit direction (same convention as Sample.nx/ny). */
function leftNormal(d: Vec2): Vec2 { return { x: d.y, y: -d.x }; }

/** Miter normal + length factor at a vertex from its incoming/outgoing unit directions. */
function miter(din: Vec2 | null, dout: Vec2 | null, fallback: Vec2): { nx: number; ny: number; scale: number } {
  if (din && dout) {
    const a = leftNormal(din), b = leftNormal(dout);
    const bx = a.x + b.x, by = a.y + b.y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) return { nx: a.x, ny: a.y, scale: 1 }; // 180° hairpin: no sensible miter
    const nx = bx / bl, ny = by / bl;
    const cosHalf = Math.max(MITER_MIN_COS, nx * a.x + ny * a.y);
    return { nx, ny, scale: 1 / cosHalf };
  }
  const d = din ?? dout;
  if (d) { const m = leftNormal(d); return { nx: m.x, ny: m.y, scale: 1 }; }
  return { nx: fallback.x, ny: fallback.y, scale: 1 };
}

/**
 * Offset polyline. Directions are taken from the sample POSITIONS (incoming = previous distinct point → this,
 * outgoing = this → next distinct point), so straight segments with sharp joins get a proper miter.
 * Convention: normal points to the LEFT of travel; a lane at cross-section position y (+y = right)
 * sits at -y along the normal.
 */
export function offsetPolyline(f: Flat, offAt: (s: number) => number): Vec2[] {
  const pts = f.pts;
  const n = pts.length;
  const out: Vec2[] = [];
  if (n === 0) return out;
  const distinct = (i: number, step: 1 | -1): Vec2 | null => {
    let j = i;
    for (let k = 0; k < n; k++) {
      j += step;
      if (j < 0 || j >= n) {
        if (!f.closed) return null;
        j = (j + n) % n;
      }
      if (j === i) return null;
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const l = Math.hypot(dx, dy);
      if (l > 1e-7) return step === 1 ? { x: dx / l, y: dy / l } : { x: -dx / l, y: -dy / l };
    }
    return null;
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = miter(distinct(i, -1), distinct(i, 1), { x: p.nx, y: p.ny });
    const d = -offAt(p.s) * m.scale;
    out.push({ x: p.x + m.nx * d, y: p.y + m.ny * d });
  }
  return out;
}

/** Polygon between two cross-section offsets (a < b, in lane coordinates where +y is right). */
export function bandPolygon(f: Flat, aAt: (s: number) => number, bAt: (s: number) => number): Vec2[] {
  const left = offsetPolyline(f, aAt);
  const right = offsetPolyline(f, bAt);
  return [...left, ...right.reverse()];
}

export function polygonBounds(pts: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Nearest point on the flattened path to q. */
export function nearestOnPath(f: Flat, q: Vec2): { dist: number; s: number; seg: number; t: number; x: number; y: number } {
  const pts = f.pts;
  let best = { dist: Infinity, s: 0, seg: 0, t: 0, x: 0, y: 0 };
  const segs = f.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let u = l2 > 0 ? ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2 : 0;
    u = Math.max(0, Math.min(1, u));
    const x = a.x + dx * u, y = a.y + dy * u;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < best.dist) {
      const bs = f.closed && i === pts.length - 1 ? f.length : b.s;
      const ta = a.seg === b.seg ? a.t : 0; // a = end of previous segment = start of b's segment
      best = { dist: d, s: a.s + (bs - a.s) * u, seg: b.seg, t: ta + (b.t - ta) * u, x, y };
    }
  }
  return best;
}

/** Point-in-polygon (even-odd). */
export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const inter = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}

// ───────────────────────── editing operations ─────────────────────────

/** Split a cubic at t (de Casteljau). Returns the new middle node and updated handles for neighbours. */
export function splitSegment(p: PathData, seg: number, t: number): PathData {
  const nodes = p.nodes.map((n) => ({ ...n }));
  const i = seg, j = (seg + 1) % nodes.length;
  const a = nodes[i], b = nodes[j];
  const c = segmentControl(p, seg);
  if (isStraight(c)) {
    const m: PathNode = { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t, mode: 'corner' };
    nodes.splice(i + 1, 0, m);
    return { ...p, nodes };
  }
  const lerp = (u: Vec2, v: Vec2, k: number) => ({ x: u.x + (v.x - u.x) * k, y: u.y + (v.y - u.y) * k });
  const p01 = lerp(c[0], c[1], t), p12 = lerp(c[1], c[2], t), p23 = lerp(c[2], c[3], t);
  const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
  const mid = lerp(p012, p123, t);
  a.hOut = p01;
  b.hIn = p23;
  const m: PathNode = { x: mid.x, y: mid.y, hIn: p012, hOut: p123, mode: 'smooth' };
  nodes.splice(i + 1, 0, m);
  return { ...p, nodes };
}

/** Cut an open path into two at (seg, t); a closed path becomes one open path starting at the cut. */
export function cutPath(p: PathData, seg: number, t: number): PathData[] {
  const sp = splitSegment(p, seg, t);
  const k = seg + 1; // index of inserted node
  if (p.closed) {
    const nodes = [...sp.nodes.slice(k), ...sp.nodes.slice(0, k + 1)].map((n) => ({ ...n }));
    nodes[0] = { ...nodes[0], hIn: undefined };
    nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], hOut: undefined };
    return [{ nodes, closed: false }];
  }
  const first = sp.nodes.slice(0, k + 1).map((n) => ({ ...n }));
  const second = sp.nodes.slice(k).map((n) => ({ ...n }));
  first[first.length - 1] = { ...first[first.length - 1], hOut: undefined };
  second[0] = { ...second[0], hIn: undefined };
  return [{ nodes: first, closed: false }, { nodes: second, closed: false }];
}

/** Cut at an existing node index. */
export function cutAtNode(p: PathData, idx: number): PathData[] {
  if (p.closed) {
    const nodes = [...p.nodes.slice(idx), ...p.nodes.slice(0, idx + 1)].map((n) => ({ ...n }));
    nodes[0] = { ...nodes[0], hIn: undefined };
    nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], hOut: undefined };
    return [{ nodes, closed: false }];
  }
  if (idx <= 0 || idx >= p.nodes.length - 1) return [p];
  const first = p.nodes.slice(0, idx + 1).map((n) => ({ ...n }));
  const second = p.nodes.slice(idx).map((n) => ({ ...n }));
  first[first.length - 1] = { ...first[first.length - 1], hOut: undefined };
  second[0] = { ...second[0], hIn: undefined };
  return [{ nodes: first, closed: false }, { nodes: second, closed: false }];
}

export function reversePath(p: PathData): PathData {
  return { ...p, nodes: [...p.nodes].reverse().map((n) => ({ ...n, hIn: n.hOut, hOut: n.hIn })) };
}

/**
 * Approximate parallel path at lateral offset `d` (lane coords: +d = right of travel).
 * Nodes move along their miter normal; handles are translated with the node and scaled by the
 * chord ratio so curves stay roughly concentric.
 */
export function offsetPath(p: PathData, d: number): PathData {
  const N = p.nodes.length;
  const unit = (x: number, y: number): Vec2 | null => { const l = Math.hypot(x, y); return l > 1e-7 ? { x: x / l, y: y / l } : null; };
  const nodes = p.nodes.map((n, i) => {
    const hasPrev = p.closed || i > 0, hasNext = p.closed || i < N - 1;
    const prev = p.nodes[(i - 1 + N) % N], next = p.nodes[(i + 1) % N];
    const inFrom = n.hIn ?? (hasPrev ? prev.hOut ?? prev : null);
    const outTo = n.hOut ?? (hasNext ? next.hIn ?? next : null);
    const din = inFrom ? unit(n.x - inFrom.x, n.y - inFrom.y) : null;
    const dout = outTo ? unit(outTo.x - n.x, outTo.y - n.y) : null;
    const m = miter(din, dout, { x: 0, y: -1 });
    const mv = { x: -m.nx * d * m.scale, y: -m.ny * d * m.scale };
    const o: PathNode = { ...n, x: n.x + mv.x, y: n.y + mv.y };
    if (n.hIn) o.hIn = { x: n.hIn.x + mv.x, y: n.hIn.y + mv.y };
    if (n.hOut) o.hOut = { x: n.hOut.x + mv.x, y: n.hOut.y + mv.y };
    return o;
  });
  for (let i = 0; i < segmentCount(p); i++) {
    const a = p.nodes[i], b = p.nodes[(i + 1) % N];
    const A = nodes[i], B = nodes[(i + 1) % N];
    const chord0 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = Math.hypot(B.x - A.x, B.y - A.y) / chord0;
    if (A.hOut && a.hOut) A.hOut = { x: A.x + (a.hOut.x - a.x) * k, y: A.y + (a.hOut.y - a.y) * k };
    if (B.hIn && b.hIn) B.hIn = { x: B.x + (b.hIn.x - b.x) * k, y: B.y + (b.hIn.y - b.y) * k };
  }
  return { ...p, nodes };
}

/** Apply an affine transform (scale about origin then rotate) to all nodes and handles. */
export function transformPath(p: PathData, fn: (v: Vec2) => Vec2): PathData {
  return {
    ...p,
    nodes: p.nodes.map((n) => {
      const a = fn({ x: n.x, y: n.y });
      return { ...n, x: a.x, y: a.y, hIn: n.hIn ? fn(n.hIn) : undefined, hOut: n.hOut ? fn(n.hOut) : undefined };
    }),
  };
}

/** Make a node smooth: mirror hOut from hIn (or build handles from neighbours). */
export function smoothNode(p: PathData, idx: number): PathData {
  const nodes = p.nodes.map((n) => ({ ...n }));
  const n = nodes[idx];
  const prev = nodes[(idx - 1 + nodes.length) % nodes.length];
  const next = nodes[(idx + 1) % nodes.length];
  const hasPrev = p.closed || idx > 0, hasNext = p.closed || idx < nodes.length - 1;
  let dx = 0, dy = 0;
  if (hasPrev && hasNext) { dx = next.x - prev.x; dy = next.y - prev.y; }
  else if (hasNext) { dx = next.x - n.x; dy = next.y - n.y; }
  else if (hasPrev) { dx = n.x - prev.x; dy = n.y - prev.y; }
  const l = Math.hypot(dx, dy) || 1;
  const lenIn = hasPrev ? Math.hypot(n.x - prev.x, n.y - prev.y) / 3 : 0;
  const lenOut = hasNext ? Math.hypot(next.x - n.x, next.y - n.y) / 3 : 0;
  n.hIn = hasPrev ? { x: n.x - (dx / l) * lenIn, y: n.y - (dy / l) * lenIn } : undefined;
  n.hOut = hasNext ? { x: n.x + (dx / l) * lenOut, y: n.y + (dy / l) * lenOut } : undefined;
  n.mode = 'smooth';
  return { ...p, nodes };
}

export function cornerNode(p: PathData, idx: number): PathData {
  const nodes = p.nodes.map((n) => ({ ...n }));
  nodes[idx] = { ...nodes[idx], hIn: undefined, hOut: undefined, mode: 'corner' };
  return { ...p, nodes };
}

// ───────────────────────── shape constructors ─────────────────────────

const KAPPA = 0.5522847498;

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): PathData {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  return {
    closed: true,
    nodes: [
      { x: cx + rx, y: cy, hIn: { x: cx + rx, y: cy - ky }, hOut: { x: cx + rx, y: cy + ky }, mode: 'smooth' },
      { x: cx, y: cy + ry, hIn: { x: cx + kx, y: cy + ry }, hOut: { x: cx - kx, y: cy + ry }, mode: 'smooth' },
      { x: cx - rx, y: cy, hIn: { x: cx - rx, y: cy + ky }, hOut: { x: cx - rx, y: cy - ky }, mode: 'smooth' },
      { x: cx, y: cy - ry, hIn: { x: cx - kx, y: cy - ry }, hOut: { x: cx + kx, y: cy - ry }, mode: 'smooth' },
    ],
  };
}

export function rectPath(x0: number, y0: number, x1: number, y1: number): PathData {
  return { closed: true, nodes: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map((n) => ({ ...n, mode: 'corner' as const })) };
}

export function linePath(a: Vec2, b: Vec2): PathData {
  return { closed: false, nodes: [{ x: a.x, y: a.y, mode: 'corner' }, { x: b.x, y: b.y, mode: 'corner' }] };
}

export function pathCentroid(p: PathData): Vec2 {
  if (!p.nodes.length) return { x: 0, y: 0 };
  const s = p.nodes.reduce((acc, n) => ({ x: acc.x + n.x, y: acc.y + n.y }), { x: 0, y: 0 });
  return { x: s.x / p.nodes.length, y: s.y / p.nodes.length };
}

// ───────────────────────── length / rotation ─────────────────────────

export function pathLength(p: PathData): number {
  return flatten(p, 0.25).length;
}

/**
 * Shorten (trim) or extend an open path to `newLen` meters, at the end (default) or at the start.
 * Extending continues straight along the end tangent; shortening cuts the path exactly at that arc length.
 */
export function setPathLength(p: PathData, newLen: number, atStart = false): PathData {
  if (p.closed || p.nodes.length < 2) return p;
  if (atStart) return reversePath(setPathLength(reversePath(p), newLen, false));
  const f = flatten(p, 0.25);
  const L = f.length;
  const target = Math.max(0.5, newLen);
  if (Math.abs(target - L) < 1e-4) return p;
  if (target > L) {
    const end = f.pts[f.pts.length - 1];
    const d = target - L;
    const nodes = p.nodes.map((n) => ({ ...n }));
    const k = nodes.length - 1;
    const last = nodes[k];
    const prev = nodes[k - 1];
    const straight = !last.hIn && !prev.hOut;
    if (straight) {
      nodes[k] = { ...last, x: last.x + end.tx * d, y: last.y + end.ty * d, hOut: undefined };
    } else {
      nodes[k] = { ...last, hOut: undefined };
      nodes.push({ x: last.x + end.tx * d, y: last.y + end.ty * d, mode: 'corner' });
    }
    return { ...p, nodes };
  }
  const smp = sampleAt(f, target);
  if (smp.t <= 1e-4) {
    const nodes = p.nodes.slice(0, smp.seg + 1).map((n) => ({ ...n }));
    if (nodes.length < 2) return p;
    nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], hOut: undefined };
    return { ...p, nodes };
  }
  if (smp.t >= 1 - 1e-4) {
    const nodes = p.nodes.slice(0, smp.seg + 2).map((n) => ({ ...n }));
    nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], hOut: undefined };
    return { ...p, nodes };
  }
  return cutPath(p, smp.seg, smp.t)[0];
}

/** Rotate all nodes/handles about point c by `deg` degrees (clockwise in screen coords). */
export function rotatePath(p: PathData, deg: number, c: Vec2): PathData {
  const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  return transformPath(p, (v) => ({ x: c.x + (v.x - c.x) * cs - (v.y - c.y) * sn, y: c.y + (v.x - c.x) * sn + (v.y - c.y) * cs }));
}
