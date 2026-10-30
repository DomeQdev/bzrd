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
 * Strips the user draws (V2: surface only — paint is added afterwards with the marking tool).
 * Flow lanes are created with dir 1; non-flow strips (parking, sidewalk, green, ...) have dir 0.
 */
export const LANE_TEMPLATES: LaneTemplate[] = [
  { id: 'lt-drive', name: 'Pas ruchu (3,5 m)', lane: lane('drive', 1, DRIVE_W), description: 'Pas ruchu dla dróg klasy G/Z' },
  { id: 'lt-drive-city', name: 'Pas ruchu miejski (3,0 m)', lane: lane('drive', 1, DRIVE_CITY_W), description: 'Pas ruchu w terenie zabudowanym (ulice L/D)' },
  { id: 'lt-turn', name: 'Pas do skrętu (3,0 m)', lane: lane('turn', 1, TURN_W), description: 'Dodatkowy pas na wlocie skrzyżowania — strzałki P-8 dodasz narzędziem oznakowania' },
  { id: 'lt-bike-lane', name: 'Pas ruchu dla rowerów (1,5 m)', lane: lane('bike', 1, BIKE_LANE_W), description: 'Pas dla rowerów na jezdni (asfalt), symbol P-23 i linia P-2b do dodania' },
  { id: 'lt-bike-path', name: 'Droga dla rowerów jednokierunkowa (2,0 m)', lane: lane('bikePath', 1, BIKE_PATH_W, { surface: RED_ASPHALT }), description: 'Wydzielona droga dla rowerów, czerwona nawierzchnia' },
  { id: 'lt-bike-path-2way', name: 'Droga dla rowerów dwukierunkowa (2,5 m)', lane: lane('bikePath', 1, BIKE_PATH_2WAY_W, { surface: RED_ASPHALT }), description: 'Wydzielona dwukierunkowa droga dla rowerów, czerwona nawierzchnia' },
  { id: 'lt-bus', name: 'Buspas (3,5 m)', lane: lane('bus', 1, BUS_W), description: 'Pas dla autobusów — napis P-22 „BUS” dodasz narzędziem oznakowania' },
  { id: 'lt-tram', name: 'Torowisko tramwajowe – jeden tor (3,0 m)', lane: lane('tram', 1, TRAM_W), description: 'Tor 1435 mm; na jezdni i przejściach rysuje się jako przejazd (płyty)' },
  { id: 'lt-tram-green', name: 'Torowisko tramwajowe – zielone', lane: lane('tram', 1, TRAM_W, { surface: GRASS_TRACK }), description: 'Jeden tor na torowisku zielonym (trawa)' },
  { id: 'lt-parking', name: 'Parkowanie równoległe (2,5 m)', lane: lane('parking', 0, PARKING_PAR_W), description: 'Pas postojowy 2,5 m; stanowiska P-18 dodasz narzędziem oznakowania' },
  { id: 'lt-parking-perp', name: 'Parkowanie prostopadłe (5,0 m)', lane: lane('parkingPerp', 0, PARKING_PERP_W), description: 'Miejsca postojowe prostopadłe 2,5 × 5,0 m' },
  { id: 'lt-parking-angle', name: 'Parkowanie skośne (4,5 m)', lane: lane('parkingAngle', 0, PARKING_ANGLE_W), description: 'Miejsca postojowe skośne (45°)' },
  { id: 'lt-sidewalk', name: 'Chodnik (2,0 m)', lane: lane('sidewalk', 0, SIDEWALK_W), description: 'Chodnik o minimalnej szerokości 2,0 m' },
  { id: 'lt-sidewalk-wide', name: 'Chodnik szeroki (3,0 m)', lane: lane('sidewalk', 0, 3.0), description: 'Szeroki chodnik w centrum miasta' },
  { id: 'lt-path', name: 'Ciąg pieszo-rowerowy (3,0 m)', lane: lane('path', 0, PATH_W), description: 'Wspólna nawierzchnia dla pieszych i rowerzystów' },
  { id: 'lt-green', name: 'Pas zieleni (2,0 m)', lane: lane('green', 0, GREEN_W), description: 'Trawnik / pas zieleni przyulicznej' },
  { id: 'lt-median', name: 'Pas dzielący / wyspa (2,0 m)', lane: lane('median', 0, MEDIAN_W), description: 'Wyniesiony pas dzielący lub wyspa z krawężnikami' },
  { id: 'lt-separator', name: 'Separator (0,3 m)', lane: lane('separator', 0, SEPARATOR_W), description: 'Wąski separator / krawężnik oddzielający pasy' },
  { id: 'lt-buffer', name: 'Powierzchnia wyłączona P-21 (0,5 m)', lane: lane('buffer', 0, BUFFER_W), description: 'Opaska / powierzchnia wyłączona z ruchu — szrafura 0,24 m co 0,39 m, skos 1:3' },
  { id: 'lt-shoulder', name: 'Pobocze (1,0 m)', lane: lane('shoulder', 0, SHOULDER_W), description: 'Pobocze utwardzone (linia krawędziowa P-7 do dodania)' },
];
