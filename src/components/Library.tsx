import { useEffect, useMemo, useRef, useState } from 'react';
import type { Preset, StripObj, SymbolDef } from '../model/types';
import { CATEGORIES, PRESETS } from '../catalog';
import { SYMBOLS, SYMBOL_CATEGORIES } from '../assets/symbols';
import { objectFromTemplate } from '../lib/factory';
import { drawObject, objectBounds, type Drawable } from '../canvas/draw';
import { uid } from '../store/project';
import { svgDataUrl } from '../canvas/symbolImage';
import { useProject } from '../store/project';
import { Layers } from './Layers';

export const DRAG_MIME = 'application/x-bzrd';

interface Props {
  onAddSymbol: (s: SymbolDef) => void;
}

/** Thumbnail: the template drawn along a gentle S-curve so lanes and lines are readable. */
function PresetThumb({ preset }: { preset: Preset }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 64, H = 40;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const t = preset.template;
    ctx.fillStyle = t.kind === 'strip' || (t.kind === 'line' && ['grass', 'pavement'].includes(t.variant)) ? '#d9dad6' : '#3a3d42';
    ctx.fillRect(0, 0, W, H);
    try {
      let obj: Drawable;
      if (t.kind === 'laneMarking') {
        // a straight 3 m lane with that marking, flowing to the right
        obj = { id: uid('s'), type: 'strip', x: 0, y: 0, rotation: 0, path: { closed: false, nodes: [{ x: 0, y: 0 }, { x: 24, y: 0 }] }, spec: { lanes: [{ kind: 'drive', width: 3.5, dir: 1, marking: t.marking, markCount: 1 }] } } as StripObj;
      } else {
        const closed = t.kind === 'line' && t.closedOnly;
        const path = closed
          ? { closed: true, nodes: [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 14 }, { x: 0, y: 14 }] }
          : { closed: false, nodes: [{ x: 0, y: 0, hOut: { x: 12, y: 0 } }, { x: 30, y: 6, hIn: { x: 18, y: 6 } }] };
        obj = objectFromTemplate(preset, path) as Drawable;
      }
      const b = objectBounds(obj);
      const pad = t.kind === 'laneMarking' ? 2 : 8;
      const s = Math.min((W - pad) / Math.max(b.w, 1), (H - pad) / Math.max(b.h, 1));
      ctx.translate(W / 2, H / 2);
      ctx.scale(s, s);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      if (t.kind === 'laneMarking') {
        // zoom on the glyph itself
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(2.2, 2.2); ctx.translate(-(b.x + b.w * 0.78), -(b.y + b.h / 2));
      }
      drawObject(ctx, obj);
    } catch { /* ignore */ }
  }, [preset]);
  return <canvas ref={ref} style={{ width: 64, height: 40 }} />;
}

function SymbolThumb({ def }: { def: SymbolDef }) {
  const src = useMemo(() => svgDataUrl(def, def.defaultColor), [def]);
  return <div className="thumb sym"><img src={src} alt="" loading="lazy" /></div>;
}

