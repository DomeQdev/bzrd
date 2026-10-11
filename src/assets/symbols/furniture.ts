import type { SymbolDef } from '../../model/types';

/** Mała architektura — street furniture, top-down. Units: cm (viewBox = 100 × meters) unless noted. */

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const SHADOW = 'fill="#000" opacity=".22"';
const EDGE = 'stroke="#000" stroke-opacity=".4" stroke-width="1.5"';
const GREEN = '#4f8a3c';

const bench = svg(180, 60,
  `<rect x="10" y="8" width="168" height="52" rx="4" ${SHADOW}/>` +
  '<rect x="14" y="2" width="8" height="54" rx="2" fill="#333"/><rect x="158" y="2" width="8" height="54" rx="2" fill="#333"/>' +
  [4, 15, 26, 37].map((y) => `<rect x="5" y="${y}" width="170" height="9" rx="2" fill="{{color}}" ${EDGE}/>`).join('') +
  '<rect x="5" y="48" width="170" height="7" rx="2" fill="#555"/>');

// U-12c: 0.15 m post, viewBox in millimeters
const bollard = svg(150, 150,
  '<circle cx="84" cy="84" r="62" fill="#000" opacity=".25"/>' +
  `<circle cx="72" cy="72" r="62" fill="{{color}}" stroke="#000" stroke-opacity=".5" stroke-width="5"/>` +
  '<circle cx="72" cy="72" r="42" fill="none" stroke="#fff" stroke-width="14"/>' +
  '<circle cx="58" cy="58" r="14" fill="#fff" opacity=".3"/>');

const planter = svg(120, 120,
  `<rect x="10" y="10" width="108" height="108" rx="6" ${SHADOW}/>` +
  '<rect x="4" y="4" width="108" height="108" rx="6" fill="#b9b3a8" stroke="#8a847a" stroke-width="2"/>' +
  '<rect x="14" y="14" width="88" height="88" rx="3" fill="#5b4030"/>' +
  `<g fill="{{color}}"><circle cx="40" cy="40" r="18"/><circle cx="72" cy="38" r="20"/><circle cx="44" cy="72" r="20"/><circle cx="76" cy="74" r="18"/><circle cx="58" cy="56" r="16"/></g>` +
  '<g fill="#fff" opacity=".14"><circle cx="35" cy="35" r="8"/><circle cx="66" cy="32" r="9"/><circle cx="39" cy="66" r="9"/></g>');

let shelterHatch = '';
for (let k = -400; k < 200; k += 24) shelterHatch += `M${k} 400L${k + 400} 0`;
const busShelter = svg(150, 400,
  `<rect x="12" y="12" width="138" height="388" rx="6" ${SHADOW}/>` +
  '<defs><clipPath id="c"><rect x="4" y="4" width="136" height="388" rx="6"/></clipPath></defs>' +
  '<rect x="4" y="4" width="136" height="388" rx="6" fill="{{color}}"/>' +
  `<g clip-path="url(#c)"><path d="${shelterHatch}" stroke="#fff" stroke-opacity=".3" stroke-width="3"/></g>` +
  '<path d="M128 14V382" stroke="#e2e8f0" stroke-width="6"/>' +
  '<rect x="12" y="356" width="112" height="26" rx="3" fill="#1e293b"/>' +
  '<rect x="4" y="4" width="136" height="388" rx="6" fill="none" stroke="#334155" stroke-width="4"/>' +
  '<g fill="#334155"><rect x="8" y="8" width="12" height="12"/><rect x="124" y="8" width="12" height="12"/><rect x="8" y="340" width="12" height="12"/><rect x="124" y="340" width="12" height="12"/></g>');

const parkedBike = (x: number, frame: string): string =>
  `<rect x="${x - 3}" y="10" width="6" height="66" rx="3" fill="#1a1a1a"/><rect x="${x - 3}" y="124" width="6" height="66" rx="3" fill="#1a1a1a"/>` +
  `<path d="M${x} 36V164M${x - 20} 48H${x + 20}" stroke="${frame}" stroke-width="5" stroke-linecap="round"/>` +
  `<ellipse cx="${x}" cy="130" rx="5" ry="11" fill="#222"/>`;
