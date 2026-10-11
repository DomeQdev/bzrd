import type { SymbolDef } from '../../model/types';

/**
 * Pojazdy — widok z góry (plan). Coordinates are in centimeters, so every viewBox
 * is exactly 100x the real-world footprint in meters. Front of vehicle = up (-y).
 */

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** draw `half` and its mirror image across the vertical center line */
const mirror = (half: string, w: number): string =>
  `${half}<g transform="matrix(-1 0 0 1 ${w} 0)">${half}</g>`;

const OUTLINE = 'stroke="#000" stroke-opacity=".35" stroke-width="2"';
const GLASS = 'fill="#000" opacity=".5"';

/** rounded-rectangle body path with separate front (rf) and rear (rr) corner radii */
const bodyPath = (x0: number, y0: number, x1: number, y1: number, rf: number, rr: number): string =>
  `M${x0} ${y0 + rf}Q${x0} ${y0} ${x0 + rf} ${y0}L${x1 - rf} ${y0}Q${x1} ${y0} ${x1} ${y0 + rf}` +
  `L${x1} ${y1 - rr}Q${x1} ${y1} ${x1 - rr} ${y1}L${x0 + rr} ${y1}Q${x0} ${y1} ${x0} ${y1 - rr}Z`;

interface AutoOpts {
  w: number;
  h: number;
  rf: number;
  rr: number;
  /** windshield bottom edge (hood end) / top edge (roof start) */
  ws0: number;
  ws1: number;
  /** roof end / rear-window end; omit rw for no rear window */
  re: number;
  rw?: number;
  /** wheel centers (y) and wheel length */
  wf: number;
  wr: number;
  wl?: number;
  extra?: string;
}

/** generic car-like vehicle (osobowy, SUV, van, taxi, radiowóz, karetka) */
function auto(o: AutoOpts): string {
  const { w, h, rf, rr, ws0, ws1, re, rw, wf, wr } = o;
  const wl = o.wl ?? 62;
  const c = w / 2;
  const wheels = `<rect x="5" y="${wf - wl / 2}" width="12" height="${wl}" rx="5" fill="#1b1b1b"/>` +
    `<rect x="5" y="${wr - wl / 2}" width="12" height="${wl}" rx="5" fill="#1b1b1b"/>`;
  const mirrorPart = `<path d="M13 ${ws0 + 2}L1 ${ws0 + 8}L2 ${ws0 + 20}L13 ${ws0 + 18}Z" fill="{{color}}" stroke="#000" stroke-opacity=".45" stroke-width="1.5"/>`;
  const sideWin = `<path d="M23 ${ws0 + 12}L33 ${ws1 + 4}L33 ${re - 4}L25 ${(rw ?? re) - 8}Z" fill="#000" opacity=".38"/>`;
  const lights = `<rect x="${rf > 30 ? 32 : 18}" y="13" width="26" height="7" rx="3.5" fill="#fff6c8"/>` +
    `<rect x="${rr > 25 ? 28 : 16}" y="${h - 17}" width="24" height="6" rx="3" fill="#c1121f"/>`;
  const windshield = `<path d="M22 ${ws0}Q${c} ${ws0 - 22} ${w - 22} ${ws0}L${w - 34} ${ws1}Q${c} ${ws1 - 10} 34 ${ws1}Z" ${GLASS}/>`;
  const roof = `<rect x="36" y="${ws1 + 3}" width="${w - 72}" height="${re - ws1 - 6}" rx="12" fill="#fff" opacity=".1"/>`;
  const rear = rw === undefined ? '' :
    `<path d="M34 ${re}Q${c} ${re + 8} ${w - 34} ${re}L${w - 25} ${rw}Q${c} ${rw + 14} 25 ${rw}Z" ${GLASS}/>`;
  return svg(w, h,
    `<path d="${bodyPath(16, 12, w - 4, h, rf, rr)}" fill="#000" opacity=".2"/>` +
    mirror(wheels + mirrorPart, w) +
    `<path d="${bodyPath(10, 6, w - 10, h - 6, rf, rr)}" fill="{{color}}" ${OUTLINE}/>` +
    mirror(sideWin + lights, w) + windshield + roof + rear + (o.extra ?? ''));
}

