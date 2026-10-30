/**
 * Pure Canvas-2D drawing of BZRD objects in LOCAL METER coordinates.
 * Used by the Konva scene (Shape.sceneFunc), library previews and export.
 *
 * V2 draws the board in PASSES by category (rank), not in a single z-order:
 *   0 nawierzchnie (asfalt / chodnik / trawnik / krawężnik)   drawSurface
 *   1 pasy (powierzchnia pasów + zaokrąglone styki)             drawSurface
 *   2 tło przejść (czerwona nawierzchnia P-11, …)               drawSurface
 *   3 torowiska (podsypka, podkłady, płyty przejazdu na jezdni) drawTramBand
 *   4 oznakowanie (linie, strzałki, napisy, zebra, szrafura)    drawMarkings
 *   5 szyny                                                      drawRails
 *   6 symbole (pojazdy, ludzie, znaki pionowe, zieleń)          Konva <Image>
 */
import type { BzObject, Lane, LaneMarking, LineObj, LineSpec, RoadSpec, StripObj, TextObj, Vec2 } from '../model/types';
import { ASPHALT, CONCRETE, CURB, CURB_KINDS, GRASS, RAIL, ROADWAY_KINDS, SLEEPER, TRAM_SLAB, WHITE, laneFill, mergeLanes, autoDividers, specWidth } from './roadGeometry';
import { bandPolygon, flatten, offsetPolyline, polygonBounds, sampleAt, type Flat } from './path';
import { drawPictogram, type PictoId } from './pictograms';
import { laneMarkingOf } from '../catalog/helpers';
import { symbolById } from '../assets/symbols';

type Ctx = CanvasRenderingContext2D;

// ───────────────────────── categories ─────────────────────────

export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const RANK_LABEL: Record<Rank, string> = { 0: 'Nawierzchnie', 1: 'Pasy', 2: 'Przejścia', 3: 'Torowiska', 4: 'Oznakowanie', 5: 'Szyny', 6: 'Symbole' };

export function isTramStrip(o: StripObj): boolean {
  return o.spec.lanes.some((l) => l.kind === 'tram') || !!o.spec.lanesEnd?.some((l) => l.kind === 'tram');
}

/** Category of an object — decides what is drawn above what (creation order only matters within a category). */
export function objectRank(o: BzObject): Rank {
  switch (o.type) {
    case 'strip': return isTramStrip(o) ? 3 : 1;
    case 'line':
      switch (o.variant) {
        case 'asphalt': case 'pavement': case 'grass': case 'curb': return 0;
        case 'crosswalk': case 'bikeCrossing': return 2;
        default: return 4;
      }
    case 'text': return 4;
    case 'symbol': {
      const def = symbolById(o.symbolId);
      return def && (def.category === 'arrows' || def.category === 'markings' || def.category === 'words') ? 4 : 6;
    }
  }
}

