/**
 * All geometry in BZRD is stored in METERS (world space).
 * Default widths follow Polish practice (Rozporządzenie ws. warunków technicznych
 * dróg publicznych / wytyczne WR-D) — metric only, feet available for display.
 */
export type Units = 'm' | 'ft';

export const FT = 0.3048;

// pasy ruchu
export const DRIVE_W = 3.5;        // pas ruchu (droga G/Z); w mieście często 3.0
export const DRIVE_CITY_W = 3.0;   // pas ruchu w terenie zabudowanym (L/D)
export const TURN_W = 3.0;         // pas do skrętu
export const BUS_W = 3.5;          // buspas
export const TRAM_W = 3.0;         // jeden tor tramwajowy (torowisko wydzielone)
// rower
export const BIKE_LANE_W = 1.5;    // pas ruchu dla rowerów (na jezdni)
export const BIKE_PATH_W = 2.0;    // droga dla rowerów jednokierunkowa
export const BIKE_PATH_2WAY_W = 2.5; // droga dla rowerów dwukierunkowa
// postój
export const PARKING_PAR_W = 2.5;  // parkowanie równoległe (2.5 × 6.0)
export const PARKING_PERP_W = 5.0; // parkowanie prostopadłe (2.5 × 5.0)
export const PARKING_ANGLE_W = 4.5;// parkowanie skośne 45°
// piesi i zieleń
export const SIDEWALK_W = 2.0;     // chodnik (min 2.0 m)
export const PATH_W = 3.0;         // ciąg pieszo-rowerowy
export const GREEN_W = 2.0;        // pas zieleni
export const MEDIAN_W = 2.0;       // pas dzielący / wyspa
export const BUFFER_W = 0.5;       // powierzchnia wyłączona z ruchu P-21 (opaska)
export const SEPARATOR_W = 0.3;    // separator / krawężnik
export const SHOULDER_W = 1.0;     // pobocze utwardzone

export const DEFAULT_ROAD_LENGTH = 60; // meters
export const DEFAULT_PX_PER_METER = 10;

export function formatLength(m: number, units: Units): string {
  if (units === 'ft') return `${(m / FT).toFixed(1)} ft`;
  return `${m.toFixed(2)} m`;
}
export function toMeters(v: number, units: Units) { return units === 'ft' ? v * FT : v; }
export function fromMeters(m: number, units: Units) { return units === 'ft' ? m / FT : m; }