/** roof light bar (blue lamps) centered at y */
const lightBar = (w: number, y: number): string =>
  `<rect x="${w / 2 - 54}" y="${y}" width="108" height="22" rx="6" fill="#e5e7eb" stroke="#000" stroke-opacity=".4" stroke-width="2"/>` +
  `<rect x="${w / 2 - 50}" y="${y + 3}" width="40" height="16" rx="4" fill="#1d4ed8"/>` +
  `<rect x="${w / 2 + 10}" y="${y + 3}" width="40" height="16" rx="4" fill="#1d4ed8"/>`;

// ───────── samochody ─────────

const CAR: AutoOpts = { w: 180, h: 450, rf: 46, rr: 36, ws0: 136, ws1: 192, re: 322, rw: 368, wf: 106, wr: 352 };

const car = auto({ ...CAR,
  extra: '<path d="M52 30L58 122M128 30L122 122" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>' });

const suv = auto({ w: 196, h: 490, rf: 38, rr: 22, ws0: 140, ws1: 188, re: 404, rw: 440, wf: 104, wr: 392, wl: 70,
  extra: '<path d="M46 196V396M150 196V396" stroke="#000" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>' });

const taxi = auto({ ...CAR,
  extra: '<rect x="62" y="244" width="56" height="20" rx="4" fill="#fff" stroke="#000" stroke-opacity=".4" stroke-width="2"/>' +
    '<path d="M68 254H112" stroke="#111" stroke-width="5" stroke-dasharray="6 5"/>' });

const police = auto({ ...CAR,
  extra: lightBar(180, 200) +
    '<path d="M36 280H144" stroke="#fff" stroke-width="10" opacity=".85"/>' });

const van = auto({ w: 200, h: 550, rf: 40, rr: 10, ws0: 76, ws1: 130, re: 530, wf: 80, wr: 450, wl: 66,
  extra: '<path d="M30 200H170M30 280H170M30 360H170M30 440H170" stroke="#000" stroke-opacity=".12" stroke-width="3"/>' +
    '<rect x="72" y="500" width="56" height="16" rx="3" fill="#000" opacity=".12"/>' });

const ambulance = auto({ w: 210, h: 600, rf: 40, rr: 10, ws0: 76, ws1: 130, re: 580, wf: 82, wr: 490, wl: 68,
  extra: lightBar(210, 140) +
    '<rect x="20" y="186" width="170" height="26" fill="#d61f26" opacity=".9"/>' +
    '<path d="M105 300V420M45 360H165" stroke="#d61f26" stroke-width="30"/>' +
    '<rect x="20" y="540" width="170" height="14" fill="#d61f26" opacity=".9"/>' });

const pickup = auto({ w: 200, h: 560, rf: 40, rr: 12, ws0: 150, ws1: 200, re: 290, rw: 316, wf: 108, wr: 448, wl: 70,
  extra: '<rect x="26" y="330" width="148" height="206" rx="5" fill="#000" opacity=".3"/>' +
    '<path d="M56 336V530M86 336V530M114 336V530M144 336V530" stroke="#fff" stroke-opacity=".12" stroke-width="4"/>' +
    '<path d="M18 324H182" stroke="#000" stroke-opacity=".35" stroke-width="3"/>' });

// ───────── autobusy i ciężarówki ─────────

/** roof detail of one bus section: hatches + AC unit */
const busRoof = (w: number, y: number, len: number): string =>
  `<rect x="${w / 2 - 36}" y="${y + 60}" width="72" height="72" rx="6" fill="#000" opacity=".14"/>` +
  `<rect x="52" y="${y + len * 0.36}" width="${w - 104}" height="${Math.round(len * 0.22)}" rx="14" fill="#e5e7eb" stroke="#000" stroke-opacity=".3" stroke-width="2"/>` +
  `<path d="M${w / 2 - 50} ${y + len * 0.36 + 30}h100m-100 30h100m-100 30h100" stroke="#000" stroke-opacity=".18" stroke-width="4"/>` +
  `<rect x="${w / 2 - 36}" y="${y + len - 150}" width="72" height="72" rx="6" fill="#000" opacity=".14"/>`;

