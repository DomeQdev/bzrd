import type { Units } from './units';

// ───────────────────────── Lanes (cross-section of a strip) ─────────────────────────

/** Kinds of lanes/strips a cross-section is made of (left -> right looking along the path). */
export type LaneKind =
  | 'drive'          // pas ruchu
  | 'turn'           // pas do skrętu (strzałki P-8)
  | 'bike'           // pas ruchu dla rowerów (na jezdni, P-23, 1.5 m)
  | 'bikePath'       // droga dla rowerów (wydzielona, czerwona nawierzchnia, 2.0 / 2.5 m)
  | 'bus'            // buspas (P-22 "BUS", 3.5 m)
  | 'parking'        // parkowanie równoległe (P-19 / P-18)
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
 * Line styles — Polish horizontal markings:
 *  solid             P-2 linia pojedyncza ciągła
 *  dashed            P-1 linia pojedyncza przerywana (2 m / 4 m w terenie zabudowanym)
 *  dashedLong        P-6 linia ostrzegawcza (4 m / 2 m)
 *  dotted            P-1c linia krótka (1 m / 1 m) przy skrzyżowaniach
 *  double            P-4 linia podwójna ciągła
 *  doubleDashedLeft  P-3 linia jednostronnie przekraczalna (przerywana po lewej)
 *  doubleDashedRight P-3 (przerywana po prawej)
 *  edge              P-7 linia krawędziowa
 *  none              brak
 */
export type LineStyle =
  | 'solid'
  | 'dashed'
  | 'dashedLong'
  | 'dotted'
  | 'double'
  | 'doubleDashedLeft'
  | 'doubleDashedRight'
  | 'edge'
  | 'none';
/** white = standard; yellow = oznakowanie tymczasowe (roboty drogowe) */
export type LineColor = 'white' | 'yellow';

export interface Divider {
  style: LineStyle;
  color: LineColor;
}

export interface Lane {
  kind: LaneKind;
  /** width in meters */
  width: number;
  /** 1 = flows along the path direction, -1 = against it, 0 = no flow */
  dir: 1 | -1 | 0;
  marking?: 'none' | 'bikeSymbols' | 'busText' | 'tramTracks' | 'parkingBays' | 'hatch'
    | 'arrowsStraight' | 'arrowsLeft' | 'arrowsRight' | 'arrowsStraightLeft' | 'arrowsStraightRight' | 'arrowsLeftRight' | 'arrowsAll' | 'arrowsUturn';
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
   * 0 = path runs through the middle. Changed automatically when lanes are added with
   * "Zachowaj położenie pasów" so existing lanes stay where they are on the map.
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

/** A strip (pas / jezdnia): a cross-section swept along a bezier path. */
export interface StripObj extends BaseObj {
  type: 'strip';
  path: PathData;
  spec: RoadSpec;
}

/** A marking path (znak poziomy liniowy) or a plain shape. */
export type LineVariant =
  | 'plain'        // zwykła linia / wielokąt (styl + kolor + wypełnienie)
  | 'crosswalk'    // P-10 zebra wzdłuż ścieżki (width = szerokość przejścia)
  | 'bikeCrossing' // P-11 przejazd dla rowerzystów
  | 'hatch'        // P-21 powierzchnia wyłączona (zamknięty)
  | 'zigzag'       // P-17 linia przystankowa
  | 'curb'         // krawężnik
  | 'grass'        // trawnik (wielokąt)
  | 'pavement'     // chodnik / plac (wielokąt)
  | 'asphalt';     // nawierzchnia (wielokąt)

export interface LineObj extends BaseObj {
  type: 'line';
  path: PathData;
  width: number;    // stroke width (or crossing width) in meters
  style: LineStyle;
  color: string;    // hex
  fill?: string;    // hex (closed shapes)
  variant: LineVariant;
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
  version: 2;
  name: string;
  units: Units;
  widthM: number;
  heightM: number;
  pxPerMeter: number;
  background: Background;
  /** bottom -> top */
  objects: BzObject[];
  updatedAt: number;
}

// ───────────────────────── Library ─────────────────────────

/** Something you pick in the library and then DRAW with pen / line / rect / ellipse. */
export type DrawTemplate =
  | { kind: 'strip'; spec: RoadSpec }
  | { kind: 'line'; width: number; style: LineStyle; color: string; fill?: string; variant: LineVariant; closedOnly?: boolean };

export interface Preset {
  id: string;
  name: string;
  /** 'Pasy' | 'Znaki poziome' */
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
