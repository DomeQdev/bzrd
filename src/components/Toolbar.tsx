import { useProject, type Tool } from '../store/project';
import { Circle, Hand, Hexagon, Link2, Minus, MousePointer2, PenTool, Redo2, Ruler, Square, Type, Undo2, Waypoints, X } from 'lucide-react';

const TOOLS: Array<{ id: Tool; label: string; key: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'Zaznaczanie', key: 'V', icon: <MousePointer2 size={17} /> },
  { id: 'hand', label: 'Rączka', key: 'H', icon: <Hand size={17} /> },
  { id: 'pen', label: 'Pióro — pasy i linie', key: 'P', icon: <PenTool size={17} /> },
  { id: 'polygon', label: 'Wielokąt — nawierzchnie (klikaj wierzchołki, Enter zamyka)', key: 'W', icon: <Hexagon size={17} /> },
  { id: 'line', label: 'Linia (przeciągnij)', key: 'L', icon: <Minus size={17} /> },
  { id: 'rect', label: 'Prostokąt', key: 'R', icon: <Square size={17} /> },
  { id: 'ellipse', label: 'Elipsa', key: 'O', icon: <Circle size={17} /> },
  { id: 'link', label: 'Łącznik — koniec pasa → koniec pasa = osobny segment łączący', key: 'J', icon: <Link2 size={17} /> },
  { id: 'mark', label: 'Oznakowanie — kropka → kropka po krawędziach pasów; kliknij pas, by nałożyć strzałki', key: 'K', icon: <Waypoints size={17} /> },
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
  const drawing = tool === 'pen' || tool === 'polygon' || tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'mark';
  const fallback = tool === 'mark' ? 'P-1b linia przerywana' : tool === 'rect' || tool === 'ellipse' || tool === 'polygon' ? 'Nawierzchnia asfaltowa' : 'P-2a linia ciągła';
  const shown = pending && (tool !== 'mark' || pending.category === 'Oznakowanie') && (tool === 'mark' || pending.template.kind !== 'laneMarking') ? pending.name : fallback;
  return (
    <div className="toolbar-wrap">
      {drawing && (
        <div className="chip" title="Wybrany element z biblioteki (kliknij inny w panelu po lewej)">
          {shown}
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
