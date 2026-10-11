import { useRef, useState } from 'react';
import type { Project } from '../model/types';
import { blankProject, useProject } from '../store/project';
import { autosaveMeta, loadAutosave, readImageFile, readProjectFile } from '../lib/persist';
import { MapPicker } from './MapPicker';
import type { StitchResult } from '../lib/geo';

export function StartScreen() {
  const newProject = useProject((s) => s.newProject);
  const loadProject = useProject((s) => s.loadProject);
  const [name, setName] = useState('Nowy projekt');
  const [w, setW] = useState(200);
  const [h, setH] = useState(150);
  const [map, setMap] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const meta = autosaveMeta();

  const fromSatellite = (r: StitchResult) => {
    const p: Project = {
      ...blankProject(name, r.widthM, r.heightM),
      background: { kind: 'image', dataUrl: r.dataUrl, widthM: r.widthM, heightM: r.heightM, geo: { lat: r.center.lat, lng: r.center.lng, zoom: r.zoom } },
    };
    setMap(false);
    newProject(p);
  };

  const openFile = async (f: File | undefined) => {
    if (!f) return;
    try { loadProject(await readProjectFile(f)); } catch (e) { setErr((e as Error).message); }
  };
  const openImage = async (f: File | undefined) => {
    if (!f) return;
    try {
      const img = await readImageFile(f);
      const mpp = 0.25; // assumed; user calibrates with the measure tool
      const p: Project = {
        ...blankProject(name, img.width * mpp, img.height * mpp),
        background: { kind: 'image', dataUrl: img.dataUrl, widthM: img.width * mpp, heightM: img.height * mpp },
      };
      newProject(p);
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="start">
      <div className="start-card">
        <div className="brand"><span className="logo">BZRD</span><span className="tag">projektowanie ulic w przeglądarce</span></div>
        <label>
          Nazwa projektu
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="start-grid">
          <section>
            <h3>Satelita</h3>
            <p>Wybierz fragment miasta z ortofotomapy ESRI. Skala ustawia się automatycznie.</p>
            <button className="primary" onClick={() => setMap(true)}>Wybierz obszar na mapie</button>
          </section>
          <section>
            <h3>Pusta plansza</h3>
            <p>Plansza w metrach, bez tła.</p>
            <div className="row">
              <label>szer. (m)<input type="number" value={w} min={10} max={5000} onChange={(e) => setW(Number(e.target.value))} /></label>
              <label>wys. (m)<input type="number" value={h} min={10} max={5000} onChange={(e) => setH(Number(e.target.value))} /></label>
            </div>
            <button onClick={() => newProject(blankProject(name, w, h))}>Utwórz pustą planszę</button>
          </section>
          <section>
            <h3>Własny obraz</h3>
            <p>Zrzut z mapy lub skan. Skalę ustawisz narzędziem pomiaru (M).</p>
            <button onClick={() => imgRef.current?.click()}>Wczytaj obraz…</button>
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => openImage(e.target.files?.[0])} />
          </section>
          <section>
            <h3>Otwórz projekt</h3>
            <p>Plik roboczy <code>.bzrd.json</code> zapisany wcześniej.</p>
            <button onClick={() => fileRef.current?.click()}>Otwórz plik…</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
            {meta && (
              <button className="ghost" onClick={async () => { const p = await loadAutosave(); if (p) loadProject(p); else setErr('Brak zapisu w przeglądarce'); }}>
                Przywróć „{meta.name}” ({new Date(meta.updatedAt).toLocaleString('pl-PL')}, {meta.objects} obiektów)
              </button>
            )}
          </section>
        </div>
        {err && <div className="warn">{err}</div>}
      </div>
      {map && <MapPicker onCancel={() => setMap(false)} onDone={fromSatellite} />}
    </div>
  );
}
