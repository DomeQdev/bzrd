import type { SymbolDef } from '../../model/types';

/**
 * Znaki poziome (P-10 … P-27) — white pavement markings per Polish regulations.
 * Units: centimeters (viewBox = 100 × meters). Direction of travel = up (-y).
 */

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const C = '{{color}}';

/**
 * P-23 style bicycle (side view, rotated so the front wheel points up).
 * Occupies a 100 × 160 box at the origin. Exported for reuse in arrows.ts (P-27).
 */
export const bikeGlyph = (color: string, sw = 9): string =>
  `<g transform="matrix(0 -1 1 0 -2 160)" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">` +
  '<circle cx="30" cy="62" r="25"/><circle cx="130" cy="62" r="25"/>' +
  '<path d="M30 62L75 62L64 30L30 62M64 30L118 28L130 62M118 28L114 14M106 14H122M56 26H72"/></g>';

/** International wheelchair symbol in a 100 × 100 box */
const wheelchairGlyph = (color: string): string =>
  `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="52" cy="14" r="9" fill="${color}" stroke="none"/>` +
  '<path d="M50 28L48 58H72L82 84M48 40H66" stroke-width="10"/>' +
  '<path d="M34 46A26 26 0 1 0 66 78" stroke-width="8"/></g>';

/** walking pedestrian figure centered on the origin (≈ 26 × 52) */
const walkerFig = (color: string): string =>
  `<g fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="2" cy="-21" r="5.5" fill="${color}" stroke="none"/>` +
  '<path d="M0 -13L-3 6L-10 22M-3 6L6 19L10 23M0 -9L-8 1M0 -9L8 -2"/></g>';

// P-10 zebra: 0.5 m stripes / 0.5 m gaps, stripes parallel to the road axis
const zebra = (y: number, h: number): string =>
  [25, 125, 225, 325].map((x) => `<rect x="${x}" y="${y}" width="50" height="${h}"/>`).join('');

const p10 = svg(400, 400, `<g fill="${C}">${zebra(0, 400)}</g>`);

const squaresRow = (xs: number[], y: number): string =>
  xs.map((x) => `<rect x="${x}" y="${y}" width="50" height="50"/>`).join('');

const p11 = svg(250, 200, `<g fill="${C}">${squaresRow([0, 100, 200], 0)}${squaresRow([0, 100, 200], 150)}</g>`);

const p10p11 = svg(400, 600, `<g fill="${C}">${zebra(0, 400)}` +
  `${squaresRow([25, 125, 225, 325], 420)}${squaresRow([25, 125, 225, 325], 550)}</g>`);

const p12 = svg(350, 50, `<rect width="350" height="50" fill="${C}"/>`);

const p13 = svg(350, 60, `<path fill="${C}" d="` +
  [0, 75, 150, 225, 300].map((x) => `M${x} 0H${x + 50}L${x + 25} 60Z`).join('') + '"/>');

const p14 = svg(350, 50, `<g fill="${C}">` +
  [0, 75, 150, 225, 300].map((x) => `<rect x="${x}" width="50" height="50"/>`).join('') + '</g>');

const p15 = svg(150, 300, `<path fill="${C}" fill-rule="evenodd" d="M0 0H150L75 300ZM26.6 20H123.4L75 213Z"/>`);

const p17 = svg(100, 600, `<path d="M8 0L92 100L8 200L92 300L8 400L92 500L8 600" fill="none" stroke="${C}" stroke-width="10"/>`);

const p18 = svg(250, 500, `<path d="M6 500V6H244V500" fill="none" stroke="${C}" stroke-width="12"/>`);

const p18par = svg(250, 600, `<rect x="6" y="6" width="238" height="588" fill="none" stroke="${C}" stroke-width="12"/>`);

const p19 = svg(15, 600, `<g fill="${C}"><rect y="50" width="15" height="100"/><rect y="250" width="15" height="100"/><rect y="450" width="15" height="100"/></g>`);

const p20 = svg(250, 500, `<path d="M6 6H244V494H6ZM6 6L244 494M244 6L6 494" fill="none" stroke="${C}" stroke-width="12" stroke-linejoin="miter"/>`);

let hatch = '';
for (let k = 60; k <= 600; k += 100) hatch += `M${k} 0L${k - 400} 400`;
const p21 = svg(200, 400,
  '<defs><clipPath id="c"><rect width="200" height="400"/></clipPath></defs>' +
  `<g clip-path="url(#c)"><path d="${hatch}" stroke="${C}" stroke-width="36"/></g>` +
  `<rect x="6" y="6" width="188" height="388" fill="none" stroke="${C}" stroke-width="12"/>`);

