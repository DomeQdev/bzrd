import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ESRI_TILE_URL, estimateStitch, geocode, stitchSatellite, type StitchResult } from '../lib/geo';

interface Props {
  onCancel: () => void;
  onDone: (r: StitchResult) => void;
}

const MAX_TILES = 900;

export function MapPicker({ onCancel, onDone }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ lat: number; lng: number; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState(19);
  const [view, setView] = useState<{ bounds: L.LatLngBounds; zoom: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || map.current) return;
    const m = L.map(mapRef.current, { zoomControl: true, attributionControl: true, maxZoom: 21, minZoom: 3 });
    m.setView([52.2297, 21.0122], 17);
    L.tileLayer(ESRI_TILE_URL, { maxNativeZoom: 19, maxZoom: 21, attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(m);
    const upd = () => setView({ bounds: m.getBounds(), zoom: m.getZoom() });
    m.on('moveend zoomend', upd);
    upd();
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { try { m.off(); m.remove(); } catch { /* leaflet may throw mid-animation */ } map.current = null; };
  }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try { setResults(await geocode(query)); } catch { setResults([]); }
    setSearching(false);
  };

  const est = view
    ? estimateStitch({ north: view.bounds.getNorth(), south: view.bounds.getSouth(), east: view.bounds.getEast(), west: view.bounds.getWest() }, detail)
    : null;
  const tooBig = est ? est.tiles > MAX_TILES : false;

  const capture = async () => {
    if (!view || !map.current) return;
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      const b = view.bounds;
      const res = await stitchSatellite({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }, detail, (done, total) => setProgress({ done, total }));
      onDone(res);
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal map-modal">
        <div className="map-toolbar">
          <strong>Wybierz obszar z satelity</strong>
          <form className="search" onSubmit={(e) => { e.preventDefault(); doSearch(); }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: ulica, miasto…" />
            <button type="submit" disabled={searching}>{searching ? '…' : 'Szukaj'}</button>
          </form>
          <label className="inline">
            Szczegółowość
            <select value={detail} onChange={(e) => setDetail(Number(e.target.value))}>
              <option value={17}>z17 (~1,0 m/px)</option>
              <option value={18}>z18 (~0,5 m/px)</option>
              <option value={19}>z19 (~0,3 m/px)</option>
              <option value={20}>z20 (~0,15 m/px — nie wszędzie)</option>
            </select>
          </label>
          <div className="spacer" />
          <button onClick={onCancel}>Anuluj</button>
          <button className="primary" onClick={capture} disabled={!view || tooBig || !!progress}>
            {progress ? `Pobieranie ${progress.done}/${progress.total}` : 'Użyj tego widoku'}
          </button>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r, i) => (
              <button key={i} onClick={() => { map.current?.setView([r.lat, r.lng], 17); setResults([]); }}>{r.label}</button>
            ))}
          </div>
        )}
        <div className="map-container" ref={mapRef} />
        <div className="map-status">
          {est && (
            <span>
              Obszar: {est.widthM.toFixed(0)} × {est.heightM.toFixed(0)} m · obraz {est.widthPx} × {est.heightPx} px · {est.tiles} kafelków · skala {est.mpp.toFixed(2)} m/px
              {tooBig && <strong className="warn"> — za duży obszar, przybliż mapę lub zmniejsz szczegółowość</strong>}
            </span>
          )}
          {error && <strong className="warn">{error}</strong>}
          <span className="hint">Przybliż mapę tak, by widok obejmował tylko projektowany fragment. Skala zostanie ustawiona automatycznie.</span>
        </div>
      </div>
    </div>
  );
}
