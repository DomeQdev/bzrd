import type { SymbolDef } from '../../model/types';

/**
 * Znaki pionowe (A / B / C / D / S / U) — schematic face-on icons, 0.9 × 0.9 m.
 * Fixed colors (no {{color}} tint). viewBox 100 × 100 unless noted.
 */

const RED = '#d2232a';
const BLUE = '#1a5aa6';
const YELLOW = '#ffd200';
const BLACK = '#111';
const FONT = 'font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle"';

const f = (n: number): number => +n.toFixed(1);
const sq = (body: string, w = 100, h = 100): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// ───────── building blocks ─────────

const warnTri = (inner: string): string =>
  `<path d="M50 8L95 88H5Z" fill="${YELLOW}" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>${inner}`;
const prohib = (fill = '#fff'): string =>
  `<circle cx="50" cy="50" r="41" fill="${fill}" stroke="${RED}" stroke-width="12"/>`;
const blueDisc = `<circle cx="50" cy="50" r="47" fill="${BLUE}" stroke="#fff" stroke-width="2"/>`;
const blueSquare = `<rect x="3" y="3" width="94" height="94" rx="6" fill="${BLUE}" stroke="#fff" stroke-width="2.5"/>`;
const slash = (x0: number, y0: number, x1: number, y1: number, w = 9): string =>
  `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${RED}" stroke-width="${w}"/>`;

/** walking pedestrian centered on the origin (≈ 26 × 52 units) */
const walker = (tx: number, ty: number, s: number, color = BLACK): string =>
  `<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="2" cy="-21" r="5.5" fill="${color}" stroke="none"/>` +
  '<path d="M0 -13L-3 6L-10 22M-3 6L6 19L10 23M0 -9L-8 1M0 -9L8 -2"/></g>';

/** side-view bicycle, native box 160 × 95 */
const sideBike = (tx: number, ty: number, s: number, color: string): string =>
  `<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">` +
  '<circle cx="30" cy="62" r="25"/><circle cx="130" cy="62" r="25"/>' +
  '<path d="M30 62L75 62L64 30L30 62M64 30L118 28L130 62M118 28L114 14M106 14H122M56 26H72"/></g>';

/** octagon with circumradius r centered at (50,50) */
const octagon = (r: number): string => {
  const pts: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180;
    pts.push(`${f(50 + r * Math.cos(a))} ${f(50 + r * Math.sin(a))}`);
  }
  return `M${pts.join('L')}Z`;
};

/** three counter-clockwise arrows around (50,50) for C-12 */
const roundaboutArrows = (): string => {
  const R = 24;
  let out = '';
  for (let k = 0; k < 3; k++) {
    const s = ((-40 + 120 * k) * Math.PI) / 180;
    const e = s - (85 * Math.PI) / 180;
    const sx = 50 + R * Math.cos(s), sy = 50 + R * Math.sin(s);
    const ex = 50 + R * Math.cos(e), ey = 50 + R * Math.sin(e);
    const tx = Math.sin(e), ty = -Math.cos(e); // direction of travel at the end (CCW)
    const nx = Math.cos(e), ny = Math.sin(e);
    out += `<path d="M${f(sx)} ${f(sy)}A${R} ${R} 0 0 0 ${f(ex)} ${f(ey)}" fill="none" stroke="#fff" stroke-width="8"/>` +
      `<path d="M${f(ex + tx * 13)} ${f(ey + ty * 13)}L${f(ex + nx * 9)} ${f(ey + ny * 9)}L${f(ex - nx * 9)} ${f(ey - ny * 9)}Z" fill="#fff"/>`;
  }
  return out;
};

const leftTurnArrow = `<path d="M60 78V48Q60 38 50 38H38" fill="none" stroke="${BLACK}" stroke-width="9"/><path d="M24 38L40 25V51Z" fill="${BLACK}"/>`;

const d6Inner =
  '<path d="M50 10L90 84H10Z" fill="#fff" stroke-linejoin="round"/>' +
  walker(50, 52, 0.55) +
  `<path d="M28 80h6l3-8h-6zM40 80h6l3-8h-6zM52 80h6l3-8h-6zM64 80h6l3-8h-6z" fill="${BLACK}"/>`;
const d6aInner =
  sideBike(18, 22, 0.4, '#fff') +
  '<path d="M14 70h8v8h-8zM30 70h8v8h-8zM46 70h8v8h-8zM62 70h8v8h-8zM78 70h8v8h-8z" fill="#fff"/>';

