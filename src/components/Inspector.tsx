import { useMemo, useState } from 'react';
import type { BzObject, Lane, LaneKind, LaneMarking, LineCode, LineObj, LineSpec, RoadSpec, StripObj, SymbolObj, TextObj } from '../model/types';
import { useProject } from '../store/project';
import { LANE_TEMPLATES } from '../catalog';
import { LANE_MARKINGS, LANE_MARKING_LABEL, LINE_CODES, WHITE, YELLOW, codeOfSpec, lineSpec } from '../catalog/helpers';
import { LANE_KIND_LABEL, LINE_STYLE_LABEL, laneFill, mergeLanes, specWidth } from '../canvas/roadGeometry';
import { symbolById } from '../assets/symbols';
import { cutAtNode, offsetPath, reversePath, smoothNode, cornerNode, setPathLength, rotatePath, polygonBounds } from '../canvas/path';
import { normalizeOrigin } from '../lib/factory';
import { uid } from '../store/project';
import { NumberInput } from './NumberInput';
import { mergeChain, type PathObj } from '../lib/merge';
import { Copy, FlipHorizontal2, Lock, LockOpen, Trash2 } from 'lucide-react';
import { formatLength } from '../model/units';
import { flatten } from '../canvas/path';
import { RANK_LABEL, defaultMarkGap, objectRank } from '../canvas/draw';

const LINE_STYLES = Object.keys(LINE_STYLE_LABEL) as LineSpec['style'][];
const LANE_KINDS = Object.keys(LANE_KIND_LABEL) as LaneKind[];
const REPEATED: LaneMarking[] = ['p8a', 'p8b', 'p8c', 'p8d', 'p8e', 'p8f', 'p8g', 'p8h', 'p8i', 'p9a', 'p9b', 'p22', 'p23'];

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-h"><span>{title}</span>{right}</div>
      {children}
    </div>
  );
}

/** Picker for a painted line: Polish code or none; "własna" keeps the current spec editable. */
function LineCodeSelect({ value, onPick, allowNone = true }: { value: LineSpec | undefined; onPick: (d: LineSpec | undefined) => void; allowNone?: boolean }) {
  const code = value ? codeOfSpec(value) : 'none';
  return (
    <select value={code} onChange={(e) => {
      const v = e.target.value as LineCode | 'none';
      if (v === 'none') onPick(undefined);
      else if (v === 'custom') onPick(value ?? lineSpec('p2a'));
      else onPick(lineSpec(v, value?.color ?? WHITE));
    }}>
      {allowNone && <option value="none">brak</option>}
      {LINE_CODES.map((c) => <option key={c.code} value={c.code} title={c.description}>{c.name}</option>)}
    </select>
  );
}

