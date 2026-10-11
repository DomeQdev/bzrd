import { useState } from 'react';
import type { BzObject } from '../model/types';
import { useProject } from '../store/project';
import { Eye, EyeOff, Lock, LockOpen, PenLine, Route, Shapes, Type } from 'lucide-react';

function icon(o: BzObject) {
  switch (o.type) {
    case 'strip': return <Route size={13} />;
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
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const rows = [...objects].reverse(); // top first
  const n = objects.length;

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
      {rows.length === 0 && <div className="empty">Brak warstw — narysuj pas lub znak</div>}
      {rows.map((o, ri) => {
        const idx = n - 1 - ri; // index in objects array
        const sel = selection.includes(o.id);
        return (
          <div
            key={o.id}
            title={o.groupId ? 'W grupie' : undefined}
            className={`layer ${o.groupId ? 'grouped' : ''} ${sel ? 'selected' : ''} ${hoverId === o.id ? 'hover' : ''} ${o.visible === false ? 'hidden' : ''} ${overIdx === ri ? 'drop-before' : ''}`}
            onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button,input')) return; onRangeSelect(o.id, e); }}
            onMouseEnter={() => setHover(o.id)}
            onMouseLeave={() => setHover(null)}
            onDoubleClick={() => setRenaming(o.id)}
            draggable={renaming !== o.id}
            onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverIdx(ri); } }}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId) return;
              const ids = selection.includes(dragId) ? selection : [dragId];
              // drop before row ri (visual top-first) => insert at objects index idx+1
              moveToIndex(ids, idx + 1);
              setDragId(null); setOverIdx(null);
            }}
            onDragEnd={() => { setDragId(null); setOverIdx(null); }}
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
  );
}
