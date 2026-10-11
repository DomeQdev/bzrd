import type { SymbolDef } from '../../model/types';

/**
 * Zieleń — top-down canopies and planting. Every element carries a soft offset
 * shadow so it reads well over aerial imagery. Shapes are generated
 * deterministically (seeded) so output is stable between builds.
 */

const f = (n: number): number => +n.toFixed(1);
const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const rng = (seed: number) => {
  let s = seed;
  return (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

/** scalloped (lobed) closed outline: n lobes, radius jitter as a fraction of r */
function blob(cx: number, cy: number, r: number, n: number, jitter = 0, seed = 1): string {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const rr = r * (1 + jitter * (rnd() * 2 - 1));
    pts.push([f(cx + rr * Math.cos(a)), f(cy + rr * Math.sin(a))]);
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let k = 0; k < n; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[(k + 1) % n];
    const R = f(Math.hypot(x1 - x0, y1 - y0) * 0.62);
    d += `A${R} ${R} 0 0 1 ${x1} ${y1}`;
  }
  return d + 'Z';
}

/** spiky star outline for conifers */
function star(cx: number, cy: number, R: number, r: number, n: number, rot = 0): string {
  const pts: string[] = [];
  for (let k = 0; k < 2 * n; k++) {
    const a = rot + (Math.PI * k) / n;
    const rr = k % 2 ? r : R;
    pts.push(`${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join('L')}Z`;
}

const SHADE = '<defs><radialGradient id="g" cx=".38" cy=".35" r=".7">' +
  '<stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>';

/** shadow + tinted fill + shading overlay for one outline */
const layered = (d: string, dx = 6): string =>
  `<path d="${d}" transform="translate(${dx} ${dx})" fill="#000" opacity=".25"/>` +
  `<path d="${d}" fill="{{color}}"/><path d="${d}" fill="url(#g)"/>`;

const canopy = (r: number, n: number, jitter: number, seed: number): string => {
  const d = blob(46, 46, r, n, jitter, seed);
  return svg(100, 100, SHADE + layered(d) +
    `<path d="${blob(36, 35, r * 0.42, 7, jitter, seed + 1)}" fill="#fff" opacity=".12"/>` +
    `<path d="${blob(58, 58, r * 0.36, 6, jitter, seed + 2)}" fill="#000" opacity=".08"/>` +
    `<path d="${blob(60, 33, r * 0.26, 6, jitter, seed + 3)}" fill="#fff" opacity=".08"/>` +
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>`);
};

const roundTree = canopy(38, 12, 0, 11);
const irregularTree = canopy(34, 10, 0.16, 29);

const conifer = svg(100, 100, SHADE +
  layered(star(46, 46, 44, 30, 16)) +
  `<path d="${star(46, 46, 32, 20, 12, 0.2)}" fill="#000" opacity=".12"/>` +
  `<path d="${star(46, 46, 20, 11, 9, 0.4)}" fill="#fff" opacity=".14"/>` +
  '<circle cx="46" cy="46" r="3" fill="#4b3621"/>');

const shrubBlobs = [
  blob(42, 56, 26, 9, 0.1, 3), blob(80, 42, 28, 10, 0.1, 5),
  blob(110, 60, 24, 9, 0.1, 7), blob(72, 70, 20, 8, 0.1, 9),
];
const shrubs = svg(150, 100, SHADE +
  shrubBlobs.map((d) => `<path d="${d}" transform="translate(5 5)" fill="#000" opacity=".22"/>`).join('') +
  shrubBlobs.map((d) => `<path d="${d}" fill="{{color}}" stroke="#000" stroke-opacity=".2" stroke-width=".8"/><path d="${d}" fill="url(#g)"/>`).join(''));

let bumps = '';
for (let y = 40; y <= 560; y += 40) bumps += `<circle cx="16" cy="${y}" r="14"/><circle cx="84" cy="${y + 20 > 570 ? 560 : y + 20}" r="14"/>`;
let hedgeTex = '';
{
  const rnd = rng(77);
  for (let i = 0; i < 18; i++) {
    hedgeTex += `<circle cx="${f(30 + rnd() * 40)}" cy="${f(30 + rnd() * 540)}" r="${f(6 + rnd() * 8)}" fill="${i % 2 ? '#fff' : '#000'}" opacity=".1"/>`;
  }
}
const hedge = svg(100, 600,
  '<defs><linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>' +
  '<stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>' +
  '<rect x="12" y="10" width="86" height="588" rx="40" fill="#000" opacity=".22"/>' +
  `<g fill="{{color}}">${bumps}<rect x="8" y="6" width="84" height="584" rx="40"/></g>` +
  '<rect x="2" y="6" width="96" height="584" rx="40" fill="url(#h)"/>' + hedgeTex);

let grassDark = '';
let grassLight = '';
{
  const rnd = rng(123);
  for (let i = 0; i < 70; i++) {
    const seg = `M${f(rnd() * 196 + 2)} ${f(rnd() * 190 + 6)}l${f(rnd() * 4 - 2)} -${f(3 + rnd() * 4)}`;
    if (i % 2) grassDark += seg; else grassLight += seg;
  }
}
const grass = svg(200, 200,
  '<rect width="200" height="200" fill="{{color}}"/>' +
  `<path d="${grassDark}" stroke="#000" stroke-opacity=".16" stroke-width="1.2" stroke-linecap="round"/>` +
  `<path d="${grassLight}" stroke="#fff" stroke-opacity=".18" stroke-width="1.2" stroke-linecap="round"/>`);

const FLOWERS = ['#f472b6', '#facc15', '#ffffff', '#a78bfa', '#fb7185'];
const flowerDots = (n: number, x0: number, y0: number, w: number, h: number, seed: number): string => {
  const rnd = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${f(x0 + rnd() * w)}" cy="${f(y0 + rnd() * h)}" r="${f(2.5 + rnd() * 2)}" fill="${FLOWERS[i % FLOWERS.length]}"/>`;
  }
  return out;
};

const bedFoliage = [blob(40, 50, 26, 8, 0.12, 4), blob(95, 48, 30, 9, 0.12, 6), blob(150, 52, 28, 8, 0.12, 8)];
const flowerBed = svg(200, 100,
  '<rect width="200" height="100" rx="6" fill="#8a6a4a"/><rect x="7" y="7" width="186" height="86" rx="3" fill="#5b4030"/>' +
  bedFoliage.map((d) => `<path d="${d}" fill="{{color}}"/>`).join('') +
  flowerDots(34, 14, 14, 172, 72, 21));

const planter = svg(100, 100, SHADE +
  '<circle cx="51" cy="51" r="46" fill="#000" opacity=".2"/>' +
  '<circle cx="48" cy="48" r="46" fill="#bdb8ad" stroke="#8d8a83" stroke-width="2"/><circle cx="48" cy="48" r="37" fill="#5b4030"/>' +
  `<path d="${blob(48, 48, 28, 9, 0.12, 15)}" fill="{{color}}"/><path d="${blob(48, 48, 28, 9, 0.12, 15)}" fill="url(#g)"/>` +
  flowerDots(12, 28, 28, 40, 40, 33));

export const symbols: SymbolDef[] = [
  { id: 'tree-round-lg', name: 'Drzewo liściaste duże (korona 6 m)', category: 'trees', width: 6, height: 6, svg: roundTree, defaultColor: '#3f8f3f', tags: ['drzewo', 'korona', 'liściaste', 'duże', 'tree'] },
  { id: 'tree-round-md', name: 'Drzewo liściaste średnie (korona 4 m)', category: 'trees', width: 4, height: 4, svg: roundTree, defaultColor: '#3f8f3f', tags: ['drzewo', 'korona', 'liściaste', 'średnie', 'tree'] },
  { id: 'tree-round-sm', name: 'Drzewo liściaste małe (korona 2,5 m)', category: 'trees', width: 2.5, height: 2.5, svg: roundTree, defaultColor: '#4f9a45', tags: ['drzewo', 'korona', 'małe', 'młode', 'tree'] },
  { id: 'tree-irregular', name: 'Drzewo o nieregularnej koronie', category: 'trees', width: 6, height: 6, svg: irregularTree, defaultColor: '#3f8f3f', tags: ['drzewo', 'korona', 'nieregularna', 'tree'] },
  { id: 'tree-conifer', name: 'Drzewo iglaste', category: 'trees', width: 4, height: 4, svg: conifer, defaultColor: '#2f6b3a', tags: ['drzewo', 'iglaste', 'świerk', 'sosna', 'conifer'] },
  { id: 'tree-shrubs', name: 'Krzewy', category: 'trees', width: 3, height: 2, svg: shrubs, defaultColor: '#4e8f3a', tags: ['krzew', 'krzewy', 'zarośla', 'shrub'] },
  { id: 'tree-hedge', name: 'Żywopłot (1 × 6 m)', category: 'trees', width: 1, height: 6, svg: hedge, defaultColor: '#3d7a35', tags: ['żywopłot', 'krzewy', 'hedge'] },
  { id: 'tree-grass', name: 'Trawnik (4 × 4 m)', category: 'trees', width: 4, height: 4, svg: grass, defaultColor: '#6fa548', tags: ['trawnik', 'trawa', 'zieleń', 'grass'] },
  { id: 'tree-flowerbed', name: 'Rabata kwiatowa', category: 'trees', width: 2, height: 1, svg: flowerBed, defaultColor: '#4f8a3c', tags: ['rabata', 'kwietnik', 'kwiaty', 'flowers'] },
  { id: 'tree-planter', name: 'Donica z kwiatami', category: 'trees', width: 1, height: 1, svg: planter, defaultColor: '#4f8a3c', tags: ['donica', 'kwiaty', 'zieleń', 'planter'] },
];
