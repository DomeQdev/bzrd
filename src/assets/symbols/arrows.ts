import type { SymbolDef } from '../../model/types';
import { bikeGlyph } from './markings';
import { pictogramSize, pictogramSvg, type PictoId } from '../../canvas/pictograms';

/**
 * Strzałki kierunkowe P-8 i naprowadzające P-9 (white, elongated, 5.0 m long — urban size).
 * Units: centimeters (viewBox = 100 × meters). Direction of travel = up (-y).
 * Shaft width 0.16 m; branches/heads computed from the shaft center `sx`.
 */

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const H = 500;

/** P-8a straight arrow: head 0.6 m wide, 1.7 m long */
const straight = (sx: number): string =>
  `M${sx} 0L${sx + 30} 170H${sx + 8}V${H}H${sx - 8}V170H${sx - 30}Z`;

/** plain shaft from yTop down to the bottom */
const shaft = (sx: number, yTop: number): string =>
  `M${sx - 8} ${yTop}H${sx + 8}V${H}H${sx - 8}Z`;

/** turn branch leaving the shaft; d = -1 left, +1 right; y0 = center line of the turned head */
const branch = (sx: number, y0: number, d: -1 | 1): string =>
  `M${sx - d * 8} ${y0 + 70}Q${sx - d * 8} ${y0 - 8} ${sx + d * 26} ${y0 - 8}V${y0 - 60}` +
  `L${sx + d * 86} ${y0}L${sx + d * 26} ${y0 + 60}V${y0 + 8}Q${sx + d * 8} ${y0 + 8} ${sx + d * 8} ${y0 + 70}Z`;

/** U-turn (zawracanie) hooking to the left; yc = center of the hook */
const uturn = (sx: number, yc: number): string =>
  `M${sx - 8} ${H}H${sx + 8}V${yc}A36 36 0 0 0 ${sx - 64} ${yc}V${yc + 40}H${sx - 78}` +
  `L${sx - 56} ${yc + 150}L${sx - 34} ${yc + 40}H${sx - 48}V${yc}A20 20 0 0 1 ${sx - 8} ${yc}Z`;

const arrow = (w: number, ...paths: string[]): string =>
  svg(w, H, paths.map((d) => `<path d="${d}" fill="{{color}}"/>`).join(''));

const p8a = arrow(60, straight(30));
const p8b = arrow(100, shaft(92, 130), branch(92, 60, -1));
const p8c = arrow(100, shaft(8, 130), branch(8, 60, 1));
const p8d = arrow(120, straight(88), branch(88, 250, -1));
const p8e = arrow(120, straight(32), branch(32, 250, 1));
const p8f = arrow(176, shaft(88, 130), branch(88, 60, -1), branch(88, 60, 1));
const p8g = arrow(90, uturn(80, 40));
const p8h = arrow(176, straight(88), branch(88, 250, -1), branch(88, 250, 1));
const p8i = arrow(100, uturn(88, 40), branch(88, 300, -1));

/** P-9 lane-guidance arrow bending left (mirrored for right) */
const p9Body =
  '<path d="M96 500V240C96 200 64 176 52 140" fill="none" stroke="{{color}}" stroke-width="16"/>' +
  '<path d="M7.7 7.2L80.5 130.5L23.5 149.5Z" fill="{{color}}"/>';
const p9a = svg(110, H, p9Body);
const p9b = svg(110, H, `<g transform="matrix(-1 0 0 1 110 0)">${p9Body}</g>`);

const chevron = 'M50 0L100 36V54L50 18L0 54V36Z';
const p27 = svg(100, 260,
  `<path d="${chevron}" fill="{{color}}"/><path d="${chevron}" transform="translate(0 32)" fill="{{color}}"/>` +
  `<g transform="translate(0 100)">${bikeGlyph('{{color}}')}</g>`);

const W = '#ffffff';
const TAGS = ['strzałka', 'strzałka kierunkowa', 'P-8', 'arrow'];

