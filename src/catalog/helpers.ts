import type { Divider, Lane, LaneKind, RoadSpec } from '../model/types';
import {
  BIKE_LANE_W,
  BIKE_PATH_W,
  BUFFER_W,
  BUS_W,
  DRIVE_W,
  GREEN_W,
  MEDIAN_W,
  PARKING_ANGLE_W,
  PARKING_PAR_W,
  PARKING_PERP_W,
  PATH_W,
  SEPARATOR_W,
  SHOULDER_W,
  SIDEWALK_W,
  TRAM_W,
  TURN_W,
} from '../model/units';

export type Dir = Lane['dir'];
export type Marking = NonNullable<Lane['marking']>;
export type LaneExtra = Partial<Pick<Lane, 'marking' | 'surface'>>;

/** Surface tints */
export const RED_ASPHALT = '#b5423a'; // droga dla rowerów
export const GRASS_TRACK = '#5b8a3c'; // torowisko zielone
export const PAVERS = '#9a948a';      // kostka (strefa zamieszkania)

/** Default length (m) for transition presets (dodanie / zakończenie pasa). */
export const TRANSITION_LENGTH = 40;

// ───────────────────────── lanes ─────────────────────────

const DEFAULT_WIDTH: Record<LaneKind, number> = {
  drive: DRIVE_W,
  turn: TURN_W,
  bike: BIKE_LANE_W,
  bikePath: BIKE_PATH_W,
  bus: BUS_W,
  parking: PARKING_PAR_W,
  parkingPerp: PARKING_PERP_W,
  parkingAngle: PARKING_ANGLE_W,
  tram: TRAM_W,
  median: MEDIAN_W,
  green: GREEN_W,
  buffer: BUFFER_W,
  separator: SEPARATOR_W,
  sidewalk: SIDEWALK_W,
  path: PATH_W,
  shoulder: SHOULDER_W,
};

const DEFAULT_MARKING: Partial<Record<LaneKind, Marking>> = {
  bike: 'bikeSymbols',
  bikePath: 'bikeSymbols',
  bus: 'busText',
  tram: 'tramTracks',
  parking: 'parkingBays',
  parkingPerp: 'parkingBays',
  parkingAngle: 'parkingBays',
  turn: 'arrowsLeft',
  buffer: 'hatch',
};

const DEFAULT_SURFACE: Partial<Record<LaneKind, string>> = {
  bikePath: RED_ASPHALT,
};

/** Generic lane builder with per-kind default width, marking and surface. */
export function lane(kind: LaneKind, dir: Dir, width?: number, extra: LaneExtra = {}): Lane {
  const l: Lane = { kind, width: width ?? DEFAULT_WIDTH[kind], dir };
  const marking = extra.marking ?? DEFAULT_MARKING[kind];
  const surface = extra.surface ?? DEFAULT_SURFACE[kind];
  if (marking) l.marking = marking;
  if (surface) l.surface = surface;
  return l;
}

export const drive = (dir: Dir, w?: number, extra?: LaneExtra) => lane('drive', dir, w, extra);
/** Pas do skrętu (default: w lewo). */
export const turn = (dir: Dir, side: 'left' | 'right' = 'left', w?: number) =>
  lane('turn', dir, w, { marking: side === 'left' ? 'arrowsLeft' : 'arrowsRight' });
export const bike = (dir: Dir, w?: number) => lane('bike', dir, w);
export const bikePath = (dir: Dir, w?: number) => lane('bikePath', dir, w);
export const bus = (dir: Dir, w?: number) => lane('bus', dir, w);
export const tram = (dir: Dir, w?: number, extra?: LaneExtra) => lane('tram', dir, w, extra);
export const parking = (w?: number) => lane('parking', 0, w);
export const parkingPerp = (w?: number) => lane('parkingPerp', 0, w);
export const parkingAngle = (w?: number) => lane('parkingAngle', 0, w);
export const median = (w?: number) => lane('median', 0, w);
export const green = (w?: number) => lane('green', 0, w);
export const separator = (w?: number) => lane('separator', 0, w);
export const buffer = (w?: number) => lane('buffer', 0, w);
export const sidewalk = (w?: number) => lane('sidewalk', 0, w);
export const path = (w?: number) => lane('path', 0, w);
export const shoulder = (w?: number) => lane('shoulder', 0, w);

const rep = (n: number, f: () => Lane): Lane[] => Array.from({ length: n }, f);

export interface TwoWayOpts {
  /** lanes toward +x (right side); default = nPerDir */
  right?: number;
  /** drive lane width; default DRIVE_W */
  width?: number;
  /** strip between the two directions */
  center?: 'median' | 'green' | 'separator' | Lane;
}

/**
 * Two-way carriageway: `nPerDir` lanes toward -x on the LEFT, then the optional center strip,
 * then `opts.right ?? nPerDir` lanes toward +x on the right.
 */
export function twoWay(nPerDir: number, opts: TwoWayOpts = {}): Lane[] {
  const w = opts.width;
  const c = opts.center;
  const mid: Lane[] =
    c === undefined ? [] : c === 'median' ? [median()] : c === 'green' ? [green()] : c === 'separator' ? [separator()] : [c];
  return [...rep(nPerDir, () => drive(-1, w)), ...mid, ...rep(opts.right ?? nPerDir, () => drive(1, w))];
}

