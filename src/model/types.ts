import type { Units } from './units';

// ───────────────────────── Lanes (cross-section of a strip) ─────────────────────────

/** Kinds of lanes/strips a cross-section is made of (left -> right looking along the path). */
export type LaneKind =
  | 'drive'          // pas ruchu
  | 'turn'           // pas do skrętu
  | 'bike'           // pas ruchu dla rowerów (na jezdni, 1.5 m)
  | 'bikePath'       // droga dla rowerów (wydzielona, czerwona nawierzchnia, 2.0 / 2.5 m)
  | 'bus'            // buspas (3.5 m)
  | 'parking'        // parkowanie równoległe
  | 'parkingPerp'    // parkowanie prostopadłe
  | 'parkingAngle'   // parkowanie skośne
  | 'tram'           // torowisko tramwajowe (jeden tor)
  | 'median'         // pas dzielący / wyspa (beton)
  | 'green'          // pas zieleni (trawa)
  | 'buffer'         // powierzchnia wyłączona z ruchu P-21 (szrafura)
  | 'separator'      // separator / krawężnik (wąski, beton)
  | 'sidewalk'       // chodnik
  | 'path'           // ciąg pieszo-rowerowy
  | 'shoulder';      // pobocze

/**
 * Geometry of a painted line (Polish P-1 … P-7, P-12 … P-14). The code (P-1b, P-2a, …) only picks
 * the values below; what is drawn is always `style` + `width` + `dash`.
 *  solid              linia ciągła
 *  dashed             linia przerywana (dash = [kreska, przerwa] w metrach)
 *  double             linia podwójna ciągła (P-4)
 *  doubleDashedLeft   linia jednostronnie przekraczalna, przerywana po lewej (P-3)
 *  doubleDashedRight  … przerywana po prawej (P-3)
 *  doubleDashed       linia podwójna przerywana (P-5)
 *  triangles          linia warunkowego zatrzymania z trójkątów (P-13)
 *  blocks             linia warunkowego zatrzymania z prostokątów (P-14)
 *  none               nic nie jest malowane (tylko wypełnienie kształtu)
 */
export type LineStyle =
  | 'solid'
  | 'dashed'
  | 'double'
  | 'doubleDashedLeft'
  | 'doubleDashedRight'
  | 'doubleDashed'
  | 'triangles'
  | 'blocks'
  | 'none';

export interface LineSpec {
  style: LineStyle;
  /** stroke width in meters (0.12 wąska, 0.24 szeroka, 0.5 linie zatrzymania) */
  width: number;
  /** [kreska, przerwa] in meters for dashed styles */
  dash?: [number, number];
  /** hex; white = standard, yellow = oznakowanie tymczasowe */
  color: string;
}

/** A line painted on the edge of a strip (or between lanes). */
export type Divider = LineSpec;

/** Polish codes of painted lines (drawn with the marking tool or set on a strip edge). */
export type LineCode =
  | 'p1a' | 'p1b' | 'p1c' | 'p1d' | 'p1e'
  | 'p2a' | 'p2b'
  | 'p3a' | 'p3b'
  | 'p4' | 'p5' | 'p6'
  | 'p7a' | 'p7b' | 'p7c' | 'p7d'
  | 'p12' | 'p13' | 'p14'
  | 'custom';

/**
 * Markings painted along a lane (Polish codes):
 *  p8a na wprost · p8b w lewo · p8c do zawracania · p8d w prawo · p8e na wprost lub w lewo
 *  p8f na wprost lub w prawo · p8g w lewo lub w prawo · p8h na wprost, w lewo lub w prawo · p8i na wprost i do zawracania
 *  p9a / p9b strzałki naprowadzające · p22 napis BUS · p23 rower · p18 stanowiska postojowe · p21 powierzchnia wyłączona
 *  tracks tory tramwajowe (konstrukcja, nie farba)
 */
export type LaneMarking =
  | 'none'
  | 'p8a' | 'p8b' | 'p8c' | 'p8d' | 'p8e' | 'p8f' | 'p8g' | 'p8h' | 'p8i'
  | 'p9a' | 'p9b'
  | 'p22' | 'p23' | 'p18' | 'p21'
  | 'tracks';

export interface Lane {
  kind: LaneKind;
  /** width in meters */
  width: number;
  /** 1 = flows along the path direction, -1 = against it, 0 = no flow */
  dir: 1 | -1 | 0;
  marking?: LaneMarking;
  /** spacing of repeated glyphs along the lane (m); default 15 (strzałki co 15 m w terenie zabudowanym) */
  markGap?: number;
  /** how many glyphs from the exit end of the lane; 0 = along the whole lane; default 3 */
  markCount?: number;
  /** Optional surface tint override (hex) */
  surface?: string;
}

export interface RoadSpec {
  /** Cross-section at the START of the path, left->right looking along the path. */
  lanes: Lane[];
  /** Dividers between consecutive lanes; auto when omitted. */
  dividers?: Divider[];
  edgeLeft?: Divider;
  edgeRight?: Divider;
  /** Optional cross-section at the END for transitions (tapered along the path). */
  lanesEnd?: Lane[];
  anchor?: 'left' | 'right' | 'center';
  /**
   * Lateral shift of the whole cross-section relative to the path (meters, + = right of travel).
   * 0 = path runs through the middle.
   */
  offset?: number;
  /** offset at the END of the path (transitions between two different strips); defaults to `offset` */
  offsetEnd?: number;
}