/** Nazewnictwo wg załącznika nr 2 (P-8a…P-8i). Geometria wspólna z glifami pasów (canvas/pictograms.ts). */
const base: SymbolDef[] = [
  { id: 'arr-p8a', name: 'P-8a Strzałka kierunkowa na wprost', category: 'arrows', width: 0.75, height: 5.0, svg: p8a, defaultColor: W, tags: [...TAGS, 'na wprost', 'P-8a'] },
  { id: 'arr-p8b', name: 'P-8b Strzałka kierunkowa w lewo', category: 'arrows', width: 1.05, height: 5.0, svg: p8b, defaultColor: W, tags: [...TAGS, 'w lewo', 'P-8b'] },
  { id: 'arr-p8c', name: 'P-8c Strzałka kierunkowa do zawracania', category: 'arrows', width: 1.8, height: 5.0, svg: p8g, defaultColor: W, tags: [...TAGS, 'zawracanie', 'P-8c', 'u-turn'] },
  { id: 'arr-p8d', name: 'P-8d Strzałka kierunkowa w prawo', category: 'arrows', width: 1.05, height: 5.0, svg: p8c, defaultColor: W, tags: [...TAGS, 'w prawo', 'P-8d'] },
  { id: 'arr-p8e', name: 'P-8e Strzałka kierunkowa na wprost lub w lewo', category: 'arrows', width: 1.35, height: 5.0, svg: p8d, defaultColor: W, tags: [...TAGS, 'na wprost', 'w lewo', 'P-8e'] },
  { id: 'arr-p8f', name: 'P-8f Strzałka kierunkowa na wprost lub w prawo', category: 'arrows', width: 1.35, height: 5.0, svg: p8e, defaultColor: W, tags: [...TAGS, 'na wprost', 'w prawo', 'P-8f'] },
  { id: 'arr-p8g', name: 'P-8g Strzałka kierunkowa w lewo lub w prawo', category: 'arrows', width: 1.95, height: 5.0, svg: p8f, defaultColor: W, tags: [...TAGS, 'w lewo', 'w prawo', 'P-8g'] },
  { id: 'arr-p8h', name: 'P-8h Strzałka kierunkowa na wprost, w lewo lub w prawo', category: 'arrows', width: 1.95, height: 5.0, svg: p8h, defaultColor: W, tags: [...TAGS, 'na wprost', 'w lewo', 'w prawo', 'P-8h'] },
  { id: 'arr-p8i', name: 'P-8i Strzałka kierunkowa na wprost i do zawracania', category: 'arrows', width: 2.1, height: 5.0, svg: p8i, defaultColor: W, tags: [...TAGS, 'na wprost', 'zawracanie', 'P-8i'] },
  { id: 'arr-p9a', name: 'P-9a Strzałka naprowadzająca w lewo', category: 'arrows', width: 2.9, height: 5.0, svg: p9a, defaultColor: W, tags: ['strzałka', 'naprowadzająca', 'P-9', 'P-9a', 'zmiana pasa'] },
  { id: 'arr-p9b', name: 'P-9b Strzałka naprowadzająca w prawo', category: 'arrows', width: 2.9, height: 5.0, svg: p9b, defaultColor: W, tags: ['strzałka', 'naprowadzająca', 'P-9', 'P-9b', 'zmiana pasa'] },
  { id: 'arr-p27', name: 'P-27 Kierunek i tor ruchu roweru', category: 'arrows', width: 1.0, height: 2.6, svg: p27, defaultColor: W, tags: ['P-27', 'rower', 'sharrow', 'kontrapas', 'daszki'] },
];

/** P-8a–i and P-9a/b share their geometry with the lane glyphs (canvas/pictograms.ts). */
const GENERATED: Record<string, PictoId> = {
  'arr-p8a': 'p8a', 'arr-p8b': 'p8b', 'arr-p8c': 'p8c', 'arr-p8d': 'p8d', 'arr-p8e': 'p8e',
  'arr-p8f': 'p8f', 'arr-p8g': 'p8g', 'arr-p8h': 'p8h', 'arr-p8i': 'p8i', 'arr-p9a': 'p9a', 'arr-p9b': 'p9b',
};

export const symbols: SymbolDef[] = base.map((d) => {
  const id = GENERATED[d.id];
  if (!id) return d;
  const { w, h } = pictogramSize(id);
  return { ...d, width: +w.toFixed(2), height: +h.toFixed(2), svg: pictogramSvg(id) };
});
