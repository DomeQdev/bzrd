import type { SymbolDef } from '../../model/types';

/**
 * Napisy na jezdni — white words stretched ×2.5 along the direction of travel
 * (letters 1.6 m tall, 0.55 m letter pitch). Multi-line messages read from the
 * driver outward, so the FIRST word is the BOTTOM line.
 * Units: centimeters (viewBox = 100 × meters).
 */

const LETTER = 55; // letter pitch (cm)
const CAP = 160; // cap height (cm)
const GAP = 100; // gap between lines (cm)
const STRETCH = 2.5;
const FONT = 88; // ≈ CAP / (0.716 cap-height ratio × STRETCH)

/** `read` = words in reading order (first one is closest to the driver = bottom) */
function word(read: string[]): { svg: string; width: number; height: number } {
  const lines = [...read].reverse();
  const maxN = Math.max(...lines.map((l) => [...l].length));
  const w = maxN * LETTER;
  const h = lines.length * CAP + (lines.length - 1) * GAP;
  const texts = lines.map((l, i) => {
    const base = (i * (CAP + GAP) + CAP) / STRETCH;
    const len = [...l].length * LETTER - 10;
    return `<text x="${w / 2}" y="${base}" text-anchor="middle" font-size="${FONT}" textLength="${len}" lengthAdjust="spacingAndGlyphs">${l}</text>`;
  }).join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
      `<g transform="scale(1 ${STRETCH})" fill="{{color}}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700">${texts}</g></svg>`,
    width: w / 100,
    height: h / 100,
  };
}

const def = (id: string, name: string, read: string[], tags: string[]): SymbolDef => ({
  id, name, category: 'words', ...word(read), defaultColor: '#ffffff', tags: ['napis', ...tags],
});

export const symbols: SymbolDef[] = [
  def('word-stop', 'P-16 Napis STOP', ['STOP'], ['STOP', 'P-16', 'zatrzymaj']),
  def('word-bus', 'P-22 Napis BUS', ['BUS'], ['BUS', 'P-22', 'buspas', 'autobus']),
  def('word-buspas', 'Napis BUSPAS', ['BUSPAS'], ['BUSPAS', 'autobus', 'pas autobusowy']),
  def('word-tylko-bus', 'Napis TYLKO BUS', ['TYLKO', 'BUS'], ['TYLKO BUS', 'autobus']),
  def('word-taxi', 'Napis TAXI', ['TAXI'], ['TAXI', 'taksówka', 'postój']),
  def('word-tram', 'Napis TRAM', ['TRAM'], ['TRAM', 'tramwaj']),
  def('word-rower', 'Napis ROWER', ['ROWER'], ['ROWER', 'rower', 'pas rowerowy']),
  def('word-moto', 'Napis MOTO', ['MOTO'], ['MOTO', 'motocykl']),
  def('word-szkola', 'Napis SZKOŁA', ['SZKOŁA'], ['SZKOŁA', 'szkoła', 'dzieci']),
  def('word-zwolnij', 'Napis ZWOLNIJ', ['ZWOLNIJ'], ['ZWOLNIJ', 'uspokojenie ruchu']),
  def('word-strefa-30', 'Napis STREFA 30', ['STREFA', '30'], ['STREFA 30', 'tempo 30', 'prędkość']),
  def('word-20', 'Napis 20 (prędkość)', ['20'], ['20', 'prędkość', 'ograniczenie']),
  def('word-30', 'Napis 30 (prędkość)', ['30'], ['30', 'prędkość', 'ograniczenie']),
  def('word-50', 'Napis 50 (prędkość)', ['50'], ['50', 'prędkość', 'ograniczenie']),
];
