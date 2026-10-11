import type { SymbolDef } from '../../model/types';

/** Ludzie — widok z góry. Units: centimeters (viewBox = 100 × meters). Facing up (-y). */

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const LINE = 'stroke="#000" stroke-opacity=".35" stroke-width="1.5"';
const HAIR = '#3b2a1e';
const SKIN = '#d9a77c';

/** standing person in a 60×60 box centered at (30,30) */
const standing = (fill: string, hair = HAIR): string =>
  '<ellipse cx="33" cy="33" rx="25" ry="12" fill="#000" opacity=".18"/>' +
  `<ellipse cx="8" cy="31" rx="5" ry="7" fill="${fill}" ${LINE}/><ellipse cx="52" cy="31" rx="5" ry="7" fill="${fill}" ${LINE}/>` +
  `<ellipse cx="30" cy="30" rx="21" ry="10.5" fill="${fill}" ${LINE}/>` +
  `<circle cx="30" cy="29" r="9" fill="${hair}"/><ellipse cx="30" cy="21.5" rx="4.5" ry="2.2" fill="${SKIN}"/>`;

/** head + shoulders (no shadow) centered at (cx, cy) */
const torso = (cx: number, cy: number, fill: string): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="21" ry="10.5" fill="${fill}" ${LINE}/>` +
  `<circle cx="${cx}" cy="${cy - 1}" r="9" fill="${HAIR}"/><ellipse cx="${cx}" cy="${cy - 8.5}" rx="4.5" ry="2.2" fill="${SKIN}"/>`;

const placed = (tx: number, ty: number, rot: number, s: number, body: string): string =>
  `<g transform="translate(${tx} ${ty}) rotate(${rot}) scale(${s}) translate(-30 -30)">${body}</g>`;

const pedestrian = svg(60, 60, standing('{{color}}'));

const walking = svg(60, 90,
  '<ellipse cx="33" cy="48" rx="24" ry="32" fill="#000" opacity=".15"/>' +
  '<ellipse cx="23" cy="22" rx="5" ry="9" fill="#222"/><ellipse cx="37" cy="70" rx="5" ry="9" fill="#222"/>' +
  `<ellipse cx="51" cy="37" rx="5" ry="8" fill="{{color}}" ${LINE}/><ellipse cx="9" cy="55" rx="5" ry="8" fill="{{color}}" ${LINE}/>` +
  `<g transform="rotate(-8 30 46)">${torso(30, 46, '{{color}}')}</g>`);

const stroller = svg(60, 140,
  '<ellipse cx="33" cy="74" rx="26" ry="64" fill="#000" opacity=".12"/>' +
  '<rect x="3" y="12" width="7" height="15" rx="3" fill="#222"/><rect x="50" y="12" width="7" height="15" rx="3" fill="#222"/>' +
  '<rect x="3" y="62" width="7" height="15" rx="3" fill="#222"/><rect x="50" y="62" width="7" height="15" rx="3" fill="#222"/>' +
  '<rect x="9" y="8" width="42" height="74" rx="10" fill="#4b5563"/>' +
  '<rect x="13" y="30" width="34" height="48" rx="8" fill="#e5e7eb"/>' +
  '<path d="M9 42Q9 6 30 6Q51 6 51 42Z" fill="#5b7db1" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>' +
  '<path d="M14 80V96M46 80V96M10 96H50" stroke="#222" stroke-width="4" stroke-linecap="round" fill="none"/>' +
  '<path d="M12 114L14 99M48 114L46 99" stroke="{{color}}" stroke-width="8" stroke-linecap="round"/>' +
  torso(30, 118, '{{color}}'));

const wheelchair = svg(70, 110,
  '<ellipse cx="38" cy="62" rx="32" ry="46" fill="#000" opacity=".15"/>' +
  '<rect x="3" y="44" width="8" height="58" rx="4" fill="#222"/><rect x="59" y="44" width="8" height="58" rx="4" fill="#222"/>' +
  '<path d="M24 22L22 50M46 22L48 50" stroke="#666" stroke-width="3"/>' +
  '<rect x="20" y="8" width="30" height="10" rx="3" fill="#666"/>' +
  '<rect x="13" y="48" width="44" height="50" rx="5" fill="#555"/>' +
  '<rect x="20" y="18" width="13" height="42" rx="6" fill="#2f3e55"/><rect x="37" y="18" width="13" height="42" rx="6" fill="#2f3e55"/>' +
  '<path d="M18 100V106M52 100V106" stroke="#333" stroke-width="4" stroke-linecap="round"/>' +
  `<ellipse cx="12" cy="68" rx="5" ry="8" fill="{{color}}" ${LINE}/><ellipse cx="58" cy="68" rx="5" ry="8" fill="{{color}}" ${LINE}/>` +
  torso(35, 72, '{{color}}'));

const dogWalker = svg(80, 180,
  '<ellipse cx="38" cy="42" rx="14" ry="36" fill="#000" opacity=".15"/>' +
  '<ellipse cx="49" cy="143" rx="26" ry="14" fill="#000" opacity=".18"/>' +
  '<path d="M26 114Q16 82 34 60" stroke="#7c2d12" stroke-width="2" fill="none"/>' +
  '<ellipse cx="26" cy="30" rx="3" ry="4" fill="#5c3b1c"/><ellipse cx="42" cy="30" rx="3" ry="4" fill="#5c3b1c"/>' +
  '<ellipse cx="26" cy="52" rx="3" ry="4" fill="#5c3b1c"/><ellipse cx="42" cy="52" rx="3" ry="4" fill="#5c3b1c"/>' +
  '<path d="M34 56Q41 66 36 76" stroke="#8b5a2b" stroke-width="4" stroke-linecap="round" fill="none"/>' +
  '<ellipse cx="34" cy="40" rx="9" ry="18" fill="#8b5a2b"/>' +
  '<ellipse cx="27" cy="14" rx="3" ry="5.5" fill="#5c3b1c"/><ellipse cx="41" cy="14" rx="3" ry="5.5" fill="#5c3b1c"/>' +
  '<ellipse cx="34" cy="17" rx="7.5" ry="8.5" fill="#8b5a2b"/><ellipse cx="34" cy="9" rx="4" ry="4" fill="#6b4423"/>' +
  '<path d="M28 140L26 116" stroke="{{color}}" stroke-width="8" stroke-linecap="round"/>' +
  `<ellipse cx="67" cy="143" rx="5" ry="7" fill="{{color}}" ${LINE}/>` +
  torso(46, 141, '{{color}}'));

const children = svg(160, 120,
  placed(40, 34, -10, 1, standing('#2a9d8f')) +
  placed(92, 30, 0, 0.72, standing('{{color}}', '#b5651d')) +
  placed(128, 48, 12, 0.7, standing('#f72585')) +
  placed(58, 84, -4, 0.7, standing('#4cc9f0', '#1a1a1a')) +
  placed(104, 88, 6, 0.72, standing('#90be6d', '#e0b04a')));

export const symbols: SymbolDef[] = [
  { id: 'ppl-pedestrian', name: 'Pieszy', category: 'people', width: 0.6, height: 0.6, svg: pedestrian, defaultColor: '#f2c14e', tags: ['pieszy', 'człowiek', 'osoba', 'pedestrian'] },
  { id: 'ppl-walking', name: 'Pieszy idący', category: 'people', width: 0.6, height: 0.9, svg: walking, defaultColor: '#f2c14e', tags: ['pieszy', 'idący', 'spacer', 'walking'] },
  { id: 'ppl-stroller', name: 'Osoba z wózkiem dziecięcym', category: 'people', width: 0.6, height: 1.4, svg: stroller, defaultColor: '#e76f51', tags: ['wózek', 'dziecko', 'rodzic', 'stroller'] },
  { id: 'ppl-wheelchair', name: 'Osoba na wózku inwalidzkim', category: 'people', width: 0.7, height: 1.1, svg: wheelchair, defaultColor: '#3a86ff', tags: ['wózek inwalidzki', 'niepełnosprawny', 'wheelchair'] },
  { id: 'ppl-dog-walker', name: 'Osoba z psem', category: 'people', width: 0.8, height: 1.8, svg: dogWalker, defaultColor: '#8338ec', tags: ['pies', 'spacer', 'dog'] },
  { id: 'ppl-children', name: 'Grupa dzieci', category: 'people', width: 1.6, height: 1.2, svg: children, defaultColor: '#ffbe0b', tags: ['dzieci', 'grupa', 'szkoła', 'children'] },
];