const p23 = svg(100, 160, bikeGlyph(C));

const bikeArrow = svg(100, 300,
  `<path d="M50 0L80 70H56V120H44V70H20Z" fill="${C}"/>` +
  `<g transform="translate(0 140)">${bikeGlyph(C)}</g>`);

const p24 = svg(360, 500,
  `<rect width="360" height="500" fill="${C}"/>` +
  '<rect x="6" y="6" width="348" height="488" fill="none" stroke="#fff" stroke-width="12"/>' +
  `<g transform="translate(80 110) scale(2 2.8)">${wheelchairGlyph('#fff')}</g>`);

const p25 = svg(350, 100, `<path fill="${C}" d="` +
  [0, 70, 140, 210, 280].map((x) => `M${x + 5} 95L${x + 35} 15L${x + 65} 95H${x + 50}L${x + 35} 55L${x + 20} 95Z`).join('') + '"/>');

const p26 = svg(100, 200, `<g transform="translate(50 100) scale(2.8 3.5)">${walkerFig(C)}</g>`);

const surface = svg(250, 400,
  `<rect width="250" height="400" fill="${C}"/>` +
  '<path d="M0 0H250V400H0Z" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="4"/>');

const paving = svg(200, 200,
  '<defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse">' +
  `<rect width="20" height="20" fill="${C}"/>` +
  '<path d="M0 .5H20M0 10.5H20M.5 0V10M10.5 10V20" stroke="#000" stroke-opacity=".28" stroke-width="1"/>' +
  '<rect x="2" y="2" width="6" height="5" fill="#fff" opacity=".08"/></pattern></defs>' +
  '<rect width="200" height="200" fill="url(#p)"/>');

const island = svg(200, 600,
  '<rect x="6" y="10" width="194" height="590" rx="97" fill="#000" opacity=".2"/>' +
  '<rect x="0" y="0" width="194" height="594" rx="97" fill="#e7e5df" stroke="#8d8a83" stroke-width="3"/>' +
  `<rect x="14" y="14" width="166" height="566" rx="83" fill="${C}"/>` +
  '<circle cx="97" cy="70" r="16" fill="#1a5aa6" stroke="#fff" stroke-width="3"/>' +
  '<path d="M90 63L104 77M104 77V69M104 77H96" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>');

const busBay = svg(300, 3600,
  `<path d="M0 0L300 1200V2400L0 3600Z" fill="${C}"/>` +
  '<path d="M0 0L300 1200V2400L0 3600" fill="none" stroke="#d6d3cc" stroke-width="16"/>' +
  '<path d="M10 0V3600" stroke="#fff" stroke-width="12" stroke-dasharray="100 100"/>' +
  '<path d="M150 1300L250 1400L150 1500L250 1600L150 1700L250 1800L150 1900L250 2000L150 2100L250 2200L150 2300" fill="none" stroke="#fff" stroke-width="10"/>');