const busSide =
  `<rect x="20" y="36" width="60" height="30" rx="5" fill="${BLACK}"/>` +
  '<path d="M25 41h10v10h-10zM38 41h10v10h-10zM51 41h10v10h-10zM64 41h11v14h-11z" fill="#fff"/>' +
  `<circle cx="32" cy="67" r="6" fill="${BLACK}" stroke="#fff" stroke-width="2"/><circle cx="66" cy="67" r="6" fill="${BLACK}" stroke="#fff" stroke-width="2"/>`;
const tramSide =
  `<rect x="16" y="40" width="68" height="26" rx="4" fill="${BLACK}"/>` +
  `<path d="M40 40L50 30L60 40M36 28H64" fill="none" stroke="${BLACK}" stroke-width="3"/>` +
  '<path d="M21 45h9v9h-9zM34 45h9v9h-9zM47 45h9v9h-9zM60 45h9v9h-9zM72 45h8v12h-8z" fill="#fff"/>' +
  `<path d="M22 70h12M66 70h12" stroke="${BLACK}" stroke-width="5"/>`;

const diamondOuter = 'M50 2L98 50L50 98L2 50Z';
const d1 = `<path d="${diamondOuter}" fill="#fff" stroke="#555" stroke-width="1"/><path d="M50 16L84 50L50 84L16 50Z" fill="${YELLOW}"/>`;

// ───────── signs ─────────

const a7 = sq(`<path d="M5 12H95L50 92Z" fill="${YELLOW}" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>`);
const a5 = sq(warnTri(`<path d="M46 36h8v46h-8zM30 56h40v8h-40z" fill="${BLACK}"/>`));
const a16 = sq(warnTri(walker(50, 58, 0.85)));
const a17 = sq(warnTri(walker(42, 63, 0.62) + walker(59, 67, 0.5) + `<path d="M46 62L55 64" stroke="${BLACK}" stroke-width="3"/>`));

const b20 = sq(`<path d="${octagon(48)}" fill="#fff" stroke="#999" stroke-width=".8"/><path d="${octagon(44)}" fill="${RED}"/>` +
  `<text x="50" y="60" ${FONT} font-size="27" textLength="72" lengthAdjust="spacingAndGlyphs" fill="#fff">STOP</text>`);
const b1 = sq(prohib());
const b2 = sq(`<circle cx="50" cy="50" r="47" fill="${RED}"/><rect x="16" y="42" width="68" height="16" fill="#fff"/>`);
const b21 = sq(prohib() + leftTurnArrow + slash(25, 25, 75, 75, 8));
const b22 = sq(prohib() + `<g transform="matrix(-1 0 0 1 100 0)">${leftTurnArrow}</g>` + slash(25, 25, 75, 75, 8));
const b33 = (v: string): string => sq(prohib() +
  `<text x="50" y="64" ${FONT} font-size="40" textLength="46" lengthAdjust="spacingAndGlyphs" fill="${BLACK}">${v}</text>`);
const b35 = sq(prohib(BLUE) + slash(24, 24, 76, 76, 10));
const b36 = sq(prohib(BLUE) + slash(24, 24, 76, 76, 10) + slash(76, 24, 24, 76, 10));
const b43 = sq(`<rect x="3" y="3" width="94" height="94" rx="6" fill="#fff" stroke="${BLACK}" stroke-width="2.5"/>` +
  `<circle cx="50" cy="38" r="25" fill="#fff" stroke="${RED}" stroke-width="7"/>` +
  `<text x="50" y="47" ${FONT} font-size="25" textLength="28" lengthAdjust="spacingAndGlyphs" fill="${BLACK}">30</text>` +
  `<text x="50" y="86" ${FONT} font-size="15" textLength="66" lengthAdjust="spacingAndGlyphs" fill="${BLACK}">STREFA</text>`);

const c2 = sq(blueDisc + '<path d="M42 80V54Q42 42 54 42H60" fill="none" stroke="#fff" stroke-width="10"/><path d="M77 42L58 28V56Z" fill="#fff"/>');
const c12 = sq(blueDisc + roundaboutArrows());
const c13 = sq(blueDisc + sideBike(16.4, 28, 0.42, '#fff'));
const c16 = sq(blueDisc + walker(50, 52, 1.2, '#fff'));
const c1316 = sq(blueDisc + sideBike(21, 12, 0.36, '#fff') + '<path d="M8 50H92" stroke="#fff" stroke-width="3"/>' + walker(50, 73, 0.62, '#fff'));
const c1316a = sq(blueDisc + walker(30, 52, 0.85, '#fff') + '<path d="M50 4V96" stroke="#fff" stroke-width="3"/>' + sideBike(54, 38, 0.25, '#fff'));

const d1s = sq(d1);
const d2 = sq('<defs><clipPath id="c"><path d="M50 2L98 50L50 98L2 50Z"/></clipPath></defs>' + d1 +
  `<g clip-path="url(#c)"><path d="M10 78L78 10M15 83L83 15M20 88L88 20M25 93L93 25" stroke="${BLACK}" stroke-width="2.2"/></g>`);