/** Stable sort by rank (bottom first). */
export function sortByRank<T extends BzObject>(objs: T[]): T[] {
  return objs.map((o, i) => ({ o, i, r: objectRank(o) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.o);
}

// ───────────────────────── text & glyphs ─────────────────────────

export function drawTextM(ctx: Ctx, text: string, x: number, y: number, heightM: number, opts: { color?: string; stretch?: number; weight?: string; family?: string; align?: CanvasTextAlign; rotate?: number; maxWidth?: number } = {}) {
  const k = 100;
  ctx.save();
  ctx.translate(x, y);
  if (opts.rotate) ctx.rotate(opts.rotate);
  ctx.scale(1 / k, (opts.stretch ?? 1) / k);
  ctx.font = `${opts.weight ?? 'bold'} ${heightM * k}px ${opts.family ?? 'Arial, Helvetica, sans-serif'}`;
  ctx.fillStyle = opts.color ?? WHITE;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.maxWidth) {
    const wM = ctx.measureText(text).width / k;
    if (wM > opts.maxWidth) ctx.scale(opts.maxWidth / wM, 1);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** P-23 bicycle in profile, upright (up = -y), centered. h = height in meters. */
export function drawBikeGlyph(ctx: Ctx, x: number, y: number, h = 1.4, color = WHITE) {
  ctx.save();
  ctx.translate(x, y);
  const s = h / 1.4;
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 0.1;
  ctx.lineCap = 'round';
  const r = 0.36;
  const wy = 0.12;
  ctx.beginPath(); ctx.arc(-0.55, wy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.55, wy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.55, wy); ctx.lineTo(-0.15, -0.25); ctx.lineTo(0.35, -0.25); ctx.lineTo(0.55, wy);
  ctx.moveTo(-0.15, -0.25); ctx.lineTo(0.05, wy); ctx.lineTo(-0.55, wy);
  ctx.moveTo(0.35, -0.25); ctx.lineTo(0.25, -0.5); ctx.lineTo(0.5, -0.55);
  ctx.moveTo(-0.15, -0.25); ctx.lineTo(-0.25, -0.5); ctx.lineTo(-0.1, -0.52);
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────── strip layout ─────────────────────────

interface LaneBand {
  lane: Lane;
  top: (s: number) => number;
  bot: (s: number) => number;
  w0: number; w1: number;
}

export interface StripLayout {
  flat: Flat;
  bands: LaneBand[];
  dividers: Array<{ divider: LineSpec; at: (s: number) => number }>;
  top: (s: number) => number;
  bot: (s: number) => number;
  spec: RoadSpec;
}

export function stripLayout(obj: StripObj, step = 0.5): StripLayout {
  const flat = flatten(obj.path, step);
  const L = flat.length || 1;
  const merged = mergeLanes(obj.spec.lanes, obj.spec.lanesEnd);
  const W0 = merged.reduce((a, m) => a + m.w0, 0);
  const W1 = merged.reduce((a, m) => a + m.w1, 0);
  const anchor = obj.spec.anchor ?? 'center';
  const off = obj.spec.offset ?? 0;
  const top0 = -W0 / 2 + off;
  const top1 = obj.spec.offsetEnd !== undefined ? -W1 / 2 + obj.spec.offsetEnd : anchor === 'left' ? top0 : anchor === 'right' ? top0 + W0 - W1 : -W1 / 2 + off;
  const ease = obj.spec.lanesEnd ? (t: number) => t * t * (3 - 2 * t) : (t: number) => t;
  const lerp = (a: number, b: number) => (s: number) => a + (b - a) * ease(Math.min(1, Math.max(0, s / L)));
  const bands: LaneBand[] = [];
  let y0 = top0, y1 = top1;
  for (const m of merged) {
    const t = lerp(y0, y1), b = lerp(y0 + m.w0, y1 + m.w1);
    bands.push({ lane: m.lane, top: t, bot: b, w0: m.w0, w1: m.w1 });
    y0 += m.w0; y1 += m.w1;
  }
  const useExplicit = obj.spec.dividers && !obj.spec.lanesEnd && obj.spec.dividers.length === obj.spec.lanes.length - 1;
  const divs = useExplicit ? obj.spec.dividers! : autoDividers(merged.map((m) => m.lane));
  const dividers = bands.slice(0, -1).map((b, i) => ({ divider: divs[i], at: b.bot }));
  return { flat, bands, dividers, top: lerp(top0, top1), bot: lerp(top0 + W0, top1 + W1), spec: obj.spec };
}

export function stripOutline(obj: StripObj): Vec2[] {
  const lay = stripLayout(obj, 1);
  return bandPolygon(lay.flat, lay.top, lay.bot);
}

// ───────────────────────── primitives ─────────────────────────

function pathPoly(ctx: Ctx, poly: Vec2[]) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

function fillPoly(ctx: Ctx, poly: Vec2[], color: string) {
  if (poly.length < 3) return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // hide anti-aliasing seams between adjacent bands / touching strips: ~1 screen pixel, at least 4 cm
  const m = ctx.getTransform();
  const pxPerUnit = Math.hypot(m.a, m.b) || 1;
  ctx.lineWidth = Math.max(0.04, 1.2 / pxPerUnit);
  ctx.lineJoin = 'round';
  pathPoly(ctx, poly);
  ctx.fill();
  ctx.stroke();
}

function strokePoly(ctx: Ctx, pts: Vec2[], closed: boolean, color: string, width: number, dash?: number[]) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

/** P-13: triangles (base 0.5 m along the line, height = spec.width) every 0.75 m, apex toward the path's left. */
function strokeTriangles(ctx: Ctx, flat: Flat, at: (s: number) => number, spec: LineSpec) {
  ctx.fillStyle = spec.color;
  const h = spec.width || 0.7;
  for (let s = 0.25; s + 0.5 <= flat.length + 0.01; s += 0.75) {
    const a = sampleAt(flat, s), b = sampleAt(flat, s + 0.5), m = sampleAt(flat, s + 0.25);
    const oa = at(a.s), ob = at(b.s), om = at(m.s);
    ctx.beginPath();
    ctx.moveTo(a.x - a.nx * oa, a.y - a.ny * oa);
    ctx.lineTo(b.x - b.nx * ob, b.y - b.ny * ob);
    ctx.lineTo(m.x - m.nx * (om - h), m.y - m.ny * (om - h));
    ctx.closePath();
    ctx.fill();
  }
}

/** Paint a line spec along `flat`, laterally offset by `at(s)` (lane coords, +right). */
export function strokeLineSpec(ctx: Ctx, flat: Flat, spec: LineSpec, at: (s: number) => number) {
  if (spec.style === 'none' || spec.width <= 0) return;
  const closed = flat.closed;
  const w = spec.width;
  const dash = spec.dash ?? [2, 4];
  const off = (w + 0.12) / 2; // double lines: 0.12 m gap between them
  switch (spec.style) {
    case 'solid':
      strokePoly(ctx, offsetPolyline(flat, at), closed, spec.color, w);
      break;
    case 'dashed':
      strokePoly(ctx, offsetPolyline(flat, at), closed, spec.color, w, dash);
      break;
    case 'blocks':
      strokePoly(ctx, offsetPolyline(flat, at), closed, spec.color, w, spec.dash ?? [0.75, 0.25]);
      break;
    case 'triangles':
      strokeTriangles(ctx, flat, at, spec);
      break;
    case 'double':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, spec.color, w);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, spec.color, w);
      break;
    case 'doubleDashedLeft':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, spec.color, w, dash);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, spec.color, w);
      break;
    case 'doubleDashedRight':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, spec.color, w);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, spec.color, w, dash);
      break;
    case 'doubleDashed':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, spec.color, w, dash);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, spec.color, w, dash);
      break;
  }
}

