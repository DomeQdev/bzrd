import { useMemo, useState } from 'react';
import Konva from 'konva';
import { useProject } from '../store/project';
import { downloadDataUrl, exportStageImage, selectionBounds } from '../lib/export';

interface Props {
  stage: Konva.Stage | null;
  onClose: () => void;
}

export function ExportDialog({ stage, onClose }: Props) {
  const project = useProject((s) => s.project)!;
  const selection = useProject((s) => s.selection);
  const viewport = useProject((s) => s.viewport);
  const [scope, setScope] = useState<'board' | 'selection' | 'view'>('board');
  const [ppm, setPpm] = useState(10);
  const [bg, setBg] = useState(true);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const region = useMemo(() => {
    if (scope === 'selection') return selectionBounds(project, selection);
    if (scope === 'view' && stage) {
      const w = stage.width() / viewport.scale, h = stage.height() / viewport.scale;
      return { x: -viewport.x / viewport.scale, y: -viewport.y / viewport.scale, w, h };
    }
    return { x: 0, y: 0, w: project.widthM, h: project.heightM };
  }, [scope, project, selection, stage, viewport]);

  const outW = region ? Math.round(region.w * ppm) : 0;
  const outH = region ? Math.round(region.h * ppm) : 0;
  const tooBig = outW * outH > 60e6;

  const run = async () => {
    if (!stage || !region) return;
    setBusy(true); setErr(null);
    try {
      const url = await exportStageImage(stage, project, { ...region, pxPerMeter: ppm, includeBackground: bg, format });
      downloadDataUrl(url, `${(project.name || 'bzrd').replace(/[^\w\-]+/g, '_')}.${format === 'png' ? 'png' : 'jpg'}`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Eksport obrazu</h3>
        <div className="prop"><span>Zakres</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="board">cała plansza</option>
            <option value="view">bieżący widok</option>
            <option value="selection" disabled={!selection.length}>zaznaczenie</option>
          </select>
        </div>
        <div className="prop"><span>Rozdzielczość</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" value={ppm} min={1} max={200} onChange={(e) => setPpm(Math.max(1, Number(e.target.value)))} /> <span className="hint">px / metr</span>
          </span>
        </div>
        <div className="prop"><span>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="png">PNG</option><option value="jpeg">JPEG</option></select>
        </div>
        <div className="prop"><span>Tło</span><label className="inline"><input type="checkbox" checked={bg} onChange={(e) => setBg(e.target.checked)} /> dołącz tło (satelita / kolor)</label></div>
        <div className="hint">Wynik: {outW} × {outH} px{tooBig && <strong className="warn"> — za duży, zmniejsz rozdzielczość</strong>}</div>
        {err && <div className="warn">{err}</div>}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Anuluj</button>
          <button className="primary" disabled={busy || !region || tooBig} onClick={run}>{busy ? 'Renderowanie…' : 'Pobierz'}</button>
        </div>
      </div>
    </div>
  );
}