const busSideWindows = (h0: number, h1: number): string =>
  `<rect x="8" y="${h0}" width="9" height="${h1 - h0}" rx="4" fill="#000" opacity=".35"/>`;

const busMirrors = '<path d="M16 46L6 14L1 16L9 48Z" fill="#222"/>';
const busWindshield = '<path d="M18 18Q127 4 237 18L237 54Q127 42 18 54Z" fill="#000" opacity=".55"/>';

const bus = svg(255, 1200,
  '<rect x="14" y="14" width="241" height="1186" rx="22" fill="#000" opacity=".2"/>' +
  mirror(busMirrors, 255) +
  `<path d="${bodyPath(6, 6, 249, 1194, 30, 16)}" fill="{{color}}" ${OUTLINE}/>` +
  mirror(busSideWindows(80, 1140), 255) + busWindshield +
  busRoof(255, 120, 900) +
  '<rect x="40" y="1110" width="175" height="60" rx="6" fill="#000" opacity=".15"/>' +
  '<path d="M52 1124H203M52 1140H203M52 1156H203" stroke="#000" stroke-opacity=".2" stroke-width="3"/>');

const busArtic = svg(255, 1800,
  '<rect x="14" y="14" width="241" height="1786" rx="22" fill="#000" opacity=".2"/>' +
  mirror(busMirrors, 255) +
  `<path d="${bodyPath(6, 6, 249, 1050, 30, 4)}" fill="{{color}}" ${OUTLINE}/>` +
  '<rect x="22" y="1040" width="211" height="110" rx="8" fill="#2b2b2b"/>' +
  '<path d="M26 1058H229M26 1076H229M26 1094H229M26 1112H229M26 1130H229" stroke="#555" stroke-width="5"/>' +
  `<path d="${bodyPath(6, 1140, 249, 1794, 4, 16)}" fill="{{color}}" ${OUTLINE}/>` +
  mirror(busSideWindows(80, 1010) + busSideWindows(1170, 1740), 255) + busWindshield +
  busRoof(255, 120, 880) + busRoof(255, 1170, 520) +
  '<rect x="40" y="1710" width="175" height="60" rx="6" fill="#000" opacity=".15"/>');

// Tramwaj (Pesa Swing): 240 × 3000, five sections, both ends with cabs.
const TRAM_NOSE = 'M6 170C6 46 56 6 120 6C184 6 234 46 234 170';
const tramWindshield = '<path d="M26 156C36 66 74 30 120 30C166 30 204 66 214 156C180 138 60 138 26 156Z" fill="#000" opacity=".55"/>';
const tramJoint = (y: number): string =>
  `<rect x="22" y="${y}" width="196" height="44" rx="6" fill="#2b2b2b"/>` +
  `<path d="M26 ${y + 11}H214M26 ${y + 22}H214M26 ${y + 33}H214" stroke="#555" stroke-width="4"/>`;
const tramEquip = (y: number, len: number): string =>
  `<rect x="52" y="${y}" width="136" height="${len}" rx="10" fill="#9ca3af" stroke="#000" stroke-opacity=".3" stroke-width="2"/>` +
  `<path d="M64 ${y + len / 2}H176" stroke="#000" stroke-opacity=".2" stroke-width="4"/>`;
const tramSec = (y0: number, y1: number): string =>
  `<rect x="6" y="${y0}" width="228" height="${y1 - y0}" fill="{{color}}" ${OUTLINE}/>` +
  `<rect x="10" y="${y0 + 30}" width="8" height="${y1 - y0 - 60}" rx="4" fill="#000" opacity=".3"/>` +
  `<rect x="222" y="${y0 + 30}" width="8" height="${y1 - y0 - 60}" rx="4" fill="#000" opacity=".3"/>`;