export function Library({ onAddSymbol }: Props) {
  const pending = useProject((s) => s.pending);
  const setPending = useProject((s) => s.setPending);
  const setTool = useProject((s) => s.setTool);
  const tool = useProject((s) => s.tool);
  const [panel, setPanel] = useState<'lib' | 'layers'>('lib');
  const tabs = useMemo(() => [...CATEGORIES, 'Symbole'], []);
  const [tab, setTab] = useState(tabs[0]);
  const [symCat, setSymCat] = useState(SYMBOL_CATEGORIES[0]?.id ?? 'vehicles');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const presets = useMemo(() => {
    if (query) return PRESETS.filter((p) => (p.name + ' ' + p.category + ' ' + (p.tags ?? []).join(' ') + ' ' + (p.description ?? '')).toLowerCase().includes(query));
    if (tab === 'Symbole') return [];
    return PRESETS.filter((p) => p.category === tab);
  }, [tab, query]);
  const symbols = useMemo(() => {
    if (query) return SYMBOLS.filter((s) => (s.name + ' ' + s.id + ' ' + (s.tags ?? []).join(' ')).toLowerCase().includes(query));
    if (tab !== 'Symbole') return [];
    return SYMBOLS.filter((s) => s.category === symCat);
  }, [tab, symCat, query]);
  const groups = useMemo(() => {
    const m = new Map<string, Preset[]>();
    for (const p of presets) { const g = query ? p.category : p.group ?? ''; if (!m.has(g)) m.set(g, []); m.get(g)!.push(p); }
    return [...m.entries()];
  }, [presets, query]);

  const pick = (p: Preset) => {
    setPending(p);
    const t = p.template;
    if (t.kind === 'laneMarking') { setTool('mark'); return; }
    if (t.kind === 'line' && t.closedOnly) { if (tool !== 'polygon' && tool !== 'rect' && tool !== 'ellipse') setTool('polygon'); return; }
    if (t.kind === 'line' && p.category === 'Oznakowanie') { if (tool !== 'pen' && tool !== 'line' && tool !== 'mark') setTool('mark'); return; }
    const drawingTool = tool === 'pen' || tool === 'polygon' || tool === 'line' || tool === 'rect' || tool === 'ellipse';
    if (!drawingTool) setTool('pen');
  };

  return (
    <div className="sidebar">
      <div className="panel-tabs">
        <button className={panel === 'lib' ? 'active' : ''} onClick={() => setPanel('lib')}>Biblioteka</button>
        <button className={panel === 'layers' ? 'active' : ''} onClick={() => setPanel('layers')}>Warstwy</button>
      </div>
      {panel === 'layers' ? (
        <Layers />
      ) : (
        <>
          <div className="lib-tabs">
            {tabs.map((t) => <button key={t} className={tab === t && !query ? 'active' : ''} onClick={() => { setTab(t); setQ(''); }}>{t}</button>)}
          </div>
          <div className="lib-search">
            <input placeholder="Szukaj…  (np. rower, P-10, buspas)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {tab === 'Symbole' && !query && (
            <div className="lib-subtabs">
              {SYMBOL_CATEGORIES.map((c) => <button key={c.id} className={symCat === c.id ? 'active' : ''} onClick={() => setSymCat(c.id)}>{c.label}</button>)}
            </div>
          )}
          <div className="lib-list">
            {tab === 'Nawierzchnia' && !query && <div className="lib-hint">Krok 1: nawierzchnia. Kliknij element i narysuj go piórem (P), wielokątem (W), linią (L), prostokątem (R) lub elipsą (O). Pasy łącz łącznikiem (J).</div>}
            {tab === 'Oznakowanie' && !query && <div className="lib-hint">Krok 2: oznakowanie, zawsze na wierzchu. Linie i przejścia: narzędzie Oznakowanie (K) — kropka → kropka po krawędziach pasów. Znaki „na pasie”: kliknij pas.</div>}
            {groups.map(([g, items]) => (
              <div key={g}>
                {g && <div className="lib-group">{g}</div>}
                {items.map((p) => (
                  <button key={p.id} className={`lib-item ${pending?.id === p.id ? 'active' : ''}`} title={p.description ?? p.name} onClick={() => pick(p)}>
                    <div className="thumb"><PresetThumb preset={p} /></div>
                    <div className="label"><span>{p.name}</span>{p.description && <small>{p.description}</small>}</div>
                  </button>
                ))}
              </div>
            ))}
            {symbols.length > 0 && (
              <div className="lib-grid">
                {symbols.map((s) => (
                  <button key={s.id} className="lib-item" title={`${s.name} (${s.width} × ${s.height} m) — kliknij lub przeciągnij na planszę`} draggable
                    onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: 'symbol', id: s.id })); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => onAddSymbol(s)}>
                    <SymbolThumb def={s} />
                    <div className="label"><span>{s.name}</span></div>
                  </button>
                ))}
              </div>
            )}
            {groups.length === 0 && symbols.length === 0 && <div className="empty">Brak wyników</div>}
          </div>
        </>
      )}
    </div>
  );
}
