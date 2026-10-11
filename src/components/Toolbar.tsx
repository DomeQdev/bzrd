import { useProject, type Tool } from '../store/project';
import { Circle, Hand, Hexagon, Link2, Minus, MousePointer2, PenTool, Redo2, Ruler, Square, Type, Undo2, X } from 'lucide-react';

const TOOLS: Array<{ id: Tool; label: string; key: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'Zaznaczanie', key: 'V', icon: <MousePointer2 size={17} /> },
  { id: 'hand', label: 'Rączka', key: 'H', icon: <Hand size={17} /> },
  { id: 'pen', label: 'Pióro', key: 'P', icon: <PenTool size={17} /> },
  { id: 'polygon', label: 'Wielokąt (klikaj wierzchołki, Enter zamyka)', key: 'W', icon: <Hexagon size={17} /> },
  { id: 'line', label: 'Linia', key: 'L', icon: <Minus size={17} /> },
  { id: 'rect', label: 'Prostokąt', key: 'R', icon: <Square size={17} /> },
  { id: 'ellipse', label: 'Elipsa', key: 'O', icon: <Circle size={17} /> },
  { id: 'join', label: 'Łącz pasy — kliknij koniec jednego pasa, potem koniec drugiego', key: 'J', icon: <Link2 size={17} /> },
  { id: 'text', label: 'Tekst', key: 'T', icon: <Type size={17} /> },
  { id: 'measure', label: 'Pomiar / kalibracja', key: 'M', icon: <Ruler size={17} /> },
];

export function Toolbar() {
  const tool = useProject((s) => s.tool);
  const setTool = useProject((s) => s.setTool);
  const pending = useProject((s) => s.pending);
  const setPending = useProject((s) => s.setPending);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const drawing = tool === 'pen' || tool === 'polygon' || tool === 'line' || tool === 'rect' || tool === 'ellipse';
  return (
    <div className="toolbar-wrap">
      {drawing && (
        <div className="chip" title="Wybrany element z biblioteki (kliknij inny w panelu po lewej)">
          {pending ? pending.name : tool === 'rect' || tool === 'ellipse' || tool === 'polygon' ? 'Nawierzchnia asfaltowa' : 'P-2 linia ciągła'}
          {pending && <button className="chip-x" onClick={() => setPending(null)} title="Wróć do domyślnego"><X size={12} /></button>}
        </div>
      )}
      <div className="toolbar">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tb ${tool === t.id ? 'active' : ''}`} title={`${t.label} (${t.key})`} onClick={() => setTool(t.id)}>{t.icon}</button>
        ))}
        <span className="tb-sep" />
        <button className="tb" title="Cofnij (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={17} /></button>
        <button className="tb" title="Ponów (Ctrl+Y)" disabled={!canRedo} onClick={redo}><Redo2 size={17} /></button>
      </div>
    </div>
  );
}
