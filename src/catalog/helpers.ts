import type { Divider, Lane, LaneKind, LaneMarking, LineCode, LineSpec, RoadSpec } from '../model/types';
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
export type LaneExtra = Partial<Pick<Lane, 'marking' | 'surface'>>;

/** Surface tints */
export const RED_ASPHALT = '#b5423a'; // droga dla rowerów
export const GRASS_TRACK = '#5b8a3c'; // torowisko zielone
export const PAVERS = '#9a948a';      // kostka (strefa zamieszkania)

export const WHITE = '#f4f4f4';
export const YELLOW = '#f2c230';

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

/**
 * V2: a lane is asphalt first — paint is added later with the marking tool. Only structural
 * markings are implied by the kind (tram rails, P-21 hatch of a buffer strip).
 */
export const DEFAULT_MARKING: Partial<Record<LaneKind, LaneMarking>> = {
  tram: 'tracks',
  buffer: 'p21',
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

export function laneMarkingOf(l: Lane): LaneMarking {
  return l.marking ?? DEFAULT_MARKING[l.kind] ?? 'none';
}

// ───────────────────────── painted lines (Polish P-1 … P-14) ─────────────────────────

export interface LineCodeDef {
  code: LineCode;
  name: string;
  short: string;
  spec: Omit<LineSpec, 'color'>;
  description: string;
}

/**
 * Wymiary wg załącznika nr 2 do rozporządzenia w sprawie szczegółowych warunków technicznych
 * dla znaków i sygnałów drogowych (Dz.U. 2019 poz. 2311) — odmiany dla dróg o V ≤ 70 km/h.
 */
export const LINE_CODES: LineCodeDef[] = [
  { code: 'p1a', short: 'P-1a', name: 'P-1a linia pojedyncza przerywana – długa', spec: { style: 'dashed', width: 0.12, dash: [4, 8] }, description: 'Kreska 4 m / przerwa 8 m. Pasy ruchu między skrzyżowaniami, V > 70 km/h' },
  { code: 'p1b', short: 'P-1b', name: 'P-1b linia pojedyncza przerywana – krótka', spec: { style: 'dashed', width: 0.12, dash: [2, 4] }, description: 'Kreska 2 m / przerwa 4 m. Pasy ruchu między skrzyżowaniami, V ≤ 70 km/h (miasto)' },
  { code: 'p1c', short: 'P-1c', name: 'P-1c linia przerywana – wydzielająca', spec: { style: 'dashed', width: 0.24, dash: [2, 2] }, description: 'Szeroka 0,24 m, 2 m / 2 m. Pasy włączania, wyłączania, początek buspasa / pasa rowerowego' },
  { code: 'p1d', short: 'P-1d', name: 'P-1d linia przerywana – prowadząca wąska', spec: { style: 'dashed', width: 0.12, dash: [1, 1] }, description: '1 m / 1 m. Prowadzenie pasów przez skrzyżowanie' },
  { code: 'p1e', short: 'P-1e', name: 'P-1e linia przerywana – prowadząca szeroka', spec: { style: 'dashed', width: 0.24, dash: [1, 1] }, description: 'Szeroka 0,24 m, 1 m / 1 m. Kontynuacja P-4 / P-3a przez skrzyżowanie' },
  { code: 'p2a', short: 'P-2a', name: 'P-2a linia pojedyncza ciągła – wąska', spec: { style: 'solid', width: 0.12 }, description: 'Zakaz zmiany pasa' },
  { code: 'p2b', short: 'P-2b', name: 'P-2b linia pojedyncza ciągła – szeroka', spec: { style: 'solid', width: 0.24 }, description: 'Wydzielenie buspasa / pasa rowerowego' },
  { code: 'p3a', short: 'P-3a', name: 'P-3a linia jednostronnie przekraczalna – długa', spec: { style: 'doubleDashedLeft', width: 0.12, dash: [2, 4] }, description: 'Podwójna: przerywana 2 m / 4 m + ciągła. Odstęp 0,12 m' },
  { code: 'p3b', short: 'P-3b', name: 'P-3b linia jednostronnie przekraczalna – krótka', spec: { style: 'doubleDashedLeft', width: 0.12, dash: [1, 1] }, description: 'Podwójna: przerywana 1 m / 1 m + ciągła. Skrzyżowania, wyjazdy' },
  { code: 'p4', short: 'P-4', name: 'P-4 linia podwójna ciągła', spec: { style: 'double', width: 0.12 }, description: 'Oś jezdni, zakaz przekraczania w obu kierunkach' },
  { code: 'p5', short: 'P-5', name: 'P-5 linia podwójna przerywana', spec: { style: 'doubleDashed', width: 0.12, dash: [2, 4] }, description: 'Pas o zmiennym kierunku ruchu' },
  { code: 'p6', short: 'P-6', name: 'P-6 linia ostrzegawcza', spec: { style: 'dashed', width: 0.12, dash: [4, 2] }, description: 'Kreska 4 m / przerwa 2 m, przed linią ciągłą' },
  { code: 'p7a', short: 'P-7a', name: 'P-7a linia krawędziowa – przerywana szeroka', spec: { style: 'dashed', width: 0.24, dash: [1, 1] }, description: 'Krawędź jezdni przy poboczu / zjazdach, 0,24 m' },
  { code: 'p7b', short: 'P-7b', name: 'P-7b linia krawędziowa – ciągła szeroka', spec: { style: 'solid', width: 0.24 }, description: 'Krawędź jezdni, obwiednia P-21, oddzielenie torowiska' },
  { code: 'p7c', short: 'P-7c', name: 'P-7c linia krawędziowa – przerywana wąska', spec: { style: 'dashed', width: 0.12, dash: [1, 1] }, description: 'Krawędź jezdni na drogach niższych klas' },
  { code: 'p7d', short: 'P-7d', name: 'P-7d linia krawędziowa – ciągła wąska', spec: { style: 'solid', width: 0.12 }, description: 'Krawędź jezdni na drogach niższych klas' },
  { code: 'p12', short: 'P-12', name: 'P-12 linia bezwzględnego zatrzymania – stop', spec: { style: 'solid', width: 0.5 }, description: 'Linia 0,5 m przy znaku B-20 (rysuj w poprzek pasa)' },
  { code: 'p13', short: 'P-13', name: 'P-13 linia warunkowego zatrzymania z trójkątów', spec: { style: 'triangles', width: 0.7 }, description: 'Trójkąty 0,5 × 0,7 m co 0,75 m, wierzchołkiem do kierowcy (A-7)' },
  { code: 'p14', short: 'P-14', name: 'P-14 linia warunkowego zatrzymania z prostokątów', spec: { style: 'blocks', width: 0.5, dash: [0.75, 0.25] }, description: 'Prostokąty 0,75 × 0,5 m co 1 m (sygnalizacja, przejścia)' },
  { code: 'custom', short: 'własna', name: 'Linia własna', spec: { style: 'solid', width: 0.12 }, description: 'Dowolny styl, grubość i kolor' },
];

const CODE_BY_ID = new Map(LINE_CODES.map((c) => [c.code, c]));
export function lineCode(code: LineCode): LineCodeDef {
  return CODE_BY_ID.get(code) ?? CODE_BY_ID.get('custom')!;
}

/** Full line spec for a Polish code (white by default). */
export function lineSpec(code: LineCode, color = WHITE): LineSpec {
  return { ...lineCode(code).spec, color };
}

/** Find the code matching a spec exactly (style, width, dash) — or 'custom'. */
export function codeOfSpec(s: Omit<LineSpec, 'color'>): LineCode {
  for (const c of LINE_CODES) {
    if (c.code === 'custom') continue;
    const d = c.spec;
    const sameDash = (d.dash?.[0] ?? 0) === (s.dash?.[0] ?? 0) && (d.dash?.[1] ?? 0) === (s.dash?.[1] ?? 0);
    if (d.style === s.style && Math.abs(d.width - s.width) < 1e-6 && (d.style === 'solid' || d.style === 'double' || sameDash)) return c.code;
  }
  return 'custom';
}

export const LINE_STYLE_LABEL: Record<LineSpec['style'], string> = {
  solid: 'ciągła',
  dashed: 'przerywana',
  double: 'podwójna ciągła',
  doubleDashedLeft: 'podwójna, przerywana z lewej',
  doubleDashedRight: 'podwójna, przerywana z prawej',
  doubleDashed: 'podwójna przerywana',
  triangles: 'trójkąty (P-13)',
  blocks: 'prostokąty (P-14)',
  none: 'brak',
};

// ───────────────────────── dividers between lanes (auto, Polish rules) ─────────────────────────

export const D = {
  p1b: lineSpec('p1b'),
  p1c: lineSpec('p1c'),
  p2a: lineSpec('p2a'),
  p2b: lineSpec('p2b'),
  p3a: lineSpec('p3a'),
  p4: lineSpec('p4'),
  p6: lineSpec('p6'),
  p7b: lineSpec('p7b'),
  none: { style: 'none', width: 0, color: WHITE } as LineSpec,
} as const;

/** Strips with their own curb / no painted line next to them. */
const NO_LINE: LaneKind[] = ['median', 'green', 'separator', 'sidewalk', 'bikePath', 'path', 'buffer'];
const PARKING_KINDS: LaneKind[] = ['parking', 'parkingPerp', 'parkingAngle'];

const opposite = (a: Lane, b: Lane) => a.dir !== 0 && b.dir !== 0 && a.dir !== b.dir;
const is = (l: Lane, ...kinds: LaneKind[]) => kinds.includes(l.kind);

/** Default divider between lane `a` (left) and lane `b` (right) for legacy multi-lane strips. */
export function dividerBetween(a: Lane, b: Lane): Divider {
  if (is(a, ...NO_LINE) || is(b, ...NO_LINE)) return D.none;
  if (is(a, 'shoulder') || is(b, 'shoulder')) return is(a, 'shoulder') && is(b, 'shoulder') ? D.none : D.p7b;
  if (is(a, 'tram') && is(b, 'tram')) return D.none;
  if (is(a, 'tram') || is(b, 'tram')) return D.p7b;
  if (is(a, 'turn') || is(b, 'turn')) {
    if (is(a, 'turn', 'drive') && is(b, 'turn', 'drive')) return opposite(a, b) ? D.p4 : D.p1b;
    return D.p2a;
  }
  if (is(a, 'drive') && is(b, 'drive')) return D.p1b;
  if (is(a, 'bus') && is(b, 'bus')) return opposite(a, b) ? D.p4 : D.p1b;
  if (is(a, 'bike') && is(b, 'bike')) return D.p1b;
  if (is(a, ...PARKING_KINDS) && is(b, ...PARKING_KINDS)) return D.none;
  if (is(a, 'bus') || is(b, 'bus') || is(a, 'bike') || is(b, 'bike')) return D.p2b;
  return D.p2a;
}

/** Auto dividers (length = lanes.length - 1). */
export function autoDividers(lanes: Lane[]): Divider[] {
  const out: Divider[] = [];
  for (let i = 0; i < lanes.length - 1; i++) out.push(dividerBetween(lanes[i], lanes[i + 1]));
  return out;
}

// ───────────────────────── specs ─────────────────────────

export function road(lanes: Lane[], extra: Partial<RoadSpec> = {}): RoadSpec {
  return { lanes, ...extra };
}

// ───────────────────────── labels ─────────────────────────

export const LANE_KIND_LABEL: Record<LaneKind, string> = {
  drive: 'Pas ruchu',
  turn: 'Pas do skrętu',
  bike: 'Pas ruchu dla rowerów',
  bikePath: 'Droga dla rowerów',
  bus: 'Buspas',
  parking: 'Parkowanie równoległe',
  parkingPerp: 'Parkowanie prostopadłe',
  parkingAngle: 'Parkowanie skośne',
  tram: 'Torowisko',
  median: 'Pas dzielący',
  green: 'Zieleń',
  buffer: 'Pow. wyłączona (P-21)',
  separator: 'Separator',
  sidewalk: 'Chodnik',
  path: 'Ciąg pieszo-rowerowy',
  shoulder: 'Pobocze',
};

export const LANE_MARKING_LABEL: Record<LaneMarking, string> = {
  none: 'brak',
  p8a: 'P-8a na wprost',
  p8b: 'P-8b w lewo',
  p8c: 'P-8c do zawracania',
  p8d: 'P-8d w prawo',
  p8e: 'P-8e na wprost lub w lewo',
  p8f: 'P-8f na wprost lub w prawo',
  p8g: 'P-8g w lewo lub w prawo',
  p8h: 'P-8h na wprost, w lewo lub w prawo',
  p8i: 'P-8i na wprost i do zawracania',
  p9a: 'P-9a naprowadzająca w lewo',
  p9b: 'P-9b naprowadzająca w prawo',
  p22: 'P-22 napis BUS',
  p23: 'P-23 rower',
  p18: 'P-18 stanowiska postojowe',
  p21: 'P-21 powierzchnia wyłączona',
  tracks: 'tory tramwajowe',
};

export const LANE_MARKINGS: LaneMarking[] = ['none', 'p8a', 'p8b', 'p8c', 'p8d', 'p8e', 'p8f', 'p8g', 'p8h', 'p8i', 'p9a', 'p9b', 'p22', 'p23', 'p18', 'p21', 'tracks'];