const d3 = sq(blueSquare + '<path d="M50 12L74 42H58V88H42V42H26Z" fill="#fff"/>');
const d6 = sq(blueSquare + d6Inner);
const d6a = sq(blueSquare + d6aInner);
const d6b = sq(`<rect x="2" y="2" width="146" height="86" rx="6" fill="${BLUE}" stroke="#fff" stroke-width="2.5"/>` +
  `<g transform="translate(-2 0) scale(.9)">${d6Inner}</g><g transform="translate(68 0) scale(.9)">${d6aInner}</g>`, 150, 90);
const d15 = sq(blueSquare + '<rect x="12" y="12" width="76" height="76" rx="4" fill="#fff"/>' + busSide);
const d17 = sq(blueSquare + '<rect x="12" y="12" width="76" height="76" rx="4" fill="#fff"/>' + tramSide);
const d18 = sq(blueSquare + `<text x="50" y="78" ${FONT} font-size="72" fill="#fff">P</text>`);
const d40 = sq(blueSquare + '<rect x="10" y="10" width="80" height="80" rx="3" fill="#fff"/>' +
  `<path d="M16 54L30 40L44 54V72H16Z" fill="${BLACK}"/><path d="M26 72V62h8v10z" fill="#fff"/>` +
  walker(58, 57, 0.55) + walker(72, 64, 0.38) + `<circle cx="82" cy="74" r="4" fill="${BLACK}"/>` +
  `<path d="M14 80H86" stroke="${BLACK}" stroke-width="2"/>`);
const d42 = sq(`<rect x="2" y="14" width="96" height="72" rx="5" fill="#fff" stroke="${BLACK}" stroke-width="2"/>` +
  `<rect x="7" y="19" width="86" height="62" rx="3" fill="none" stroke="${BLACK}" stroke-width="1.2"/>` +
  `<path d="M12 74V54H22V46H30V58H38V36L44 28L50 36V58H58V50H68V42H76V60H88V74Z" fill="${BLACK}"/>`);

const s1 = sq('<rect x="26" y="1" width="48" height="98" rx="6" fill="#222"/>' +
  `<rect x="31" y="5" width="38" height="90" rx="6" fill="${BLACK}"/>` +
  '<circle cx="50" cy="21" r="11" fill="#ef4444"/><circle cx="50" cy="50" r="11" fill="#f59e0b"/><circle cx="50" cy="79" r="11" fill="#22c55e"/>');

const u5a = sq('<defs><clipPath id="c"><rect x="36" y="40" width="28" height="57" rx="3"/></clipPath></defs>' +
  '<rect x="36" y="40" width="28" height="57" rx="3" fill="#fff"/>' +
  `<g clip-path="url(#c)"><path d="M30 52L70 32M30 68L70 48M30 84L70 64M30 100L70 80M30 116L70 96" stroke="${RED}" stroke-width="7"/></g>` +
  '<rect x="36" y="40" width="28" height="57" rx="3" fill="none" stroke="#555" stroke-width="1"/>' +
  `<circle cx="50" cy="21" r="18" fill="${BLUE}" stroke="#fff" stroke-width="2"/>` +
  '<path d="M42 13L56 27M57 28V18M57 28H47" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>');

const u18 = sq('<defs><radialGradient id="g" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#8b95a1"/></radialGradient></defs>' +
  '<circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="9"/>' +
  `<circle cx="50" cy="50" r="43" fill="none" stroke="${RED}" stroke-width="9" stroke-dasharray="13.51 13.51"/>` +
  '<circle cx="50" cy="50" r="38.5" fill="url(#g)"/>' +
  '<ellipse cx="38" cy="34" rx="14" ry="7" fill="#fff" opacity=".45" transform="rotate(-30 38 34)"/>');

const S = 0.9;
const sign = (id: string, name: string, svg: string, tags: string[], w = S, h = S): SymbolDef =>
  ({ id, name, category: 'signs', width: w, height: h, svg, tags: ['znak', ...tags] });

