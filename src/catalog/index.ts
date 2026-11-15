import type { Preset } from '../model/types';
import { presets as markings } from './markings';
import { LANE_TEMPLATES } from './lanes';
import { ASPHALT, CONCRETE, GRASS, RED_ASPHALT } from '../canvas/roadGeometry';
import { WHITE } from './helpers';

export const SURFACE_CATEGORY = 'Nawierzchnia';

/** Single-lane strips generated from the lane templates. */
const singleStrips: Preset[] = LANE_TEMPLATES.map((t) => ({
  id: `strip-${t.id}`,
  name: t.name,
  category: SURFACE_CATEGORY,
  group: 'Pasy — rysuj piórem (P) lub linią (L)',
  template: { kind: 'strip', spec: { lanes: [{ ...t.lane }] } },
  description: t.description,
  tags: ['pas', t.lane.kind],
}));

const AREA_GROUP = 'Obszary — wielokąt (W), prostokąt (R), elipsa (O)';
const areas: Preset[] = [
  { id: 'mk-asphalt', name: 'Nawierzchnia asfaltowa', category: SURFACE_CATEGORY, group: AREA_GROUP, template: { kind: 'line', width: 0, style: 'none', color: WHITE, fill: ASPHALT, variant: 'asphalt', closedOnly: true }, description: 'Wypełnienie asfaltem (plac skrzyżowania, zatoka, wypełnienie łuku)', tags: ['asfalt'] },
  { id: 'mk-red', name: 'Nawierzchnia czerwona', category: SURFACE_CATEGORY, group: AREA_GROUP, template: { kind: 'line', width: 0, style: 'none', color: WHITE, fill: RED_ASPHALT, variant: 'asphalt', closedOnly: true }, description: 'Czerwona nawierzchnia (DDR, przejazd, śluza)', tags: ['czerwona'] },
  { id: 'mk-pavement', name: 'Chodnik / plac', category: SURFACE_CATEGORY, group: AREA_GROUP, template: { kind: 'line', width: 0.12, style: 'none', color: WHITE, fill: CONCRETE, variant: 'pavement', closedOnly: true }, description: 'Nawierzchnia betonowa z krawężnikiem', tags: ['chodnik'] },
  { id: 'mk-grass', name: 'Trawnik', category: SURFACE_CATEGORY, group: AREA_GROUP, template: { kind: 'line', width: 0.12, style: 'none', color: WHITE, fill: GRASS, variant: 'grass', closedOnly: true }, description: 'Zieleń z krawężnikiem', tags: ['trawa', 'zieleń'] },
  { id: 'mk-curb', name: 'Krawężnik', category: SURFACE_CATEGORY, group: AREA_GROUP, template: { kind: 'line', width: 0.3, style: 'solid', color: '#aaa69e', variant: 'curb' }, description: 'Krawężnik betonowy 0,3 m (linia)', tags: ['krawężnik'] },
];

export const PRESETS: Preset[] = [...singleStrips, ...areas, ...markings];

export const CATEGORIES: string[] = Array.from(new Set(PRESETS.map((p) => p.category)));

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export function presetById(id: string): Preset | undefined {
  return BY_ID.get(id);
}

export { LANE_TEMPLATES } from './lanes';
export { autoDividers } from './helpers';
