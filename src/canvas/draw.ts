/**
 * Pure Canvas-2D drawing of BZRD objects in LOCAL METER coordinates.
 * Used by the Konva scene (Shape.sceneFunc), library previews and export.
 */
import type { BzObject, Divider, Lane, LineObj, RoadSpec, StripObj, TextObj, Vec2 } from '../model/types';
import { CONCRETE, CONCRETE_DARK, GRASS, WHITE, ASPHALT, dashFor, laneFill, lineColor, mergeLanes, strokeFor, LINE_W, DOUBLE_GAP, autoDividers } from './roadGeometry';
import { bandPolygon, flatten, offsetPolyline, polygonBounds, sampleAt, type Flat } from './path';
import { drawPictogram, type PictoId } from './pictograms';

type Ctx = CanvasRenderingContext2D;

export const CURB = '#8f8b84';
const CURB_KINDS: Lane['kind'][] = ['sidewalk', 'median', 'separator', 'green', 'path', 'bikePath'];

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
    if (wM > opts.maxWidth) ctx.scale(opts.maxWidth / wM, 1); // squeeze to fit the lane
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
  const wy = 0.12; // wheel centre y (glyph centred on its bounding box)
  ctx.beginPath(); ctx.arc(-0.55, wy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.55, wy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.55, wy); ctx.lineTo(-0.15, -0.25); ctx.lineTo(0.35, -0.25); ctx.lineTo(0.55, wy); // top tube + down to rear
  ctx.moveTo(-0.15, -0.25); ctx.lineTo(0.05, wy); ctx.lineTo(-0.55, wy);                     // seat tube + chainstay
  ctx.moveTo(0.35, -0.25); ctx.lineTo(0.25, -0.5); ctx.lineTo(0.5, -0.55);                   // stem + handlebar
  ctx.moveTo(-0.15, -0.25); ctx.lineTo(-0.25, -0.5); ctx.lineTo(-0.1, -0.52);                // seat post + saddle
  ctx.stroke();
  ctx.restore();
}

/** P-8 style arrow pointing +x. */
// ───────────────────────── strip (lanes along a path) ─────────────────────────

interface LaneBand {
  lane: Lane;
  top: (s: number) => number;
  bot: (s: number) => number;
  w0: number; w1: number;
}

export interface StripLayout {
  flat: Flat;
  bands: LaneBand[];
  dividers: Array<{ divider: Divider; at: (s: number) => number }>;
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
  // width changes (klin) follow a smooth S-curve: tangent to the lane at the start and to the neighbour at the end
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

function fillPoly(ctx: Ctx, poly: Vec2[], color: string) {
  if (poly.length < 3) return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // hide anti-aliasing seams between adjacent bands / joined strips: ~1 screen pixel, at least 4 cm
  const m = ctx.getTransform();
  const pxPerUnit = Math.hypot(m.a, m.b) || 1;
  ctx.lineWidth = Math.max(0.04, 1.2 / pxPerUnit);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
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

function strokeDividerAlong(ctx: Ctx, flat: Flat, d: Divider, at: (s: number) => number) {
  if (d.style === 'none') return;
  const color = lineColor(d.color);
  const w = strokeFor(d.style);
  const dash = dashFor(d.style);
  const off = LINE_W / 2 + DOUBLE_GAP / 2;
  const closed = flat.closed;
  switch (d.style) {
    case 'double':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, color, w);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, color, w);
      break;
    case 'doubleDashedLeft':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, color, w, dashFor('dashed'));
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, color, w);
      break;
    case 'doubleDashedRight':
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) - off), closed, color, w);
      strokePoly(ctx, offsetPolyline(flat, (s) => at(s) + off), closed, color, w, dashFor('dashed'));
      break;
    default:
      strokePoly(ctx, offsetPolyline(flat, at), closed, color, w, dash);
  }
}

function defaultMarking(lane: Lane): NonNullable<Lane['marking']> {
  switch (lane.kind) {
    case 'bike': case 'bikePath': return 'bikeSymbols';
    case 'bus': return 'busText';
    case 'tram': return 'tramTracks';
    case 'parking': case 'parkingPerp': case 'parkingAngle': return 'parkingBays';
    case 'buffer': return 'hatch';
    default: return 'none';
  }
}

