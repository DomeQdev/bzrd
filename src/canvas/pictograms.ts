/**
 * Polish pavement pictograms: strzałki kierunkowe P-8a…i and naprowadzające P-9a/b — geometry taken from
 * the dimension drawings in załącznik nr 2 (rys. 3.2.1.2 – 3.2.2.3), "krótka" variant (V ≤ 70 km/h, 5,0 m).
 *
 * Frame: x = lateral in METERS (+ = right of travel), y = longitudinal (+ = direction of travel), tail at y = 0.
 * x = 0 is the geometric axis of the sign (oś geometryczna strzałki pokrywa się z osią pasa ruchu).
 */
import type { Vec2 } from '../model/types';

export type PictoId = 'p8a' | 'p8b' | 'p8c' | 'p8d' | 'p8e' | 'p8f' | 'p8g' | 'p8h' | 'p8i' | 'p9a' | 'p9b';

type Poly = Vec2[];

const cm = (pts: Array<[number, number]>): Poly => pts.map(([x, y]) => ({ x: x / 100, y: y / 100 }));
const mirror = (polys: Poly[]): Poly[] => polys.map((p) => p.map((v) => ({ x: -v.x, y: v.y })));

/** P-8a: shaft 15 cm, head 205 × 75 cm, total 500 cm. `sx` = shaft centre (cm). */
function straight(sx = 0): Poly[] {
  return [
    cm([[sx - 7.5, 0], [sx + 7.5, 0], [sx + 7.5, 300], [sx - 7.5, 300]]),
    cm([[sx - 37.5, 295], [sx + 37.5, 295], [sx, 500]]),
  ];
}

/** P-8b: shaft on the right of the axis, 45° neck, dart head pointing left (rys. 3.2.1.3 a). */
function turnLeft(): Poly[] {
  return [cm([[-22.5, 500], [-52.5, 370], [-22.5, 250], [-22.5, 320], [37.5, 245], [37.5, 0], [52.5, 0], [52.5, 345], [-22.5, 420]])];
}

/** P-8c: do zawracania (rys. 3.2.1.4). */
function uturn(): Poly[] {
  return [cm([[60, 0], [75, 0], [75, 425], [0, 500], [-75, 425], [-75, 265], [-105, 265], [-67.5, 60], [-30, 265], [-60, 265], [-60, 325], [0, 425], [60, 325]])];
}

/** Left branch of P-8e / P-8h attached to a shaft whose left edge is at x = `shaftLeft` (cm); overlaps the shaft to hide seams. */
function leftBranch(shaftLeft: number): Poly {
  const b = shaftLeft - 60; // back of the dart
  const s = shaftLeft + 7.5; // shaft centre
  return cm([[s, 35], [b, 110], [b, 40], [b - 30, 160], [b, 290], [b, 210], [s, 135]]);
}

/** P-8e: straight arrow (shaft centre +30 cm) + left dart (rys. 3.2.1.6 a); overall width 135 cm centred on the axis. */
function straightLeft(): Poly[] {
  return [...straight(30), leftBranch(22.5)];
}

/** P-8g: w lewo lub w prawo (rys. 3.2.1.8 a): shaft 245 cm, two darts joined by a 90° V. */
function leftRight(): Poly[] {
  return [cm([
    [-7.5, 0], [7.5, 0], [7.5, 245], [67.5, 320], [67.5, 250], [97.5, 370], [67.5, 500], [67.5, 420], [0, 345],
    [-67.5, 420], [-67.5, 500], [-97.5, 370], [-67.5, 250], [-67.5, 320], [-7.5, 245],
  ])];
}

/** P-8h: straight arrow + both darts. */
function all(): Poly[] {
  const left = leftBranch(-7.5);
  return [...straight(0), left, left.map((v) => ({ x: -v.x, y: v.y }))];
}

/** P-8i: na wprost i do zawracania — straight arrow on the right, hook with a down-pointing head on the left. */
function straightUturn(): Poly[] {
  return [
    ...straight(67.5),
    cm([[60, 165], [60, 230], [0, 330], [-60, 230], [-60, 205], [-30, 205], [-67.5, 0], [-105, 205], [-75, 205], [-75, 265], [0, 345], [75, 265], [75, 165]]),
  ];
}

/** P-9a: strzałka naprowadzająca w lewo (rys. 3.2.2.2), 290 × 500 cm. */
function guideLeft(): Poly[] {
  return [cm([[-145, 500], [15, 415], [15, 315], [145, 170], [145, 0], [15, 113], [15, 223]])];
}

const DEFS: Record<PictoId, () => Poly[]> = {
  p8a: () => straight(0),
  p8b: () => turnLeft(),
  p8c: () => uturn(),
  p8d: () => mirror(turnLeft()),
  p8e: () => straightLeft(),
  p8f: () => mirror(straightLeft()),
  p8g: () => leftRight(),
  p8h: () => all(),
  p8i: () => straightUturn(),
  p9a: () => guideLeft(),
  p9b: () => mirror(guideLeft()),
};

interface Cached { polys: Poly[]; x0: number; x1: number; y0: number; y1: number }
const cache = new Map<PictoId, Cached>();
function get(id: PictoId): Cached {
  let c = cache.get(id);
  if (!c) {
    const polys = DEFS[id]();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of polys) for (const v of p) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    c = { polys, x0, x1, y0, y1 };
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
 * Draw a pictogram at the current origin, in a frame where +x = direction of travel and +y = right of travel
 * (i.e. after ctx.rotate(heading)). The sign's AXIS (x = 0 in the definition) sits on the origin and the
 * pictogram is centred along travel. `length` = target length along travel (m); `fitWidth` = max lateral width.
 */
export function drawPictogram(ctx: CanvasRenderingContext2D, id: PictoId, opts: { length?: number; fitWidth?: number; color?: string } = {}) {
  const c = get(id);
  const w = c.x1 - c.x0, h = c.y1 - c.y0;
  let k = (opts.length ?? h) / h;
  if (opts.fitWidth !== undefined && w * k > opts.fitWidth) k = Math.max(0.05, opts.fitWidth / w);
  const cy = (c.y0 + c.y1) / 2;
  ctx.save();
  ctx.fillStyle = opts.color ?? '#f4f4f4';
  for (const p of c.polys) {
    ctx.beginPath();
    p.forEach((v, i) => {
      const X = (v.y - cy) * k, Y = v.x * k;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Standalone SVG (forward = up) for the symbol library; colour token {{color}}. */
export function pictogramSvg(id: PictoId): string {
  const c = get(id);
  const S = 100; // px per meter in the viewBox
  const W = (c.x1 - c.x0) * S, H = (c.y1 - c.y0) * S;
  const P = (v: Vec2) => `${((v.x - c.x0) * S).toFixed(1)},${((c.y1 - v.y) * S).toFixed(1)}`;
  const body = c.polys.map((p) => `<polygon points="${p.map(P).join(' ')}" fill="{{color}}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">${body}</svg>`;
}