// ───────────────────────── joints between strips (round caps) ─────────────────────────

export interface Cap { x: number; y: number; r: number }

interface StripEnd { id: string; x: number; y: number; r: number; rank: Rank }

function stripEnds(o: StripObj): StripEnd[] {
  if (o.path.closed || o.path.nodes.length < 2) return [];
  const lay = stripLayout(o, 1);
  const L = lay.flat.length;
  const rank = objectRank(o);
  const out: StripEnd[] = [];
  for (const s of [0, L]) {
    const smp = sampleAt(lay.flat, s);
    const t = lay.top(s), b = lay.bot(s);
    const c = (t + b) / 2;
    const r = (b - t) / 2;
    if (r < 0.05) continue;
    out.push({ id: o.id, x: o.x + smp.x - smp.nx * c, y: o.y + smp.y - smp.ny * c, r, rank });
  }
  return out;
}

/**
 * Where two strip ends meet (within 0.35 m) a disc of the lane width is drawn under the joint, so a joint at an
 * angle does not leave a wedge of missing asphalt on the outer side. Returned per object, in OBJECT-LOCAL coords.
 */
export function computeCaps(objects: BzObject[]): Map<string, Cap[]> {
  const ends: StripEnd[] = [];
  const byId = new Map<string, StripObj>();
  for (const o of objects) if (o.type === 'strip' && o.visible !== false) { byId.set(o.id, o); ends.push(...stripEnds(o)); }
  const caps = new Map<string, Cap[]>();
  const add = (id: string, x: number, y: number, r: number) => {
    const o = byId.get(id)!;
    const arr = caps.get(id) ?? [];
    arr.push({ x: x - o.x, y: y - o.y, r });
    caps.set(id, arr);
  };
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i], b = ends[j];
      if (a.id === b.id || a.rank !== b.rank) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.35) continue;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, r = Math.max(a.r, b.r);
      add(a.id, x, y, r);
      add(b.id, x, y, r);
    }
  }
  return caps;
}

function fillCaps(ctx: Ctx, caps: Cap[] | undefined, color: string) {
  if (!caps?.length) return;
  ctx.fillStyle = color;
  for (const c of caps) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); }
}

// ───────────────────────── strips: surface pass ─────────────────────────

function drawStripSurface(ctx: Ctx, obj: StripObj, caps?: Cap[]) {
  if (obj.path.nodes.length < 2) return;
  const lay = stripLayout(obj);
  const flat = lay.flat;
  for (const b of lay.bands) fillPoly(ctx, bandPolygon(flat, b.top, b.bot), laneFill(b.lane));
  fillCaps(ctx, caps, laneFill(lay.bands[lay.bands.length - 1]?.lane ?? obj.spec.lanes[0]));
  for (const b of lay.bands) {
    if (CURB_KINDS.includes(b.lane.kind)) {
      strokePoly(ctx, offsetPolyline(flat, b.top), flat.closed, CURB, 0.1);
      strokePoly(ctx, offsetPolyline(flat, b.bot), flat.closed, CURB, 0.1);
    }
  }
}

// ───────────────────────── strips: tram passes ─────────────────────────

const GAUGE = 1.435;

/** World polygons of everything a tram should cross on slabs: carriageway strips, asphalt areas, P-10 / P-11. */
export function roadwayPolygons(objects: BzObject[]): Vec2[][] {
  const out: Vec2[][] = [];
  for (const o of objects) {
    if (o.visible === false) continue;
    if (o.type === 'strip') {
      if (o.path.nodes.length < 2 || isTramStrip(o)) continue;
      if (!o.spec.lanes.some((l) => ROADWAY_KINDS.includes(l.kind))) continue;
      out.push(stripOutline(o).map((p) => ({ x: p.x + o.x, y: p.y + o.y })));
    } else if (o.type === 'line') {
      if (o.path.nodes.length < 2) continue;
      if (o.variant === 'asphalt' && o.path.closed) out.push(flatten(o.path, 0.5).pts.map((p) => ({ x: p.x + o.x, y: p.y + o.y })));
      else if (o.variant === 'crosswalk' || o.variant === 'bikeCrossing') {
        const f = flatten(o.path, 0.4);
        out.push(bandPolygon(f, () => -o.width / 2, () => o.width / 2).map((p) => ({ x: p.x + o.x, y: p.y + o.y })));
      }
    }
  }
  return out;
}