/** Iterate positions along the band center at a spacing; cb gets world pos + heading (rad, in travel direction). */
function alongBand(lay: StripLayout, band: LaneBand, start: number, spacing: number, cb: (x: number, y: number, heading: number, s: number) => void) {
  const L = lay.flat.length;
  const nominal = Math.max(band.w0, band.w1);
  for (let s = start; s <= L - start * 0.5 && s <= L; s += spacing) {
    if (band.bot(s) - band.top(s) < nominal * 0.7) continue;
    const smp = sampleAt(lay.flat, s);
    const c = (band.top(s) + band.bot(s)) / 2;
    const x = smp.x - smp.nx * c, y = smp.y - smp.ny * c;
    let heading = Math.atan2(smp.ty, smp.tx);
    if (band.lane.dir === -1) heading += Math.PI;
    cb(x, y, heading, s);
    if (spacing <= 0) break;
  }
}

function drawBandDetails(ctx: Ctx, lay: StripLayout, band: LaneBand, noGlyphs: boolean) {
  const lane = band.lane;
  const marking = lane.marking ?? defaultMarking(lane);
  const nominal = Math.max(band.w0, band.w1);
  const flat = lay.flat;
  if (marking === 'tramTracks') {
    const gauge = 1.435;
    for (const off of [-gauge / 2, gauge / 2]) {
      strokePoly(ctx, offsetPolyline(flat, (s) => (band.top(s) + band.bot(s)) / 2 + off), flat.closed, '#b7bcc2', 0.09);
    }
    // sleepers
    if (!noGlyphs) {
      ctx.strokeStyle = '#6a6e73'; ctx.lineWidth = 0.12;
      for (let s = 0.4; s < flat.length; s += 0.7) {
        const smp = sampleAt(flat, s);
        const c = (band.top(s) + band.bot(s)) / 2;
        ctx.beginPath();
        ctx.moveTo(smp.x - smp.nx * (c - 1.0), smp.y - smp.ny * (c - 1.0));
        ctx.lineTo(smp.x - smp.nx * (c + 1.0), smp.y - smp.ny * (c + 1.0));
        ctx.stroke();
      }
      for (const off of [-gauge / 2, gauge / 2]) strokePoly(ctx, offsetPolyline(flat, (s) => (band.top(s) + band.bot(s)) / 2 + off), flat.closed, '#c9ced4', 0.09);
    }
    return;
  }
  if (marking === 'parkingBays') {
    const step = lane.kind === 'parkingPerp' ? 2.5 : lane.kind === 'parkingAngle' ? 2.5 / Math.SQRT1_2 : 6;
    ctx.strokeStyle = WHITE; ctx.lineWidth = LINE_W;
    // P-19 edge line toward the traffic lane is drawn by dividers; bays:
    for (let s = step; s < flat.length - 0.5; s += step) {
      const smp = sampleAt(flat, s);
      const t = band.top(s), b = band.bot(s);
      const inset = lane.kind === 'parking' ? 0.25 : 0;
      ctx.beginPath();
      if (lane.kind === 'parkingAngle') {
        const back = sampleAt(flat, Math.max(0, s - nominal));
        ctx.moveTo(smp.x - smp.nx * (t + inset), smp.y - smp.ny * (t + inset));
        ctx.lineTo(back.x - back.nx * (b - inset), back.y - back.ny * (b - inset));
      } else {
        ctx.moveTo(smp.x - smp.nx * (t + inset), smp.y - smp.ny * (t + inset));
        ctx.lineTo(smp.x - smp.nx * (b - inset), smp.y - smp.ny * (b - inset));
      }
      ctx.stroke();
    }
    return;
  }
  if (marking === 'hatch') {
    const poly = bandPolygon(flat, band.top, band.bot);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y); for (const p of poly) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = WHITE; ctx.lineWidth = LINE_W;
    for (let s = 0; s < flat.length + nominal; s += 1.0) {
      const a = sampleAt(flat, Math.max(0, s - nominal)), b = sampleAt(flat, Math.min(flat.length, s));
      ctx.beginPath();
      ctx.moveTo(a.x - a.nx * band.top(a.s), a.y - a.ny * band.top(a.s));
      ctx.lineTo(b.x - b.nx * band.bot(b.s), b.y - b.ny * band.bot(b.s));
      ctx.stroke();
    }
    ctx.restore();
    strokePoly(ctx, offsetPolyline(flat, band.top), flat.closed, WHITE, LINE_W);
    strokePoly(ctx, offsetPolyline(flat, band.bot), flat.closed, WHITE, LINE_W);
    return;
  }
  if (noGlyphs) return;
  // P-9 on a traffic lane that ends inside this strip (taper to zero in the direction of travel)
  if ((lane.kind === 'drive' || lane.kind === 'bus' || lane.kind === 'turn') && lane.dir !== 0) {
    const ends = lane.dir === 1 ? band.w0 > 0.5 && band.w1 < 1e-6 : band.w1 > 0.5 && band.w0 < 1e-6;
    const L = flat.length;
    if (ends && L > 8) {
      const i = lay.bands.indexOf(band);
      const keeps = (j: number) => { const nb = lay.bands[j]; return !!nb && nb.lane.dir === lane.dir && (lane.dir === 1 ? nb.w1 : nb.w0) > 0.5 && ['drive', 'bus', 'turn'].includes(nb.lane.kind); };
      let towardLower = keeps(i - 1); // neighbour on the path's left (-y)
      let towardUpper = keeps(i + 1);
      if (!towardLower && !towardUpper && lay.bands.length === 1) {
        // a single lane that tapers away (klin włączenia): it merges toward its anchored edge
        if (lay.spec.anchor === 'left') towardLower = true;
        else if (lay.spec.anchor === 'right') towardUpper = true;
      }
      if (towardLower || towardUpper) {
        const s = lane.dir === 1 ? Math.min(L * 0.18, 6) : L - Math.min(L * 0.18, 6);
        const smp = sampleAt(flat, s);
        const c = (band.top(s) + band.bot(s)) / 2;
        let heading = Math.atan2(smp.ty, smp.tx);
        if (lane.dir === -1) heading += Math.PI;
        // in the arrow's local frame (+x = travel), -y is the driver's left; path-left (lower index) is driver's left only for dir 1
        const side: -1 | 1 = towardLower ? (lane.dir === 1 ? -1 : 1) : lane.dir === 1 ? 1 : -1;
        ctx.save(); ctx.translate(smp.x - smp.nx * c, smp.y - smp.ny * c); ctx.rotate(heading);
        drawPictogram(ctx, side === -1 ? 'p9a' : 'p9b', { length: Math.min(5, L * 0.3), fitWidth: Math.max(0.4, band.bot(s) - band.top(s) - 0.6) });
        ctx.restore();
      }
    }
  }
  // a lane that starts or ends inside this strip (taper) gets no repeated glyphs — only the P-9 above
  if (band.w0 < 1e-6 || band.w1 < 1e-6) return;
  if (marking === 'bikeSymbols') {
    const avail = Math.max(0.4, nominal - 0.3);
    const h = Math.min(1.4, nominal * 0.8, (avail / 1.3)); // bicycle is ~1.3·h wide across the lane
    alongBand(lay, band, 3, 15, (x, y, heading) => {
      const fx = Math.cos(heading), fy = Math.sin(heading);
      // P-23 bicycle (front = direction of travel)
      ctx.save(); ctx.translate(x - fx * 0.7, y - fy * 0.7); ctx.rotate(heading + Math.PI / 2);
      drawBikeGlyph(ctx, 0, 0, h);
      ctx.restore();
      // small P-8a ahead of it
      ctx.save(); ctx.translate(x + fx * (h * 0.5 + 0.6), y + fy * (h * 0.5 + 0.6)); ctx.rotate(heading);
      drawPictogram(ctx, 'p8a', { length: 1.6, fitWidth: avail });
      ctx.restore();
    });
    return;
  }
  if (marking === 'busText') {
    alongBand(lay, band, 6, 25, (x, y, heading) => {
      drawTextM(ctx, 'BUS', x, y, Math.min(1.6, nominal * 0.45), { stretch: 2.4, rotate: heading + Math.PI / 2, weight: '700', family: 'Arial Narrow, Arial, sans-serif', maxWidth: Math.max(0.5, nominal - 0.6) });
    });
    return;
  }
  const ARROW: Partial<Record<NonNullable<Lane['marking']>, PictoId>> = {
    arrowsStraight: 'p8a', arrowsLeft: 'p8b', arrowsRight: 'p8c', arrowsStraightLeft: 'p8d', arrowsStraightRight: 'p8e',
    arrowsLeftRight: 'p8f', arrowsAll: 'p8h', arrowsUturn: 'p8g',
  };
  const picto = ARROW[marking];
  if (picto) {
    const len = Math.min(5, flat.length * 0.4);
    const L = flat.length;
    const positions: number[] = [];
    if (lane.dir === -1) for (let s = len / 2 + 1.5; s < L - 1; s += 30) positions.push(s);
    else for (let s = L - len / 2 - 1.5; s > 1; s -= 30) positions.push(s);
    for (const s of positions) {
      const smp = sampleAt(flat, s);
      if (band.bot(s) - band.top(s) < nominal * 0.7) continue;
      const c = (band.top(s) + band.bot(s)) / 2;
      let heading = Math.atan2(smp.ty, smp.tx);
      if (lane.dir === -1) heading += Math.PI;
      ctx.save(); ctx.translate(smp.x - smp.nx * c, smp.y - smp.ny * c); ctx.rotate(heading);
      drawPictogram(ctx, picto, { length: len, fitWidth: Math.max(0.4, band.bot(s) - band.top(s) - 0.7) });
      ctx.restore();
    }
  }
}

