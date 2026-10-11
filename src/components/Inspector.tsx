import { useMemo, useState } from 'react';
import type { BzObject, Divider, Lane, LaneKind, LineObj, RoadSpec, StripObj, SymbolObj, TextObj } from '../model/types';
import { useProject } from '../store/project';
import { LANE_TEMPLATES } from '../catalog';
import { LANE_KIND_LABEL, LINE_STYLE_LABEL, laneFill, mergeLanes, specWidth } from '../canvas/roadGeometry';
import { symbolById } from '../assets/symbols';
import { cutAtNode, offsetPath, reversePath, smoothNode, cornerNode, setPathLength, rotatePath, polygonBounds } from '../canvas/path';
import { normalizeOrigin } from '../lib/factory';
import { uid } from '../store/project';
import { NumberInput } from './NumberInput';
import { mergeChain, type PathObj } from '../lib/merge';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, FlipHorizontal2, Lock, LockOpen, Trash2 } from 'lucide-react';
import { formatLength } from '../model/units';
import { flatten } from '../canvas/path';

const LINE_STYLES = Object.keys(LINE_STYLE_LABEL) as Divider['style'][];
const LANE_KINDS = Object.keys(LANE_KIND_LABEL) as LaneKind[];
const MARKINGS: Array<{ id: NonNullable<Lane['marking']>; label: string }> = [
  { id: 'none', label: 'brak' }, { id: 'bikeSymbols', label: 'P-23 rower' }, { id: 'busText', label: 'P-22 BUS' }, { id: 'tramTracks', label: 'tory' },
  { id: 'parkingBays', label: 'P-18 stanowiska' }, { id: 'hatch', label: 'P-21 szrafura' },
  { id: 'arrowsStraight', label: 'P-8a na wprost' }, { id: 'arrowsLeft', label: 'P-8b w lewo' }, { id: 'arrowsRight', label: 'P-8c w prawo' },
  { id: 'arrowsStraightLeft', label: 'P-8d na wprost lub w lewo' }, { id: 'arrowsStraightRight', label: 'P-8e na wprost lub w prawo' },
  { id: 'arrowsLeftRight', label: 'P-8f w lewo lub w prawo' }, { id: 'arrowsUturn', label: 'P-8g zawracanie' }, { id: 'arrowsAll', label: 'P-8h na wprost, w lewo lub w prawo' },
];

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-h"><span>{title}</span>{right}</div>
      {children}
    </div>
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
  const legacy = lanes.length !== 1 || !!obj.spec.lanesEnd;
  const lane = lanes[0];
  const setLane = (patch: Partial<Lane>) => upd(obj.id, { spec: { ...obj.spec, lanes: [{ ...lane, ...patch }] } } as Partial<BzObject>);
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

  const edgeSelect = (value: Divider | undefined, onPick: (d: Divider | undefined) => void) => (
    <select value={value?.style ?? 'none'} onChange={(e) => onPick(e.target.value === 'none' ? undefined : { style: e.target.value as Divider['style'], color: 'white' })}>
      {LINE_STYLES.map((st) => <option key={st} value={st}>{LINE_STYLE_LABEL[st]}</option>)}
    </select>
  );

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
          <Section title="Pas">
            <div className="prop"><span>Rodzaj</span>
              <select value={lane.kind} onChange={(e) => setLane({ kind: e.target.value as LaneKind, marking: undefined, surface: undefined })}>
                {LANE_KINDS.map((k) => <option key={k} value={k}>{LANE_KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="prop"><span>Szerokość</span><NumberInput value={lane.width} step={0.25} min={0.2} suffix="m" onChange={(v) => setLane({ width: v })} /></div>
            <div className="prop"><span>Kierunek</span>
              <span className="seg">
                <button className={lane.dir === 1 ? 'on' : ''} onClick={() => setLane({ dir: 1 })} title="Ruch zgodnie z kierunkiem rysowania">→</button>
                <button className={lane.dir === -1 ? 'on' : ''} onClick={() => setLane({ dir: -1 })} title="Ruch przeciwnie do kierunku rysowania">←</button>
                <button className={lane.dir === 0 ? 'on' : ''} onClick={() => setLane({ dir: 0 })} title="Bez kierunku (chodnik, zieleń, parkowanie)">brak</button>
              </span>
            </div>
            <div className="prop"><span>Oznakowanie</span>
              <select value={lane.marking ?? 'default'} onChange={(e) => setLane({ marking: e.target.value === 'default' ? undefined : (e.target.value as Lane['marking']) })}>
                <option value="default">domyślne</option>
                {MARKINGS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="prop"><span>Nawierzchnia</span>
              <span className="row-inline">
                <input type="color" value={lane.surface ?? laneFill({ ...lane, surface: undefined })} onChange={(e) => setLane({ surface: e.target.value })} />
                <button className="mini" onClick={() => setLane({ surface: undefined })}>domyślna</button>
                <button className="mini" onClick={() => setLane({ surface: '#b5423a' })}>czerwona</button>
              </span>
            </div>
            <div className="prop"><span>Linia lewa</span>{edgeSelect(obj.spec.edgeLeft, (d) => setSpec({ edgeLeft: d }))}</div>
            <div className="prop"><span>Linia prawa</span>{edgeSelect(obj.spec.edgeRight, (d) => setSpec({ edgeRight: d }))}</div>
            <div className="hint">Lewa / prawa — patrząc w kierunku rysowania. Linię między dwoma pasami ustaw na jednym z nich.</div>
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
  return (
    <>
      <PathOps obj={obj} />
      <Section title="Znak / kształt">
        <div className="prop"><span>Rodzaj</span>
          <select value={v} onChange={(e) => { const nv = e.target.value as LineObj['variant']; set({ variant: nv, path: ['hatch', 'grass', 'pavement', 'asphalt'].includes(nv) ? { ...obj.path, closed: true } : obj.path }); }}>
            <option value="plain">linia / wielokąt</option>
            <option value="crosswalk">P-10 przejście (zebra)</option>
            <option value="bikeCrossing">P-11 przejazd rowerowy</option>
            <option value="zigzag">P-17 linia przystankowa</option>
            <option value="hatch">P-21 powierzchnia wyłączona</option>
            <option value="curb">krawężnik</option>
            <option value="asphalt">nawierzchnia (wielokąt)</option>
            <option value="pavement">chodnik / plac (wielokąt)</option>
            <option value="grass">trawnik (wielokąt)</option>
          </select>
        </div>
        {v !== 'asphalt' && v !== 'grass' && v !== 'pavement' && (
          <div className="prop"><span>{v === 'crosswalk' || v === 'bikeCrossing' || v === 'zigzag' ? 'Szerokość' : 'Grubość'}</span><NumberInput value={obj.width} step={0.05} min={0} suffix="m" onChange={(w) => set({ width: w })} /></div>
        )}
        {v === 'plain' && (
          <div className="prop"><span>Styl</span>
            <select value={obj.style} onChange={(e) => set({ style: e.target.value as LineObj['style'] })}>
              {LINE_STYLES.map((s) => <option key={s} value={s}>{LINE_STYLE_LABEL[s]}</option>)}
            </select>
          </div>
        )}
        {!area && <div className="prop"><span>Kolor</span><span className="row-inline"><input type="color" value={obj.color} onChange={(e) => set({ color: e.target.value })} /><button onClick={() => set({ color: '#f4f4f4' })}>biały</button><button onClick={() => set({ color: '#f2c230' })}>żółty</button></span></div>}
        {(obj.path.closed || area || v === 'crosswalk' || v === 'bikeCrossing') && (
          <div className="prop"><span>Wypełnienie</span>
            <span className="row-inline">
              <input type="color" value={obj.fill ?? '#3a3d42'} onChange={(e) => set({ fill: e.target.value })} />
              <button onClick={() => set({ fill: undefined })}>brak</button>
              <button onClick={() => set({ fill: '#3a3d42' })}>asfalt</button>
              <button onClick={() => set({ fill: '#b5423a' })}>czerw.</button>
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
      <div className="hint">Napisy na jezdni (P-16 STOP, P-22 BUS) są wydłużone ~2,5× w kierunku jazdy.</div>
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
  const reorder = useProject((s) => s.reorder);
  const setMeta = useProject((s) => s.setProjectMeta);
  const setBackground = useProject((s) => s.setBackground);
  const group = useProject((s) => s.group);
  const ungroup = useProject((s) => s.ungroup);
  const mergeObjects = useProject((s) => s.mergeObjects);
  const pending = useProject((s) => s.pending);
  const [real, setReal] = useState(0);

  if (tool === 'join') {
    return (
      <div className="inspector">
        <Section title="Łączenie pasów">
          <p className="hint">Kliknij kropkę na końcu jednego pasa, potem na końcu drugiego — powstanie jeden ciągły pas z płynnym łukiem. Nachodzące końce zostaną lekko przycięte. Kliknięcie drugiego końca tego samego pasa zamyka go w pętlę. Esc anuluje wybór.</p>
          <p className="hint"><strong>Włączenie w bok (klin):</strong> po kliknięciu kropki na końcu pasa kliknij w sam pas, do którego ma się włączyć — w miejscu, gdzie włączenie ma się skończyć. Krawędź od strony tamtego pasa przylega do niego, druga schodzi łukiem, a pas zwęża się do zera (ze strzałką P-9). Klin jest grupowany z pasem.</p>
          <p className="hint">Łączy się pas z pasem i linię z linią. Wynik przejmuje rodzaj i szerokość pierwszego klikniętego pasa.</p>
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
            <div className="hint">Element: <strong>{pending?.name ?? (tool === 'rect' || tool === 'ellipse' || tool === 'polygon' ? 'Nawierzchnia asfaltowa' : 'P-2 linia ciągła')}</strong></div>
            <div className="hint">{tool === 'pen' ? 'Klik = punkt. Przeciągnięcie = przesuwanie mapy. Alt+przeciągnięcie = punkt gładki (łuk). Klik w pierwszy punkt zamyka, w ostatni / Enter kończy. Ctrl+Z / Backspace = cofnij punkt. Shift = kąty co 15°.' : tool === 'polygon' ? 'Klik = wierzchołek. Przeciągnięcie = przesuwanie mapy. Alt+przeciągnięcie = wierzchołek gładki. Enter lub klik w pierwszy punkt zamyka wielokąt.' : 'Przeciągnij, by narysować. Shift = proporcje 1:1 / kąty co 15°.'}</div>
          </Section>
        )}
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
            <kbd>J</kbd><span>łącz pasy</span><kbd>T</kbd><span>tekst</span><kbd>M</kbd><span>pomiar</span>
            <kbd>⏎</kbd><span>edycja węzłów</span><kbd>Esc</kbd><span>zakończ / odznacz</span>
            <kbd>Ctrl+D</kbd><span>duplikuj</span><kbd>Ctrl+Z / Y</kbd><span>cofnij / ponów</span>
            <kbd>Ctrl+[ ]</kbd><span>kolejność (+Shift: spód/wierzch)</span><kbd>Ctrl+Shift+L</kbd><span>zablokuj</span>
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
      <Section title="Pozycja" right={
        <span className="row-inline">
          <button className="icon" title="Na wierzch" onClick={() => reorder(objs.map((o) => o.id), 'top')}><ChevronsUp size={13} /></button>
          <button className="icon" title="Wyżej" onClick={() => reorder(objs.map((o) => o.id), 'up')}><ArrowUp size={13} /></button>
          <button className="icon" title="Niżej" onClick={() => reorder(objs.map((o) => o.id), 'down')}><ArrowDown size={13} /></button>
          <button className="icon" title="Na spód" onClick={() => reorder(objs.map((o) => o.id), 'bottom')}><ChevronsDown size={13} /></button>
        </span>
      }>
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
            return <button className="primary" onClick={() => { const r = mergeChain(ps); if (r) mergeObjects(r.merged, r.removed); }} title="Łączy kawałki w jeden ciągły pas płynnymi łukami między najbliższymi końcami">Połącz w jeden pas</button>;
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
