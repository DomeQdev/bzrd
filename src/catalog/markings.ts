import type { Preset } from '../model/types';

export const CATEGORY = 'Znaki poziome';
const W = '#f4f4f4';

function p(id: string, name: string, group: string, template: Preset['template'], description: string, tags: string[] = []): Preset {
  return { id: `mk-${id}`, name, category: CATEGORY, group, template, description, tags };
}

/** Line markings drawn with the pen / line tools. */
export const presets: Preset[] = [
  p('p1', 'P-1 linia pojedyncza przerywana', 'Linie', { kind: 'line', width: 0.12, style: 'dashed', color: W, variant: 'plain' }, 'Linia segregacyjna 2 m / 4 m (teren zabudowany)', ['przerywana', 'dashed']),
  p('p1c', 'P-1c linia krótka', 'Linie', { kind: 'line', width: 0.12, style: 'dotted', color: W, variant: 'plain' }, 'Linia przerywana 1 m / 1 m przy skrzyżowaniach'),
  p('p2', 'P-2 linia pojedyncza ciągła', 'Linie', { kind: 'line', width: 0.12, style: 'solid', color: W, variant: 'plain' }, 'Linia ciągła, zakaz przejeżdżania', ['ciągła', 'solid']),
  p('p3l', 'P-3 jednostronnie przekraczalna (przerywana z lewej)', 'Linie', { kind: 'line', width: 0.12, style: 'doubleDashedLeft', color: W, variant: 'plain' }, 'Linia podwójna: przerywana po lewej, ciągła po prawej'),
  p('p3r', 'P-3 jednostronnie przekraczalna (przerywana z prawej)', 'Linie', { kind: 'line', width: 0.12, style: 'doubleDashedRight', color: W, variant: 'plain' }, 'Linia podwójna: ciągła po lewej, przerywana po prawej'),
  p('p4', 'P-4 linia podwójna ciągła', 'Linie', { kind: 'line', width: 0.12, style: 'double', color: W, variant: 'plain' }, 'Oś jezdni, zakaz przekraczania w obu kierunkach', ['podwójna']),
  p('p6', 'P-6 linia ostrzegawcza', 'Linie', { kind: 'line', width: 0.12, style: 'dashedLong', color: W, variant: 'plain' }, 'Linia 4 m / 2 m przed linią ciągłą'),
  p('p7', 'P-7 linia krawędziowa', 'Linie', { kind: 'line', width: 0.24, style: 'edge', color: W, variant: 'plain' }, 'Krawędź jezdni (0,24 m)'),
  p('p7b', 'P-7b linia krawędziowa przerywana', 'Linie', { kind: 'line', width: 0.24, style: 'dashed', color: W, variant: 'plain' }, 'Krawędź jezdni przerywana (zjazdy)'),
  p('p12', 'P-12 linia bezwzględnego zatrzymania', 'Linie', { kind: 'line', width: 0.5, style: 'solid', color: W, variant: 'plain' }, 'Linia STOP 0,5 m (ze znakiem B-20)', ['stop']),
  p('p14', 'P-14 linia warunkowego zatrzymania', 'Linie', { kind: 'line', width: 0.5, style: 'dotted', color: W, variant: 'plain' }, 'Linia z prostokątów 0,5 m (sygnalizacja / A-7)'),
  p('p10', 'P-10 przejście dla pieszych', 'Przejścia', { kind: 'line', width: 4, style: 'solid', color: W, variant: 'crosswalk' }, 'Zebra: pasy 0,5 m co 1,0 m, szerokość 4 m (rysuj w poprzek jezdni)', ['zebra', 'przejście']),
  p('p11', 'P-11 przejazd dla rowerzystów', 'Przejścia', { kind: 'line', width: 2.0, style: 'solid', color: W, variant: 'bikeCrossing', fill: '#b5423a' }, 'Dwa rzędy kwadratów 0,5 m na czerwonej nawierzchni', ['przejazd', 'rower']),
  p('p17', 'P-17 linia przystankowa', 'Linie', { kind: 'line', width: 1.0, style: 'solid', color: W, variant: 'zigzag' }, 'Zygzak wyznaczający przystanek (rysuj wzdłuż krawężnika)'),
  p('p21', 'P-21 powierzchnia wyłączona z ruchu', 'Powierzchnie', { kind: 'line', width: 0.12, style: 'solid', color: W, variant: 'hatch', closedOnly: true }, 'Szrafura w obrysie (zamknięty wielokąt)', ['szrafura']),
  p('asphalt', 'Nawierzchnia asfaltowa', 'Powierzchnie', { kind: 'line', width: 0, style: 'none', color: W, fill: '#3a3d42', variant: 'asphalt', closedOnly: true }, 'Wypełnienie asfaltem (np. plac skrzyżowania, zatoka)', ['asfalt']),
  p('red', 'Nawierzchnia czerwona', 'Powierzchnie', { kind: 'line', width: 0, style: 'none', color: W, fill: '#b5423a', variant: 'asphalt', closedOnly: true }, 'Czerwona nawierzchnia (DDR, przejazd)', ['czerwona']),
  p('pavement', 'Chodnik / plac', 'Powierzchnie', { kind: 'line', width: 0.12, style: 'none', color: W, fill: '#cfcbc3', variant: 'pavement', closedOnly: true }, 'Nawierzchnia betonowa z krawężnikiem'),
  p('grass', 'Trawnik', 'Powierzchnie', { kind: 'line', width: 0.12, style: 'none', color: W, fill: '#5b8a3c', variant: 'grass', closedOnly: true }, 'Zieleń z krawężnikiem'),
  p('curb', 'Krawężnik', 'Linie', { kind: 'line', width: 0.3, style: 'solid', color: '#aaa69e', variant: 'curb' }, 'Krawężnik betonowy 0,3 m'),
  p('custom', 'Linia własna', 'Linie', { kind: 'line', width: 0.12, style: 'solid', color: W, variant: 'plain' }, 'Dowolna linia (kolor, grubość, styl w panelu)'),
];