export const symbols: SymbolDef[] = [
  { id: 'mk-p10', name: 'P-10 Przejście dla pieszych (zebra 4 m)', category: 'markings', width: 4.0, height: 4.0, svg: p10, defaultColor: '#ffffff', tags: ['P-10', 'przejście', 'zebra', 'pasy', 'crosswalk'] },
  { id: 'mk-p11', name: 'P-11 Przejazd dla rowerzystów', category: 'markings', width: 2.5, height: 2.0, svg: p11, defaultColor: '#ffffff', tags: ['P-11', 'przejazd rowerowy', 'rower', 'kwadraty'] },
  { id: 'mk-p10-p11', name: 'P-10 + P-11 Przejście z przejazdem dla rowerzystów', category: 'markings', width: 4.0, height: 6.0, svg: p10p11, defaultColor: '#ffffff', tags: ['P-10', 'P-11', 'przejście', 'przejazd', 'zebra'] },
  { id: 'mk-p12', name: 'P-12 Linia bezwzględnego zatrzymania', category: 'markings', width: 3.5, height: 0.5, svg: p12, defaultColor: '#ffffff', tags: ['P-12', 'linia zatrzymania', 'stop', 'stop bar'] },
  { id: 'mk-p13', name: 'P-13 Linia warunkowego zatrzymania (trójkąty)', category: 'markings', width: 3.5, height: 0.6, svg: p13, defaultColor: '#ffffff', tags: ['P-13', 'trójkąty', 'ustąp pierwszeństwa', 'zęby rekina'] },
  { id: 'mk-p14', name: 'P-14 Linia warunkowego zatrzymania (prostokąty)', category: 'markings', width: 3.5, height: 0.5, svg: p14, defaultColor: '#ffffff', tags: ['P-14', 'prostokąty', 'linia zatrzymania'] },
  { id: 'mk-p15', name: 'P-15 Trójkąt podporządkowania', category: 'markings', width: 1.5, height: 3.0, svg: p15, defaultColor: '#ffffff', tags: ['P-15', 'trójkąt', 'ustąp pierwszeństwa'] },
  { id: 'mk-p17', name: 'P-17 Linia przystankowa', category: 'markings', width: 1.0, height: 6.0, svg: p17, defaultColor: '#ffffff', tags: ['P-17', 'przystanek', 'zygzak', 'linia przystankowa'] },
  { id: 'mk-p18', name: 'P-18 Stanowisko postojowe (prostopadłe)', category: 'markings', width: 2.5, height: 5.0, svg: p18, defaultColor: '#ffffff', tags: ['P-18', 'parking', 'miejsce postojowe', 'prostopadłe'] },
  { id: 'mk-p18-par', name: 'P-18 Stanowisko postojowe (równoległe)', category: 'markings', width: 2.5, height: 6.0, svg: p18par, defaultColor: '#ffffff', tags: ['P-18', 'parking', 'miejsce postojowe', 'równoległe'] },
  { id: 'mk-p19', name: 'P-19 Linia wyznaczająca pas postojowy', category: 'markings', width: 0.15, height: 6.0, svg: p19, defaultColor: '#ffffff', tags: ['P-19', 'pas postojowy', 'linia'] },
  { id: 'mk-p20', name: 'P-20 Koperta', category: 'markings', width: 2.5, height: 5.0, svg: p20, defaultColor: '#ffffff', tags: ['P-20', 'koperta', 'zastrzeżone', 'parking'] },
  { id: 'mk-p21', name: 'P-21 Powierzchnia wyłączona z ruchu', category: 'markings', width: 2.0, height: 4.0, svg: p21, defaultColor: '#ffffff', tags: ['P-21', 'powierzchnia wyłączona', 'kreskowanie', 'wyspa', 'hatch'] },
  { id: 'mk-p23', name: 'P-23 Rower', category: 'markings', width: 1.0, height: 1.6, svg: p23, defaultColor: '#ffffff', tags: ['P-23', 'rower', 'pas rowerowy', 'bike'] },
  { id: 'mk-bike-arrow', name: 'P-23 Rower ze strzałką (pas rowerowy)', category: 'markings', width: 1.0, height: 3.0, svg: bikeArrow, defaultColor: '#ffffff', tags: ['P-23', 'rower', 'strzałka', 'pas rowerowy'] },
  { id: 'mk-p24', name: 'P-24 Miejsce dla pojazdu osoby niepełnosprawnej', category: 'markings', width: 3.6, height: 5.0, svg: p24, defaultColor: '#1f5fbf', tags: ['P-24', 'niepełnosprawni', 'koperta', 'parking', 'wózek'] },
  { id: 'mk-p25', name: 'P-25 Próg zwalniający', category: 'markings', width: 3.5, height: 1.0, svg: p25, defaultColor: '#ffffff', tags: ['P-25', 'próg', 'próg zwalniający', 'spowalniacz'] },
  { id: 'mk-p26', name: 'P-26 Piesi', category: 'markings', width: 1.0, height: 2.0, svg: p26, defaultColor: '#ffffff', tags: ['P-26', 'piesi', 'pieszy', 'chodnik'] },
  { id: 'mk-red-surface', name: 'Czerwona nawierzchnia (przejazd rowerowy)', category: 'markings', width: 2.5, height: 4.0, svg: surface, defaultColor: '#b8322a', tags: ['czerwony', 'asfalt', 'nawierzchnia', 'rower', 'buspas'] },
  { id: 'mk-green-surface', name: 'Zielona nawierzchnia', category: 'markings', width: 2.5, height: 4.0, svg: surface, defaultColor: '#3a9a4f', tags: ['zielony', 'nawierzchnia', 'rower'] },
  { id: 'mk-paving', name: 'Kostka brukowa', category: 'markings', width: 2.0, height: 2.0, svg: paving, defaultColor: '#a3a09a', tags: ['kostka', 'bruk', 'chodnik', 'nawierzchnia'] },
  { id: 'mk-island', name: 'Wyspa azylu (betonowa)', category: 'markings', width: 2.0, height: 6.0, svg: island, defaultColor: '#bdb8ad', tags: ['wyspa', 'azyl', 'krawężnik', 'separator'] },
  { id: 'mk-bus-bay', name: 'Przystanek – zatoka autobusowa', category: 'markings', width: 3.0, height: 36.0, svg: busBay, defaultColor: '#4a4a4a', tags: ['zatoka', 'przystanek', 'autobus', 'P-17'] },
];
