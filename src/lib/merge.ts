/**
 * Joining pieces of the same lane / line into ONE continuous object (no cross-section transitions).
 *  - orient both pieces so that A.end → B.start (reversing a strip flips its lane direction so it looks the same),
 *  - if the ends overlap / are too close for a smooth turn, trim them back a little,
 *  - connect with a cubic bezier tangent to both ends (or concatenate if the ends already meet in line),
 *  - the result keeps A's id, name and properties.
 */
import type { Lane, LineObj, PathData, PathNode, StripObj, Vec2 } from '../model/types';
import { flatten, reversePath, setPathLength, transformPath } from '../canvas/path';
import { specWidth } from '../canvas/roadGeometry';
import { normalizeOrigin } from './factory';
import { stripLayout } from '../canvas/draw';
import { offsetPolyline } from '../canvas/path';
import { uid } from '../store/project';

export type PathObj = StripObj | LineObj;
export interface EndRef { id: string; atStart: boolean }

function worldPath(o: PathObj): PathData {
  const r = (o.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return transformPath(o.path, (v) => ({ x: o.x + v.x * c - v.y * s, y: o.y + v.x * s + v.y * c }));
}

/** Reverse a path object without changing how it looks (strips: lane direction + edge lines are flipped). */
function reverseObj<T extends PathObj>(o: T, path: PathData): { obj: T; path: PathData } {
  const rp = reversePath(path);
  if (o.type !== 'strip') return { obj: o, path: rp };
  const flip = (ls: Lane[]) => [...ls].reverse().map((l) => ({ ...l, dir: (l.dir * -1) as Lane['dir'] }));
  const spec = { ...o.spec, lanes: flip(o.spec.lanes), edgeLeft: o.spec.edgeRight, edgeRight: o.spec.edgeLeft, offset: o.spec.offset ? -o.spec.offset : o.spec.offset };
  return { obj: { ...o, spec } as T, path: rp };
}

function endInfo(p: PathData, atEnd: boolean): { pt: Vec2; t: Vec2; len: number } {
  const f = flatten(p, 0.25);
  const smp = atEnd ? f.pts[f.pts.length - 1] : f.pts[0];
  return { pt: { x: smp.x, y: smp.y }, t: { x: smp.tx, y: smp.ty }, len: f.length };
}

function widthOf(o: PathObj): number {
  return o.type === 'strip' ? specWidth(o.spec.lanes) : Math.max(1, o.width);
}

/** World position of an object's start / end node. */
export function endPoint(o: PathObj, atStart: boolean): Vec2 {
  const n = atStart ? o.path.nodes[0] : o.path.nodes[o.path.nodes.length - 1];
  return { x: o.x + n.x, y: o.y + n.y };
}

/**
 * Merge B into A: A's end `aAtStart ? start : end` is joined to B's `bAtStart ? start : end`.
 * Returns the merged object (A's id) or null if impossible.
 */
export function mergePair(a0: PathObj, aAtStart: boolean, b0: PathObj, bAtStart: boolean): PathObj | null {
  if (a0.type !== b0.type || a0.path.closed || b0.path.closed || a0.path.nodes.length < 2 || b0.path.nodes.length < 2) return null;
  let a = a0, pa = worldPath(a0);
  let b = b0, pb = worldPath(b0);
  if (aAtStart) ({ obj: a, path: pa } = reverseObj(a, pa));
  if (!bAtStart) ({ obj: b, path: pb } = reverseObj(b, pb));

  const W = widthOf(a);
  let e = endInfo(pa, true), s = endInfo(pb, false);
  const D0 = Math.hypot(s.pt.x - e.pt.x, s.pt.y - e.pt.y);
  const cosTurn = e.t.x * s.t.x + e.t.y * s.t.y;

  // ends already meet in line → plain concatenation
  if (D0 < 0.05 && cosTurn > 0.995) {
    const nodes: PathNode[] = [...pa.nodes.slice(0, -1), { ...pa.nodes[pa.nodes.length - 1], hOut: pb.nodes[0].hOut }, ...pb.nodes.slice(1)];
    return normalizeOrigin({ ...a, x: 0, y: 0, rotation: 0, path: { closed: false, nodes } } as PathObj);
  }

  // room for a smooth connection: at least ~2 widths, more for sharp turns; trim overlapping ends back
  const along = (s.pt.x - e.pt.x) * e.t.x + (s.pt.y - e.pt.y) * e.t.y;
  const turn = Math.acos(Math.max(-1, Math.min(1, cosTurn)));
  const want = Math.max(4, W * (2 + 2 * turn / Math.PI));
  // not for U-turns: those keep their full length and get a wide loop instead
  if (along < want && cosTurn > -0.2) {
    const extra = want - along;
    const tA = Math.min(extra / 2, Math.max(0, e.len - 1));
    const tB = Math.min(extra - tA, Math.max(0, s.len - 1));
    if (tA > 0.01) pa = setPathLength(pa, e.len - tA);
    if (tB > 0.01) pb = setPathLength(pb, s.len - tB, true);
    e = endInfo(pa, true);
    s = endInfo(pb, false);
  }
  const D = Math.hypot(s.pt.x - e.pt.x, s.pt.y - e.pt.y);
  // handle length: D/3 for a straight-ish link, ~2/3·D for a U-turn (≈ semicircle)
  const h = Math.max(0.5, D * (1 / 3 + (0.33 * turn) / Math.PI));
  const lastA = pa.nodes[pa.nodes.length - 1];
  const firstB = pb.nodes[0];
  const nodes: PathNode[] = [
    ...pa.nodes.slice(0, -1),
    { ...lastA, hOut: { x: e.pt.x + e.t.x * h, y: e.pt.y + e.t.y * h }, mode: lastA.hIn ? 'smooth' : 'corner' },
    { ...firstB, hIn: { x: s.pt.x - s.t.x * h, y: s.pt.y - s.t.y * h }, mode: firstB.hOut ? 'smooth' : 'corner' },
    ...pb.nodes.slice(1),
  ];
  return normalizeOrigin({ ...a, x: 0, y: 0, rotation: 0, path: { closed: false, nodes } } as PathObj);
}

/** Close a single open piece into a loop with a smooth connection between its two ends. */
export function closeLoop(o: PathObj): PathObj | null {
  if (o.path.closed || o.path.nodes.length < 2) return null;
  const p = worldPath(o);
  const e = endInfo(p, true), s = endInfo(p, false);
  const D = Math.hypot(s.pt.x - e.pt.x, s.pt.y - e.pt.y);
  const h = Math.max(0.5, D / 3);
  const nodes = p.nodes.map((n) => ({ ...n }));
  const k = nodes.length - 1;
  nodes[k] = { ...nodes[k], hOut: { x: e.pt.x + e.t.x * h, y: e.pt.y + e.t.y * h } };
  nodes[0] = { ...nodes[0], hIn: { x: s.pt.x - s.t.x * h, y: s.pt.y - s.t.y * h } };
  return normalizeOrigin({ ...o, x: 0, y: 0, rotation: 0, path: { closed: true, nodes } } as PathObj);
}

/** Merge several pieces into one, always joining the closest pair of free ends (greedy chain). */
export function mergeChain(objs: PathObj[]): { merged: PathObj; removed: string[] } | null {
  const pieces = objs.filter((o) => !o.path.closed && o.path.nodes.length >= 2);
  if (pieces.length < 2 || !pieces.every((o) => o.type === pieces[0].type)) return null;
  let cur: PathObj = pieces[0];
  const rest = pieces.slice(1);
  const removed: string[] = [];
  while (rest.length) {
    let best: { i: number; aStart: boolean; bStart: boolean; d: number } | null = null;
    rest.forEach((r, i) => {
      for (const aStart of [false, true]) for (const bStart of [true, false]) {
        const pa = endPoint(cur, aStart), pb = endPoint(r, bStart);
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (!best || d < best.d) best = { i, aStart, bStart, d };
      }
    });
    const pick = best as { i: number; aStart: boolean; bStart: boolean; d: number } | null;
    if (!pick) break;
    const next = mergePair(cur, pick.aStart, rest[pick.i], pick.bStart);
    if (!next) break;
    removed.push(rest[pick.i].id);
    rest.splice(pick.i, 1);
    cur = next;
  }
  return removed.length ? { merged: cur, removed } : null;
}

// ───────────────────────── włączenie w bok innego pasa (klin) ─────────────────────────


function nearestOn(pts: Vec2[], q: Vec2): { x: number; y: number; tx: number; ty: number; dist: number } {
  let best = { x: 0, y: 0, tx: 1, ty: 0, dist: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (l2 === 0) continue;
    const u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
    const x = a.x + dx * u, y = a.y + dy * u, d = Math.hypot(q.x - x, q.y - y);
    if (d < best.dist) { const l = Math.sqrt(l2); best = { x, y, tx: dx / l, ty: dy / l, dist: d }; }
  }
  return best;
}

/**
 * Lane A ends by merging into the SIDE of strip B (klin włączenia): returns a tapering piece that starts at A's end
 * with A's full width, keeps its B-facing edge flowing onto B's edge and narrows to zero at the point on B's edge
 * nearest to `at` (the click). The piece is a strip with lanesEnd width 0, anchored on the B side.
 */
export function taperInto(a0: StripObj, aAtStart: boolean, b: StripObj, at: Vec2): StripObj | null {
  if (a0.path.closed || a0.path.nodes.length < 2 || b.path.nodes.length < 2) return null;
  let a = a0, pa = worldPath(a0);
  if (aAtStart) ({ obj: a, path: pa } = reverseObj(a, pa));
  const wA = specWidth(a.spec.lanes);
  const e = endInfo(pa, true);
  const nL = { x: e.t.y, y: -e.t.x }; // left normal (same convention as the renderer)

  // B's two outer edges in world coordinates
  const lay = stripLayout(b, 0.5);
  const toW = (p: Vec2) => ({ x: b.x + p.x, y: b.y + p.y });
  const edges = [offsetPolyline(lay.flat, lay.top).map(toW), offsetPolyline(lay.flat, lay.bot).map(toW)];
  const near = edges.map((pl) => nearestOn(pl, e.pt));
  const k = near[0].dist <= near[1].dist ? 0 : 1;
  const edge = edges[k];

  // which side of A faces B → that edge of A stays on B's edge, the other one converges
  const q = near[k];
  const innerLeft = (q.x - e.pt.x) * nL.x + (q.y - e.pt.y) * nL.y > 0;
  const sgn = innerLeft ? 1 : -1;
  const P0 = { x: e.pt.x + nL.x * sgn * (wA / 2), y: e.pt.y + nL.y * sgn * (wA / 2) };

  // end of the taper: point on B's edge nearest to the click (or ~10 m per m of width ahead if clicked too close)
  let M = nearestOn(edge, at);
  let tB = { x: M.tx, y: M.ty };
  if (tB.x * e.t.x + tB.y * e.t.y < 0) tB = { x: -tB.x, y: -tB.y };
  const ahead = (M.x - P0.x) * e.t.x + (M.y - P0.y) * e.t.y;
  if (ahead < 3) {
    const want = Math.max(10, 8 * wA);
    M = nearestOn(edge, { x: P0.x + e.t.x * want, y: P0.y + e.t.y * want });
    tB = { x: M.tx, y: M.ty };
    if (tB.x * e.t.x + tB.y * e.t.y < 0) tB = { x: -tB.x, y: -tB.y };
  }
  const D = Math.hypot(M.x - P0.x, M.y - P0.y);
  if (D < 1) return null;
  const h = D / 3;
  const path: PathData = {
    closed: false,
    nodes: [
      { x: P0.x, y: P0.y, hOut: { x: P0.x + e.t.x * h, y: P0.y + e.t.y * h }, mode: 'smooth' },
      { x: M.x, y: M.y, hIn: { x: M.x - tB.x * h, y: M.y - tB.y * h }, mode: 'smooth' },
    ],
  };
  const lanes: Lane[] = a.spec.lanes.length === 1 ? [{ ...a.spec.lanes[0], width: wA }] : [{ ...a.spec.lanes[0], width: wA }];
  const piece: StripObj = {
    id: uid('s'), type: 'strip', x: 0, y: 0, rotation: 0, name: 'Klin (włączenie)', path,
    spec: {
      lanes,
      lanesEnd: [{ ...lanes[0], width: 0 }],
      anchor: innerLeft ? 'left' : 'right',
      offset: innerLeft ? wA / 2 : -wA / 2,
      edgeLeft: a.spec.edgeLeft, edgeRight: a.spec.edgeRight,
    },
  };
  return normalizeOrigin(piece);
}