const tram = svg(240, 3000,
  '<rect x="14" y="20" width="226" height="2976" rx="90" fill="#000" opacity=".2"/>' +
  `<path d="${TRAM_NOSE}L234 690L6 690Z" fill="{{color}}" ${OUTLINE}/>` +
  `<g transform="matrix(1 0 0 -1 0 3000)"><path d="${TRAM_NOSE}L234 690L6 690Z" fill="{{color}}" ${OUTLINE}/>${tramWindshield}</g>` +
  tramWindshield +
  tramSec(730, 1250) + tramSec(1290, 1710) + tramSec(1750, 2270) +
  tramJoint(688) + tramJoint(1248) + tramJoint(1708) + tramJoint(2268) +
  '<rect x="10" y="200" width="8" height="460" rx="4" fill="#000" opacity=".3"/><rect x="222" y="200" width="8" height="460" rx="4" fill="#000" opacity=".3"/>' +
  '<rect x="10" y="2340" width="8" height="460" rx="4" fill="#000" opacity=".3"/><rect x="222" y="2340" width="8" height="460" rx="4" fill="#000" opacity=".3"/>' +
  tramEquip(300, 280) + tramEquip(2420, 280) + tramEquip(820, 300) + tramEquip(1840, 300) +
  '<rect x="68" y="1540" width="104" height="44" rx="6" fill="#6b7280"/>' +
  '<path d="M80 1550L120 1476L160 1550" fill="none" stroke="#4b5563" stroke-width="7" stroke-linejoin="round"/>' +
  '<rect x="30" y="1466" width="180" height="14" rx="5" fill="#374151"/>');

const truck = svg(250, 900,
  '<rect x="12" y="12" width="238" height="888" rx="10" fill="#000" opacity=".2"/>' +
  mirror('<rect x="3" y="92" width="14" height="70" rx="5" fill="#1b1b1b"/>' +
    '<path d="M14 72L0 78L1 98L14 96Z" fill="#222"/>', 250) +
  `<path d="${bodyPath(14, 6, 236, 240, 34, 6)}" fill="{{color}}" ${OUTLINE}/>` +
  '<path d="M26 70Q125 50 224 70L214 116Q125 104 36 116Z" fill="#000" opacity=".5"/>' +
  '<rect x="36" y="124" width="178" height="100" rx="8" fill="#fff" opacity=".1"/>' +
  '<rect x="4" y="234" width="242" height="660" rx="6" fill="#f1f5f9" stroke="#000" stroke-opacity=".4" stroke-width="2"/>' +
  '<path d="M10 310H240M10 390H240M10 470H240M10 550H240M10 630H240M10 710H240M10 790H240" stroke="#000" stroke-opacity=".1" stroke-width="3"/>' +
  '<rect x="4" y="234" width="242" height="18" fill="#000" opacity=".12"/>');

let trailerRibs = '';
for (let y = 520; y < 1620; y += 80) trailerRibs += `M10 ${y}H245`;

const semi = svg(255, 1650,
  '<rect x="12" y="14" width="243" height="1636" rx="10" fill="#000" opacity=".2"/>' +
  mirror('<rect x="8" y="100" width="16" height="74" rx="5" fill="#1b1b1b"/>' +
    '<path d="M24 74L2 82L3 104L24 100Z" fill="#222"/>' +
    '<rect x="2" y="1420" width="18" height="90" rx="5" fill="#1b1b1b"/><rect x="2" y="1520" width="18" height="90" rx="5" fill="#1b1b1b"/>', 255) +
  '<rect x="38" y="250" width="179" height="230" rx="10" fill="#2b2b2b"/>' +
  `<path d="${bodyPath(20, 6, 235, 290, 36, 12)}" fill="{{color}}" ${OUTLINE}/>` +
  '<path d="M32 76Q127 54 223 76L213 124Q127 112 42 124Z" fill="#000" opacity=".5"/>' +
  '<rect x="42" y="132" width="171" height="140" rx="10" fill="#fff" opacity=".1"/>' +
  '<rect x="4" y="430" width="247" height="1214" rx="4" fill="#f1f5f9" stroke="#000" stroke-opacity=".4" stroke-width="2"/>' +
  `<path d="${trailerRibs}" stroke="#000" stroke-opacity=".1" stroke-width="3"/>`);