const bikeRack = svg(240, 200,
  [40, 120, 200].map((x) => `<rect x="${x - 3}" y="40" width="6" height="120" rx="3" fill="#6b7280"/><circle cx="${x}" cy="40" r="5" fill="#4b5563"/><circle cx="${x}" cy="160" r="5" fill="#4b5563"/>`).join('') +
  parkedBike(56, '{{color}}') + parkedBike(136, '#16a34a'));

const streetLight = svg(60, 260,
  '<rect x="28" y="44" width="6" height="190" fill="#000" opacity=".2"/>' +
  '<rect x="27" y="40" width="6" height="190" rx="2" fill="#6b7280"/>' +
  '<circle cx="30" cy="232" r="13" fill="#4b5563"/><circle cx="30" cy="232" r="6" fill="#9ca3af"/>' +
  `<rect x="14" y="6" width="32" height="46" rx="12" fill="{{color}}" ${EDGE}/>` +
  '<rect x="20" y="14" width="20" height="30" rx="8" fill="#fef3c7"/>');

const trashBin = svg(60, 60,
  '<circle cx="33" cy="33" r="25" fill="#000" opacity=".22"/>' +
  `<circle cx="30" cy="30" r="25" fill="{{color}}" ${EDGE}/>` +
  '<circle cx="30" cy="30" r="20" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2"/>' +
  '<circle cx="30" cy="30" r="13" fill="#111" opacity=".65"/>');

const table = svg(180, 180,
  `<rect x="20" y="26" width="154" height="148" rx="4" ${SHADOW}/>` +
  `<rect x="14" y="20" width="26" height="140" rx="3" fill="{{color}}" ${EDGE}/><rect x="140" y="20" width="26" height="140" rx="3" fill="{{color}}" ${EDGE}/>` +
  `<rect x="50" y="20" width="80" height="140" rx="4" fill="{{color}}" ${EDGE}/>` +
  '<path d="M70 22V158M90 22V158M110 22V158" stroke="#000" stroke-opacity=".18" stroke-width="2"/>');

let boards = '';
for (let y = 15; y < 600; y += 15) boards += `M8 ${y}H200`;
const parkletPlanter = (y: number): string =>
  `<rect x="10" y="${y}" width="186" height="60" rx="4" fill="#8d8a83"/>` +
  `<g fill="${GREEN}"><circle cx="38" cy="${y + 30}" r="22"/><circle cx="80" cy="${y + 28}" r="24"/><circle cx="124" cy="${y + 31}" r="22"/><circle cx="166" cy="${y + 29}" r="22"/></g>`;
const parkletTable = (y: number): string =>
  `<g fill="#374151"><circle cx="60" cy="${y}" r="11"/><circle cx="140" cy="${y}" r="11"/><circle cx="100" cy="${y - 40}" r="11"/><circle cx="100" cy="${y + 40}" r="11"/></g>` +
  `<circle cx="100" cy="${y}" r="28" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>`;
const parklet = svg(200, 600,
  '<rect x="0" y="0" width="200" height="600" fill="{{color}}"/>' +
  `<path d="${boards}" stroke="#000" stroke-opacity=".15" stroke-width="1.5"/>` +
  parkletPlanter(6) + parkletPlanter(534) + parkletTable(220) + parkletTable(390) +
  '<rect x="0" y="0" width="9" height="600" fill="#374151"/>' +
  '<rect x="0" y="0" width="200" height="600" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2"/>');