export const symbols: SymbolDef[] = [
  sign('sign-a7', 'A-7 Ustąp pierwszeństwa', a7, ['A-7', 'ustąp pierwszeństwa', 'yield']),
  sign('sign-b20', 'B-20 STOP', b20, ['B-20', 'stop', 'zatrzymaj się']),
  sign('sign-a5', 'A-5 Skrzyżowanie dróg równorzędnych', a5, ['A-5', 'skrzyżowanie', 'równorzędne', 'ostrzegawczy']),
  sign('sign-a16', 'A-16 Przejście dla pieszych', a16, ['A-16', 'przejście', 'piesi', 'ostrzegawczy']),
  sign('sign-a17', 'A-17 Dzieci', a17, ['A-17', 'dzieci', 'szkoła', 'ostrzegawczy']),
  sign('sign-b1', 'B-1 Zakaz ruchu w obu kierunkach', b1, ['B-1', 'zakaz ruchu', 'zakazu']),
  sign('sign-b2', 'B-2 Zakaz wjazdu', b2, ['B-2', 'zakaz wjazdu', 'zakazu']),
  sign('sign-b21', 'B-21 Zakaz skręcania w lewo', b21, ['B-21', 'zakaz skrętu', 'w lewo', 'zakazu']),
  sign('sign-b22', 'B-22 Zakaz skręcania w prawo', b22, ['B-22', 'zakaz skrętu', 'w prawo', 'zakazu']),
  sign('sign-b33-30', 'B-33 Ograniczenie prędkości 30', b33('30'), ['B-33', 'ograniczenie prędkości', '30', 'tempo 30']),
  sign('sign-b33-50', 'B-33 Ograniczenie prędkości 50', b33('50'), ['B-33', 'ograniczenie prędkości', '50']),
  sign('sign-b35', 'B-35 Zakaz postoju', b35, ['B-35', 'zakaz postoju', 'parkowanie']),
  sign('sign-b36', 'B-36 Zakaz zatrzymywania się', b36, ['B-36', 'zakaz zatrzymywania', 'parkowanie']),
  sign('sign-b43', 'B-43 Strefa ograniczonej prędkości', b43, ['B-43', 'strefa', 'tempo 30', 'prędkość']),
  sign('sign-c2', 'C-2 Nakaz jazdy w prawo za znakiem', c2, ['C-2', 'nakaz', 'w prawo', 'nakazu']),
  sign('sign-c12', 'C-12 Ruch okrężny', c12, ['C-12', 'rondo', 'ruch okrężny', 'nakazu']),
  sign('sign-c13', 'C-13 Droga dla rowerów', c13, ['C-13', 'droga dla rowerów', 'rower', 'DDR']),
  sign('sign-c16', 'C-16 Droga dla pieszych', c16, ['C-16', 'droga dla pieszych', 'piesi', 'chodnik']),
  sign('sign-c13-16', 'C-13/16 Droga dla pieszych i rowerów (wspólna)', c1316, ['C-13/16', 'ciąg pieszo-rowerowy', 'CPR', 'rower', 'piesi']),
  sign('sign-c13-16a', 'C-13/16a Droga dla pieszych i rowerów (rozdzielona)', c1316a, ['C-13/16a', 'rower', 'piesi', 'rozdzielona']),
  sign('sign-d1', 'D-1 Droga z pierwszeństwem', d1s, ['D-1', 'droga z pierwszeństwem', 'pierwszeństwo']),
  sign('sign-d2', 'D-2 Koniec drogi z pierwszeństwem', d2, ['D-2', 'koniec pierwszeństwa']),
  sign('sign-d3', 'D-3 Droga jednokierunkowa', d3, ['D-3', 'jednokierunkowa', 'jeden kierunek']),
  sign('sign-d6', 'D-6 Przejście dla pieszych', d6, ['D-6', 'przejście', 'piesi', 'zebra']),
  sign('sign-d6a', 'D-6a Przejazd dla rowerzystów', d6a, ['D-6a', 'przejazd', 'rower']),
  sign('sign-d6b', 'D-6b Przejście dla pieszych i przejazd dla rowerzystów', d6b, ['D-6b', 'przejście', 'przejazd', 'rower', 'piesi'], 1.5, 0.9),
  sign('sign-d15', 'D-15 Przystanek autobusowy', d15, ['D-15', 'przystanek', 'autobus']),
  sign('sign-d17', 'D-17 Przystanek tramwajowy', d17, ['D-17', 'przystanek', 'tramwaj']),
  sign('sign-d18', 'D-18 Parking', d18, ['D-18', 'parking', 'P']),
  sign('sign-d40', 'D-40 Strefa zamieszkania', d40, ['D-40', 'strefa zamieszkania', 'woonerf']),
  sign('sign-d42', 'D-42 Obszar zabudowany', d42, ['D-42', 'obszar zabudowany', 'miasto']),
  sign('sign-s1', 'S-1 Sygnalizator ogólny', s1, ['S-1', 'sygnalizacja', 'światła', 'sygnalizator']),
  sign('sign-u5a', 'U-5a Słupek przeszkodowy', u5a, ['U-5a', 'słupek', 'przeszkoda', 'azyl']),
  sign('sign-u18', 'U-18 Lustro drogowe', u18, ['U-18', 'lustro', 'lustro drogowe']),
];