/** Editable fields of a line spec (shown when the line is "własna" or to tweak colour). */
function LineSpecFields({ value, onChange }: { value: LineSpec; onChange: (d: LineSpec) => void }) {
  const dashed = ['dashed', 'doubleDashedLeft', 'doubleDashedRight', 'doubleDashed', 'blocks'].includes(value.style);
  return (
    <>
      <div className="prop"><span>Styl</span>
        <select value={value.style} onChange={(e) => onChange({ ...value, style: e.target.value as LineSpec['style'] })}>
          {LINE_STYLES.filter((s) => s !== 'none').map((s) => <option key={s} value={s}>{LINE_STYLE_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="prop"><span>Grubość</span><NumberInput value={value.width} step={0.02} min={0.02} suffix="m" onChange={(w) => onChange({ ...value, width: w })} /></div>
      {dashed && (
        <div className="prop"><span>Kreska / przerwa</span><span className="pair">
          <NumberInput value={value.dash?.[0] ?? 2} step={0.5} min={0.1} suffix="m" onChange={(a) => onChange({ ...value, dash: [a, value.dash?.[1] ?? 4] })} />
          <NumberInput value={value.dash?.[1] ?? 4} step={0.5} min={0.1} suffix="m" onChange={(b) => onChange({ ...value, dash: [value.dash?.[0] ?? 2, b] })} />
        </span></div>
      )}
      <div className="prop"><span>Kolor</span><span className="row-inline">
        <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        <button className="mini" onClick={() => onChange({ ...value, color: WHITE })}>biały</button>
        <button className="mini" onClick={() => onChange({ ...value, color: YELLOW })} title="Oznakowanie tymczasowe (roboty drogowe)">żółty</button>
      </span></div>
    </>
  );
}

// ───────────────────────── path ops (strip & line) ─────────────────────────

function PathOps({ obj }: { obj: StripObj | LineObj }) {
  const upd = useProject((s) => s.updateObject);
  const replaceWith = useProject((s) => s.replaceWith);
  const editing = useProject((s) => s.editing);
  const setEditing = useProject((s) => s.setEditing);
  const len = useMemo(() => flatten(obj.path, 0.5).length, [obj.path]);
  const units = useProject((s) => s.project?.units ?? 'm');
  const nodeSel = editing?.id === obj.id ? editing.nodes : [];

  const setPath = (path: StripObj['path']) => { const n = normalizeOrigin({ ...obj, path }); upd(obj.id, { x: n.x, y: n.y, path: n.path } as Partial<BzObject>); };

  const cut = () => {
    if (nodeSel.length !== 1) return;
    const parts = cutAtNode(obj.path, nodeSel[0]);
    if (parts.length === 1 && !obj.path.closed) return;
    replaceWith(obj.id, parts.map((p, i) => normalizeOrigin({ ...obj, id: uid(obj.type === 'strip' ? 's' : 'l'), name: obj.name ? `${obj.name} ${i + 1}` : undefined, path: p })));
  };

  return (
    <Section title="Ścieżka" right={obj.path.closed ? <span className="hint">{formatLength(len, units)}</span> : undefined}>
      {!obj.path.closed && (
        <div className="prop"><span>Długość</span>
          <NumberInput value={len} step={1} min={0.5} suffix="m" onChange={(v) => setPath(setPathLength(obj.path, v))} title="Skraca lub wydłuża ścieżkę od końca (uchwyty na końcach robią to samo na planszy)" />
        </div>
      )}
      <div className="prop"><span>Obróć</span>
        <span className="row-inline">
          {[-90, -15, 15, 90].map((a) => (
            <button key={a} className="mini" onClick={() => {
              const b = polygonBounds(obj.path.nodes.map((n) => ({ x: n.x, y: n.y })));
              setPath(rotatePath(obj.path, a, { x: b.x + b.w / 2, y: b.y + b.h / 2 }));
            }}>{a > 0 ? `↻ ${a}°` : `↺ ${-a}°`}</button>
          ))}
        </span>
      </div>
      <div className="btn-row">
        <button className={editing?.id === obj.id ? 'on' : ''} onClick={() => setEditing(editing?.id === obj.id ? null : { id: obj.id, nodes: [] })}>{editing?.id === obj.id ? 'Zakończ edycję' : 'Edytuj węzły ⏎'}</button>
        <button onClick={() => setPath({ ...obj.path, closed: !obj.path.closed })}>{obj.path.closed ? 'Otwórz' : 'Zamknij'}</button>
      </div>
      <div className="btn-row">
        <button onClick={() => {
          const rp = reversePath(obj.path);
          if (obj.type === 'strip') {
            const flipLanes = (ls: Lane[]) => [...ls].reverse().map((l) => ({ ...l, dir: (l.dir * -1) as Lane['dir'] }));
            const spec: RoadSpec = { ...obj.spec, lanes: flipLanes(obj.spec.lanes), lanesEnd: obj.spec.lanesEnd ? flipLanes(obj.spec.lanesEnd) : undefined, dividers: undefined, edgeLeft: obj.spec.edgeRight, edgeRight: obj.spec.edgeLeft };
            const n = normalizeOrigin({ ...obj, path: rp, spec });
            upd(obj.id, { x: n.x, y: n.y, path: n.path, spec } as Partial<BzObject>);
          } else setPath(rp);
        }} title="Odwraca kierunek ścieżki, zachowując wygląd">Odwróć ścieżkę</button>
        <button onClick={() => setPath({ ...obj.path, nodes: obj.path.nodes.map((_, i) => smoothNode({ ...obj.path, nodes: obj.path.nodes }, i).nodes[i]) })} title="Wygładź wszystkie węzły">Wygładź</button>
        <button onClick={() => setPath({ ...obj.path, nodes: obj.path.nodes.map((n) => ({ ...n, hIn: undefined, hOut: undefined, mode: 'corner' as const })) })} title="Zamień na odcinki proste">Prostuj</button>
      </div>
      {editing?.id === obj.id && (
        <div className="node-panel">
          <div className="hint">{nodeSel.length ? `Węzeł ${nodeSel.map((i) => i + 1).join(', ')} z ${obj.path.nodes.length}` : 'Kliknij węzeł; kliknij ścieżkę, by dodać węzeł; 2× klik przełącza gładki/ostry; Alt przy uchwycie łamie symetrię'}</div>
          {nodeSel.length === 1 && (() => {
            const i = nodeSel[0]; const n = obj.path.nodes[i];
            return (
              <>
                <div className="prop"><span>Pozycja</span><span className="pair">
                  <NumberInput value={obj.x + n.x} step={0.5} onChange={(v) => setPath({ ...obj.path, nodes: obj.path.nodes.map((m, k) => (k === i ? { ...m, x: v - obj.x, hIn: m.hIn && { x: m.hIn.x + (v - obj.x - m.x), y: m.hIn.y }, hOut: m.hOut && { x: m.hOut.x + (v - obj.x - m.x), y: m.hOut.y } } : m)) })} />
                  <NumberInput value={obj.y + n.y} step={0.5} onChange={(v) => setPath({ ...obj.path, nodes: obj.path.nodes.map((m, k) => (k === i ? { ...m, y: v - obj.y, hIn: m.hIn && { x: m.hIn.x, y: m.hIn.y + (v - obj.y - m.y) }, hOut: m.hOut && { x: m.hOut.x, y: m.hOut.y + (v - obj.y - m.y) } } : m)) })} />
                </span></div>
                <div className="btn-row">
                  <button onClick={() => setPath(n.hIn || n.hOut ? cornerNode(obj.path, i) : smoothNode(obj.path, i))}>{n.hIn || n.hOut ? 'Ostry' : 'Gładki'}</button>
                  <button onClick={cut} disabled={!obj.path.closed && (i === 0 || i === obj.path.nodes.length - 1)} title="Rozcina ścieżkę w tym węźle na dwa obiekty">Przetnij tutaj</button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </Section>
  );
}

// ───────────────────────── per-type panels ─────────────────────────

function StripPanel({ obj }: { obj: StripObj }) {
  const upd = useProject((s) => s.updateObject);
  const addObjects = useProject((s) => s.addObjects);
  const replaceWith = useProject((s) => s.replaceWith);
  const [tpl, setTpl] = useState(LANE_TEMPLATES[0]?.id ?? '');
  const lanes = obj.spec.lanes;
  const legacy = lanes.length !== 1;
  const lane = lanes[0];
  const taper = !!obj.spec.lanesEnd;
  const setLane = (patch: Partial<Lane>) => upd(obj.id, { spec: { ...obj.spec, lanes: [{ ...lane, ...patch }], lanesEnd: obj.spec.lanesEnd?.map((l) => ({ ...l, ...patch, width: l.width })) } } as Partial<BzObject>);
  const setSpec = (patch: Partial<RoadSpec>) => upd(obj.id, { spec: { ...obj.spec, ...patch } } as Partial<BzObject>);

  /** New single-lane strip touching this one edge-to-edge, parallel along the whole path (also on curves). */
  const addBeside = (side: -1 | 1) => {
    const t = LANE_TEMPLATES.find((x) => x.id === tpl);
    if (!t) return;
    const nl: Lane = { ...t.lane };
    if (nl.dir !== 0 && lane && lane.dir !== 0) nl.dir = lane.dir;
    const centre = (obj.spec.offset ?? 0) + side * (specWidth(lanes) / 2 + nl.width / 2);
    const path = offsetPath(obj.path, centre);
    addObjects([normalizeOrigin({ id: uid('s'), type: 'strip', x: obj.x, y: obj.y, rotation: 0, name: t.name, path, spec: { lanes: [nl] } } as StripObj)]);
  };

  /** Old multi-lane objects → one strip per lane. */
  const explode = () => {
    const merged = mergeLanes(obj.spec.lanes, obj.spec.lanesEnd);
    const W = merged.reduce((acc, m) => acc + m.w0, 0);
    let y = -W / 2 + (obj.spec.offset ?? 0);
    const out: StripObj[] = [];
    for (const m of merged) {
      const c = y + m.w0 / 2;
      y += m.w0;
      if (m.w0 <= 0) continue;
      out.push(normalizeOrigin({ ...obj, id: uid('s'), name: LANE_KIND_LABEL[m.lane.kind], path: offsetPath(obj.path, c), spec: { lanes: [{ ...m.lane, width: m.w0 }] } }));
    }
    replaceWith(obj.id, out);
  };

  const marking = lane?.marking ?? (lane?.kind === 'tram' ? 'tracks' : lane?.kind === 'buffer' ? 'p21' : 'none');

  return (
    <>
      <PathOps obj={obj} />
      {legacy ? (
        <Section title="Kilka pasów w jednym obiekcie">
          <div className="hint">Ten obiekt pochodzi ze starszej wersji ({lanes.length} pasy razem). Rozdziel go, żeby każdy pas był osobnym obiektem.</div>
          <button className="primary" onClick={explode}>Rozdziel pasy</button>
        </Section>
      ) : (
        <>
          <Section title={obj.link ? 'Łącznik' : 'Pas'}>
            {obj.link && <div className="hint">Osobny segment łączący dwa końce pasów; można go edytować jak każdy pas.</div>}
            <div className="prop"><span>Rodzaj</span>
              <select value={lane.kind} onChange={(e) => setLane({ kind: e.target.value as LaneKind, marking: undefined, surface: undefined })}>
                {LANE_KINDS.map((k) => <option key={k} value={k}>{LANE_KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="prop"><span>Szerokość</span><NumberInput value={lane.width} step={0.25} min={0.2} suffix="m" onChange={(v) => setLane({ width: v })} /></div>
            {taper && obj.spec.lanesEnd?.[0] && (
              <div className="prop"><span>Szer. na końcu</span><NumberInput value={obj.spec.lanesEnd[0].width} step={0.25} min={0} suffix="m" onChange={(v) => setSpec({ lanesEnd: [{ ...obj.spec.lanesEnd![0], width: v }] })} /></div>
            )}
            <div className="prop"><span>Kierunek</span>
              <span className="seg">
                <button className={lane.dir === 1 ? 'on' : ''} onClick={() => setLane({ dir: 1 })} title="Ruch zgodnie z kierunkiem rysowania">→</button>
                <button className={lane.dir === -1 ? 'on' : ''} onClick={() => setLane({ dir: -1 })} title="Ruch przeciwnie do kierunku rysowania">←</button>
                <button className={lane.dir === 0 ? 'on' : ''} onClick={() => setLane({ dir: 0 })} title="Bez kierunku (chodnik, zieleń, parkowanie)">brak</button>
              </span>
            </div>
            <div className="prop"><span>Nawierzchnia</span>
              <span className="row-inline">
                <input type="color" value={lane.surface ?? laneFill({ ...lane, surface: undefined })} onChange={(e) => setLane({ surface: e.target.value })} />
                <button className="mini" onClick={() => setLane({ surface: undefined })}>domyślna</button>
                <button className="mini" onClick={() => setLane({ surface: '#b5423a' })}>czerwona</button>
                <button className="mini" onClick={() => setLane({ surface: '#5b8a3c' })}>trawa</button>
              </span>
            </div>
          </Section>
          <Section title="Oznakowanie na pasie">
            <div className="prop"><span>Znak</span>
              <select value={marking} onChange={(e) => setLane({ marking: e.target.value as LaneMarking })}>
                {LANE_MARKINGS.map((m) => <option key={m} value={m}>{LANE_MARKING_LABEL[m]}</option>)}
              </select>
            </div>
            {REPEATED.includes(marking) && (() => {
              const gap = lane.markGap ?? defaultMarkGap(marking);
              const all = !lane.markCount;
              return (
                <>
                  <div className="prop"><span>Powtarzaj co</span><NumberInput value={gap} step={1} min={1} suffix="m" onChange={(v) => setLane({ markGap: Math.max(1, v) })} title="Odległość między kolejnymi znakami, środek do środka (15 m w terenie zabudowanym, 30 m poza nim)" /></div>
                  <div className="prop"><span></span><span className="row-inline">
                    {[5, 10, 15, 20, 30].map((g) => <button key={g} className={`mini ${Math.abs(gap - g) < 1e-6 ? 'on' : ''}`} onClick={() => setLane({ markGap: g })}>{g} m</button>)}
                  </span></div>
                  <div className="prop"><span>Zakres</span>
                    <span className="seg">
                      <button className={all ? 'on' : ''} onClick={() => setLane({ markCount: 0 })} title="Znaki powtarzają się na całej długości pasa">cały pas</button>
                      <button className={!all ? 'on' : ''} onClick={() => setLane({ markCount: lane.markCount || 3 })} title="Tylko kilka znaków przed końcem pasa (np. przed skrzyżowaniem)">przy końcu</button>
                    </span>
                  </div>
                  {!all && <div className="prop"><span>Liczba</span><NumberInput value={lane.markCount ?? 3} step={1} min={1} decimals={0} suffix="szt." onChange={(v) => setLane({ markCount: Math.max(1, Math.round(v)) })} title="Ile znaków od końca pasa, w kierunku jazdy" /></div>}
                </>
              );
            })()}
            <div className="prop"><span>Linia lewa</span><LineCodeSelect value={obj.spec.edgeLeft} onPick={(d) => setSpec({ edgeLeft: d })} /></div>
            <div className="prop"><span>Linia prawa</span><LineCodeSelect value={obj.spec.edgeRight} onPick={(d) => setSpec({ edgeRight: d })} /></div>
            <div className="hint">Lewa / prawa — patrząc w kierunku rysowania. Linie między pasami i przez skrzyżowanie wygodniej rysować narzędziem Oznakowanie (K).</div>
          </Section>
          <Section title="Dodaj pas obok">
            <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {LANE_TEMPLATES.map((t) => <option key={t.id} value={t.id} title={t.description}>{t.name}</option>)}
            </select>
            <div className="btn-row">
              <button onClick={() => addBeside(-1)}>◀ z lewej</button>
              <button onClick={() => addBeside(1)}>z prawej ▶</button>
            </div>
            <div className="hint">Nowy pas styka się krawędzią i biegnie równolegle na całej długości, także po łuku.</div>
          </Section>
        </>
      )}
    </>
  );
}

function LinePanel({ obj }: { obj: LineObj }) {
  const upd = useProject((s) => s.updateObject);
  const set = (patch: Partial<LineObj>) => upd(obj.id, patch);
  const v = obj.variant ?? 'plain';
  const area = ['hatch', 'grass', 'pavement', 'asphalt'].includes(v);
  const spec: LineSpec = { style: obj.style, width: obj.width, dash: obj.dash, color: obj.color };
  return (
    <>
      <PathOps obj={obj} />
      <Section title={area ? 'Nawierzchnia / obszar' : 'Znak poziomy'}>
        <div className="prop"><span>Rodzaj</span>
          <select value={v} onChange={(e) => { const nv = e.target.value as LineObj['variant']; set({ variant: nv, path: ['hatch', 'grass', 'pavement', 'asphalt'].includes(nv) ? { ...obj.path, closed: true } : obj.path }); }}>
            <option value="plain">linia / wielokąt</option>
            <option value="crosswalk">P-10 przejście dla pieszych</option>
            <option value="bikeCrossing">P-11 przejazd dla rowerzystów</option>
            <option value="zigzag">P-17 linia przystankowa</option>
            <option value="yieldTriangle">P-15 trójkąt podporządkowania</option>
            <option value="hatch">P-21 powierzchnia wyłączona</option>
            <option value="curb">krawężnik</option>
            <option value="asphalt">nawierzchnia (wielokąt)</option>
            <option value="pavement">chodnik / plac (wielokąt)</option>
            <option value="grass">trawnik (wielokąt)</option>
          </select>
        </div>
        {v === 'plain' && (
          <div className="prop"><span>Linia</span>
            <LineCodeSelect value={obj.style === 'none' ? undefined : spec} onPick={(d) => (d ? set({ style: d.style, width: d.width, dash: d.dash, color: d.color, code: codeOfSpec(d) }) : set({ style: 'none' }))} />
          </div>
        )}
        {v === 'plain' && obj.style !== 'none' && (
          <LineSpecFields value={spec} onChange={(d) => set({ style: d.style, width: d.width, dash: d.dash, color: d.color, code: codeOfSpec(d) })} />
        )}
        {(v === 'crosswalk' || v === 'bikeCrossing' || v === 'zigzag') && (
          <div className="prop"><span>{v === 'zigzag' ? 'Amplituda' : 'Szerokość'}</span><NumberInput value={obj.width} step={0.1} min={0.1} suffix="m" onChange={(w) => set({ width: w })} /></div>
        )}
        {v === 'curb' && <div className="prop"><span>Grubość</span><NumberInput value={obj.width} step={0.05} min={0.05} suffix="m" onChange={(w) => set({ width: w })} /></div>}
        {v === 'yieldTriangle' && (
          <>
            <div className="prop"><span>Podstawa</span><NumberInput value={obj.width} step={0.1} min={0.2} suffix="m" onChange={(w) => set({ width: w })} title="Szerokość podstawy; długość zmieniasz uchwytami na końcach (wierzchołek → podstawa)" /></div>
            <div className="prop"><span>Odmiana</span><span className="row-inline">
              {([['mini', 0.5, 1.65], ['krótki', 1.0, 3.3], ['długi', 1.9, 5.0]] as const).map(([lbl, w, l]) => (
                <button key={lbl} className="mini" title={`${w.toString().replace('.', ',')} × ${l.toString().replace('.', ',')} m`} onClick={() => { const n = normalizeOrigin({ ...obj, width: w, path: setPathLength(obj.path, l) }); set({ width: w, x: n.x, y: n.y, path: n.path }); }}>{lbl}</button>
              ))}
            </span></div>
          </>
        )}
        {(v === 'crosswalk' || v === 'bikeCrossing' || v === 'zigzag' || v === 'hatch' || v === 'curb' || v === 'yieldTriangle') && (
          <div className="prop"><span>Kolor</span><span className="row-inline"><input type="color" value={obj.color} onChange={(e) => set({ color: e.target.value })} /><button className="mini" onClick={() => set({ color: WHITE })}>biały</button><button className="mini" onClick={() => set({ color: YELLOW })}>żółty</button></span></div>
        )}
        {(obj.path.closed || area || v === 'crosswalk' || v === 'bikeCrossing') && (
          <div className="prop"><span>Wypełnienie</span>
            <span className="row-inline">
              <input type="color" value={obj.fill ?? '#3a3d42'} onChange={(e) => set({ fill: e.target.value })} />
              <button className="mini" onClick={() => set({ fill: undefined })}>brak</button>
              <button className="mini" onClick={() => set({ fill: '#3a3d42' })}>asfalt</button>
              <button className="mini" onClick={() => set({ fill: '#b5423a' })}>czerw.</button>
            </span>
          </div>
        )}
      </Section>
    </>
  );
}

function SymbolPanel({ obj }: { obj: SymbolObj }) {
  const upd = useProject((s) => s.updateObject);
  const set = (patch: Partial<SymbolObj>) => upd(obj.id, patch);
  const def = symbolById(obj.symbolId);
  const ratio = obj.width / obj.height;
  return (
    <Section title={def?.name ?? 'Symbol'}>
      <div className="prop"><span>Rozmiar</span>
        <span className="pair">
          <NumberInput value={obj.width} step={0.1} min={0.1} suffix="szer." onChange={(v) => set({ width: v, height: v / ratio })} />
          <NumberInput value={obj.height} step={0.1} min={0.1} suffix="wys." onChange={(v) => set({ height: v, width: v * ratio })} />
        </span>
      </div>
      {def && <div className="prop"><span></span><button onClick={() => set({ width: def.width, height: def.height })}>rozmiar rzeczywisty ({def.width} × {def.height} m)</button></div>}
      {def && /\{\{color\}\}/.test(def.svg) && (
        <div className="prop"><span>Kolor</span><span className="row-inline"><input type="color" value={obj.color ?? def.defaultColor ?? '#ffffff'} onChange={(e) => set({ color: e.target.value })} /><button onClick={() => set({ color: def.defaultColor })}>domyślny</button></span></div>
      )}
      <div className="prop"><span>Odbicie</span><button className="icon" onClick={() => set({ flipX: !obj.flipX })} title="Odbij w poziomie (Shift+H)"><FlipHorizontal2 size={14} /></button></div>
    </Section>
  );
}

function TextPanel({ obj }: { obj: TextObj }) {
  const upd = useProject((s) => s.updateObject);
  const set = (patch: Partial<TextObj>) => upd(obj.id, patch);
  return (
    <Section title="Tekst">
      <textarea rows={2} value={obj.text} onChange={(e) => set({ text: e.target.value })} />
      <div className="prop"><span>Wys. liter</span><NumberInput value={obj.fontSize} step={0.1} min={0.1} suffix="m" onChange={(v) => set({ fontSize: v })} /></div>
      <div className="prop"><span>Wydłużenie</span><NumberInput value={obj.stretch} step={0.1} min={0.5} max={6} onChange={(v) => set({ stretch: v })} /></div>
      <div className="prop"><span>Kolor</span><input type="color" value={obj.color} onChange={(e) => set({ color: e.target.value })} /></div>
      <div className="prop"><span>Tło</span><span className="row-inline"><input type="color" value={obj.background ?? '#000000'} onChange={(e) => set({ background: e.target.value })} /><button onClick={() => set({ background: undefined })}>brak</button></span></div>
      <div className="hint">Napisy na jezdni (P-16 STOP, P-22 BUS) mają litery 1,6 m i są wydłużone w kierunku jazdy.</div>
    </Section>
  );
}

// ───────────────────────── root ─────────────────────────

interface Props {
  measured: number | null;
  onCalibrate: (factor: number) => void;
}

export function Inspector({ measured, onCalibrate }: Props) {
  const tool = useProject((s) => s.tool);
  const project = useProject((s) => s.project)!;
  const selection = useProject((s) => s.selection);
  const objs = useMemo(() => project.objects.filter((o) => selection.includes(o.id)), [project.objects, selection]);
  const upd = useProject((s) => s.updateObjects);
  const remove = useProject((s) => s.removeObjects);
  const dup = useProject((s) => s.duplicateObjects);
  const setMeta = useProject((s) => s.setProjectMeta);
  const setBackground = useProject((s) => s.setBackground);
  const group = useProject((s) => s.group);
  const ungroup = useProject((s) => s.ungroup);
  const mergeObjects = useProject((s) => s.mergeObjects);
  const pending = useProject((s) => s.pending);
  const markCurve = useProject((s) => s.markCurve);
  const toggleMarkCurve = useProject((s) => s.toggleMarkCurve);
  const [real, setReal] = useState(0);

  if (tool === 'link') {
    return (
      <div className="inspector">
        <Section title="Łącznik (J)">
          <p className="hint">Kliknij kropkę na końcu jednego pasa, potem kropkę na końcu drugiego — powstanie <strong>osobny segment</strong> łączący oba końce łukiem stycznym do obu pasów. Pasy nie są zmieniane ani scalane; łącznik ma rodzaj i nawierzchnię pierwszego pasa, a gdy drugi jest innej szerokości — płynnie zwęża się do niego.</p>
          <p className="hint">Styk dwóch pasów pod kątem jest automatycznie wypełniany zaokrągleniem, więc na zewnątrz zakrętu nie brakuje asfaltu.</p>
          <p className="hint"><strong>Włączenie w bok (klin):</strong> po kliknięciu kropki kliknij w sam pas, do którego ma się włączyć — pas zwęży się do zera ze strzałką P-9.</p>
          <p className="hint">Łączy się pas z pasem i linię z linią. Esc anuluje wybór. Scalanie kawałków w jeden obiekt jest w menu prawego przycisku.</p>
        </Section>
      </div>
    );
  }

  if (tool === 'mark') {
    const name = pending && pending.category === 'Oznakowanie' ? pending.name : 'P-1b linia pojedyncza przerywana – krótka';
    const laneMode = pending?.template.kind === 'laneMarking';
    return (
      <div className="inspector">
        <Section title="Oznakowanie (K)">
          <div className="hint">Wybrany znak: <strong>{name}</strong></div>
          {laneMode ? (
            <p className="hint">Kliknij pas, na którym ma się znaleźć ten znak. Strzałki, rowery i napisy ustawiają się na osi pasa i powtarzają na całej jego długości, licząc od końca w kierunku jazdy. Co ile metrów (albo tylko kilka przy końcu pasa) ustawisz w panelu pasa.</p>
          ) : (
            <>
              <p className="hint">Rysujesz jak piórem: <strong>klik = punkt</strong>, <strong>przeciągnięcie = przesuwanie mapy</strong>, klik w ostatni punkt lub Enter kończy linię (narzędzie zostaje włączone), Backspace / Ctrl+Z cofa punkt, Alt+przeciągnięcie = punkt z łukiem, Shift = kąty co 15°.</p>
              <p className="hint">Kropki na krawędziach pasów przyciągają punkty:</p>
              <p className="hint">• kolejne punkty na <strong>tej samej krawędzi</strong> — linia biegnie po tej krawędzi (np. P-2a na ostatnich 20 m przed skrzyżowaniem, P-1b wcześniej),<br />• kolejne punkty na <strong>dwóch różnych krawędziach</strong> — płynny łuk styczny do obu (prowadzenie pasa przez skrzyżowanie, P-1d / P-1e),<br />• dowolne miejsce — zwykły punkt.</p>
              <div className="prop"><span>Między krawędziami</span>
                <span className="seg">
                  <button className={markCurve ? 'on' : ''} onClick={() => { if (!markCurve) toggleMarkCurve(); }}>łuk</button>
                  <button className={!markCurve ? 'on' : ''} onClick={() => { if (markCurve) toggleMarkCurve(); }}>prosto</button>
                </span>
              </div>
              <p className="hint">Przejścia (P-10, P-11) i linie zatrzymania rysuj od krawędzi do krawędzi w poprzek jezdni. Esc kończy linię i wyłącza narzędzie.</p>
            </>
          )}
        </Section>
      </div>
    );
  }

  if (tool === 'measure') {
    return (
      <div className="inspector">
        <Section title="Pomiar / kalibracja">
          <p className="hint">Kliknij dwa punkty. Jeśli znasz rzeczywistą odległość, wpisz ją — plansza i tło zostaną przeskalowane.</p>
          <div className="prop"><span>Zmierzono</span><strong>{measured !== null ? formatLength(measured, project.units) : '—'}</strong></div>
          <div className="prop"><span>Rzeczywista</span><NumberInput value={real} step={0.5} min={0} suffix="m" onChange={setReal} /></div>
          <button className="primary" disabled={!measured || !(real > 0)} onClick={() => onCalibrate(real / measured!)}>Przeskaluj planszę</button>
        </Section>
      </div>
    );
  }

  if (objs.length === 0) {
    const drawing = tool === 'pen' || tool === 'polygon' || tool === 'line' || tool === 'rect' || tool === 'ellipse';
    return (
      <div className="inspector">
        {drawing && (
          <Section title="Rysowanie">
            <div className="hint">Element: <strong>{pending && pending.template.kind !== 'laneMarking' ? pending.name : tool === 'rect' || tool === 'ellipse' || tool === 'polygon' ? 'Nawierzchnia asfaltowa' : 'P-2a linia ciągła'}</strong></div>
            <div className="hint">{tool === 'pen' ? 'Klik = punkt. Przeciągnięcie = przesuwanie mapy. Alt+przeciągnięcie = punkt gładki (łuk). Klik w pierwszy punkt zamyka, w ostatni / Enter kończy. Ctrl+Z / Backspace = cofnij punkt. Shift = kąty co 15°.' : tool === 'polygon' ? 'Klik = wierzchołek. Przeciągnięcie = przesuwanie mapy. Alt+przeciągnięcie = wierzchołek gładki. Enter lub klik w pierwszy punkt zamyka wielokąt.' : 'Przeciągnij, by narysować. Shift = proporcje 1:1 / kąty co 15°.'}</div>
          </Section>
        )}
        <Section title="Kolejność warstw">
          <div className="hint">Stała, wg kategorii: {([0, 1, 2, 3, 4, 5, 6] as const).map((r) => RANK_LABEL[r]).join(' → ')}. Najpierw rysujesz nawierzchnię i pasy, na końcu oznakowanie — ono zawsze leży na wierzchu, a tory tramwajowe na jezdni i przejściach stają się przejazdem na płytach.</div>
        </Section>
        <Section title="Projekt">
          <div className="prop"><span>Nazwa</span><input type="text" value={project.name} onChange={(e) => setMeta({ name: e.target.value })} /></div>
          <div className="prop"><span>Plansza</span><span className="pair">
            <NumberInput value={project.widthM} step={10} min={10} suffix="szer." decimals={0} onChange={(v) => setMeta({ widthM: v })} />
            <NumberInput value={project.heightM} step={10} min={10} suffix="wys." decimals={0} onChange={(v) => setMeta({ heightM: v })} />
          </span></div>
          <div className="prop"><span>Jednostki</span><select value={project.units} onChange={(e) => setMeta({ units: e.target.value as 'm' | 'ft' })}><option value="m">metry</option><option value="ft">stopy</option></select></div>
          {project.background.kind === 'blank' ? (
            <div className="prop"><span>Kolor tła</span><input type="color" value={project.background.color} onChange={(e) => setBackground({ kind: 'blank', color: e.target.value })} /></div>
          ) : (
            <>
              <div className="prop"><span>Tło</span><span className="hint">{project.background.widthM.toFixed(0)} × {project.background.heightM.toFixed(0)} m{project.background.geo ? ` · ${project.background.geo.lat.toFixed(4)}, ${project.background.geo.lng.toFixed(4)}` : ''}</span></div>
              <div className="prop"><span>Krycie tła</span><input type="range" min={0.1} max={1} step={0.05} value={project.background.opacity ?? 1} onChange={(e) => setBackground({ ...project.background, opacity: Number(e.target.value) } as typeof project.background)} /></div>
            </>
          )}
        </Section>
        <Section title="Skróty">
          <div className="shortcuts">
            <kbd>V</kbd><span>zaznaczanie</span><kbd>H / Spacja</kbd><span>rączka</span>
            <kbd>P</kbd><span>pióro</span><kbd>W</kbd><span>wielokąt</span><kbd>L</kbd><span>linia</span>
            <kbd>R</kbd><span>prostokąt</span><kbd>O</kbd><span>elipsa</span>
            <kbd>J</kbd><span>łącznik</span><kbd>K</kbd><span>oznakowanie</span><kbd>T</kbd><span>tekst</span><kbd>M</kbd><span>pomiar</span>
            <kbd>⏎</kbd><span>edycja węzłów</span><kbd>Esc</kbd><span>zakończ / odznacz</span>
            <kbd>Ctrl+D</kbd><span>duplikuj</span><kbd>Ctrl+Z / Y</kbd><span>cofnij / ponów</span>
            <kbd>Ctrl+[ ]</kbd><span>kolejność w obrębie kategorii</span><kbd>Ctrl+Shift+L</kbd><span>zablokuj</span>
            <kbd>Shift+R</kbd><span>obróć symbol 90°</span><kbd>Shift+H</kbd><span>odbij symbol</span>
            <kbd>Shift+1 / 2 / 0</kbd><span>dopasuj / do zaznaczenia / 100%</span><kbd>Ctrl+kółko</kbd><span>zoom</span>
          </div>
        </Section>
      </div>
    );
  }

  const one = objs.length === 1 ? objs[0] : null;
  const allLocked = objs.every((o) => o.locked);
  const common = (patch: Partial<BzObject>) => upd(objs.map((o) => ({ id: o.id, patch })));
  const canRotate = objs.every((o) => o.type === 'symbol' || o.type === 'text');

  return (
    <div className="inspector">
      <div className="obj-head">
        <input className="obj-name" type="text" value={one ? one.name ?? '' : `${objs.length} obiektów`} disabled={!one} placeholder="Nazwa" onChange={(e) => one && upd([{ id: one.id, patch: { name: e.target.value } }])} />
        <button className="icon" title={allLocked ? 'Odblokuj' : 'Zablokuj (Ctrl+Shift+L)'} onClick={() => common({ locked: !allLocked })}>{allLocked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
        <button className="icon" title="Duplikuj (Ctrl+D)" onClick={() => dup(objs.map((o) => o.id))}><Copy size={14} /></button>
        <button className="icon danger" title="Usuń (Del)" onClick={() => remove(objs.map((o) => o.id))}><Trash2 size={14} /></button>
      </div>
      <Section title="Pozycja" right={one ? <span className="hint">{RANK_LABEL[objectRank(one)]}</span> : undefined}>
        {one && (
          <div className="prop"><span>X / Y</span><span className="pair">
            <NumberInput value={one.x} step={0.5} suffix="X" onChange={(x) => upd([{ id: one.id, patch: { x } }])} />
            <NumberInput value={one.y} step={0.5} suffix="Y" onChange={(y) => upd([{ id: one.id, patch: { y } }])} />
          </span></div>
        )}
        {canRotate && <div className="prop"><span>Obrót</span><NumberInput value={one ? one.rotation : 0} step={5} suffix="°" onChange={(rotation) => common({ rotation })} /></div>}
        <div className="prop"><span>Krycie</span><input type="range" min={0.05} max={1} step={0.05} value={one?.opacity ?? 1} onChange={(e) => common({ opacity: Number(e.target.value) })} /></div>
      </Section>
      {objs.length > 1 && (
        <Section title="Zaznaczono kilka obiektów">
          <div className="btn-row">
            <button onClick={() => group(objs.map((o) => o.id))} title="Kliknięcie w dowolny element zaznaczy całą grupę (Ctrl+klik = pojedynczy)">Grupuj (Ctrl+G)</button>
            <button onClick={() => ungroup(objs.map((o) => o.id))} disabled={!objs.some((o) => o.groupId)}>Rozgrupuj</button>
          </div>
          {(() => {
            const ps = objs.filter((o) => (o.type === 'strip' || o.type === 'line') && !o.path.closed) as PathObj[];
            if (ps.length < 2 || !ps.every((o) => o.type === ps[0].type)) return null;
            return <button onClick={() => { const r = mergeChain(ps); if (r) mergeObjects(r.merged, r.removed); }} title="Łączy kawałki w jeden ciągły obiekt łukami między najbliższymi końcami (zwykle lepszy jest łącznik J, który zostawia pasy osobno)">Scal w jeden obiekt</button>;
          })()}
          {objs.some((o) => o.type === 'strip' || o.type === 'line') && <div className="hint">Przeciągnij uchwyt na końcu dowolnego pasa — pozostałe zaznaczone pasy wydłużą się lub skrócą po tej samej stronie o tyle samo.</div>}
        </Section>
      )}
      {one?.type === 'strip' && <StripPanel obj={one} />}
      {one?.type === 'line' && <LinePanel obj={one} />}
      {one?.type === 'symbol' && <SymbolPanel obj={one} />}
      {one?.type === 'text' && <TextPanel obj={one} />}
    </div>
  );
}