// ───────── jednoślady ─────────

const bike = svg(60, 180,
  '<ellipse cx="34" cy="94" rx="20" ry="84" fill="#000" opacity=".15"/>' +
  '<rect x="27" y="4" width="6" height="66" rx="3" fill="#1a1a1a"/><rect x="27" y="110" width="6" height="66" rx="3" fill="#1a1a1a"/>' +
  '<path d="M30 30V150" stroke="{{color}}" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M9 44H51" stroke="{{color}}" stroke-width="5" stroke-linecap="round"/>' +
  '<ellipse cx="20" cy="124" rx="5" ry="10" fill="#2b2b2b"/><ellipse cx="40" cy="124" rx="5" ry="10" fill="#2b2b2b"/>' +
  '<path d="M13 46L17 84M47 46L43 84" stroke="#e4572e" stroke-width="7" stroke-linecap="round"/>' +
  '<ellipse cx="30" cy="98" rx="20" ry="16" fill="#e4572e" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>' +
  '<ellipse cx="30" cy="80" rx="9" ry="11" fill="#f5f5f5" stroke="#333" stroke-width="1.5"/>' +
  '<path d="M27 72V88M33 72V88" stroke="#333" stroke-width="1.2"/>');

const bikeParked = svg(60, 180,
  '<ellipse cx="33" cy="93" rx="10" ry="84" fill="#000" opacity=".12"/>' +
  '<rect x="27" y="4" width="6" height="66" rx="3" fill="#1a1a1a"/><rect x="27" y="110" width="6" height="66" rx="3" fill="#1a1a1a"/>' +
  '<path d="M30 30V150" stroke="{{color}}" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M9 44H51" stroke="{{color}}" stroke-width="5" stroke-linecap="round"/>' +
  '<path d="M20 110H40" stroke="#444" stroke-width="3" stroke-linecap="round"/>' +
  '<ellipse cx="30" cy="124" rx="6" ry="12" fill="#222"/>');

const motorcycle = svg(80, 220,
  '<ellipse cx="44" cy="114" rx="30" ry="104" fill="#000" opacity=".15"/>' +
  '<rect x="33" y="4" width="14" height="62" rx="6" fill="#1a1a1a"/><rect x="31" y="150" width="18" height="66" rx="7" fill="#1a1a1a"/>' +
  '<path d="M8 58H72" stroke="#333" stroke-width="5" stroke-linecap="round"/>' +
  '<circle cx="10" cy="52" r="4" fill="#666"/><circle cx="70" cy="52" r="4" fill="#666"/>' +
  '<ellipse cx="40" cy="90" rx="17" ry="28" fill="{{color}}" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>' +
  '<rect x="29" y="112" width="22" height="56" rx="10" fill="#222"/>' +
  '<path d="M14 60L20 116M66 60L60 116" stroke="#2b2b2b" stroke-width="8" stroke-linecap="round"/>' +
  '<ellipse cx="40" cy="128" rx="27" ry="15" fill="#333" stroke="#000" stroke-opacity=".4" stroke-width="1.5"/>' +
  '<circle cx="40" cy="110" r="12" fill="#111"/><path d="M31 104Q40 98 49 104" stroke="#5b8dd6" stroke-width="3" fill="none"/>');

const scooter = svg(50, 120,
  '<ellipse cx="28" cy="64" rx="18" ry="54" fill="#000" opacity=".15"/>' +
  '<rect x="22" y="2" width="6" height="16" rx="3" fill="#111"/><rect x="22" y="102" width="6" height="16" rx="3" fill="#111"/>' +
  '<rect x="19" y="20" width="12" height="86" rx="4" fill="#333"/>' +
  '<path d="M7 16H43" stroke="#222" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M10 18L9 58M40 18L41 58" stroke="{{color}}" stroke-width="6" stroke-linecap="round"/>' +
  '<ellipse cx="25" cy="64" rx="20" ry="10" fill="{{color}}" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>' +
  '<circle cx="25" cy="62" r="8" fill="#3b2a1e"/>');

