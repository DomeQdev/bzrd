import { useRef, useState } from 'react';
import { useProject } from '../store/project';
import { ChevronDown, Download, FilePlus2, FolderOpen, Grid3X3, Magnet, Save } from 'lucide-react';
import { readProjectFile } from '../lib/persist';

interface Props {
  onFit: () => void;
  onZoomTo: (scale: number) => void;
  onZoomSel: () => void;
  onSave: () => void;
  onExport: () => void;
  onNew: () => void;
  saveState: 'saved' | 'dirty' | 'error';
}

export function TopBar({ onFit, onZoomTo, onZoomSel, onSave, onExport, onNew, saveState }: Props) {
  const viewport = useProject((s) => s.viewport);
  const showGrid = useProject((s) => s.showGrid);
  const toggleGrid = useProject((s) => s.toggleGrid);
  const snap = useProject((s) => s.snap);
  const toggleSnap = useProject((s) => s.toggleSnap);
  const wheelMode = useProject((s) => s.wheelMode);
  const setWheelMode = useProject((s) => s.setWheelMode);
  const loadProject = useProject((s) => s.loadProject);
  const name = useProject((s) => s.project?.name ?? '');
  const setMeta = useProject((s) => s.setProjectMeta);
  const fileRef = useRef<HTMLInputElement>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const pct = Math.round((viewport.scale / 10) * 100);

  return (
    <div className="topbar">
      <span className="logo">BZRD</span>
      <input className="name" value={name} onChange={(e) => setMeta({ name: e.target.value })} title="Nazwa projektu" />
      <span className={`save-state ${saveState}`}>{saveState === 'saved' ? 'Zapisano' : saveState === 'dirty' ? 'Zapisywanie…' : 'Autozapis nieudany — zapisz plik'}</span>
      <div className="spacer" />
      <button className="tb-text" onClick={onNew} title="Nowy projekt"><FilePlus2 size={14} /> Nowy</button>
      <button className="tb-text" onClick={() => fileRef.current?.click()} title="Otwórz plik .bzrd.json"><FolderOpen size={14} /> Otwórz</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { loadProject(await readProjectFile(f)); } catch (err) { alert((err as Error).message); } } e.target.value = ''; }} />
      <button className="tb-text" onClick={onSave} title="Zapisz plik roboczy"><Save size={14} /> Zapisz</button>
      <span className="v-sep" />
      <button className={`tb-text ${snap ? 'on' : ''}`} onClick={toggleSnap} title="Przyciąganie do obiektów"><Magnet size={14} /></button>
      <button className={`tb-text ${showGrid ? 'on' : ''}`} onClick={toggleGrid} title="Siatka (G)"><Grid3X3 size={14} /></button>
      <select className="tb-select" value={wheelMode} title="Kółko myszy / touchpad" onChange={(e) => setWheelMode(e.target.value as typeof wheelMode)}>
        <option value="auto">Kółko: auto</option>
        <option value="zoom">Kółko: zoom</option>
        <option value="pan">Kółko: przewijanie</option>
      </select>
      <div className="zoom-menu">
        <button className="tb-text" onClick={() => setZoomOpen(!zoomOpen)}>{pct}% <ChevronDown size={12} /></button>
        {zoomOpen && (
          <div className="menu" onMouseLeave={() => setZoomOpen(false)}>
            <button onClick={() => { onZoomTo(viewport.scale * 1.25); setZoomOpen(false); }}>Przybliż <kbd>Ctrl +</kbd></button>
            <button onClick={() => { onZoomTo(viewport.scale * 0.8); setZoomOpen(false); }}>Oddal <kbd>Ctrl −</kbd></button>
            <button onClick={() => { onFit(); setZoomOpen(false); }}>Dopasuj planszę <kbd>Shift 1</kbd></button>
            <button onClick={() => { onZoomSel(); setZoomOpen(false); }}>Do zaznaczenia <kbd>Shift 2</kbd></button>
            <button onClick={() => { onZoomTo(10); setZoomOpen(false); }}>100% (10 px/m) <kbd>Shift 0</kbd></button>
            <button onClick={() => { onZoomTo(50); setZoomOpen(false); }}>500%</button>
          </div>
        )}
      </div>
      <button className="primary" onClick={onExport} title="Eksport PNG / JPEG"><Download size={14} /> Eksport</button>
    </div>
  );
}