function tramBands(lay: StripLayout): LaneBand[] {
  return lay.bands.filter((b) => b.lane.kind === 'tram' && b.w0 + b.w1 > 0.1);
}

/**
 * Rank 3: the tram band itself (ballast / grass, sleepers), then — wherever it overlaps a carriageway or a crossing —
 * light slabs (przejazd tramwajowy) on top of the sleepers. `roadPolys` are WORLD polygons; the ctx is object-local.
 */
export function drawTramBand(ctx: Ctx, obj: StripObj, roadPolys: Vec2[][], caps?: Cap[]) {
  if (obj.path.nodes.length < 2) return;
  const lay = stripLayout(obj);
  const flat = lay.flat;
  for (const b of lay.bands) fillPoly(ctx, bandPolygon(flat, b.top, b.bot), laneFill(b.lane));
  fillCaps(ctx, caps, laneFill(lay.bands[0].lane));
  // sleepers
  ctx.strokeStyle = SLEEPER; ctx.lineWidth = 0.14; ctx.lineCap = 'butt';
  for (const b of tramBands(lay)) {
    const half = Math.min(1.1, Math.max(b.w0, b.w1) / 2 - 0.1);
    ctx.beginPath();
    for (let s = 0.35; s < flat.length; s += 0.7) {
      const smp = sampleAt(flat, s);
      const c = (b.top(s) + b.bot(s)) / 2;
      ctx.moveTo(smp.x - smp.nx * (c - half), smp.y - smp.ny * (c - half));
      ctx.lineTo(smp.x - smp.nx * (c + half), smp.y - smp.ny * (c + half));
    }
    ctx.stroke();
  }
  // slabs where the track crosses a roadway / crossing
  if (roadPolys.length) {
    const band = bandPolygon(flat, lay.top, lay.bot);
    ctx.save();
    ctx.translate(-obj.x, -obj.y);
    const world = band.map((p) => ({ x: p.x + obj.x, y: p.y + obj.y }));
    for (const poly of roadPolys) {
      if (poly.length < 3) continue;
      ctx.save();
      pathPoly(ctx, poly);
      ctx.clip();
      fillPoly(ctx, world, TRAM_SLAB);
      // slab seams every 3 m
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (let s = 3; s < flat.length; s += 3) {
        const smp = sampleAt(flat, s);
        const t = lay.top(s), b = lay.bot(s);
        ctx.moveTo(obj.x + smp.x - smp.nx * t, obj.y + smp.y - smp.ny * t);
        ctx.lineTo(obj.x + smp.x - smp.nx * b, obj.y + smp.y - smp.ny * b);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Rank 5: rails (always on top of paint). */
export function drawRails(ctx: Ctx, obj: StripObj) {
  if (obj.path.nodes.length < 2) return;
  const lay = stripLayout(obj);
  const flat = lay.flat;
  for (const b of tramBands(lay)) {
    for (const off of [-GAUGE / 2, GAUGE / 2]) {
      const pl = offsetPolyline(flat, (s) => (b.top(s) + b.bot(s)) / 2 + off);
      strokePoly(ctx, pl, flat.closed, '#2f3236', 0.14);
      strokePoly(ctx, pl, flat.closed, RAIL, 0.07);
    }
  }
}

// ───────────────────────── strips: marking pass ─────────────────────────

const ARROW: Partial<Record<LaneMarking, PictoId>> = {
  p8a: 'p8a', p8b: 'p8b', p8c: 'p8c', p8d: 'p8d', p8e: 'p8e', p8f: 'p8f', p8g: 'p8g', p8h: 'p8h', p8i: 'p8i', p9a: 'p9a', p9b: 'p9b',
};

/** Centre positions (arc length) of repeated glyphs, counted from the exit end of the lane. */
function glyphPositions(lane: Lane, L: number, glyphLen: number, defaultGap: number): number[] {
  const gap = lane.markGap ?? defaultGap;
  const count = lane.markCount ?? 3;
  const margin = glyphLen / 2 + 1.0;
  const out: number[] = [];
  if (L < glyphLen + 1) return out;
  const exitEnd = lane.dir !== -1;
  for (let k = 0; count === 0 || k < count; k++) {
    const s = exitEnd ? L - margin - k * gap : margin + k * gap;
    if (s < glyphLen / 2 || s > L - glyphLen / 2) break;
    out.push(s);
    if (gap <= 0) break;
  }
  return out;
}

function glyphFrame(lay: StripLayout, band: LaneBand, s: number): { x: number; y: number; heading: number; width: number } | null {
  const nominal = Math.max(band.w0, band.w1);
  const width = band.bot(s) - band.top(s);
  if (width < nominal * 0.7) return null;
  const smp = sampleAt(lay.flat, s);
  const c = (band.top(s) + band.bot(s)) / 2;
  let heading = Math.atan2(smp.ty, smp.tx);
  if (band.lane.dir === -1) heading += Math.PI;
  return { x: smp.x - smp.nx * c, y: smp.y - smp.ny * c, heading, width };
}

function drawBandMarking(ctx: Ctx, lay: StripLayout, band: LaneBand) {
  const lane = band.lane;
  const marking = laneMarkingOf(lane);
  if (marking === 'none' || marking === 'tracks') return;
  const flat = lay.flat;
  const L = flat.length;
  const nominal = Math.max(band.w0, band.w1);

  if (marking === 'p18') {
    const step = lane.kind === 'parkingPerp' ? 2.5 : lane.kind === 'parkingAngle' ? 2.5 / Math.SQRT1_2 : 6;
    ctx.strokeStyle = WHITE; ctx.lineWidth = 0.12; ctx.lineCap = 'butt';
    for (let s = step; s < L - 0.5; s += step) {
      const smp = sampleAt(flat, s);
      const t = band.top(s), b = band.bot(s);
      const inset = lane.kind === 'parking' ? 0.25 : 0.06;
      ctx.beginPath();
      if (lane.kind === 'parkingAngle') {
        const back = sampleAt(flat, Math.max(0, s - nominal));
        ctx.moveTo(smp.x - smp.nx * (t + inset), smp.y - smp.ny * (t + inset));
        ctx.lineTo(back.x - back.nx * (b - inset), back.y - back.ny * (b - inset));
      } else {
        ctx.moveTo(smp.x - smp.nx * (t + inset), smp.y - smp.ny * (t + inset));
        ctx.lineTo(smp.x - smp.nx * (b - inset), smp.y - smp.ny * (b - inset));
        // T-caps 0.6 m at both ends of the divider (P-18)
        for (const e of [t + inset, b - inset]) {
          ctx.moveTo(smp.x - smp.nx * e + smp.tx * 0.3, smp.y - smp.ny * e + smp.ty * 0.3);
          ctx.lineTo(smp.x - smp.nx * e - smp.tx * 0.3, smp.y - smp.ny * e - smp.ty * 0.3);
        }
      }
      ctx.stroke();
    }
    return;
  }

  if (marking === 'p21') {
    // P-21a: obwiednia P-7b 0,24 m; liniowanie 0,24 m co 0,39 m, skos 1:3 do linii obwodowej
    const poly = bandPolygon(flat, band.top, band.bot);
    if (poly.length < 3) return;
    ctx.save();
    pathPoly(ctx, poly); ctx.clip();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 0.24; ctx.lineCap = 'butt';
    const run = 3 * nominal;
    const pitch = 0.63 * Math.sqrt(1 + 9); // perpendicular pitch 0.63 m projected on the axis
    ctx.beginPath();
    for (let s = -run; s < L + run; s += pitch) {
      const a = sampleAt(flat, Math.max(0, Math.min(L, s))), b = sampleAt(flat, Math.max(0, Math.min(L, s + run)));
      const ax = a.x + a.tx * (s - a.s), ay = a.y + a.ty * (s - a.s);
      const bx = b.x + b.tx * (s + run - b.s), by = b.y + b.ty * (s + run - b.s);
      ctx.moveTo(ax - a.nx * band.top(a.s), ay - a.ny * band.top(a.s));
      ctx.lineTo(bx - b.nx * band.bot(b.s), by - b.ny * band.bot(b.s));
    }
    ctx.stroke();
    ctx.restore();
    strokePoly(ctx, offsetPolyline(flat, (s) => band.top(s) + 0.12), flat.closed, WHITE, 0.24);
    strokePoly(ctx, offsetPolyline(flat, (s) => band.bot(s) - 0.12), flat.closed, WHITE, 0.24);
    return;
  }

  // a lane that starts or ends inside this strip (taper / klin) gets a single P-9 arrow instead of repeated glyphs
  if (band.w0 < 1e-6 || band.w1 < 1e-6) {
    if (lane.dir === 0 || L < 8) return;
    const ends = lane.dir === 1 ? band.w1 < 1e-6 : band.w0 < 1e-6;
    if (!ends) return;
    const i = lay.bands.indexOf(band);
    const keeps = (j: number) => { const nb = lay.bands[j]; return !!nb && nb.lane.dir === lane.dir && (lane.dir === 1 ? nb.w1 : nb.w0) > 0.5; };
    let towardLower = keeps(i - 1), towardUpper = keeps(i + 1);
    if (!towardLower && !towardUpper && lay.bands.length === 1) {
      if (lay.spec.anchor === 'left') towardLower = true; else if (lay.spec.anchor === 'right') towardUpper = true;
    }
    if (!towardLower && !towardUpper) return;
    const s = lane.dir === 1 ? Math.min(L * 0.18, 6) : L - Math.min(L * 0.18, 6);
    const f = glyphFrame(lay, band, s);
    if (!f) return;
    const side: -1 | 1 = towardLower ? (lane.dir === 1 ? -1 : 1) : lane.dir === 1 ? 1 : -1;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.heading);
    drawPictogram(ctx, side === -1 ? 'p9a' : 'p9b', { length: Math.min(5, L * 0.3), fitWidth: Math.max(0.4, f.width - 0.4) });
    ctx.restore();
    return;
  }

  if (marking === 'p23') {
    const h = Math.min(1.9, Math.max(0.6, nominal - 0.5)); // P-23 ≈ 1,9 m long
    const mini = lane.kind === 'bike' || lane.kind === 'bikePath';
    for (const s of glyphPositions(lane, L, mini ? h + 3 : h, 15)) {
      const f = glyphFrame(lay, band, s);
      if (!f) continue;
      const fx = Math.cos(f.heading), fy = Math.sin(f.heading);
      const back = mini ? 1.4 : 0;
      ctx.save(); ctx.translate(f.x - fx * back, f.y - fy * back); ctx.rotate(f.heading + Math.PI / 2);
      drawBikeGlyph(ctx, 0, 0, Math.min(h, (f.width - 0.3) / 1.3));
      ctx.restore();
      if (mini) {
        // P-8a mini (50 %) ahead of the bicycle
        ctx.save(); ctx.translate(f.x + fx * 1.3, f.y + fy * 1.3); ctx.rotate(f.heading);
        drawPictogram(ctx, 'p8a', { length: 2.5, fitWidth: Math.max(0.3, f.width - 0.4) });
        ctx.restore();
      }
    }
    return;
  }

  if (marking === 'p22') {
    for (const s of glyphPositions(lane, L, 1.6, 30)) {
      const f = glyphFrame(lay, band, s);
      if (!f) continue;
      drawTextM(ctx, 'BUS', f.x, f.y, 1.6, { rotate: f.heading + Math.PI / 2, weight: '700', family: 'Arial Narrow, Arial, sans-serif', maxWidth: Math.min(1.62, Math.max(0.5, f.width - 0.4)) });
    }
    return;
  }

  const picto = ARROW[marking];
  if (picto) {
    const len = Math.min(5, L * 0.4);
    for (const s of glyphPositions(lane, L, len, 15)) {
      const f = glyphFrame(lay, band, s);
      if (!f) continue;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.heading);
      drawPictogram(ctx, picto, { length: len, fitWidth: Math.max(0.4, f.width - 0.4) });
      ctx.restore();
    }
  }
}

function drawStripMarkings(ctx: Ctx, obj: StripObj) {
  if (obj.path.nodes.length < 2) return;
  const lay = stripLayout(obj);
  const flat = lay.flat;
  for (const b of lay.bands) drawBandMarking(ctx, lay, b);
  for (const d of lay.dividers) strokeLineSpec(ctx, flat, d.divider, d.at);
  if (obj.spec.edgeLeft) strokeLineSpec(ctx, flat, obj.spec.edgeLeft, (s) => lay.top(s) + obj.spec.edgeLeft!.width / 2);
  if (obj.spec.edgeRight) strokeLineSpec(ctx, flat, obj.spec.edgeRight, (s) => lay.bot(s) - obj.spec.edgeRight!.width / 2);
}

// ───────────────────────── line objects ─────────────────────────

export function linePolyline(obj: LineObj): Vec2[] {
  return flatten(obj.path, 0.4).pts.map((p) => ({ x: p.x, y: p.y }));
}

function drawLineSurface(ctx: Ctx, obj: LineObj) {
  if (obj.path.nodes.length < 2) return;
  const flat = flatten(obj.path, 0.4);
  const pts = flat.pts;
  switch (obj.variant) {
    case 'grass': case 'pavement': case 'asphalt': {
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      fillPoly(ctx, poly, obj.fill || (obj.variant === 'grass' ? GRASS : obj.variant === 'pavement' ? CONCRETE : ASPHALT));
      if (obj.variant !== 'asphalt') strokePoly(ctx, poly, true, CURB, 0.12);
      return;
    }
    case 'curb':
      strokePoly(ctx, pts, obj.path.closed, obj.color || CURB, obj.width || 0.3);
      return;
    case 'crosswalk': case 'bikeCrossing':
      if (obj.fill) fillPoly(ctx, bandPolygon(flat, () => -obj.width / 2, () => obj.width / 2), obj.fill);
      return;
    default:
      return;
  }
}

function drawLineMarkings(ctx: Ctx, obj: LineObj) {
  if (obj.path.nodes.length < 2) return;
  const flat = flatten(obj.path, 0.4);
  const pts = flat.pts;
  const closed = obj.path.closed;
  ctx.lineJoin = 'round';
  switch (obj.variant) {
    case 'crosswalk': {
      // P-10: pasy 0,5 m co 1,0 m równoległe do osi jezdni (prostopadłe do rysowanej ścieżki); pierwszy ≤ 0,5 m od krawędzi
      ctx.fillStyle = obj.color || WHITE;
      for (let s = 0.25; s + 0.5 <= flat.length + 0.01; s += 1.0) {
        const smp = sampleAt(flat, s + 0.25);
        ctx.save(); ctx.translate(smp.x, smp.y); ctx.rotate(Math.atan2(smp.ty, smp.tx));
        ctx.fillRect(-0.25, -obj.width / 2, 0.5, obj.width);
        ctx.restore();
      }
      return;
    }
    case 'bikeCrossing': {
      // P-11: dwa rzędy kwadratów 0,5 m co 1,0 m na zewnętrznych krawędziach przejazdu
      ctx.fillStyle = obj.color || WHITE;
      for (let s = 0.25; s + 0.5 <= flat.length + 0.01; s += 1.0) {
        const smp = sampleAt(flat, s + 0.25);
        ctx.save(); ctx.translate(smp.x, smp.y); ctx.rotate(Math.atan2(smp.ty, smp.tx));
        ctx.fillRect(-0.25, -obj.width / 2, 0.5, 0.5);
        ctx.fillRect(-0.25, obj.width / 2 - 0.5, 0.5, 0.5);
        ctx.restore();
      }
      return;
    }
    case 'zigzag': {
      // P-17: zygzak o amplitudzie `width` (1,5 m), 2,5 m na połowę okresu, 0,12 m, zakończony poprzeczkami
      const a = obj.width / 2;
      ctx.strokeStyle = obj.color || WHITE; ctx.lineWidth = 0.12; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      ctx.beginPath();
      const L = flat.length;
      const first = sampleAt(flat, 0);
      ctx.moveTo(first.x - first.nx * a, first.y - first.ny * a);
      ctx.lineTo(first.x + first.nx * a, first.y + first.ny * a);
      let side = 1;
      for (let s = 0; s < L; s += 2.5) {
        const smp = sampleAt(flat, Math.min(L, s + 2.5));
        side = -side;
        const off = side * a;
        ctx.lineTo(smp.x - smp.nx * off, smp.y - smp.ny * off);
      }
      const last = sampleAt(flat, L);
      ctx.lineTo(last.x - last.nx * a, last.y - last.ny * a);
      ctx.lineTo(last.x + last.nx * a, last.y + last.ny * a);
      ctx.stroke();
      return;
    }
    case 'hatch': {
      // P-21a inside a closed outline: obwiednia 0,24 m, liniowanie 0,24 m co 0,39 m, skos 1:3 do najdłuższego boku
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      if (poly.length < 3) return;
      if (obj.fill) fillPoly(ctx, poly, obj.fill);
      let best = 0, dir = { x: 1, y: 0 };
      for (let i = 0; i < poly.length; i++) {
        const q = poly[(i + 1) % poly.length];
        const dx = q.x - poly[i].x, dy = q.y - poly[i].y, l = Math.hypot(dx, dy);
        if (l > best) { best = l; dir = { x: dx / l, y: dy / l }; }
      }
      const ang = Math.atan2(dir.y, dir.x) + Math.atan(1 / 3);
      const b = polygonBounds(poly);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2 + 1;
      ctx.save();
      pathPoly(ctx, poly); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.strokeStyle = obj.color || WHITE; ctx.lineWidth = 0.24; ctx.lineCap = 'butt';
      ctx.beginPath();
      for (let y = -R; y <= R; y += 0.63) { ctx.moveTo(-R, y); ctx.lineTo(R, y); }
      ctx.stroke();
      ctx.restore();
      strokePoly(ctx, poly, true, obj.color || WHITE, 0.24);
      return;
    }
    case 'grass': case 'pavement': case 'asphalt': case 'curb':
      return;
    default: {
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      if (closed && obj.fill) fillPoly(ctx, poly, obj.fill);
      if (obj.style === 'none' || obj.width <= 0) return;
      strokeLineSpec(ctx, flat, { style: obj.style, width: obj.width, dash: obj.dash, color: obj.color }, () => 0);
    }
  }
}

// ───────────────────────── text ─────────────────────────

export function drawText(ctx: Ctx, obj: TextObj) {
  const lines = obj.text.split('\n');
  const lh = obj.fontSize * 1.15 * obj.stretch;
  const total = lh * lines.length;
  if (obj.background) {
    const w = measureTextWidth(obj) + obj.fontSize * 0.6;
    ctx.fillStyle = obj.background;
    ctx.fillRect(-w / 2, -total / 2 - obj.fontSize * 0.15, w, total + obj.fontSize * 0.3);
  }
  lines.forEach((ln, i) => {
    drawTextM(ctx, ln, 0, -total / 2 + lh * (i + 0.5), obj.fontSize, {
      color: obj.color, stretch: obj.stretch, weight: '700', family: obj.fontFamily ?? 'Arial Narrow, Arial, sans-serif',
    });
  });
}

let measureCtx: Ctx | null = null;
export function measureTextWidth(obj: TextObj): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const c = measureCtx!;
  c.font = `700 100px ${obj.fontFamily ?? 'Arial Narrow, Arial, sans-serif'}`;
  let w = 0;
  for (const ln of obj.text.split('\n')) w = Math.max(w, c.measureText(ln).width);
  return (w / 100) * obj.fontSize;
}

// ───────────────────────── passes ─────────────────────────

export type Drawable = Exclude<BzObject, { type: 'symbol' }>;

/** Ranks 0–2: what an object paints in the surface pass (nothing for tram strips, pure markings and text). */
export function drawSurface(ctx: Ctx, obj: Drawable, caps?: Cap[]) {
  if (obj.type === 'strip') { if (!isTramStrip(obj)) drawStripSurface(ctx, obj, caps); }
  else if (obj.type === 'line') drawLineSurface(ctx, obj);
}

/** Rank 4: paint. */
export function drawMarkings(ctx: Ctx, obj: Drawable) {
  switch (obj.type) {
    case 'strip': return drawStripMarkings(ctx, obj);
    case 'line': return drawLineMarkings(ctx, obj);
    case 'text': return drawText(ctx, obj);
  }
}

/**
 * Full render of a set of objects (local-to-world by translating per object), all passes in order.
 * Used for library thumbnails and previews; the live board uses per-pass Konva layers.
 */
export function drawScene(ctx: Ctx, objects: Drawable[], opts: { roadPolys?: Vec2[][]; caps?: Map<string, Cap[]> } = {}) {
  const sorted = sortByRank(objects);
  const caps = opts.caps ?? computeCaps(objects);
  const roadPolys = opts.roadPolys ?? roadwayPolygons(objects);
  const each = (fn: (o: Drawable) => void) => {
    for (const o of sorted) {
      if (o.visible === false) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.rotation) ctx.rotate((o.rotation * Math.PI) / 180);
      if (o.opacity !== undefined) ctx.globalAlpha *= o.opacity;
      fn(o);
      ctx.restore();
    }
  };
  each((o) => drawSurface(ctx, o, caps.get(o.id)));
  each((o) => { if (o.type === 'strip' && isTramStrip(o)) drawTramBand(ctx, o, roadPolys, caps.get(o.id)); });
  each((o) => drawMarkings(ctx, o));
  each((o) => { if (o.type === 'strip' && isTramStrip(o)) drawRails(ctx, o); });
}

