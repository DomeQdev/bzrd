import type { Preset } from '../model/types';
import { presets as markings } from './markings';
import { LANE_TEMPLATES } from './lanes';

/** Single-lane strips generated from the lane templates (Pasy → "Pojedyncze pasy"). */
const singleStrips: Preset[] = LANE_TEMPLATES.map((t) => ({
  id: `strip-${t.id}`,
  name: t.name,
  category: 'Pasy',
  group: 'Pasy — rysuj piórem (P) lub linią (L)',
  template: { kind: 'strip', spec: { lanes: [{ ...t.lane }] } },
  description: t.description,
  tags: ['pas', t.lane.kind],
}));

export const PRESETS: Preset[] = [...singleStrips, ...markings];

export const CATEGORIES: string[] = Array.from(new Set(PRESETS.map((p) => p.category)));

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export function presetById(id: string): Preset | undefined {
  return BY_ID.get(id);
}

export { LANE_TEMPLATES } from './lanes';
export { autoDividers } from './helpers';
