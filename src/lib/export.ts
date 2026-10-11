import Konva from 'konva';
import type { Project } from '../model/types';
import { downloadBlob, dataUrlToBlob } from './persist';
import { preloadSymbols } from '../canvas/symbolImage';
import { symbolById } from '../assets/symbols';
import { objectBounds } from '../canvas/draw';

export interface ExportOptions {
  /** world rectangle in meters */
  x: number; y: number; w: number; h: number;
  /** output px per meter */
  pxPerMeter: number;
  includeBackground: boolean;
  format: 'png' | 'jpeg';
  quality?: number;
}

export function selectionBounds(project: Project, ids: string[]): { x: number; y: number; w: number; h: number } | null {
  const objs = project.objects.filter((o) => ids.includes(o.id));
  if (!objs.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    const b = objectBounds(o);
    const r = (o.rotation * Math.PI) / 180;
    const c = Math.cos(r), s = Math.sin(r);
    for (const [px, py] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      const wx = o.x + px * c - py * s, wy = o.y + px * s + py * c;
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx); minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
    }
  }
  const pad = 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/**
 * Render the stage region to an image. Temporarily hides the overlay layer and (optionally)
 * the background, and uses pixelRatio so that output = pxPerMeter px per meter.
 */
export async function exportStageImage(stage: Konva.Stage, project: Project, opts: ExportOptions): Promise<string> {
  await preloadSymbols(
    project.objects
      .filter((o) => o.type === 'symbol')
      .map((o) => ({ def: symbolById((o as { symbolId: string }).symbolId)!, color: (o as { color?: string }).color }))
      .filter((x) => !!x.def),
  );
  const overlay = stage.findOne<Konva.Layer>('.overlay');
  const bg = stage.findOne<Konva.Layer>('.bgLayer');
  const prevOverlay = overlay?.visible();
  const prevBg = bg?.visible();
  overlay?.visible(false);
  if (!opts.includeBackground) bg?.visible(false);
  const scale = stage.scaleX();
  const pos = stage.position();
  try {
    const pixelRatio = opts.pxPerMeter / scale;
    const dataUrl = stage.toDataURL({
      x: pos.x + opts.x * scale,
      y: pos.y + opts.y * scale,
      width: opts.w * scale,
      height: opts.h * scale,
      pixelRatio,
      mimeType: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality: opts.quality ?? 0.92,
    });
    return dataUrl;
  } finally {
    overlay?.visible(prevOverlay ?? true);
    bg?.visible(prevBg ?? true);
    stage.batchDraw();
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  downloadBlob(dataUrlToBlob(dataUrl), filename);
}
