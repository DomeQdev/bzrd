import { useState } from 'react';
import type { BzObject } from '../model/types';
import { useProject } from '../store/project';
import { Eye, EyeOff, Lock, LockOpen, PenLine, Route, Shapes, TrainTrack, Type } from 'lucide-react';
import { RANK_LABEL, objectRank, type Rank } from '../canvas/draw';

function icon(o: BzObject) {
  switch (o.type) {
    case 'strip': return objectRank(o) === 3 ? <TrainTrack size={13} /> : <Route size={13} />;
    case 'line': return <PenLine size={13} />;
    case 'symbol': return <Shapes size={13} />;
    case 'text': return <Type size={13} />;
  }
}
function label(o: BzObject) {
  if (o.name) return o.name;
  switch (o.type) {
    case 'strip': return 'Pas';
    case 'line': return 'Linia';
    case 'symbol': return 'Symbol';
    case 'text': return o.text;
  }
}

/**
 * Layers grouped by category (top category first). Dragging reorders within the global creation order,
 * which only matters between objects of the same category — the categories themselves are fixed.
 */
export function Layers() {
  const objects = useProject((s) => s.project?.objects ?? []);
  const selection = useProject((s) => s.selection);
  const hoverId = useProject((s) => s.hoverId);
  const select = useProject((s) => s.select);
  const toggleSelect = useProject((s) => s.toggleSelect);
  const setHover = useProject((s) => s.setHover);
  const upd = useProject((s) => s.updateObject);
  const moveToIndex = useProject((s) => s.moveToIndex);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const groups = ([6, 5, 4, 3, 2, 1, 0] as Rank[])
    .map((r) => ({ r, rows: objects.map((o, idx) => ({ o, idx })).filter((x) => objectRank(x.o) === r).reverse() }))
    .filter((g) => g.rows.length > 0 && g.r !== 5);

  const onRangeSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && selection.length) {
      const a = objects.findIndex((o) => o.id === selection[selection.length - 1]);
      const b = objects.findIndex((o) => o.id === id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      select(Array.from(new Set([...selection, ...objects.slice(lo, hi + 1).map((o) => o.id)])));
    } else if (e.ctrlKey || e.metaKey) toggleSelect(id);
    else select([id]);
  };

  return (
    <div className="layers">
      {objects.length === 0 && <div className="empty">Brak warstw — narysuj pas lub nawierzchnię</div>}
      {groups.map((g) => (
        <div key={g.r}>
          <div className="layer-group">{RANK_LABEL[g.r]}</div>
          {g.rows.map(({ o, idx }) => {
            const sel = selection.includes(o.id);
            return (
              <div
                key={o.id}
                title={o.groupId ? 'W grupie' : undefined}
                className={`layer ${o.groupId ? 'grouped' : ''} ${sel ? 'selected' : ''} ${hoverId === o.id ? 'hover' : ''} ${o.visible === false ? 'hidden' : ''} ${overId === o.id ? 'drop-before' : ''}`}
                onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button,input')) return; onRangeSelect(o.id, e); }}
                onMouseEnter={() => setHover(o.id)}
                onMouseLeave={() => setHover(null)}
                onDoubleClick={() => setRenaming(o.id)}
                draggable={renaming !== o.id}
                onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(o.id); } }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId) return;
                  const ids = selection.includes(dragId) ? selection : [dragId];
                  // drop before this row (visual top-first) => insert right above it in the objects array
                  moveToIndex(ids, idx + 1);
                  setDragId(null); setOverId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
              >
                <span className="ic">{icon(o)}</span>
                {renaming === o.id ? (
                  <input autoFocus defaultValue={o.name ?? ''} onBlur={(e) => { upd(o.id, { name: e.target.value || undefined }); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
                ) : (
                  <span className="nm">{label(o)}</span>
                )}
                <button className="ghost-ic" title={o.locked ? 'Odblokuj' : 'Zablokuj'} onClick={() => upd(o.id, { locked: !o.locked })}>{o.locked ? <Lock size={12} /> : <LockOpen size={12} className="dim" />}</button>
                <button className="ghost-ic" title={o.visible === false ? 'Pokaż' : 'Ukryj'} onClick={() => upd(o.id, { visible: o.visible === false ? true : false })}>{o.visible === false ? <EyeOff size={12} /> : <Eye size={12} className="dim" />}</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