/** One object, all its passes (preview while drawing). */
export function drawObject(ctx: Ctx, obj: Drawable) {
  ctx.save();
  ctx.translate(-obj.x, -obj.y);
  drawScene(ctx, [obj], { roadPolys: [], caps: new Map() });
  ctx.restore();
}

// ───────────────────────── bounds / hit polygons ─────────────────────────

export interface Bounds { x: number; y: number; w: number; h: number }

/** Polygon used for hit-testing (local coords). */
export function hitPolygon(obj: BzObject, minHalf = 0.4): Vec2[] {
  switch (obj.type) {
    case 'strip':
      return obj.path.nodes.length >= 2 ? stripOutline(obj) : [];
    case 'line': {
      const flat = flatten(obj.path, 0.5);
      if (obj.path.closed && ['hatch', 'grass', 'pavement', 'asphalt', 'plain'].includes(obj.variant) && (obj.variant !== 'plain' || obj.fill)) {
        return flat.pts.map((p) => ({ x: p.x, y: p.y }));
      }
      const half = Math.max(obj.width / 2, minHalf);
      return bandPolygon(flat, () => -half, () => half);
    }
    case 'symbol':
      return [{ x: -obj.width / 2, y: -obj.height / 2 }, { x: obj.width / 2, y: -obj.height / 2 }, { x: obj.width / 2, y: obj.height / 2 }, { x: -obj.width / 2, y: obj.height / 2 }];
    case 'text': {
      const b = objectBounds(obj);
      return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
    }
  }
}

export function objectBounds(obj: BzObject): Bounds {
  switch (obj.type) {
    case 'strip': {
      if (obj.path.nodes.length < 2) { const n = obj.path.nodes[0]; return { x: (n?.x ?? 0) - 1, y: (n?.y ?? 0) - 1, w: 2, h: 2 }; }
      return polygonBounds(stripOutline(obj));
    }
    case 'line': {
      const b = polygonBounds(hitPolygon(obj));
      return b.w === 0 && b.h === 0 ? { x: b.x - 0.5, y: b.y - 0.5, w: 1, h: 1 } : b;
    }
    case 'symbol':
      return { x: -obj.width / 2, y: -obj.height / 2, w: obj.width, h: obj.height };
    case 'text': {
      const w = measureTextWidth(obj) + obj.fontSize * 0.3;
      const h = obj.fontSize * 1.15 * obj.stretch * obj.text.split('\n').length + obj.fontSize * 0.3;
      return { x: -w / 2, y: -h / 2, w, h };
    }
  }
}

export { specWidth };
