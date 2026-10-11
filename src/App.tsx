import { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from './store/project';
import { StartScreen } from './components/StartScreen';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { Library, DRAG_MIME } from './components/Library';
import { Inspector } from './components/Inspector';
import { ExportDialog } from './components/ExportDialog';
import { Board, type BoardHandle } from './canvas/Board';
import { objectFromSymbol } from './lib/factory';
import { symbolById } from './assets/symbols';
import { downloadProjectFile, autosave } from './lib/persist';
import type { SymbolDef } from './model/types';

export default function App() {
  const project = useProject((s) => s.project);
  return project ? <Editor /> : <StartScreen />;
}

function Editor() {
  const project = useProject((s) => s.project)!;
  const dirty = useProject((s) => s.dirty);
  const addObject = useProject((s) => s.addObject);
  const markSaved = useProject((s) => s.markSaved);
  const closeProject = useProject((s) => s.closeProject);
  const setMeta = useProject((s) => s.setProjectMeta);
  const setBackground = useProject((s) => s.setBackground);
  const setTool = useProject((s) => s.setTool);
  const boardRef = useRef<BoardHandle | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'error'>('saved');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const t0 = setTimeout(() => setSaveState('dirty'), 0);
    const t = setTimeout(() => {
      autosave(useProject.getState().project!).then((ok) => { setSaveState(ok ? 'saved' : 'error'); if (ok) markSaved(); });
    }, 1200);
    return () => { clearTimeout(t0); clearTimeout(t); };
  }, [dirty, project, markSaved]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (useProject.getState().dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const viewCenter = useCallback(() => {
    const st = boardRef.current?.stage();
    const v = useProject.getState().viewport;
    if (!st) return { x: project.widthM / 2, y: project.heightM / 2 };
    return { x: (st.width() / 2 - v.x) / v.scale, y: (st.height() / 2 - v.y) / v.scale };
  }, [project.widthM, project.heightM]);

  const addSymbol = (s: SymbolDef, at?: { x: number; y: number }) => {
    const c = at ?? viewCenter();
    addObject(objectFromSymbol(s, c.x, c.y));
    setTool('select');
  };

  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    const st = boardRef.current?.stage();
    if (!st) return;
    const rect = st.container().getBoundingClientRect();
    const v = useProject.getState().viewport;
    const at = { x: (e.clientX - rect.left - v.x) / v.scale, y: (e.clientY - rect.top - v.y) / v.scale };
    const data = JSON.parse(raw) as { kind: 'symbol'; id: string };
    const s = symbolById(data.id);
    if (s) addSymbol(s, at);
  };

  const onCalibrate = (factor: number) => {
    const p = useProject.getState().project!;
    setMeta({ widthM: p.widthM * factor, heightM: p.heightM * factor });
    if (p.background.kind === 'image') setBackground({ ...p.background, widthM: p.background.widthM * factor, heightM: p.background.heightM * factor });
    setMeasured(null);
    setTool('select');
    showToast(`Przeskalowano ×${factor.toFixed(3)}`);
  };

  const onNew = () => {
    if (useProject.getState().dirty && !confirm('Niezapisane zmiany zostaną utracone (autozapis w przeglądarce pozostaje). Kontynuować?')) return;
    closeProject();
  };

  const onReady = useCallback((h: BoardHandle) => { boardRef.current = h; }, []);

  return (
    <div className="editor">
      <TopBar
        onFit={() => boardRef.current?.fit()}
        onZoomTo={(s) => boardRef.current?.zoomTo(s)}
        onZoomSel={() => boardRef.current?.zoomToSelection()}
        onSave={() => { downloadProjectFile(useProject.getState().project!); showToast('Zapisano plik projektu'); }}
        onExport={() => setExportOpen(true)}
        onNew={onNew}
        saveState={saveState}
      />
      <Library onAddSymbol={(s) => addSymbol(s)} />
      <div className="board-wrap" onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
        <Board onReady={onReady} onMeasure={setMeasured} />
        <Toolbar />
        <StatusBar />
      </div>
      <Inspector measured={measured} onCalibrate={onCalibrate} />
      {exportOpen && <ExportDialog stage={boardRef.current?.stage() ?? null} onClose={() => setExportOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function StatusBar() {
  const project = useProject((s) => s.project)!;
  const sel = useProject((s) => s.selection.length);
  const editing = useProject((s) => s.editing);
  return (
    <div className="statusbar">
      {project.widthM.toFixed(0)} × {project.heightM.toFixed(0)} m · {project.objects.length} obiektów{sel ? ` · zaznaczono ${sel}` : ''}{editing ? ' · edycja węzłów' : ''}
    </div>
  );
}
