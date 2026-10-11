import { useEffect, useState } from 'react';
import type { SymbolDef } from '../model/types';

const cache = new Map<string, HTMLImageElement>();
const listeners = new Map<string, Set<() => void>>();

/** Raster size of the longer side when the SVG is decoded (crisp when zoomed in). */
const RASTER = 768;

export function buildSvg(def: SymbolDef, color?: string): string {
  let svg = def.svg.replace(/\{\{color\}\}/g, color || def.defaultColor || '#ffffff');
  // inject explicit pixel size so the browser rasterises at a useful resolution
  const ratio = def.width / def.height;
  const w = ratio >= 1 ? RASTER : Math.round(RASTER * ratio);
  const h = ratio >= 1 ? Math.round(RASTER / ratio) : RASTER;
  svg = svg.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
  return svg;
}

export function svgDataUrl(def: SymbolDef, color?: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(buildSvg(def, color));
}

export function getSymbolImage(def: SymbolDef, color?: string): HTMLImageElement | null {
  const key = `${def.id}|${color || ''}`;
  const hit = cache.get(key);
  if (hit) return hit.complete && hit.naturalWidth > 0 ? hit : null;
  const img = new Image();
  img.onload = () => {
    listeners.get(key)?.forEach((fn) => fn());
    listeners.delete(key);
  };
  img.src = svgDataUrl(def, color);
  cache.set(key, img);
  return null;
}

export function useSymbolImage(def: SymbolDef | undefined, color?: string): HTMLImageElement | null {
  const [, bump] = useState(0);
  const key = def ? `${def.id}|${color || ''}` : '';
  const img = def ? getSymbolImage(def, color) : null;
  useEffect(() => {
    if (!def || img) return;
    const fn = () => bump((n) => n + 1);
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(fn);
    return () => { listeners.get(key)?.delete(fn); };
  }, [def, key, img]);
  return img;
}

/** Wait until every symbol used in the project is decoded (export). */
export function preloadSymbols(defs: Array<{ def: SymbolDef; color?: string }>): Promise<void> {
  return Promise.all(
    defs.map(({ def, color }) =>
      new Promise<void>((resolve) => {
        const key = `${def.id}|${color || ''}`;
        const img = getSymbolImage(def, color);
        if (img) return resolve();
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(() => resolve());
        const cached = cache.get(key);
        if (cached && cached.complete && cached.naturalWidth > 0) resolve();
      }),
    ),
  ).then(() => undefined);
}
