import type { Divider, Lane, LaneKind } from '../model/types';

// ───────────────────────── colors ─────────────────────────

export const ASPHALT = '#3a3d42';
export const ASPHALT_LIGHT = '#464a50';
export const CONCRETE = '#cfcbc3';
export const CONCRETE_DARK = '#aaa69e';
export const WHITE = '#f4f4f4';
export const YELLOW = '#f2c230';
export const RED_ASPHALT = '#b5423a';
export const BUS_RED = '#a83a31';
export const GRASS = '#5b8a3c';
export const PAVERS = '#b8b2a7';

export function laneFill(lane: Lane): string {
  if (lane.surface) return lane.surface;
  return laneBaseFill(lane.kind);
}

export function laneBaseFill(kind: LaneKind): string {
  switch (kind) {
    case 'drive':
    case 'turn':
    case 'shoulder':
    case 'bus':
    case 'bike':
    case 'buffer':
      return ASPHALT;
    case 'bikePath':
      return RED_ASPHALT;
    case 'parking':
    case 'parkingPerp':
    case 'parkingAngle':
      return ASPHALT_LIGHT;
    case 'tram':
      return '#4d5157';
    case 'median':
    case 'separator':
      return CONCRETE_DARK;
    case 'green':
      return GRASS;
    case 'sidewalk':
      return CONCRETE;
    case 'path':
      return PAVERS;
  }
}

export const LANE_KIND_LABEL: Record<LaneKind, string> = {
  drive: 'Pas ruchu',
  turn: 'Pas do skrętu',
  bike: 'Pas rowerowy',
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

export const LINE_STYLE_LABEL: Record<Divider['style'], string> = {
  solid: 'P-2 ciągła',
  dashed: 'P-1 przerywana',
  dashedLong: 'P-6 ostrzegawcza',
  dotted: 'P-1c krótka',
  double: 'P-4 podwójna ciągła',
  doubleDashedLeft: 'P-3 przekraczalna (lewa)',
  doubleDashedRight: 'P-3 przekraczalna (prawa)',
  edge: 'P-7 krawędziowa',
  none: 'brak',
};

export const LINE_W = 0.12; // meters
export const DOUBLE_GAP = 0.12;

export function lineColor(c: Divider['color']) {
  return c === 'yellow' ? YELLOW : WHITE;
}

export { autoDividers, dividerBetween } from '../catalog/helpers';


export function specWidth(lanes: Lane[]): number {
  return lanes.reduce((s, l) => s + l.width, 0);
}

// ───────────────────────── merged (tapered) cross-section ─────────────────────────

export interface MergedLane {
  lane: Lane;
  w0: number;
  w1: number;
}

function laneKey(l: Lane) {
  return `${l.kind}|${l.dir}`;
}

/** LCS-based alignment of two lane arrays so added/removed lanes taper from/to zero width. */
export function mergeLanes(start: Lane[], end?: Lane[]): MergedLane[] {
  if (!end) return start.map((l) => ({ lane: l, w0: l.width, w1: l.width }));
  const n = start.length, m = end.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = laneKey(start[i]) === laneKey(end[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: MergedLane[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && laneKey(start[i]) === laneKey(end[j])) {
      out.push({ lane: { ...end[j], marking: end[j].marking ?? start[i].marking }, w0: start[i].width, w1: end[j].width });
      i++; j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ lane: end[j], w0: 0, w1: end[j].width });
      j++;
    } else {
      out.push({ lane: start[i], w0: start[i].width, w1: 0 });
      i++;
    }
  }
  return out;
}

/** Dash pattern (meters) for a line style — Polish P-1 (2/4 in city), P-6 (4/2), P-1c (1/1). */
export function dashFor(style: Divider['style']): number[] | undefined {
  switch (style) {
    case 'dashed': return [2, 4];
    case 'dashedLong': return [4, 2];
    case 'dotted': return [1, 1];
    default: return undefined;
  }
}

/** Width of a line style's stroke (meters). P-7 edge lines are 0.24 m on G roads, 0.12 in city. */
export function strokeFor(style: Divider['style']): number {
  switch (style) {
    case 'edge': return 0.2;
    default: return LINE_W;
  }
}
