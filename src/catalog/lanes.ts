import type { LaneTemplate } from '../model/types';
import {
  BIKE_LANE_W,
  BIKE_PATH_2WAY_W,
  BIKE_PATH_W,
  BUFFER_W,
  BUS_W,
  DRIVE_CITY_W,
  DRIVE_W,
  GREEN_W,
  MEDIAN_W,
  PARKING_ANGLE_W,
  PARKING_PAR_W,
  PARKING_PERP_W,
  PATH_W,
  SEPARATOR_W,
  SHOULDER_W,
  SIDEWALK_W,
  TRAM_W,
  TURN_W,
} from '../model/units';
import { GRASS_TRACK, RED_ASPHALT, lane } from './helpers';

/**
 * Strips the user can ADD to a road from the lane editor.
 * Flow lanes are created with dir 1 (the editor flips dir when inserting on the left side);
 * non-flow strips (parking, sidewalk, green, ...) have dir 0.
 */
export const LANE_TEMPLATES: LaneTemplate[] = [
  {
    id: 'lt-drive',
    name: 'Pas ruchu (3,5 m)',
    lane: lane('drive', 1, DRIVE_W),
    description: 'Pas ruchu dla dróg klasy G/Z',
  },
  {
    id: 'lt-drive-city',
    name: 'Pas ruchu miejski (3,0 m)',
    lane: lane('drive', 1, DRIVE_CITY_W),
    description: 'Pas ruchu w terenie zabudowanym (ulice L/D)',
  },
  {
    id: 'lt-turn-left',
    name: 'Pas do skrętu w lewo',
    lane: lane('turn', 1, TURN_W, { marking: 'arrowsLeft' }),
    description: 'Pas do skrętu w lewo ze strzałkami P-8',
  },
  {
    id: 'lt-turn-right',
    name: 'Pas do skrętu w prawo',
    lane: lane('turn', 1, TURN_W, { marking: 'arrowsRight' }),
    description: 'Pas do skrętu w prawo ze strzałkami P-8',
  },
  {
    id: 'lt-bike-lane',
    name: 'Pas ruchu dla rowerów (1,5 m)',
    lane: lane('bike', 1, BIKE_LANE_W, { marking: 'bikeSymbols' }),
    description: 'Pas ruchu dla rowerów na jezdni, oddzielony linią P-2, symbol P-23',
  },
  {
    id: 'lt-bike-path',
    name: 'Droga dla rowerów jednokierunkowa (2,0 m)',
    lane: lane('bikePath', 1, BIKE_PATH_W, { marking: 'bikeSymbols', surface: RED_ASPHALT }),
    description: 'Wydzielona droga dla rowerów, czerwona nawierzchnia',
  },
  {
    id: 'lt-bike-path-2way',
    name: 'Droga dla rowerów dwukierunkowa (2,5 m)',
    lane: lane('bikePath', 1, BIKE_PATH_2WAY_W, { marking: 'bikeSymbols', surface: RED_ASPHALT }),
    description: 'Wydzielona dwukierunkowa droga dla rowerów, czerwona nawierzchnia',
  },
  {
    id: 'lt-bus',
    name: 'Buspas (3,5 m)',
    lane: lane('bus', 1, BUS_W, { marking: 'busText' }),
    description: 'Pas ruchu dla autobusów, napis P-22 „BUS”',
  },
  {
    id: 'lt-tram',
    name: 'Torowisko tramwajowe – jeden tor',
    lane: lane('tram', 1, TRAM_W, { marking: 'tramTracks' }),
    description: 'Jeden tor tramwajowy (3,0 m)',
  },
  {
    id: 'lt-tram-green',
    name: 'Torowisko tramwajowe – zielone',
    lane: lane('tram', 1, TRAM_W, { marking: 'tramTracks', surface: GRASS_TRACK }),
    description: 'Jeden tor tramwajowy na torowisku zielonym (trawa)',
  },
  {
    id: 'lt-parking',
    name: 'Parkowanie równoległe (2,5 m)',
    lane: lane('parking', 0, PARKING_PAR_W, { marking: 'parkingBays' }),
    description: 'Miejsca postojowe równoległe 2,5 × 6,0 m (P-18 / P-19)',
  },
  {
    id: 'lt-parking-perp',
    name: 'Parkowanie prostopadłe (5,0 m)',
    lane: lane('parkingPerp', 0, PARKING_PERP_W, { marking: 'parkingBays' }),
    description: 'Miejsca postojowe prostopadłe 2,5 × 5,0 m',
  },
  {
    id: 'lt-parking-angle',
    name: 'Parkowanie skośne (4,5 m)',
    lane: lane('parkingAngle', 0, PARKING_ANGLE_W, { marking: 'parkingBays' }),
    description: 'Miejsca postojowe skośne (45°)',
  },
  {
    id: 'lt-sidewalk',
    name: 'Chodnik (2,0 m)',
    lane: lane('sidewalk', 0, SIDEWALK_W),
    description: 'Chodnik o minimalnej szerokości 2,0 m',
  },
  {
    id: 'lt-sidewalk-wide',
    name: 'Chodnik szeroki (3,0 m)',
    lane: lane('sidewalk', 0, 3.0),
    description: 'Szeroki chodnik w centrum miasta',
  },
  {
    id: 'lt-path',
    name: 'Ciąg pieszo-rowerowy (3,0 m)',
    lane: lane('path', 0, PATH_W),
    description: 'Wspólna nawierzchnia dla pieszych i rowerzystów',
  },
  {
    id: 'lt-green',
    name: 'Pas zieleni (2,0 m)',
    lane: lane('green', 0, GREEN_W),
    description: 'Trawnik / pas zieleni przyulicznej',
  },
  {
    id: 'lt-median',
    name: 'Pas dzielący / wyspa (2,0 m)',
    lane: lane('median', 0, MEDIAN_W),
    description: 'Wyniesiony pas dzielący lub wyspa z krawężnikami',
  },
  {
    id: 'lt-separator',
    name: 'Separator (0,3 m)',
    lane: lane('separator', 0, SEPARATOR_W),
    description: 'Wąski separator / krawężnik oddzielający pasy',
  },
  {
    id: 'lt-buffer',
    name: 'Opaska / powierzchnia wyłączona P-21 (0,5 m)',
    lane: lane('buffer', 0, BUFFER_W, { marking: 'hatch' }),
    description: 'Powierzchnia wyłączona z ruchu (szrafura P-21) lub opaska',
  },
  {
    id: 'lt-shoulder',
    name: 'Pobocze (1,0 m)',
    lane: lane('shoulder', 0, SHOULDER_W),
    description: 'Pobocze utwardzone, oddzielone linią krawędziową P-7',
  },
];
