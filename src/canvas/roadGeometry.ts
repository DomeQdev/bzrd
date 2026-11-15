import type { Lane, LaneKind } from '../model/types';

// ───────────────────────── colors ─────────────────────────

export const ASPHALT = '#3a3d42';
export const ASPHALT_LIGHT = '#464a50';
export const CONCRETE = '#cfcbc3';
export const CONCRETE_DARK = '#aaa69e';
/** płyty przejazdu tramwajowego (jasny beton) */
export const TRAM_SLAB = '#d9d6cf';
/** tłuczeń torowiska wydzielonego */
export const BALLAST = '#5a5b5d';
export const RAIL = '#b7bcc2';
export const SLEEPER = '#6a6e73';
export const WHITE = '#f4f4f4';
export const YELLOW = '#f2c230';
export const RED_ASPHALT = '#b5423a';
export const GRASS = '#5b8a3c';
export const PAVERS = '#b8b2a7';
export const CURB = '#8f8b84';

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
      return BALLAST;
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

/** Lane kinds that form a carriageway: a tram crossing them becomes a slab crossing (przejazd). */
export const ROADWAY_KINDS: LaneKind[] = ['drive', 'turn', 'bus', 'bike', 'parking', 'parkingPerp', 'parkingAngle', 'shoulder', 'buffer'];
/** Strips with a kerb drawn around them. */
export const CURB_KINDS: LaneKind[] = ['sidewalk', 'median', 'separator', 'green', 'path', 'bikePath'];

export { LANE_KIND_LABEL, LINE_STYLE_LABEL, autoDividers, dividerBetween } from '../catalog/helpers';

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
      out.push({ lane: { ...end[j], marking: end[j].marking ?? start[i].marking, surface: end[j].surface ?? start[i].surface }, w0: start[i].width, w1: end[j].width });
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