export const symbols: SymbolDef[] = [
  { id: 'veh-car', name: 'Samochód osobowy', category: 'vehicles', width: 1.8, height: 4.5, svg: car, defaultColor: '#d9d9d9', tags: ['samochód', 'osobowy', 'auto', 'car'] },
  { id: 'veh-suv', name: 'SUV', category: 'vehicles', width: 1.96, height: 4.9, svg: suv, defaultColor: '#3b4a5a', tags: ['suv', 'samochód', 'terenowy', 'car'] },
  { id: 'veh-taxi', name: 'Taksówka', category: 'vehicles', width: 1.8, height: 4.5, svg: taxi, defaultColor: '#d9d9d9', tags: ['taxi', 'taksówka', 'car'] },
  { id: 'veh-police', name: 'Radiowóz', category: 'vehicles', width: 1.8, height: 4.5, svg: police, defaultColor: '#1d3f8f', tags: ['policja', 'radiowóz', 'police'] },
  { id: 'veh-pickup', name: 'Pickup', category: 'vehicles', width: 2.0, height: 5.6, svg: pickup, defaultColor: '#8b1e1e', tags: ['pickup', 'samochód', 'truck'] },
  { id: 'veh-van', name: 'Dostawczy (van)', category: 'vehicles', width: 2.0, height: 5.5, svg: van, defaultColor: '#f5f5f5', tags: ['dostawczy', 'van', 'bus', 'delivery'] },
  { id: 'veh-ambulance', name: 'Karetka', category: 'vehicles', width: 2.1, height: 6.0, svg: ambulance, defaultColor: '#f2f2ea', tags: ['karetka', 'ambulans', 'pogotowie', 'ambulance'] },
  { id: 'veh-truck', name: 'Ciężarówka', category: 'vehicles', width: 2.5, height: 9.0, svg: truck, defaultColor: '#1f6f3a', tags: ['ciężarówka', 'samochód ciężarowy', 'truck', 'lorry'] },
  { id: 'veh-semi', name: 'Ciągnik siodłowy z naczepą', category: 'vehicles', width: 2.55, height: 16.5, svg: semi, defaultColor: '#1e40af', tags: ['tir', 'ciągnik siodłowy', 'naczepa', 'semi', 'truck'] },
  { id: 'veh-bus', name: 'Autobus 12 m (Solaris)', category: 'vehicles', width: 2.55, height: 12.0, svg: bus, defaultColor: '#1f6feb', tags: ['autobus', 'solaris', 'komunikacja', 'bus'] },
  { id: 'veh-bus-artic', name: 'Autobus przegubowy 18 m', category: 'vehicles', width: 2.55, height: 18.0, svg: busArtic, defaultColor: '#1f6feb', tags: ['autobus', 'przegubowy', 'przegubowiec', 'bus'] },
  { id: 'veh-tram', name: 'Tramwaj (Pesa Swing, 30 m)', category: 'vehicles', width: 2.4, height: 30.0, svg: tram, defaultColor: '#d61f26', tags: ['tramwaj', 'pesa', 'swing', 'tram'] },
  { id: 'veh-bike', name: 'Rower', category: 'vehicles', width: 0.6, height: 1.8, svg: bike, defaultColor: '#222222', tags: ['rower', 'rowerzysta', 'bike', 'bicycle'] },
  { id: 'veh-bike-parked', name: 'Rower zaparkowany', category: 'vehicles', width: 0.6, height: 1.8, svg: bikeParked, defaultColor: '#2563eb', tags: ['rower', 'parking', 'bike'] },
  { id: 'veh-scooter', name: 'Hulajnoga', category: 'vehicles', width: 0.5, height: 1.2, svg: scooter, defaultColor: '#10b981', tags: ['hulajnoga', 'hulajnoga elektryczna', 'scooter', 'UTO'] },
  { id: 'veh-motorcycle', name: 'Motocykl', category: 'vehicles', width: 0.8, height: 2.2, svg: motorcycle, defaultColor: '#b91c1c', tags: ['motocykl', 'motor', 'skuter', 'motorcycle'] },
];