// ───────────────────────── Paths (Figma-like vector) ─────────────────────────

export interface Vec2 { x: number; y: number }

export interface PathNode {
  /** anchor point (object-local meters) */
  x: number;
  y: number;
  /** incoming handle (absolute local coords); undefined = straight segment arriving here */
  hIn?: Vec2;
  /** outgoing handle */
  hOut?: Vec2;
  /** 'smooth' keeps hIn/hOut collinear (mirrored), 'corner' lets them move independently */
  mode?: 'smooth' | 'corner';
}

export interface PathData {
  nodes: PathNode[];
  closed: boolean;
}

// ───────────────────────── Objects on the board ─────────────────────────

export interface BaseObj {
  id: string;
  type: string;
  x: number;
  y: number;
  /** degrees, clockwise */
  rotation: number;
  locked?: boolean;
  visible?: boolean;
  name?: string;
  opacity?: number;
  /** objects with the same groupId are selected / moved / extended together (Ctrl+G) */
  groupId?: string;
}

/** Reference to one end of a path object. */
export interface EndRef { id: string; atStart: boolean }

/** A strip (pas / jezdnia): a cross-section swept along a bezier path. */
export interface StripObj extends BaseObj {
  type: 'strip';
  path: PathData;
  spec: RoadSpec;
  /** set on łączniki created with the link tool: which ends this piece connects */
  link?: { a: EndRef; b: EndRef };
}

/** A marking path (znak poziomy) or a surface shape. */
export type LineVariant =
  | 'plain'        // linia (styl + kolor) / wielokąt z wypełnieniem
  | 'crosswalk'    // P-10 zebra wzdłuż ścieżki (width = szerokość przejścia)
  | 'bikeCrossing' // P-11 przejazd dla rowerzystów
  | 'hatch'        // P-21 powierzchnia wyłączona (zamknięty)
  | 'zigzag'       // P-17 linia przystankowa
  | 'yieldTriangle' // P-15 trójkąt podporządkowania wzdłuż ścieżki (wierzchołek na początku, podstawa na końcu)
  | 'curb'         // krawężnik
  | 'grass'        // trawnik (wielokąt)
  | 'pavement'     // chodnik / plac (wielokąt)
  | 'asphalt';     // nawierzchnia (wielokąt)

export interface LineObj extends BaseObj {
  type: 'line';
  path: PathData;
  width: number;    // stroke width (or crossing width) in meters
  style: LineStyle;
  dash?: [number, number];
  color: string;    // hex
  fill?: string;    // hex (closed shapes / crossing background)
  variant: LineVariant;
  /** Polish code this line was created from (for the inspector); 'custom' when edited */
  code?: LineCode;
}

/** Library symbol (vehicle, sign, tree, arrow, word...). Local origin = symbol center. */
export interface SymbolObj extends BaseObj {
  type: 'symbol';
  symbolId: string;
  width: number;
  height: number;
  color?: string;
  flipX?: boolean;
}

export interface TextObj extends BaseObj {
  type: 'text';
  text: string;
  /** glyph height in meters */
  fontSize: number;
  color: string;
  /** pavement words are stretched along the travel direction (e.g. 2.5) */
  stretch: number;
  fontFamily?: string;
  background?: string;
}

export type BzObject = StripObj | LineObj | SymbolObj | TextObj;

// ───────────────────────── Project ─────────────────────────

export interface GeoRef { lat: number; lng: number; zoom: number }

export type Background =
  | { kind: 'blank'; color: string }
  | { kind: 'image'; dataUrl: string; widthM: number; heightM: number; geo?: GeoRef; opacity?: number };

export interface Project {
  version: 3;
  name: string;
  units: Units;
  widthM: number;
  heightM: number;
  pxPerMeter: number;
  background: Background;
  /** creation order; what is drawn above what is decided by the object's category (see canvas/draw.ts) */
  objects: BzObject[];
  updatedAt: number;
}

// ───────────────────────── Library ─────────────────────────

/** Something you pick in the library. */
export type DrawTemplate =
  /** a strip drawn with pen / line */
  | { kind: 'strip'; spec: RoadSpec }
  /** a line / shape drawn with pen / marking tool / rect / ellipse */
  | { kind: 'line'; width: number; style: LineStyle; dash?: [number, number]; color: string; fill?: string; variant: LineVariant; closedOnly?: boolean; code?: LineCode }
  /** a glyph applied to a lane with the marking tool (click on the lane) */
  | { kind: 'laneMarking'; marking: LaneMarking };

export interface Preset {
  id: string;
  name: string;
  /** 'Nawierzchnia' | 'Oznakowanie' */
  category: string;
  group?: string;
  template: DrawTemplate;
  tags?: string[];
  description?: string;
}

/** A single strip the user can ADD to an existing cross-section from the lane editor. */
export interface LaneTemplate {
  id: string;
  name: string;
  lane: Lane;
  description?: string;
}

// ───────────────────────── Symbols ─────────────────────────

export type SymbolCategory =
  | 'vehicles'
  | 'people'
  | 'arrows'
  | 'markings'
  | 'words'
  | 'signs'
  | 'trees'
  | 'furniture';

export interface SymbolDef {
  id: string;
  name: string;
  category: SymbolCategory;
  width: number;
  height: number;
  svg: string;
  defaultColor?: string;
  tags?: string[];
}
