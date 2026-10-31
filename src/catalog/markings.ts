import type { LaneMarking, LineCode, Preset } from '../model/types';
import { LANE_MARKING_LABEL, LINE_CODES, WHITE, lineSpec } from './helpers';

export const CATEGORY = 'Oznakowanie';

function line(code: LineCode): Preset {
  const def = LINE_CODES.find((c) => c.code === code)!;
  const transverse = code === 'p12' || code === 'p13' || code === 'p14';
  return {
    id: `mk-${code}`,
    name: def.name,
    category: CATEGORY,
    group: transverse ? 'Linie zatrzymania (rysuj w poprzek pasa)' : 'Linie (kropka → kropka)',
    template: { kind: 'line', ...lineSpec(code), variant: 'plain', code },
    description: def.description,
    tags: ['linia', def.short, def.spec.style],
  };
}

function laneMark(marking: LaneMarking, description: string, tags: string[] = []): Preset {
  return {
    id: `lm-${marking}`,
    name: LANE_MARKING_LABEL[marking],
    category: CATEGORY,
    group: 'Na pasie (kliknij pas)',
    template: { kind: 'laneMarking', marking },
    description,
    tags: ['pas', marking, ...tags],
  };
}

/** Everything that is PAINT (or structural detail) — drawn after the surfaces. */
export const presets: Preset[] = [
  ...(['p1b', 'p1a', 'p1c', 'p1d', 'p1e', 'p2a', 'p2b', 'p3a', 'p3b', 'p4', 'p5', 'p6', 'p7b', 'p7a', 'p7d', 'p7c', 'custom'] as LineCode[]).map(line),
  {
    id: 'mk-p10', name: 'P-10 przejście dla pieszych', category: CATEGORY, group: 'Przejścia (kropka → kropka w poprzek jezdni)',
    template: { kind: 'line', width: 4, style: 'solid', color: WHITE, variant: 'crosswalk' },
    description: 'Zebra: pasy 0,5 m co 1,0 m, szerokość 4 m (min. 2,5 m w mieście)', tags: ['zebra', 'przejście', 'P-10'],
  },
  {
    id: 'mk-p11', name: 'P-11 przejazd dla rowerzystów', category: CATEGORY, group: 'Przejścia (kropka → kropka w poprzek jezdni)',
    template: { kind: 'line', width: 2.0, style: 'solid', color: WHITE, variant: 'bikeCrossing', fill: '#b5423a' },
    description: 'Dwa rzędy kwadratów 0,5 m co 1,0 m, szerokość ≥ 1,8 m (3,0 m dwukierunkowy), czerwona nawierzchnia', tags: ['przejazd', 'rower', 'P-11'],
  },
  {
    id: 'mk-p11-plain', name: 'P-11 przejazd dla rowerzystów (bez czerwieni)', category: CATEGORY, group: 'Przejścia (kropka → kropka w poprzek jezdni)',
    template: { kind: 'line', width: 2.0, style: 'solid', color: WHITE, variant: 'bikeCrossing' },
    description: 'Dwa rzędy kwadratów 0,5 m bez czerwonej nawierzchni', tags: ['przejazd', 'rower', 'P-11'],
  },
  ...(['p12', 'p13', 'p14'] as LineCode[]).map(line),
  {
    id: 'mk-p17', name: 'P-17 linia przystankowa', category: CATEGORY, group: 'Inne',
    template: { kind: 'line', width: 1.5, style: 'solid', color: WHITE, variant: 'zigzag' },
    description: 'Zygzak 1,5 m co 2,5 m, długość 30–60 m (rysuj wzdłuż krawężnika)', tags: ['P-17', 'przystanek', 'zygzak'],
  },
  {
    id: 'mk-p21', name: 'P-21a powierzchnia wyłączona z ruchu', category: CATEGORY, group: 'Inne',
    template: { kind: 'line', width: 0.24, style: 'solid', color: WHITE, variant: 'hatch', closedOnly: true },
    description: 'Obwiednia P-7b 0,24 m, liniowanie 0,24 m co 0,39 m, skos 1:3 (zamknięty wielokąt)', tags: ['P-21', 'szrafura', 'wyspa'],
  },
  laneMark('p8a', 'Strzałka kierunkowa na wprost, 5 m, powtarzana co 15 m', ['strzałka']),
  laneMark('p8b', 'Strzałka kierunkowa w lewo', ['strzałka']),
  laneMark('p8d', 'Strzałka kierunkowa w prawo', ['strzałka']),
  laneMark('p8e', 'Strzałka kierunkowa na wprost lub w lewo', ['strzałka']),
  laneMark('p8f', 'Strzałka kierunkowa na wprost lub w prawo', ['strzałka']),
  laneMark('p8g', 'Strzałka kierunkowa w lewo lub w prawo', ['strzałka']),
  laneMark('p8h', 'Strzałka kierunkowa na wprost, w lewo lub w prawo', ['strzałka']),
  laneMark('p8c', 'Strzałka kierunkowa do zawracania', ['strzałka', 'zawracanie']),
  laneMark('p8i', 'Strzałka kierunkowa na wprost i do zawracania', ['strzałka', 'zawracanie']),
  laneMark('p9a', 'Strzałka naprowadzająca w lewo (pas zanika w lewo)', ['strzałka', 'zmiana pasa']),
  laneMark('p9b', 'Strzałka naprowadzająca w prawo (pas zanika w prawo)', ['strzałka', 'zmiana pasa']),
  laneMark('p22', 'Napis BUS 1,62 × 1,60 m, powtarzany co 30 m', ['bus', 'napis']),
  laneMark('p23', 'Symbol roweru P-23, powtarzany co 15 m', ['rower']),
  laneMark('p18', 'Stanowiska postojowe P-18 (linie 0,12 m)', ['parking']),
  laneMark('p21', 'Szrafura P-21a na całym pasie', ['szrafura']),
  laneMark('none', 'Usuwa oznakowanie z pasa'),
];