export function drawStrip(ctx: Ctx, obj: StripObj, opts: { noGlyphs?: boolean } = {}) {
  if (obj.path.nodes.length < 2) return;
  const lay = stripLayout(obj);
  const flat = lay.flat;
  // bands
  for (const b of lay.bands) fillPoly(ctx, bandPolygon(flat, b.top, b.bot), laneFill(b.lane));
  // curbs
  for (const b of lay.bands) {
    if (CURB_KINDS.includes(b.lane.kind)) {
      strokePoly(ctx, offsetPolyline(flat, b.top), flat.closed, CURB, 0.1);
      strokePoly(ctx, offsetPolyline(flat, b.bot), flat.closed, CURB, 0.1);
    }
  }
  // details & glyphs
  for (const b of lay.bands) drawBandDetails(ctx, lay, b, !!opts.noGlyphs);
  // dividers
  for (const d of lay.dividers) strokeDividerAlong(ctx, flat, d.divider, d.at);
  if (obj.spec.edgeLeft) strokeDividerAlong(ctx, flat, obj.spec.edgeLeft, lay.top);
  if (obj.spec.edgeRight) strokeDividerAlong(ctx, flat, obj.spec.edgeRight, lay.bot);
}

// ───────────────────────── line / marking paths ─────────────────────────

