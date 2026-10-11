/** Web Mercator helpers + ESRI World Imagery tile stitching. */

export const ESRI_TILE_URL =
  'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false';

export const EARTH_CIRCUMFERENCE = 40075016.686;

/** ground resolution (meters per tile pixel) at given zoom & latitude, 256px tiles */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
}

export function lngToWorldX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
}
export function latToWorldY(lat: number, zoom: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return y * 256 * Math.pow(2, zoom);
}
export function worldXToLng(x: number, zoom: number): number {
  return (x / (256 * Math.pow(2, zoom))) * 360 - 180;
}
export function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (256 * Math.pow(2, zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface StitchResult {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  widthM: number;
  heightM: number;
  center: { lat: number; lng: number };
  zoom: number;
  failedTiles: number;
}

export function estimateStitch(bounds: LatLngBounds, zoom: number) {
  const x0 = lngToWorldX(bounds.west, zoom);
  const x1 = lngToWorldX(bounds.east, zoom);
  const y0 = latToWorldY(bounds.north, zoom);
  const y1 = latToWorldY(bounds.south, zoom);
  const widthPx = Math.round(x1 - x0);
  const heightPx = Math.round(y1 - y0);
  const tx0 = Math.floor(x0 / 256), tx1 = Math.floor(x1 / 256);
  const ty0 = Math.floor(y0 / 256), ty1 = Math.floor(y1 / 256);
  const tiles = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
  const lat = (bounds.north + bounds.south) / 2;
  const mpp = metersPerPixel(lat, zoom);
  return { widthPx, heightPx, tiles, widthM: widthPx * mpp, heightM: heightPx * mpp, mpp };
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Fetch all ESRI tiles covering `bounds` at `zoom`, stitch them into a canvas,
 * crop to the exact bounds and return a JPEG data URL + real-world size.
 */
export async function stitchSatellite(
  bounds: LatLngBounds,
  zoom: number,
  onProgress?: (done: number, total: number) => void,
): Promise<StitchResult> {
  const x0 = lngToWorldX(bounds.west, zoom);
  const x1 = lngToWorldX(bounds.east, zoom);
  const y0 = latToWorldY(bounds.north, zoom);
  const y1 = latToWorldY(bounds.south, zoom);
  const widthPx = Math.round(x1 - x0);
  const heightPx = Math.round(y1 - y0);
  const tx0 = Math.floor(x0 / 256), tx1 = Math.floor(x1 / 256);
  const ty0 = Math.floor(y0 / 256), ty1 = Math.floor(y1 / 256);
  const total = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1f24';
  ctx.fillRect(0, 0, widthPx, heightPx);

  let done = 0;
  let failed = 0;
  const jobs: Promise<void>[] = [];
  const limit = 8;
  const queue: Array<[number, number]> = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) queue.push([tx, ty]);

  const worker = async () => {
    while (queue.length) {
      const [tx, ty] = queue.shift()!;
      const url = ESRI_TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(tx)).replace('{y}', String(ty));
      const img = await loadTile(url);
      if (img) ctx.drawImage(img, Math.round(tx * 256 - x0), Math.round(ty * 256 - y0));
      else failed++;
      done++;
      onProgress?.(done, total);
    }
  };
  for (let i = 0; i < limit; i++) jobs.push(worker());
  await Promise.all(jobs);

  const lat = (bounds.north + bounds.south) / 2;
  const mpp = metersPerPixel(lat, zoom);
  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  } catch (e) {
    throw new Error('Canvas is tainted (CORS). Tiles could not be exported. ' + (e as Error).message);
  }
  return {
    dataUrl,
    widthPx,
    heightPx,
    widthM: widthPx * mpp,
    heightM: heightPx * mpp,
    center: { lat, lng: (bounds.east + bounds.west) / 2 },
    zoom,
    failedTiles: failed,
  };
}

/** Nominatim geocoding (free, low volume). */
export async function geocode(query: string): Promise<Array<{ lat: number; lng: number; label: string }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return json.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name }));
}