export function oneWay(n: number, dir: 1 | -1 = 1, w?: number): Lane[] {
  return rep(n, () => drive(dir, w));
}

// ───────────────────────── dividers (Polish markings) ─────────────────────────

const div = (style: Divider['style']): Divider => ({ style, color: 'white' });

export const D = {
  /** P-1 linia pojedyncza przerywana */
  p1: div('dashed'),
  /** P-1c linia krótka (przy skrzyżowaniach) */
  p1c: div('dotted'),
  /** P-2 linia pojedyncza ciągła */
  p2: div('solid'),
  /** P-3 linia jednostronnie przekraczalna (przerywana po lewej) */
  p3L: div('doubleDashedLeft'),
  /** P-3 linia jednostronnie przekraczalna (przerywana po prawej) */
  p3R: div('doubleDashedRight'),
  /** P-4 linia podwójna ciągła */
  p4: div('double'),
  /** P-6 linia ostrzegawcza */
  p6: div('dashedLong'),
  /** P-7 linia krawędziowa */
  p7: div('edge'),
  none: div('none'),
} as const;

/** Strips with their own curb / no painted line next to them. */
const NO_LINE: LaneKind[] = ['median', 'green', 'separator', 'sidewalk', 'bikePath', 'path', 'buffer'];
const PARKING_KINDS: LaneKind[] = ['parking', 'parkingPerp', 'parkingAngle'];

const opposite = (a: Lane, b: Lane) => a.dir !== 0 && b.dir !== 0 && a.dir !== b.dir;
const is = (l: Lane, ...kinds: LaneKind[]) => kinds.includes(l.kind);

/** Default divider between lane `a` (left) and lane `b` (right), Polish rules. */
export function dividerBetween(a: Lane, b: Lane): Divider {
  if (is(a, ...NO_LINE) || is(b, ...NO_LINE)) return D.none;
  // pobocze: linia krawędziowa P-7
  if (is(a, 'shoulder') || is(b, 'shoulder')) return is(a, 'shoulder') && is(b, 'shoulder') ? D.none : D.p7;
  // torowisko
  if (is(a, 'tram') && is(b, 'tram')) return D.none;
  if (is(a, 'tram') || is(b, 'tram')) return D.p2;
  // pas do skrętu: P-1 do pasa w tym samym kierunku, P-4 do pasa przeciwnego
  if (is(a, 'turn') || is(b, 'turn')) {
    if (is(a, 'turn', 'drive') && is(b, 'turn', 'drive')) return opposite(a, b) ? D.p4 : D.p1;
    return D.p2;
  }
  // pasy ruchu: P-1 (również między przeciwnymi kierunkami — użytkownik może zmienić na P-4)
  if (is(a, 'drive') && is(b, 'drive')) return D.p1;
  if (is(a, 'bus') && is(b, 'bus')) return opposite(a, b) ? D.p4 : D.p1;
  if (is(a, 'bike') && is(b, 'bike')) return D.p1;
  // drive/bus ↔ bike, drive ↔ bus, drive ↔ parking, bike ↔ parking ...
  if (is(a, ...PARKING_KINDS) && is(b, ...PARKING_KINDS)) return D.none;
  return D.p2;
}

/** Auto dividers (length = lanes.length - 1). */
export function autoDividers(lanes: Lane[]): Divider[] {
  const out: Divider[] = [];
  for (let i = 0; i < lanes.length - 1; i++) out.push(dividerBetween(lanes[i], lanes[i + 1]));
  return out;
}

/** Index of the centerline (first divider between opposite-direction lanes), or -1. */
export function centerIndex(lanes: Lane[]): number {
  for (let i = 0; i < lanes.length - 1; i++) if (opposite(lanes[i], lanes[i + 1])) return i;
  return -1;
}

/** Auto dividers with selected indices overridden. */
export function override(lanes: Lane[], overrides: Record<number, Divider>): Divider[] {
  const out = autoDividers(lanes);
  for (const [k, v] of Object.entries(overrides)) out[Number(k)] = v;
  return out;
}

/** Auto dividers with the centerline replaced (e.g. by D.p4). */
export function withCenter(lanes: Lane[], center: Divider): Divider[] {
  const i = centerIndex(lanes);
  return i < 0 ? autoDividers(lanes) : override(lanes, { [i]: center });
}

/** All dividers 'none'. */
export function blankDividers(lanes: Lane[]): Divider[] {
  return lanes.slice(1).map(() => D.none);
}

// ───────────────────────── specs ─────────────────────────

export function road(lanes: Lane[], extra: Partial<RoadSpec> = {}): RoadSpec {
  return { lanes, ...extra };
}

export function transition(
  lanes: Lane[],
  lanesEnd: Lane[],
  anchor: RoadSpec['anchor'] = 'center',
  extra: Partial<RoadSpec> = {},
): RoadSpec {
  return { lanes, lanesEnd, anchor, ...extra };
}

/** Build a legs record (intersections / roundabouts), omitting undefined legs. */
