import type { SymbolCategory, SymbolDef } from '../../model/types';
import { symbols as vehicles } from './vehicles';
import { symbols as people } from './people';
import { symbols as arrows } from './arrows';
import { symbols as markings } from './markings';
import { symbols as words } from './words';
import { symbols as signs } from './signs';
import { symbols as trees } from './trees';
import { symbols as furniture } from './furniture';

export const SYMBOLS: SymbolDef[] = [
  ...vehicles,
  ...people,
  ...arrows,
  ...markings,
  ...words,
  ...signs,
  ...trees,
  ...furniture,
];

/** Categories in sidebar display order (Polish labels). */
export const SYMBOL_CATEGORIES: { id: SymbolCategory; label: string }[] = [
  { id: 'vehicles', label: 'Pojazdy' },
  { id: 'people', label: 'Ludzie' },
  { id: 'arrows', label: 'Strzałki' },
  { id: 'markings', label: 'Znaki poziome' },
  { id: 'words', label: 'Napisy' },
  { id: 'signs', label: 'Znaki pionowe' },
  { id: 'trees', label: 'Zieleń' },
  { id: 'furniture', label: 'Mała architektura' },
];

const BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));

export function symbolById(id: string): SymbolDef | undefined {
  return BY_ID.get(id);
}