const speedBump = svg(350, 50,
  '<rect width="350" height="50" rx="10" fill="#1f1f1f"/>' +
  `<g fill="{{color}}">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${i * 50 + 12.5}" y="4" width="25" height="42" rx="3"/>`).join('')}</g>` +
  '<path d="M6 25H344" stroke="#000" stroke-opacity=".25" stroke-width="2"/>');

const cone = svg(40, 40,
  '<rect x="2" y="2" width="36" height="36" rx="4" fill="#222"/>' +
  `<circle cx="20" cy="20" r="14" fill="{{color}}" ${EDGE}/>` +
  '<circle cx="20" cy="20" r="8.5" fill="none" stroke="#fff" stroke-width="3.5"/>' +
  '<circle cx="20" cy="20" r="2.5" fill="#7c2d12"/>');

const barrier = svg(60, 300,
  '<rect x="4" y="4" width="56" height="296" rx="3" fill="#000" opacity=".22"/>' +
  `<rect x="0" y="0" width="56" height="296" rx="3" fill="{{color}}" stroke="#8f8a80" stroke-width="2"/>` +
  '<rect x="19" y="2" width="18" height="292" fill="#fff" opacity=".3"/>' +
  '<path d="M2 8H54M2 288H54" stroke="#000" stroke-opacity=".2" stroke-width="2"/>');

const u20 = svg(200, 50,
  '<rect x="8" y="2" width="24" height="46" rx="3" fill="#333"/><rect x="168" y="2" width="24" height="46" rx="3" fill="#333"/>' +
  '<rect x="0" y="18" width="200" height="14" fill="#fff" stroke="#555" stroke-width="1"/>' +
  `<g fill="{{color}}">${[0, 40, 80, 120, 160].map((x) => `<rect x="${x + 10}" y="18" width="20" height="14"/>`).join('')}</g>`);

const islandHalf = (y: number, h: number): string =>
  `<rect x="0" y="${y}" width="194" height="${h}" rx="60" fill="#e7e5df" stroke="#8d8a83" stroke-width="3"/>` +
  `<rect x="14" y="${y + 14}" width="166" height="${h - 28}" rx="48" fill="{{color}}"/>`;
const azyl = svg(200, 900,
  '<rect x="6" y="8" width="194" height="250" rx="60" fill="#000" opacity=".2"/><rect x="6" y="658" width="194" height="242" rx="60" fill="#000" opacity=".2"/>' +
  islandHalf(0, 250) + islandHalf(650, 244) +
  '<rect x="14" y="206" width="166" height="30" fill="#e3b23c"/><rect x="14" y="664" width="166" height="30" fill="#e3b23c"/>' +
  '<g fill="#1a5aa6" stroke="#fff" stroke-width="3"><circle cx="97" cy="50" r="16"/><circle cx="97" cy="844" r="16"/></g>');

const hydrant = svg(40, 40,
  '<circle cx="22" cy="22" r="13" fill="#000" opacity=".22"/>' +
  `<rect x="4" y="16" width="32" height="8" rx="2" fill="{{color}}" ${EDGE}/>` +
  `<circle cx="20" cy="20" r="11" fill="{{color}}" ${EDGE}/>` +
  '<circle cx="20" cy="20" r="5" fill="#000" opacity=".3"/>');

const signalPole = svg(60, 60,
  '<circle cx="33" cy="41" r="9" fill="#000" opacity=".22"/>' +
  `<circle cx="30" cy="38" r="9" fill="{{color}}" ${EDGE}/>` +
  '<rect x="16" y="4" width="28" height="20" rx="3" fill="#111"/>' +
  '<rect x="19" y="8" width="10" height="12" rx="2" fill="#ef4444"/><rect x="31" y="8" width="10" height="12" rx="2" fill="#22c55e" opacity=".5"/>' +
  '<rect x="40" y="33" width="12" height="12" rx="2" fill="#facc15" stroke="#111" stroke-width="1.5"/>');

const signalMast = svg(80, 800,
  '<rect x="40" y="44" width="8" height="720" fill="#000" opacity=".2"/>' +
  `<rect x="36" y="40" width="8" height="720" rx="3" fill="{{color}}"/>` +
  '<circle cx="40" cy="760" r="22" fill="#4b5563" stroke="#000" stroke-opacity=".4" stroke-width="2"/><circle cx="40" cy="760" r="10" fill="#9ca3af"/>' +
  [80, 300, 520].map((y) => `<rect x="20" y="${y}" width="40" height="34" rx="4" fill="#111" stroke="#facc15" stroke-width="3"/>`).join(''));

export const symbols: SymbolDef[] = [
  { id: 'fur-bench', name: 'Ławka', category: 'furniture', width: 1.8, height: 0.6, svg: bench, defaultColor: '#8b5a2b', tags: ['ławka', 'siedzisko', 'bench'] },
  { id: 'fur-bollard', name: 'Słupek U-12c', category: 'furniture', width: 0.15, height: 0.15, svg: bollard, defaultColor: '#3a3a3a', tags: ['słupek', 'U-12c', 'blokada', 'bollard'] },
  { id: 'fur-planter', name: 'Donica betonowa', category: 'furniture', width: 1.2, height: 1.2, svg: planter, defaultColor: GREEN, tags: ['donica', 'zieleń', 'blokada', 'planter'] },
  { id: 'fur-bus-shelter', name: 'Wiata przystankowa', category: 'furniture', width: 1.5, height: 4.0, svg: busShelter, defaultColor: '#94a3b8', tags: ['wiata', 'przystanek', 'bus shelter'] },
  { id: 'fur-bike-rack', name: 'Stojak rowerowy z rowerami', category: 'furniture', width: 2.4, height: 2.0, svg: bikeRack, defaultColor: '#2563eb', tags: ['stojak', 'rower', 'parking rowerowy', 'bike rack'] },
  { id: 'fur-street-light', name: 'Latarnia', category: 'furniture', width: 0.6, height: 2.6, svg: streetLight, defaultColor: '#374151', tags: ['latarnia', 'oświetlenie', 'lampa', 'street light'] },
  { id: 'fur-trash-bin', name: 'Kosz na śmieci', category: 'furniture', width: 0.6, height: 0.6, svg: trashBin, defaultColor: '#2f5d3a', tags: ['kosz', 'śmietnik', 'trash'] },
  { id: 'fur-table', name: 'Stolik z ławkami', category: 'furniture', width: 1.8, height: 1.8, svg: table, defaultColor: '#a0703c', tags: ['stolik', 'stół', 'piknik', 'table'] },
  { id: 'fur-parklet', name: 'Parklet', category: 'furniture', width: 2.0, height: 6.0, svg: parklet, defaultColor: '#b5835a', tags: ['parklet', 'ogródek', 'taras', 'zieleń'] },
  { id: 'fur-speed-bump', name: 'Próg zwalniający listwowy', category: 'furniture', width: 3.5, height: 0.5, svg: speedBump, defaultColor: '#facc15', tags: ['próg', 'próg zwalniający', 'listwowy', 'spowalniacz'] },
  { id: 'fur-cone', name: 'Pachołek drogowy', category: 'furniture', width: 0.4, height: 0.4, svg: cone, defaultColor: '#f97316', tags: ['pachołek', 'słupek', 'roboty', 'cone'] },
  { id: 'fur-barrier', name: 'Bariera betonowa', category: 'furniture', width: 0.6, height: 3.0, svg: barrier, defaultColor: '#cfcac0', tags: ['bariera', 'beton', 'new jersey', 'separator'] },
  { id: 'fur-u20', name: 'Zapora drogowa U-20', category: 'furniture', width: 2.0, height: 0.5, svg: u20, defaultColor: '#d2232a', tags: ['zapora', 'U-20', 'roboty', 'barierka'] },
  { id: 'fur-azyl', name: 'Azyl dla pieszych (wyspa dzielona)', category: 'furniture', width: 2.0, height: 9.0, svg: azyl, defaultColor: '#bdb8ad', tags: ['azyl', 'wyspa', 'przejście', 'refuge'] },
  { id: 'fur-hydrant', name: 'Hydrant', category: 'furniture', width: 0.4, height: 0.4, svg: hydrant, defaultColor: '#d2232a', tags: ['hydrant', 'straż', 'woda'] },
  { id: 'fur-signal-pole', name: 'Słup sygnalizacji z przyciskiem', category: 'furniture', width: 0.6, height: 0.6, svg: signalPole, defaultColor: '#4b5563', tags: ['sygnalizacja', 'przycisk', 'słup', 'przejście'] },
  { id: 'fur-signal-mast', name: 'Wysięgnik sygnalizacji (8 m)', category: 'furniture', width: 0.8, height: 8.0, svg: signalMast, defaultColor: '#6b7280', tags: ['sygnalizacja', 'wysięgnik', 'światła', 'maszt'] },
];
