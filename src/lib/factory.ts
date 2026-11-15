import type { BzObject, LineObj, PathData, Preset, StripObj, SymbolDef, SymbolObj, TextObj } from '../model/types';
import { uid } from '../store/project';
import { symbolById } from '../assets/symbols';
import { transformPath } from '../canvas/path';

/** Create an object from a library template and a WORLD-space path. The object origin becomes the first node. */
export function objectFromTemplate(preset: Preset, worldPath: PathData): BzObject {
  const first = worldPath.nodes[0] ?? { x: 0, y: 0 };
  const local = transformPath(worldPath, (v) => ({ x: v.x - first.x, y: v.y - first.y }));
  const t = preset.template;
  if (t.kind === 'laneMarking') throw new Error('Oznakowanie pasa nakłada się na istniejący pas (narzędzie Oznakowanie)');
  if (t.kind === 'strip') {
    const o: StripObj = { id: uid('s'), type: 'strip', x: first.x, y: first.y, rotation: 0, name: preset.name, path: local, spec: structuredClone(t.spec) };
    return o;
  }
  const o: LineObj = {
    id: uid('l'), type: 'line', x: first.x, y: first.y, rotation: 0, name: preset.name, path: local,
    width: t.width, style: t.style, dash: t.dash, color: t.color, fill: t.fill, variant: t.variant, code: t.code,
  };
  return o;
}

/** Can this preset be drawn as a path (pen / shapes / marking tool)? */
export function isDrawable(preset: Preset | null | undefined): boolean {
  return !!preset && preset.template.kind !== 'laneMarking';
}

export function objectFromSymbol(def: SymbolDef, x: number, y: number): SymbolObj {
  return { id: uid('y'), type: 'symbol', x, y, rotation: 0, name: def.name, symbolId: def.id, width: def.width, height: def.height, color: def.defaultColor };
}

export function symbolObjectById(id: string, x: number, y: number): SymbolObj | null {
  const def = symbolById(id);
  return def ? objectFromSymbol(def, x, y) : null;
}

export function textObject(x: number, y: number, text = 'STOP'): TextObj {
  return { id: uid('t'), type: 'text', x, y, rotation: 0, text, fontSize: 1.6, color: '#f4f4f4', stretch: 2.5 };
}

/** Re-anchor a path object so that its origin is the first node again (after node edits). */
export function normalizeOrigin<T extends StripObj | LineObj>(obj: T): T {
  const first = obj.path.nodes[0];
  if (!first || (first.x === 0 && first.y === 0)) return obj;
  const dx = first.x, dy = first.y;
  return { ...obj, x: obj.x + dx, y: obj.y + dy, path: transformPath(obj.path, (v) => ({ x: v.x - dx, y: v.y - dy })) };
}