export function linePolyline(obj: LineObj): Vec2[] {
  return flatten(obj.path, 0.4).pts.map((p) => ({ x: p.x, y: p.y }));
}

export function drawLine(ctx: Ctx, obj: LineObj) {
  if (obj.path.nodes.length < 2 && obj.variant !== 'plain') return;
  const flat = flatten(obj.path, 0.4);
  const pts = flat.pts;
  const closed = obj.path.closed;
  const v = obj.variant ?? 'plain';
  ctx.lineJoin = 'round';
  switch (v) {
    case 'crosswalk': {
      // P-10: 0.5 m bars across the crossing path, 1.0 m pitch; bars run perpendicular to the path
      if (obj.fill) {
        const poly = bandPolygon(flat, () => -obj.width / 2, () => obj.width / 2);
        fillPoly(ctx, poly, obj.fill);
      }
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
      const poly = bandPolygon(flat, () => -obj.width / 2, () => obj.width / 2);
      fillPoly(ctx, poly, obj.fill || '#b5423a');
      ctx.fillStyle = obj.color || WHITE;
      for (let s = 0; s + 0.5 <= flat.length + 0.01; s += 1.0) {
        const smp = sampleAt(flat, s + 0.25);
        ctx.save(); ctx.translate(smp.x, smp.y); ctx.rotate(Math.atan2(smp.ty, smp.tx));
        ctx.fillRect(-0.25, -obj.width / 2, 0.5, 0.5);
        ctx.fillRect(-0.25, obj.width / 2 - 0.5, 0.5, 0.5);
        ctx.restore();
      }
      return;
    }
    case 'zigzag': {
      // P-17: zigzag between ±width/2 every 1.0 m
      ctx.strokeStyle = obj.color || WHITE; ctx.lineWidth = LINE_W; ctx.lineJoin = 'miter';
      ctx.beginPath();
      let side = -1;
      for (let s = 0; s <= flat.length; s += 1.0) {
        const smp = sampleAt(flat, s);
        const off = (side * obj.width) / 2;
        const x = smp.x - smp.nx * off, y = smp.y - smp.ny * off;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        side = -side;
      }
      ctx.stroke();
      return;
    }
    case 'hatch': {
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      if (poly.length < 3) return;
      if (obj.fill) fillPoly(ctx, poly, obj.fill);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y); for (const p of poly) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.clip();
      const b = polygonBounds(poly);
      ctx.strokeStyle = obj.color || WHITE; ctx.lineWidth = obj.width || LINE_W;
      ctx.beginPath();
      for (let x = b.x - b.h; x < b.x + b.w + b.h; x += 1.0) { ctx.moveTo(x, b.y); ctx.lineTo(x + b.h, b.y + b.h); }
      ctx.stroke();
      ctx.restore();
      strokePoly(ctx, poly, true, obj.color || WHITE, obj.width || LINE_W);
      return;
    }
    case 'grass': case 'pavement': case 'asphalt': {
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      fillPoly(ctx, poly, obj.fill || (v === 'grass' ? GRASS : v === 'pavement' ? CONCRETE : ASPHALT));
      if (v !== 'asphalt') strokePoly(ctx, poly, true, CURB, 0.12);
      return;
    }
    case 'curb': {
      strokePoly(ctx, pts, closed, obj.color || CONCRETE_DARK, obj.width || 0.3);
      return;
    }
    default: {
      const poly = pts.map((p) => ({ x: p.x, y: p.y }));
      if (closed && obj.fill) fillPoly(ctx, poly, obj.fill);
      if (obj.style === 'none' || obj.width <= 0) return;
      const color = obj.color;
      const w = obj.width;
      const scaleDash = (d?: number[]) => d?.map((x) => x * Math.max(1, (w / LINE_W) ** 0.5));
      const off = w / 2 + DOUBLE_GAP / 2;
      switch (obj.style) {
        case 'double':
          strokePoly(ctx, offsetPolyline(flat, () => -off), closed, color, w);
          strokePoly(ctx, offsetPolyline(flat, () => off), closed, color, w);
          break;
        case 'doubleDashedLeft':
          strokePoly(ctx, offsetPolyline(flat, () => -off), closed, color, w, scaleDash(dashFor('dashed')));
          strokePoly(ctx, offsetPolyline(flat, () => off), closed, color, w);
          break;
        case 'doubleDashedRight':
          strokePoly(ctx, offsetPolyline(flat, () => -off), closed, color, w);
          strokePoly(ctx, offsetPolyline(flat, () => off), closed, color, w, scaleDash(dashFor('dashed')));
          break;
        default:
          strokePoly(ctx, poly, closed, color, obj.style === 'edge' ? Math.max(w, 0.2) : w, scaleDash(dashFor(obj.style)));
      }
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

export function drawObject(ctx: Ctx, obj: Exclude<BzObject, { type: 'symbol' }>, opts: { noGlyphs?: boolean } = {}) {
  switch (obj.type) {
    case 'strip': return drawStrip(ctx, obj, opts);
    case 'line': return drawLine(ctx, obj);
    case 'text': return drawText(ctx, obj);
  }
}
