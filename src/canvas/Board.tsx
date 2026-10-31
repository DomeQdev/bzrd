import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Circle, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Text, Transformer } from 'react-konva';
import type { BzObject, LineObj, PathData, PathNode, Preset, StripObj, Vec2 } from '../model/types';
import { useProject, type Tool } from '../store/project';
import { ObjectNode } from './ObjectNode';
import { useImage } from './useImage';
import { computeCaps, drawMarkings, drawObject, drawRails, drawTramBand, hitPolygon, isTramStrip, objectBounds, roadwayPolygons, sortByRank, type Drawable } from './draw';
import { cornerNode, cutAtNode, cutPath, ellipsePath, flatten, linePath, nearestOnPath, rectPath, reversePath, sampleAt, setPathLength, smoothNode, splitSegment, transformPath } from './path';
import { buildSnapTargets, canTrace, outlineSamples, pointAt, snapAngle, snapBox, snapOutline, snapPoint, traceBetween, type GuideResult, type Polyline, type SnapResult } from './snap';
import { specWidth } from './roadGeometry';
import { uid } from '../store/project';
import { formatLength } from '../model/units';
import { objectFromTemplate, normalizeOrigin, textObject } from '../lib/factory';
import type { TextObj } from '../model/types';
import { endPoint, linkBetween, mergeChain, taperInto, type PathObj } from '../lib/merge';
import { pointInPolygon } from './path';
import { presetById } from '../catalog';

const MIN_SCALE = 0.3;
const MAX_SCALE = 600;
const ACCENT = '#0d99ff';
const GUIDE = '#f24822';

export interface BoardHandle {
  stage: () => Konva.Stage | null;
  fit: () => void;
  zoomBy: (f: number) => void;
  zoomTo: (scale: number) => void;
  zoomToSelection: () => void;
}

interface Props {
  onReady?: (h: BoardHandle) => void;
  onMeasure?: (distance: number | null) => void;
}

function isEditableTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

const DEFAULT_TEMPLATE: Record<string, string> = { pen: 'mk-p2a', polygon: 'mk-asphalt', line: 'mk-p2a', rect: 'mk-asphalt', ellipse: 'mk-asphalt', mark: 'mk-p1b' };

/**
 * Marking tool (Intersection-Marking-Tool style), applied to the pen draft: between two consecutive points that sit
 * on two DIFFERENT strip edges the segment becomes a smooth curve tangent to both edges (lane guidance through an
 * intersection). Points on the SAME edge are handled by traceNodes (the line follows the edge).
 */
function curveBetweenEdges(nodes: PathNode[], snaps: Array<SnapResult | null | undefined>, closed: boolean): PathNode[] {
  const out = nodes.map((n) => ({ ...n }));
  const n = out.length;
  const segs = closed ? n : n - 1;
  const toward = (pl: Polyline, param: number, from: Vec2, to: Vec2): Vec2 => {
    const t = pointAt(pl, param);
    const sgn = t.tx * (to.x - from.x) + t.ty * (to.y - from.y) >= 0 ? 1 : -1;
    return { x: t.tx * sgn, y: t.ty * sgn };
  };
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const a = snaps[i], b = snaps[j];
    if (!a?.poly || !b?.poly || a.poly.role !== 'edge' || b.poly.role !== 'edge' || a.poly === b.poly) continue;
    if (a.param === undefined || b.param === undefined || out[i].hOut || out[j].hIn) continue;
    const A = out[i], B = out[j];
    const D = Math.hypot(B.x - A.x, B.y - A.y);
    if (D < 0.05) continue;
    const h = D / 3;
    const tA = toward(a.poly, a.param, A, B);
    const tB = toward(b.poly, b.param, B, A);
    // only when the line runs ALONG the edges (lane guidance); across a lane (stop lines, crossings) it stays straight
    const cA = (tA.x * (B.x - A.x) + tA.y * (B.y - A.y)) / D, cB = (tB.x * (A.x - B.x) + tB.y * (A.y - B.y)) / D;
    if (cA < 0.5 || cB < 0.5) continue;
    A.hOut = { x: A.x + tA.x * h, y: A.y + tA.y * h };
    B.hIn = { x: B.x + tB.x * h, y: B.y + tB.y * h };
  }
  return out;
}

/** Direction of travel (world unit vector) of the lane under `w`, or null (no strip / no flow). */
function travelAt(w: Vec2, objects: BzObject[]): Vec2 | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.type !== 'strip' || o.visible === false || o.path.nodes.length < 2) continue;
    const local = { x: w.x - o.x, y: w.y - o.y };
    if (!pointInPolygon(local, hitPolygon(o))) continue;
    const dir = o.spec.lanes[0]?.dir ?? 0;
    if (dir === 0) continue;
    const f = flatten(o.path, 0.5);
    const smp = sampleAt(f, nearestOnPath(f, local).s);
    return { x: smp.tx * dir, y: smp.ty * dir };
  }
  return null;
}

/**
 * Orient markings that have a "front": P-13 teeth (drawn on the path's left) and the P-15 apex (path start) must point
 * at the approaching driver. When the marking lies on a lane with a direction of travel, reverse the path if needed.
 */
function orientForTraffic(obj: BzObject, objects: BzObject[]): BzObject {
  if (obj.type !== 'line' || obj.path.nodes.length < 2) return obj;
  const teeth = obj.variant === 'plain' && obj.style === 'triangles';
  const yieldT = obj.variant === 'yieldTriangle';
  if (!teeth && !yieldT) return obj;
  const f = flatten(obj.path, 0.25);
  const mid = sampleAt(f, f.length / 2);
  const travel = travelAt({ x: obj.x + mid.x, y: obj.y + mid.y }, objects);
  if (!travel) return obj;
  // teeth point to the path's left normal (nx, ny) → must face against travel; P-15 path must run with travel
  const wrong = teeth ? mid.nx * travel.x + mid.ny * travel.y > 0 : mid.tx * travel.x + mid.ty * travel.y < 0;
  return wrong ? normalizeOrigin({ ...obj, path: reversePath(obj.path) }) : obj;
}

let clipboard: BzObject[] = [];

interface PenDrag { idx: number; start: Vec2; moved: boolean }
interface EndRef { id: string; atStart: boolean; base: PathData; baseX: number; baseY: number; len: number }
interface EndDrag extends EndRef { start: Vec2; out: Vec2; endPt: Vec2; /** other selected paths whose matching end moves by the same amount */ others: EndRef[] }
interface EditDrag { kind: 'node' | 'hIn' | 'hOut'; idx: number; start: Vec2; path: PathData; moved: boolean; inserted?: boolean }

export function Board({ onReady, onMeasure }: Props) {
  const project = useProject((s) => s.project)!;
  const selection = useProject((s) => s.selection);
  const tool = useProject((s) => s.tool);
  const viewport = useProject((s) => s.viewport);
  const wheelMode = useProject((s) => s.wheelMode);
  const showGrid = useProject((s) => s.showGrid);
  const snapOn = useProject((s) => s.snap);
  const snapRotation = useProject((s) => s.snapRotation);
  const pending = useProject((s) => s.pending);
  const editing = useProject((s) => s.editing);
  const hoverId = useProject((s) => s.hoverId);
  const store = useProject;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const objLayerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [panActive, setPanActive] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [rubber, setRubber] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  // pen
  const [draft, setDraft] = useState<PathNode[]>([]);
  /** snap info for each draft node (aligned by index) → used to follow edges between consecutive snaps */
  const [draftSnaps, setDraftSnaps] = useState<Array<SnapResult | null>>([]);
  const shapeSnaps = useRef<{ a: SnapResult | null; b: SnapResult | null }>({ a: null, b: null });
  const penDrag = useRef<PenDrag | null>(null);
  /** left button pressed with pen/polygon: becomes a point on release, or a map pan if dragged */
  const penPress = useRef<{ cx: number; cy: number; w: Vec2 } | null>(null);
  const penClickRef = useRef<(w: Vec2) => void>(() => {});
  // shapes
  const [shapeDraft, setShapeDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // node editing
  const [editPath, setEditPath] = useState<PathData | null>(null);
  const editDrag = useRef<EditDrag | null>(null);
  const endDrag = useRef<EndDrag | null>(null);
  const [endLabel, setEndLabel] = useState<{ x: number; y: number; text: string } | null>(null);
  // snapping feedback
  const [snapHint, setSnapHint] = useState<SnapResult | null>(null);
  const [insertHint, setInsertHint] = useState<Vec2 | null>(null);
  const [guides, setGuides] = useState<GuideResult['guides']>([]);
  const [measurePts, setMeasurePts] = useState<number[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string | null; w: Vec2 } | null>(null);
  const [textEdit, setTextEdit] = useState<{ id: string } | null>(null);
  // join tool: first picked end + hovered end (preview)
  const [joinPick, setJoinPick] = useState<{ id: string; atStart: boolean } | null>(null);
  const [joinHover, setJoinHover] = useState<{ id: string; atStart: boolean } | null>(null);
  /** join tool: lane body under the cursor (merge INTO its side) */
  const [joinBody, setJoinBody] = useState<{ id: string; w: Vec2 } | null>(null);
  const markCurve = useProject((s) => s.markCurve);
  const dragStartRef = useRef<{ id: string; items: Map<string, Vec2>; box: { x0: number; y0: number; x1: number; y1: number }; alt: boolean; samples: Vec2[] } | null>(null);
  const transformBatch = useRef<Array<{ id: string; patch: Partial<BzObject> }>>([]);

  const bgSrc = project.background.kind === 'image' ? project.background.dataUrl : undefined;
  const bgImg = useImage(bgSrc);
  const tol = 8 / viewport.scale;

  // ─── size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(50, el.clientWidth), h: Math.max(50, el.clientHeight) }));
    ro.observe(el);
    setSize({ w: Math.max(50, el.clientWidth), h: Math.max(50, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  const toWorld = useCallback((px: number, py: number) => { const v = store.getState().viewport; return { x: (px - v.x) / v.scale, y: (py - v.y) / v.scale }; }, [store]);
  const pointer = useCallback((): Vec2 | null => {
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    return p ? toWorld(p.x, p.y) : null;
  }, [toWorld]);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const scale = Math.min(w / project.widthM, h / project.heightM) * 0.9;
    store.getState().setViewport({ scale, x: (w - project.widthM * scale) / 2, y: (h - project.heightM * scale) / 2 });
  }, [project.widthM, project.heightM, store]);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    const v = store.getState().viewport;
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
    const wx = (px - v.x) / v.scale, wy = (py - v.y) / v.scale;
    store.getState().setViewport({ scale: ns, x: px - wx * ns, y: py - wy * ns });
  }, [store]);

  const zoomTo = useCallback((scale: number) => {
    const v = store.getState().viewport;
    zoomAt(scale / v.scale, size.w / 2, size.h / 2);
  }, [zoomAt, size, store]);

  const zoomToSelection = useCallback(() => {
    const s = store.getState();
    const st = stageRef.current;
    if (!st || !s.selection.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of s.selection) {
      const n = st.findOne<Konva.Group>('#' + id);
      if (!n) continue;
      const r = n.getClientRect({ relativeTo: st as unknown as Konva.Container });
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
    }
    if (!isFinite(minX)) return;
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const scale = Math.min(MAX_SCALE, Math.min(size.w / w, size.h / h) * 0.7);
    s.setViewport({ scale, x: size.w / 2 - ((minX + maxX) / 2) * scale, y: size.h / 2 - ((minY + maxY) / 2) * scale });
  }, [size, store]);

  useEffect(() => { fit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.widthM, project.heightM]);
  useEffect(() => { onReady?.({ stage: () => stageRef.current, fit, zoomBy: (f) => zoomAt(f, size.w / 2, size.h / 2), zoomTo, zoomToSelection }); }, [onReady, fit, zoomAt, zoomTo, zoomToSelection, size]);

  // ─── snap targets
  const editingObj = useMemo(() => (editing ? project.objects.find((o) => o.id === editing.id) ?? null : null), [editing, project.objects]);
  const snapTargets = useMemo(() => {
    const exclude = new Set<string>(editing ? [editing.id] : []);
    return buildSnapTargets(project.objects, exclude);
  }, [project.objects, editing]);
  const dragTargets = useMemo(() => buildSnapTargets(project.objects, new Set(selection)), [project.objects, selection]);

  const drawHalfWidth = useMemo(() => (tool !== 'mark' && pending?.template.kind === 'strip' ? specWidth(pending.template.spec.lanes) / 2 : 0), [pending, tool]);
  /** Snap and return both the point and the snap info (edge + position) for tracing. */
  const snapFull = useCallback((p: Vec2, from?: Vec2 | null, useShift = true, half?: number): { p: Vec2; r: SnapResult | null } => {
    let q = p;
    const angled = useShift && shiftDown && !!from;
    if (angled) q = snapAngle(from!, q);
    if (!snapOn) { setSnapHint(null); return { p: q, r: null }; }
    const r = snapPoint(q, snapTargets, tol, half ?? drawHalfWidth, showGrid ? gridStep(viewport.scale) : undefined);
    setSnapHint(r.kind === 'none' ? null : r);
    if (r.kind === 'none') return { p: q, r: null };
    if (angled) return { p: snapAngle(from!, r), r: null }; // angle constraint wins; no tracing
    return { p: { x: r.x, y: r.y }, r };
  }, [snapOn, snapTargets, tol, shiftDown, showGrid, viewport.scale, drawHalfWidth]);
  const snapWorld = useCallback((p: Vec2, from?: Vec2 | null, useShift = true, half?: number): Vec2 => snapFull(p, from, useShift, half).p, [snapFull]);

  /** Insert points that follow the snapped edge between consecutive nodes snapped to the same edge. */
  const traceNodes = useCallback((nodes: PathNode[], snaps: Array<SnapResult | null | undefined>, closed: boolean, half: number): PathNode[] => {
    const out: PathNode[] = [];
    const n = nodes.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < n; i++) {
      out.push(nodes[i]);
      if (i >= segs) continue;
      const j = (i + 1) % n;
      const a = snaps[i], b = snaps[j];
      if (!canTrace(a, b) || nodes[i].hOut || nodes[j].hIn) continue;
      for (const p of traceBetween(a!.poly!, a!.param!, b!.param!, (a!.side ?? 0) * half)) out.push({ x: p.x, y: p.y, mode: 'corner' });
    }
    return out;
  }, []);

  // ─── template resolution
  const templateFor = useCallback((t: Tool): Preset | null => {
    if (t === 'mark') {
      // the marking tool draws open painted lines: strips, areas and P-21 fall back to the default line
      if (pending?.template.kind === 'line' && !pending.template.closedOnly) return pending;
      return presetById(DEFAULT_TEMPLATE.mark) ?? null;
    }
    if (pending && pending.template.kind !== 'laneMarking') return pending;
    return presetById(DEFAULT_TEMPLATE[t] ?? 'mk-p2a') ?? null;
  }, [pending]);

  const createFromPath = useCallback((worldPath: PathData, t: Tool) => {
    const preset = templateFor(t);
    if (!preset) return;
    let path = worldPath;
    if (preset.template.kind === 'line' && preset.template.closedOnly) path = { ...path, closed: true };
    const obj = orientForTraffic(objectFromTemplate(preset, path), store.getState().project!.objects);
    store.getState().addObject(obj);
  }, [templateFor, store]);

  // ─── pen
  const finishDraft = useCallback((closed = false) => {
    const nodes = draft;
    setDraft([]);
    penDrag.current = null;
    setSnapHint(null);
    if (nodes.length < 2) return;
    const close = closed || tool === 'polygon';
    const snaps = draftSnaps.slice(0, nodes.length);
    let clean = close ? nodes : nodes.map((n, i) => (i === nodes.length - 1 ? { ...n, hOut: undefined } : n));
    if (tool === 'mark' && markCurve) clean = curveBetweenEdges(clean, snaps, close);
    const traced = traceNodes(clean, snaps, close, drawHalfWidth);
    createFromPath({ nodes: traced, closed: close }, tool === 'polygon' ? 'polygon' : tool === 'mark' ? 'mark' : 'pen');
  }, [draft, draftSnaps, createFromPath, tool, traceNodes, drawHalfWidth, markCurve]);

  // ─── wheel
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const ev = e.evt;
    const p = stageRef.current!.getPointerPosition() ?? { x: size.w / 2, y: size.h / 2 };
    let mode: 'zoom' | 'pan';
    if (ev.ctrlKey || ev.metaKey) mode = 'zoom';
    else if (wheelMode === 'zoom') mode = 'zoom';
    else if (wheelMode === 'pan') mode = 'pan';
    else {
      const looksLikeMouse = ev.deltaMode !== 0 || (ev.deltaX === 0 && Math.abs(ev.deltaY) >= 40 && Number.isInteger(ev.deltaY));
      mode = looksLikeMouse ? 'zoom' : 'pan';
    }
    if (mode === 'zoom') {
      const d = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * 100 : ev.deltaY;
      const factor = Math.exp(-d * (ev.ctrlKey || ev.metaKey ? 0.0035 : 0.0018));
      zoomAt(factor, p.x, p.y);
    } else {
      const v = store.getState().viewport;
      const dx = ev.shiftKey && ev.deltaX === 0 ? ev.deltaY : ev.deltaX;
      const dy = ev.shiftKey && ev.deltaX === 0 ? 0 : ev.deltaY;
      store.getState().setViewport({ ...v, x: v.x - dx, y: v.y - dy });
    }
  };

  const undoDraftPoint = useCallback(() => {
    penDrag.current = null;
    if (shapeDraft) { setShapeDraft(null); setSnapHint(null); return; }
    setDraftSnaps((cur) => cur.slice(0, Math.max(0, draft.length - 1)));
    setDraft((cur) => {
      const next = cur.slice(0, -1);
      if (!next.length) setSnapHint(null);
      return next;
    });
  }, [shapeDraft, draft.length]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard.length) return;
    const copies = clipboard.map((o) => ({ ...structuredClone(o), id: uid(), x: o.x + 2, y: o.y + 2 }) as BzObject);
    clipboard = copies.map((o) => structuredClone(o));
    store.getState().addObjects(copies);
  }, [store]);

  // ─── keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(true);
      if (e.key === 'Alt') setAltDown(true);
      if (isEditableTarget(e.target)) return;
      const s = store.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { if (!spaceDown) setSpaceDown(true); e.preventDefault(); return; }
      if (mod && k === 'z' && !e.shiftKey && (draft.length || shapeDraft)) { e.preventDefault(); undoDraftPoint(); return; }
      if (mod && (k === 'z' || k === 'y') && (draft.length || shapeDraft)) { e.preventDefault(); return; }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); s.redo(); return; }
      if (mod && k === 'a') { e.preventDefault(); s.select(s.project!.objects.filter((o) => !o.locked && o.visible !== false).map((o) => o.id)); return; }
      if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) s.ungroup(s.selection); else s.group(s.selection); return; }
      if (mod && k === 'd') { e.preventDefault(); if (s.selection.length) s.duplicateObjects(s.selection); return; }
      if (mod && k === 'c') { e.preventDefault(); clipboard = s.project!.objects.filter((o) => s.selection.includes(o.id)).map((o) => structuredClone(o)); return; }
      if (mod && k === 'x') { e.preventDefault(); clipboard = s.project!.objects.filter((o) => s.selection.includes(o.id)).map((o) => structuredClone(o)); s.removeObjects(s.selection); return; }
      if (mod && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
      if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); const up = e.code === 'BracketRight'; s.reorder(s.selection, e.shiftKey ? (up ? 'top' : 'bottom') : up ? 'up' : 'down'); return; }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(1.25, size.w / 2, size.h / 2); return; }
      if (mod && e.key === '-') { e.preventDefault(); zoomAt(0.8, size.w / 2, size.h / 2); return; }
      if (mod && e.key === '0') { e.preventDefault(); fit(); return; }
      if (mod && e.shiftKey && k === 'l') { e.preventDefault(); const objs = s.project!.objects.filter((o) => s.selection.includes(o.id)); const lock = !objs.every((o) => o.locked); s.updateObjects(objs.map((o) => ({ id: o.id, patch: { locked: lock } }))); return; }
      if (mod && e.shiftKey && k === 'h') { e.preventDefault(); const objs = s.project!.objects.filter((o) => s.selection.includes(o.id)); s.updateObjects(objs.map((o) => ({ id: o.id, patch: { visible: o.visible === false } }))); return; }
      if (mod) return;
      if (e.shiftKey && e.key === '!') { fit(); return; }
      if (e.shiftKey && e.key === '@') { zoomToSelection(); return; }
      if (e.shiftKey && e.key === ')') { zoomTo(10); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (draft.length || shapeDraft) { undoDraftPoint(); return; }
        if (s.editing && editPathRef.current) { deleteSelectedNodes(); return; }
        if (s.selection.length) s.removeObjects(s.selection);
        return;
      }
      if (e.key === 'Escape') {
        if (draft.length) { if (draft.length >= 2) finishDraft(false); else { setDraft([]); setSnapHint(null); } if (s.tool !== 'mark') s.setTool('select'); return; }
        if (shapeDraft) { setShapeDraft(null); return; }
        if (ctxMenu) { setCtxMenu(null); return; }
        if (joinPick) { setJoinPick(null); return; }
        if (measurePts.length) { setMeasurePts([]); onMeasure?.(null); return; }
        if (s.editing) { s.setEditing(null); return; }
        if (s.tool !== 'select') { s.setTool('select'); s.setPending(null); return; }
        s.select([]);
        return;
      }
      if (e.key === 'Enter') {
        if (draft.length) { finishDraft(false); if (s.tool !== 'mark') s.setTool('select'); return; }
        if (s.editing) { s.setEditing(null); return; }
        if (s.selection.length === 1) {
          const o = s.project!.objects.find((x) => x.id === s.selection[0]);
          if (o && (o.type === 'strip' || o.type === 'line') && !o.locked) { s.setTool('select'); s.setEditing({ id: o.id, nodes: [] }); }
        }
        return;
      }
      const nudge = e.shiftKey ? 1 : 0.1;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
        const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;
        if (s.editing && editPathRef.current && s.editing.nodes.length) {
          const p = editPathRef.current;
          const sel = new Set(s.editing.nodes);
          const moved = { ...p, nodes: p.nodes.map((n, i) => (sel.has(i) ? { ...n, x: n.x + dx, y: n.y + dy, hIn: n.hIn && { x: n.hIn.x + dx, y: n.hIn.y + dy }, hOut: n.hOut && { x: n.hOut.x + dx, y: n.hOut.y + dy } } : n)) };
          commitEditPath(moved);
          return;
        }
        const objs = s.project!.objects.filter((o) => s.selection.includes(o.id) && !o.locked);
        if (objs.length) s.updateObjects(objs.map((o) => ({ id: o.id, patch: { x: o.x + dx, y: o.y + dy } })));
        return;
      }
      if (e.shiftKey && k === 'r') { const objs = s.project!.objects.filter((o) => s.selection.includes(o.id) && !o.locked && (o.type === 'symbol' || o.type === 'text')); s.updateObjects(objs.map((o) => ({ id: o.id, patch: { rotation: (o.rotation + 90) % 360 } }))); return; }
      if (e.shiftKey && k === 'h') { const objs = s.project!.objects.filter((o) => s.selection.includes(o.id) && o.type === 'symbol'); s.updateObjects(objs.map((o) => ({ id: o.id, patch: { flipX: !(o as { flipX?: boolean }).flipX } as Partial<BzObject> }))); return; }
      if (e.shiftKey) return;
      const toolKeys: Record<string, Tool> = { v: 'select', h: 'hand', p: 'pen', w: 'polygon', l: 'line', r: 'rect', o: 'ellipse', t: 'text', m: 'measure', j: 'link', k: 'mark' };
      if (toolKeys[k]) { if (draft.length >= 2 && toolKeys[k] !== tool) finishDraft(false); else if (draft.length) setDraft([]); setShapeDraft(null); s.setTool(toolKeys[k]); return; }
      if (k === 'g') { s.toggleGrid(); return; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
      if (e.key === 'Shift') setShiftDown(false);
      if (e.key === 'Alt') setAltDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, shapeDraft, measurePts, spaceDown, size, fit, zoomAt, zoomTo, zoomToSelection, finishDraft, ctxMenu, undoDraftPoint, joinPick, tool]);

  // ─── editing path state sync
  const editPathRef = useRef<PathData | null>(null);
  useEffect(() => {
    if (editingObj && (editingObj.type === 'strip' || editingObj.type === 'line')) { setEditPath(editingObj.path); editPathRef.current = editingObj.path; }
    else { setEditPath(null); editPathRef.current = null; }
  }, [editingObj]);

  const commitEditPath = useCallback((p: PathData) => {
    const s = store.getState();
    if (!s.editing) return;
    const o = s.project!.objects.find((x) => x.id === s.editing!.id);
    if (!o || (o.type !== 'strip' && o.type !== 'line')) return;
    if (p.nodes.length < 2) { s.removeObjects([o.id]); return; }
    const next = normalizeOrigin({ ...o, path: p } as StripObj | LineObj);
    s.updateObject(o.id, { x: next.x, y: next.y, path: next.path } as Partial<BzObject>);
  }, [store]);

  const deleteSelectedNodes = useCallback(() => {
    const s = store.getState();
    const p = editPathRef.current;
    if (!s.editing || !p) return;
    const sel = new Set(s.editing.nodes);
    if (!sel.size) return;
    const nodes = p.nodes.filter((_, i) => !sel.has(i));
    s.setEditing({ ...s.editing, nodes: [] });
    commitEditPath({ ...p, nodes });
  }, [store, commitEditPath]);

  // ─── transformer attach
  useEffect(() => {
    const tr = trRef.current, stage = stageRef.current;
    if (!tr || !stage) return;
    if (editing || tool !== 'select') { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }
    const nodes = selection.map((id) => stage.findOne<Konva.Group>('#' + id)).filter((n): n is Konva.Group => !!n);
    const sel = project.objects.filter((o) => selection.includes(o.id));
    const locked = sel.some((o) => o.locked);
    const singlePath = sel.length === 1 && (sel[0].type === 'strip' || sel[0].type === 'line');
    tr.nodes(locked || singlePath ? [] : nodes);
    tr.getLayer()?.batchDraw();
  }, [selection, project.objects, editing, tool]);

  const selectedObjs = useMemo(() => project.objects.filter((o) => selection.includes(o.id)), [project.objects, selection]);
  const anchors = useMemo(() => {
    if (selectedObjs.length === 0) return [];
    const types = new Set(selectedObjs.map((o) => o.type));
    if (types.has('strip') || types.has('line')) return []; // paths: move / rotate only (shape is edited via ends & nodes)
    if (types.size > 1) return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const t = selectedObjs[0].type;
    if (t === 'symbol' || t === 'text') return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'];
  }, [selectedObjs]);
  const keepRatio = selectedObjs.length > 0 && selectedObjs.every((o) => o.type === 'symbol' || o.type === 'text');

  // ─── object handlers
  const onObjMouseDown = (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const me = e.evt as MouseEvent;
    if (('button' in me && me.button === 1) || spaceDown || tool === 'hand') return;
    if (tool !== 'select') return;
    const s = store.getState();
    if (s.editing) {
      if (s.editing.id === id && editPathRef.current) {
        // click on the path itself: insert a node at the nearest point
        const w = pointer();
        const o = s.project!.objects.find((x) => x.id === id)!;
        if (w) {
          const f = flatten(editPathRef.current, 0.3);
          const n = nearestOnPath(f, { x: w.x - o.x, y: w.y - o.y });
          const half = o.type === 'strip' ? specWidth(o.spec.lanes) / 2 : 0;
          if (n.dist < Math.max(tol * 1.5, half)) {
            // Figma: clicking a segment inserts a node there and you are immediately dragging it
            const p = splitSegment(editPathRef.current, n.seg, n.t);
            const idx = n.seg + 1;
            editPathRef.current = p;
            setEditPath(p);
            s.setEditing({ id, nodes: [idx] });
            editDrag.current = { kind: 'node', idx, start: w, path: p, moved: false, inserted: true };
            setInsertHint(null);
          }
        }
        e.cancelBubble = true;
        return;
      }
      s.setEditing(null);
    }
    const clicked = s.project!.objects.find((o) => o.id === id);
    const deep = me.ctrlKey || me.metaKey;
    const members = clicked?.groupId && !deep ? s.project!.objects.filter((o) => o.groupId === clicked.groupId).map((o) => o.id) : [id];
    if (me.shiftKey) {
      const all = members.every((m) => s.selection.includes(m));
      s.select(all ? s.selection.filter((x) => !members.includes(x)) : Array.from(new Set([...s.selection, ...members])));
    } else if (deep) s.select([id]);
    else if (!s.selection.includes(id)) s.select(members);
  };
  const onObjDblClick = (id: string) => {
    const s = store.getState();
    if (tool !== 'select') return;
    const o = s.project!.objects.find((x) => x.id === id);
    if (!o || o.locked) return;
    if (o.type === 'strip' || o.type === 'line') { s.select([id]); s.setEditing({ id, nodes: [] }); }
    if (o.type === 'text') { s.select([id]); setTextEdit({ id }); }
  };
  const onContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    let id: string | null = null;
    let n: Konva.Node | null = e.target;
    while (n && n !== stage) { if (n.name() === 'obj') { id = n.id(); break; } n = n.getParent(); }
    const s = store.getState();
    if (!id && s.editing) id = s.editing.id; // right-click on a node / handle while editing
    if (id && !s.selection.includes(id)) s.select([id]);
    const rect = stage.container().getBoundingClientRect();
    const px = e.evt.clientX - rect.left, py = e.evt.clientY - rect.top;
    setCtxMenu({ x: px, y: py, id, w: toWorld(px, py) });
  };

  /** Split a path object at a world point: at a node if the point is on one, otherwise exactly at the nearest spot on the path. */
  const cutAt = (id: string, w: Vec2) => {
    const s = store.getState();
    const o = s.project!.objects.find((x) => x.id === id);
    if (!o || (o.type !== 'strip' && o.type !== 'line') || o.locked) return;
    const local = { x: w.x - o.x, y: w.y - o.y };
    const ni = o.path.nodes.findIndex((nd) => Math.hypot(nd.x - local.x, nd.y - local.y) < tol * 1.2);
    let parts: PathData[];
    if (ni >= 0) parts = cutAtNode(o.path, ni);
    else {
      const near = nearestOnPath(flatten(o.path, 0.2), local);
      if (near.t <= 1e-3 || near.t >= 1 - 1e-3) {
        const idx = near.t <= 1e-3 ? near.seg : (near.seg + 1) % o.path.nodes.length;
        parts = cutAtNode(o.path, idx);
      } else parts = cutPath(o.path, near.seg, near.t);
    }
    if (parts.length === 1 && !o.path.closed) return; // clicked on an open end: nothing to cut
    const out = parts.filter((p) => p.nodes.length >= 2).map((p, i) => normalizeOrigin({ ...o, id: uid(o.type === 'strip' ? 's' : 'l'), name: o.name ? `${o.name} ${i + 1}` : undefined, path: p } as StripObj | LineObj));
    s.replaceWith(o.id, out);
  };
  const onHover = (id: string | null) => store.getState().setHover(id);

  const onDragStart = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const s = store.getState();
    const alt = !!(e.evt as MouseEvent | undefined)?.altKey;
    if (!s.selection.includes(id)) s.select([id]);
    const items = new Map<string, Vec2>();
    const stage = stageRef.current!;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of s.project!.objects) {
      if ((s.selection.includes(o.id) || o.id === id) && !o.locked) {
        items.set(o.id, { x: o.x, y: o.y });
        const n = stage.findOne<Konva.Group>('#' + o.id);
        if (n) {
          const r = n.getClientRect({ relativeTo: stage as unknown as Konva.Container });
          x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
        }
      }
    }
    const samples = s.project!.objects.filter((o) => items.has(o.id)).flatMap((o) => outlineSamples(o, 16));
    dragStartRef.current = { id, items, box: { x0, y0, x1, y1 }, alt, samples };
    s.beginGesture();
  };
  const onDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const st = dragStartRef.current;
    if (!st || st.id !== id) return;
    const node = e.target as unknown as Konva.Group;
    const me = st.items.get(id)!;
    let dx = node.x() - me.x, dy = node.y() - me.y;
    const ev = e.evt as MouseEvent | undefined;
    if (ev?.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    if (snapOn && isFinite(st.box.x0)) {
      const es = snapOutline(st.samples.map((p) => ({ x: p.x + dx, y: p.y + dy })), dragTargets, tol);
      if (es.hit) {
        dx += es.dx; dy += es.dy;
        setSnapHint({ x: es.hit.x, y: es.hit.y, kind: 'edge' });
        setGuides([]);
      } else {
        setSnapHint(null);
        const moved = { x0: st.box.x0 + dx, y0: st.box.y0 + dy, x1: st.box.x1 + dx, y1: st.box.y1 + dy };
        const r = snapBox(moved, dragTargets.boxes, tol);
        dx += r.dx; dy += r.dy;
        setGuides(r.guides.map((g) => (g.axis === 'x' ? { ...g, from: Math.min(g.from, moved.y0 + r.dy), to: Math.max(g.to, moved.y1 + r.dy) } : { ...g, from: Math.min(g.from, moved.x0 + r.dx), to: Math.max(g.to, moved.x1 + r.dx) })));
      }
      node.position({ x: me.x + dx, y: me.y + dy });
    } else if (ev?.shiftKey) node.position({ x: me.x + dx, y: me.y + dy });
    // paint / tram slabs / rails live in the scene layer, so the store follows the drag live (one undo step at the end)
    store.getState().updateObjects([...st.items.entries()].map(([oid, p]) => ({ id: oid, patch: { x: p.x + dx, y: p.y + dy } })), { history: false });
  };
  const onDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const st = dragStartRef.current;
    setGuides([]); setSnapHint(null);
    if (!st || st.id !== id) return;
    dragStartRef.current = null;
    const node = e.target as unknown as Konva.Group;
    const me = st.items.get(id)!;
    const dx = node.x() - me.x, dy = node.y() - me.y;
    const s = store.getState();
    if (st.alt) {
      // Alt-drag = drag a copy: put the originals back and add the copies at the drop position
      const copies = s.project!.objects.filter((o) => st.items.has(o.id)).map((o) => ({ ...structuredClone(o), id: uid(), x: o.x, y: o.y }) as BzObject);
      s.updateObjects([...st.items.entries()].map(([oid, p]) => ({ id: oid, patch: { x: p.x, y: p.y } })), { history: false });
      s.addObjects(copies);
      s.endGesture();
      return;
    }
    s.updateObjects([...st.items.entries()].map(([oid, p]) => ({ id: oid, patch: { x: p.x + dx, y: p.y + dy } })), { history: false });
    s.endGesture();
  };

  const onTransformEnd = (id: string, node: Konva.Group) => {
    const s = store.getState();
    const obj = s.project!.objects.find((o) => o.id === id);
    if (!obj) return;
    const sx = node.scaleX(), sy = node.scaleY();
    const rot = node.rotation();
    node.scale({ x: 1, y: 1 });
    const base = { x: node.x(), y: node.y(), rotation: rot };
    let patch: Partial<BzObject>;
    switch (obj.type) {
      case 'symbol': patch = { ...base, width: Math.max(0.1, obj.width * Math.abs(sx)), height: Math.max(0.1, obj.height * Math.abs(sy)) } as Partial<BzObject>; break;
      case 'text': patch = { ...base, fontSize: Math.max(0.1, obj.fontSize * Math.abs(sy)) } as Partial<BzObject>; break;
      default: {
        // bake scale + rotation into the path, keep object rotation 0
        const r = (rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
        const path = transformPath(obj.path, (v) => { const x = v.x * sx, y = v.y * sy; return { x: x * c - y * sn, y: x * sn + y * c }; });
        node.rotation(0);
        patch = { x: base.x, y: base.y, rotation: 0, path } as Partial<BzObject>;
      }
    }
    transformBatch.current.push({ id, patch });
    if (transformBatch.current.length === 1) {
      queueMicrotask(() => { const b = transformBatch.current; transformBatch.current = []; s.updateObjects(b); });
    }
  };

  // ─── stage handlers
  const startPan = (px: number, py: number) => {
    const v = store.getState().viewport;
    panRef.current = { sx: px, sy: py, vx: v.x, vy: v.y };
    setPanActive(true);
  };
  useEffect(() => {
    if (!panActive) return;
    const move = (e: MouseEvent) => {
      const p = panRef.current; if (!p) return;
      const v = store.getState().viewport;
      store.getState().setViewport({ ...v, x: p.vx + (e.clientX - p.sx), y: p.vy + (e.clientY - p.sy) });
    };
    const up = () => { panRef.current = null; setPanActive(false); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [panActive, store]);

  // rubber band & pen/edit drags end anywhere in the window
  useEffect(() => {
    const up = (e: MouseEvent) => {
      if (rubber) {
        const r = rubber;
        setRubber(null);
        const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
        if (x1 - x0 < 3 && y1 - y0 < 3) return;
        const stage = stageRef.current!;
        const hits: string[] = [];
        for (const o of project.objects) {
          if (o.locked || o.visible === false) continue;
          const n = stage.findOne<Konva.Group>('#' + o.id);
          if (!n) continue;
          const cr = n.getClientRect();
          if (cr.x < x1 && cr.x + cr.width > x0 && cr.y < y1 && cr.y + cr.height > y0) hits.push(o.id);
        }
        const s = store.getState();
        const gids = new Set(project.objects.filter((o) => hits.includes(o.id) && o.groupId).map((o) => o.groupId));
        const withGroups = Array.from(new Set([...hits, ...project.objects.filter((o) => o.groupId && gids.has(o.groupId) && !o.locked).map((o) => o.id)]));
        s.select(e.shiftKey ? Array.from(new Set([...s.selection, ...withGroups])) : withGroups);
      }
      if (penDrag.current) penDrag.current = null;
      if (endDrag.current) { endDrag.current = null; setEndLabel(null); setSnapHint(null); store.getState().endGesture(); }
      if (editDrag.current) {
        const d = editDrag.current;
        editDrag.current = null;
        if ((d.moved || d.inserted) && editPathRef.current) commitEditPath(editPathRef.current);
        setSnapHint(null);
      }
      if (shapeDraft) {
        const d = shapeDraft;
        setShapeDraft(null);
        setSnapHint(null);
        if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < tol) return;
        let path: PathData;
        if (tool === 'line') {
          const lp = linePath({ x: d.x0, y: d.y0 }, { x: d.x1, y: d.y1 });
          path = { ...lp, nodes: traceNodes(lp.nodes, [shapeSnaps.current.a, shapeSnaps.current.b], false, drawHalfWidth) };
        } else if (tool === 'rect') path = rectPath(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.max(d.x0, d.x1), Math.max(d.y0, d.y1));
        else path = ellipsePath((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, Math.abs(d.x1 - d.x0) / 2, Math.abs(d.y1 - d.y0) / 2);
        shapeSnaps.current = { a: null, b: null };
        createFromPath(path, tool);
        store.getState().setTool('select');
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [rubber, shapeDraft, tool, tol, project.objects, store, createFromPath, commitEditPath, traceNodes, drawHalfWidth]);

  /** Adds a point to the pen/polygon draft (or closes/finishes it). Returns true when a new point was added. */
  const penClick = (w: Vec2): boolean => {
    const s = store.getState();
    if (tool === 'mark' && pending?.template.kind === 'laneMarking') { applyLaneMarking(w); return false; }
    const after = () => { if (tool !== 'mark') s.setTool('select'); };
    const last = draft.length ? draft[draft.length - 1] : null;
    if (draft.length >= 3) {
      const first = draft[0];
      if (Math.hypot(w.x - first.x, w.y - first.y) < tol) { finishDraft(true); after(); return false; }
    }
    if (last && Math.hypot(w.x - last.x, w.y - last.y) < tol) { finishDraft(false); after(); return false; }
    const { p: sp, r } = snapFull(w, last);
    setDraft([...draft, { x: sp.x, y: sp.y, mode: 'corner' }]);
    setDraftSnaps([...draftSnaps.slice(0, draft.length), r]);
    return true;
  };
  useEffect(() => { penClickRef.current = (w: Vec2) => { penClick(w); }; });

  // pen/polygon: a press that moves more than a few px turns into panning; otherwise it is a click
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const pr = penPress.current;
      if (!pr) return;
      if (Math.hypot(e.clientX - pr.cx, e.clientY - pr.cy) > 4) {
        penPress.current = null;
        startPan(pr.cx, pr.cy);
      }
    };
    const up = () => {
      const pr = penPress.current;
      if (!pr) return;
      penPress.current = null;
      penClickRef.current(pr.w);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripAt = (w: Vec2, excludeId?: string): StripObj | null => {
    const objs = store.getState().project!.objects;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (o.type !== 'strip' || o.id === excludeId || o.visible === false || o.path.nodes.length < 2) continue;
      const r = (-o.rotation * Math.PI) / 180, dx = w.x - o.x, dy = w.y - o.y;
      const local = { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
      if (pointInPolygon(local, hitPolygon(o))) return o;
    }
    return null;
  };
  const doTaper = (w: Vec2): boolean => {
    if (!joinPick) return false;
    const s = store.getState();
    const a = s.project!.objects.find((o) => o.id === joinPick.id);
    const b = stripAt(w, joinPick.id);
    if (!a || a.type !== 'strip' || !b) return false;
    const t = taperInto(a, joinPick.atStart, b, w);
    if (!t) return false;
    const gid = a.groupId ?? uid('g');
    s.replaceMany([{ ...a, groupId: gid }], [{ ...t, groupId: gid }], a.id, [t.id]);
    return true;
  };

  /** Link tool: end A, then end B → a NEW connecting piece (A and B stay as they are). */
  const onJoinEnd = (id: string, atStart: boolean, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const s = store.getState();
    if (!joinPick) { setJoinPick({ id, atStart }); return; }
    if (joinPick.id === id && joinPick.atStart === atStart) { setJoinPick(null); return; }
    const a = s.project!.objects.find((o) => o.id === joinPick.id) as PathObj | undefined;
    const b = s.project!.objects.find((o) => o.id === id) as PathObj | undefined;
    setJoinPick(null); setJoinHover(null);
    if (!a || !b) return;
    const m = linkBetween(a, joinPick.atStart, b, atStart);
    if (m) s.addObject(m);
  };

  /** Marking tool with a lane marking picked (arrows, BUS, bicycle…): put it on the lane under the cursor. */
  const applyLaneMarking = (w: Vec2) => {
    const s = store.getState();
    if (pending?.template.kind !== 'laneMarking') return;
    const strip = stripAt(w);
    if (!strip || strip.locked) return;
    const marking = pending.template.marking;
    const lanes = strip.spec.lanes.map((l) => ({ ...l, marking }));
    const lanesEnd = strip.spec.lanesEnd?.map((l) => ({ ...l, marking }));
    s.updateObject(strip.id, { spec: { ...strip.spec, lanes, lanesEnd } } as Partial<BzObject>);
  };

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current!;
    const me = e.evt;
    const p = stage.getPointerPosition();
    if (!p) return;
    if (me.button === 1 || spaceDown || tool === 'hand') { startPan(me.clientX, me.clientY); return; }
    if (me.button !== 0) return;
    const w = toWorld(p.x, p.y);
    const onEmpty = e.target === stage || e.target.name() === 'bg';
    const s = store.getState();
    setCtxMenu(null);
    switch (tool) {
      case 'select': {
        if (!onEmpty) return;
        if (s.editing) { s.setEditing(null); return; }
        if (!(me.shiftKey || me.ctrlKey || me.metaKey)) s.select([]);
        setRubber({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        return;
      }
      case 'text': {
        me.preventDefault(); // keep focus on the inline editor we are about to mount
        const t = textObject(w.x, w.y, '');
        s.addObject(t);
        s.setTool('select');
        setTextEdit({ id: t.id });
        return;
      }
      case 'link': {
        // with an end picked: clicking a lane's body merges the end INTO that lane (klin); empty space cancels
        doTaper(w);
        setJoinPick(null); setJoinBody(null);
        return;
      }
      case 'measure': {
        if (measurePts.length >= 4) { setMeasurePts([w.x, w.y]); onMeasure?.(null); return; }
        const pts = [...measurePts, w.x, w.y];
        setMeasurePts(pts);
        if (pts.length === 4) onMeasure?.(Math.hypot(pts[2] - pts[0], pts[3] - pts[1]));
        return;
      }
      case 'pen': case 'polygon': case 'mark': {
        if (me.altKey && !(tool === 'mark' && pending?.template.kind === 'laneMarking')) {
          // Alt + drag: place a point and pull out curve handles (smooth node)
          if (penClick(w)) {
            const last = draft.length ? draft[draft.length - 1] : null;
            const sp = snapWorld(w, last);
            penDrag.current = { idx: draft.length, start: sp, moved: false };
          }
          return;
        }
        // plain press: decided on release (click = point) or on move (drag = pan the map)
        penPress.current = { cx: me.clientX, cy: me.clientY, w };
        return;
      }
      case 'line': case 'rect': case 'ellipse': {
        const { p: sp, r } = snapFull(w, null, false);
        shapeSnaps.current = { a: r, b: null };
        setShapeDraft({ x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y });
        return;
      }
    }
  };

  const onStageMouseMove = () => {
    const stage = stageRef.current!;
    const p = stage.getPointerPosition();
    if (!p) return;
    if (panRef.current || spaceDown || penPress.current) return; // panning (or maybe about to): keep the rubber-band segment fixed in the world
    const w = toWorld(p.x, p.y);
    setCursor(w);
    if (rubber) { setRubber({ ...rubber, x1: p.x, y1: p.y }); return; }
    if (endDrag.current) {
      const d = endDrag.current;
      const s = store.getState();
      const o = s.project!.objects.find((x) => x.id === d.id);
      if (!o || (o.type !== 'strip' && o.type !== 'line')) return;
      let path: PathData;
      if (altDown) {
        // free move of the end node (with snapping)
        const sw = snapWorld(w, null, false);
        const nodes = d.base.nodes.map((n) => ({ ...n }));
        const i = d.atStart ? 0 : nodes.length - 1;
        const n = nodes[i];
        const lx = sw.x - d.baseX, ly = sw.y - d.baseY;
        const dx = lx - n.x, dy = ly - n.y;
        nodes[i] = { ...n, x: lx, y: ly, hIn: n.hIn && { x: n.hIn.x + dx, y: n.hIn.y + dy }, hOut: n.hOut && { x: n.hOut.x + dx, y: n.hOut.y + dy } };
        path = { ...d.base, nodes };
      } else {
        const proj = (w.x - d.start.x) * d.out.x + (w.y - d.start.y) * d.out.y;
        let len = Math.max(0.5, d.len + proj);
        if (shiftDown) len = Math.max(1, Math.round(len));
        else if (snapOn) {
          // align the end with nearby ends / nodes of other objects (projected onto this road's axis)
          let bestT: number | null = null, bestErr = tol, hit: Vec2 | null = null;
          for (const pt of dragTargets.points) {
            const rx = pt.x - d.endPt.x, ry = pt.y - d.endPt.y;
            const t = rx * d.out.x + ry * d.out.y;
            const lat = Math.abs(rx * d.out.y - ry * d.out.x);
            if (lat > 30) continue;
            const err = Math.abs(t - proj);
            if (err < bestErr) { bestErr = err; bestT = t; hit = pt; }
          }
          if (bestT !== null && hit) {
            len = Math.max(0.5, d.len + bestT);
            setSnapHint({ x: hit.x, y: hit.y, kind: 'point' });
          } else setSnapHint(null);
        }
        path = setPathLength(d.base, len, d.atStart);
      }
      const next = normalizeOrigin({ ...o, x: d.baseX, y: d.baseY, path } as StripObj | LineObj);
      const L = flatten(path, 0.5).length;
      const patches: Array<{ id: string; patch: Partial<BzObject> }> = [{ id: o.id, patch: { x: next.x, y: next.y, path: next.path } as Partial<BzObject> }];
      if (!altDown && d.others.length) {
        const delta = L - d.len;
        for (const r of d.others) {
          const y = s.project!.objects.find((x) => x.id === r.id);
          if (!y || (y.type !== 'strip' && y.type !== 'line')) continue;
          const yp = setPathLength(r.base, Math.max(0.5, r.len + delta), r.atStart);
          const yn = normalizeOrigin({ ...y, x: r.baseX, y: r.baseY, path: yp } as StripObj | LineObj);
          patches.push({ id: y.id, patch: { x: yn.x, y: yn.y, path: yn.path } as Partial<BzObject> });
        }
      }
      s.updateObjects(patches, { history: false });
      setEndLabel({ x: w.x, y: w.y, text: formatLength(L, project.units) });
      return;
    }
    if (penDrag.current) {
      const d = penDrag.current;
      const dist = Math.hypot(w.x - d.start.x, w.y - d.start.y);
      if (!d.moved && dist < tol / 2) return;
      d.moved = true;
      const hOut = shiftDown ? snapAngle(d.start, w) : w;
      setDraft((cur) => cur.map((n, i) => (i === d.idx ? { ...n, mode: altDown ? 'corner' : 'smooth', hOut, hIn: altDown ? n.hIn : { x: 2 * d.start.x - hOut.x, y: 2 * d.start.y - hOut.y } } : n)));
      return;
    }
    if (shapeDraft) {
      const sf = snapFull(w, { x: shapeDraft.x0, y: shapeDraft.y0 }, tool === 'line');
      shapeSnaps.current.b = sf.r;
      let end = sf.p;
      if (shiftDown && tool !== 'line') {
        const dx = end.x - shapeDraft.x0, dy = end.y - shapeDraft.y0;
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        end = { x: shapeDraft.x0 + Math.sign(dx) * m, y: shapeDraft.y0 + Math.sign(dy) * m };
      }
      setShapeDraft({ ...shapeDraft, x1: end.x, y1: end.y });
      return;
    }
    if (editDrag.current && editingObj) {
      const d = editDrag.current;
      const local = { x: w.x - editingObj.x, y: w.y - editingObj.y };
      const dist = Math.hypot(w.x - d.start.x, w.y - d.start.y);
      if (!d.moved && dist < tol / 3) return;
      d.moved = true;
      const p0 = d.path;
      const nodes = p0.nodes.map((n) => ({ ...n }));
      const n = nodes[d.idx];
      if (d.kind === 'node') {
        const sw = snapWorld(w, null, false, editingObj.type === 'strip' ? specWidth(editingObj.spec.lanes) / 2 : 0);
        const nx = sw.x - editingObj.x, ny = sw.y - editingObj.y;
        const ddx = nx - n.x, ddy = ny - n.y;
        const sel = new Set(store.getState().editing?.nodes ?? [d.idx]);
        sel.add(d.idx);
        for (const i of sel) {
          const m = nodes[i];
          nodes[i] = { ...m, x: m.x + ddx, y: m.y + ddy, hIn: m.hIn && { x: m.hIn.x + ddx, y: m.hIn.y + ddy }, hOut: m.hOut && { x: m.hOut.x + ddx, y: m.hOut.y + ddy } };
        }
      } else {
        const h = shiftDown ? snapAngle({ x: n.x, y: n.y }, local) : local;
        const other = d.kind === 'hIn' ? 'hOut' : 'hIn';
        nodes[d.idx] = { ...n, [d.kind]: h } as PathNode;
        if (!altDown && n.mode !== 'corner' && n[other]) {
          const len = Math.hypot(n[other]!.x - n.x, n[other]!.y - n.y);
          const dirx = n.x - h.x, diry = n.y - h.y;
          const dl = Math.hypot(dirx, diry) || 1;
          (nodes[d.idx] as PathNode)[other] = { x: n.x + (dirx / dl) * len, y: n.y + (diry / dl) * len };
        } else if (altDown) nodes[d.idx].mode = 'corner';
      }
      const next = { ...p0, nodes };
      editPathRef.current = next;
      setEditPath(next);
      return;
    }
    if (editingObj && editPathRef.current && (editingObj.type === 'strip' || editingObj.type === 'line')) {
      const f = flatten(editPathRef.current, 0.3);
      const n = nearestOnPath(f, { x: w.x - editingObj.x, y: w.y - editingObj.y });
      const half = editingObj.type === 'strip' ? specWidth(editingObj.spec.lanes) / 2 : 0;
      const nearNode = editPathRef.current.nodes.some((nd) => Math.hypot(nd.x - n.x, nd.y - n.y) < tol * 1.2);
      setInsertHint(n.dist < Math.max(tol * 1.5, half) && !nearNode ? { x: n.x + editingObj.x, y: n.y + editingObj.y } : null);
    } else if (insertHint) setInsertHint(null);
    if (tool === 'link') {
      if (joinPick && !joinHover) {
        const hit = stripAt(w, joinPick.id);
        if (!hit) { if (joinBody) setJoinBody(null); }
        else if (!joinBody || joinBody.id !== hit.id || Math.hypot(joinBody.w.x - w.x, joinBody.w.y - w.y) > 0.25) setJoinBody({ id: hit.id, w });
      } else if (joinBody) setJoinBody(null);
      return;
    }
    if ((tool === 'pen' || tool === 'polygon' || tool === 'mark') && draft.length) snapWorld(w, draft[draft.length - 1]);
    else if (tool === 'mark' && pending?.template.kind === 'laneMarking') { if (snapHint) setSnapHint(null); }
    else if (tool === 'pen' || tool === 'polygon' || tool === 'mark' || tool === 'line' || tool === 'rect' || tool === 'ellipse') snapWorld(w, null, false);
  };

  // end handles of a selected path: drag along the road axis = shorten / extend; Alt = free move
  const onEndDown = (obj: StripObj | LineObj, atStart: boolean, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const w = pointer(); if (!w) return;
    const f = flatten(obj.path, 0.25);
    const smp = atStart ? f.pts[0] : f.pts[f.pts.length - 1];
    const out = atStart ? { x: -smp.tx, y: -smp.ty } : { x: smp.tx, y: smp.ty };
    const endPt = { x: obj.x + smp.x, y: obj.y + smp.y };
    const others: EndRef[] = [];
    const st = store.getState();
    for (const y of st.project!.objects) {
      if (y.id === obj.id || !st.selection.includes(y.id) || (y.type !== 'strip' && y.type !== 'line') || y.path.closed || y.locked || y.path.nodes.length < 2) continue;
      const a = y.path.nodes[0], b = y.path.nodes[y.path.nodes.length - 1];
      const da = Math.hypot(y.x + a.x - endPt.x, y.y + a.y - endPt.y), db = Math.hypot(y.x + b.x - endPt.x, y.y + b.y - endPt.y);
      others.push({ id: y.id, atStart: da < db, base: y.path, baseX: y.x, baseY: y.y, len: flatten(y.path, 0.25).length });
    }
    endDrag.current = { id: obj.id, atStart, base: obj.path, baseX: obj.x, baseY: obj.y, len: f.length, start: w, out, endPt, others };
    store.getState().beginGesture();
  };

  // node / handle mouse down (edit mode)
  const onNodeDown = (kind: EditDrag['kind'], idx: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const s = store.getState();
    if (!s.editing || !editPathRef.current) return;
    const w = pointer(); if (!w) return;
    if (kind === 'node') {
      const sel = s.editing.nodes;
      if (e.evt.shiftKey) s.setEditing({ ...s.editing, nodes: sel.includes(idx) ? sel.filter((i) => i !== idx) : [...sel, idx] });
      else if (!sel.includes(idx)) s.setEditing({ ...s.editing, nodes: [idx] });
    }
    editDrag.current = { kind, idx, start: w, path: editPathRef.current, moved: false };
  };
  const onNodeDblClick = (idx: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const p = editPathRef.current; if (!p) return;
    const n = p.nodes[idx];
    const next = n.hIn || n.hOut ? cornerNode(p, idx) : smoothNode(p, idx);
    commitEditPath(next);
  };

  // ─── derived
  const panning = tool === 'hand' || spaceDown || panActive;
  const cursorStyle = panning ? (panActive ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
  const gs = gridStep(viewport.scale);
  const inv = 1 / viewport.scale;

  // draft preview object (pen) rendered with the real renderer
  const previewObj = useMemo(() => {
    if (!draft.length) return null;
    const withCursor = !!cursor && !penDrag.current;
    const cursorPt = withCursor && snapHint ? { x: snapHint.x, y: snapHint.y } : cursor;
    const raw = withCursor && cursorPt ? [...draft, { x: cursorPt.x, y: cursorPt.y, mode: 'corner' as const }] : draft;
    if (raw.length < 2) return null;
    const snaps = [...draftSnaps.slice(0, draft.length), withCursor ? snapHint : null];
    const curved = tool === 'mark' && markCurve ? curveBetweenEdges(raw, snaps, false) : raw;
    const nodes = traceNodes(curved, snaps, false, drawHalfWidth);
    const preset = templateFor(tool === 'polygon' ? 'polygon' : tool === 'mark' ? 'mark' : 'pen');
    if (!preset) return null;
    try { return objectFromTemplate(preset, { nodes, closed: tool === 'polygon' && nodes.length >= 3 }); } catch { return null; }
  }, [draft, draftSnaps, cursor, snapHint, templateFor, tool, traceNodes, drawHalfWidth, markCurve]);
  const shapePreviewObj = useMemo(() => {
    if (!shapeDraft) return null;
    const d = shapeDraft;
    let path: PathData;
    if (tool === 'line') path = linePath({ x: d.x0, y: d.y0 }, { x: d.x1, y: d.y1 });
    else if (tool === 'rect') path = rectPath(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.max(d.x0, d.x1), Math.max(d.y0, d.y1));
    else path = ellipsePath((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, Math.abs(d.x1 - d.x0) / 2, Math.abs(d.y1 - d.y0) / 2);
    const preset = templateFor(tool);
    if (!preset) return null;
    if (preset.template.kind === 'line' && preset.template.closedOnly) path = { ...path, closed: true };
    try { return objectFromTemplate(preset, path); } catch { return null; }
  }, [shapeDraft, tool, templateFor]);

  const joinPreview = useMemo(() => {
    if (tool !== 'link' || !joinPick) return null;
    if (!joinHover && joinBody) {
      const a = project.objects.find((o) => o.id === joinPick.id);
      const b = project.objects.find((o) => o.id === joinBody.id);
      if (a?.type === 'strip' && b?.type === 'strip') return taperInto(a, joinPick.atStart, b, joinBody.w);
      return null;
    }
    if (!joinHover) return null;
    if (joinPick.id === joinHover.id && joinPick.atStart === joinHover.atStart) return null;
    const a = project.objects.find((o) => o.id === joinPick.id) as PathObj | undefined;
    const b = project.objects.find((o) => o.id === joinHover.id) as PathObj | undefined;
    if (!a || !b) return null;
    return linkBetween(a, joinPick.atStart, b, joinHover.atStart);
  }, [tool, joinPick, joinHover, joinBody, project.objects]);

  // marking tool: the "slots" (ends of strip edges) you can snap to
  const markSlots = useMemo(() => (tool === 'mark' ? snapTargets.points.filter((p) => p.kind === 'corner' && p.poly?.role === 'edge') : []), [tool, snapTargets]);

  // scene layer: tram bands (3), paint (4) and rails (5) of every object, in category order
  const drawables = useMemo(() => sortByRank(project.objects.filter((o): o is Drawable => o.type !== 'symbol')), [project.objects]);
  const symbolObjs = useMemo(() => sortByRank(project.objects.filter((o) => o.type === 'symbol')), [project.objects]);
  const caps = useMemo(() => computeCaps(project.objects), [project.objects]);
  const roadPolys = useMemo(() => roadwayPolygons(project.objects), [project.objects]);
  const sceneFunc = useCallback((context: Konva.Context) => {
    const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
    const each = (fn: (o: Drawable) => void) => {
      for (const o of drawables) {
        if (o.visible === false) continue;
        ctx.save();
        ctx.translate(o.x, o.y);
        if (o.rotation) ctx.rotate((o.rotation * Math.PI) / 180);
        if (o.opacity !== undefined) ctx.globalAlpha *= o.opacity;
        fn(o);
        ctx.restore();
      }
    };
    each((o) => { if (o.type === 'strip' && isTramStrip(o)) drawTramBand(ctx, o, roadPolys, caps.get(o.id)); });
    each((o) => drawMarkings(ctx, o));
    each((o) => { if (o.type === 'strip' && isTramStrip(o)) drawRails(ctx, o); });
  }, [drawables, roadPolys, caps]);

  const hoverObj = useMemo(() => (hoverId && !selection.includes(hoverId) && tool === 'select' && !editing ? project.objects.find((o) => o.id === hoverId) ?? null : null), [hoverId, selection, project.objects, tool, editing]);
  const hoverPoly = useMemo(() => (hoverObj ? hitPolygon(hoverObj) : null), [hoverObj]);

  const editVisual = editPath && editingObj ? editPath : null;
  const editSel = new Set(editing?.nodes ?? []);

  return (
    <div ref={containerRef} className="board" style={{ cursor: cursorStyle }}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseLeave={() => setCursor(null)}
        onContextMenu={onContextMenu}
      >
        <Layer listening={!panning} name="bgLayer">
          <Rect name="bg" x={-1e5} y={-1e5} width={2e5} height={2e5} fill="#e5e5e5" />
          <Rect name="bg" x={0} y={0} width={project.widthM} height={project.heightM} fill={project.background.kind === 'blank' ? project.background.color : '#1b1f24'} shadowColor="rgba(0,0,0,.25)" shadowBlur={12 * inv} shadowOffsetY={2 * inv} />
          {project.background.kind === 'image' && bgImg && (
            <KImage name="bg" image={bgImg} x={0} y={0} width={project.background.widthM} height={project.background.heightM} opacity={project.background.opacity ?? 1} />
          )}
          {showGrid && (
            <Shape listening={false} sceneFunc={(context) => {
              const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
              ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = inv; ctx.beginPath();
              for (let x = 0; x <= project.widthM; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, project.heightM); }
              for (let y = 0; y <= project.heightM; y += gs) { ctx.moveTo(0, y); ctx.lineTo(project.widthM, y); }
              ctx.stroke(); ctx.restore();
            }} />
          )}
        </Layer>

        {/* surfaces (asphalt, lanes, crossing backgrounds) + hit areas of every non-symbol object, bottom category first */}
        <Layer ref={objLayerRef} name="objects" listening={!panning && (tool === 'select')}>
          {drawables.map((o) => (
            <ObjectNode key={o.id} obj={o} caps={caps.get(o.id)} draggable={tool === 'select' && !panning && !editing} listening={!editing || editing.id === o.id}
              onMouseDown={onObjMouseDown} onDblClick={onObjDblClick} onHover={onHover}
              onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd} />
          ))}
        </Layer>
        {/* tram bands with crossing slabs, then ALL paint, then rails — always above every surface */}
        <Layer name="scene" listening={false}>
          <Shape sceneFunc={sceneFunc} listening={false} perfectDrawEnabled={false} />
        </Layer>
        <Layer name="symbols" listening={!panning && (tool === 'select')}>
          {symbolObjs.map((o) => (
            <ObjectNode key={o.id} obj={o} draggable={tool === 'select' && !panning && !editing} listening={!editing}
              onMouseDown={onObjMouseDown} onDblClick={onObjDblClick} onHover={onHover}
              onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd} />
          ))}
        </Layer>

        <Layer name="overlay">
          {/* previews */}
          {previewObj && <PreviewNode obj={previewObj} />}
          {shapePreviewObj && <PreviewNode obj={shapePreviewObj} />}
          {draft.length > 0 && (
            <Group listening={false}>
              {draft.map((n, i) => (
                <Group key={i}>
                  {n.hIn && <Line points={[n.hIn.x, n.hIn.y, n.x, n.y]} stroke={ACCENT} strokeWidth={inv} />}
                  {n.hOut && <Line points={[n.x, n.y, n.hOut.x, n.hOut.y]} stroke={ACCENT} strokeWidth={inv} />}
                  {n.hIn && <Circle x={n.hIn.x} y={n.hIn.y} radius={3 * inv} fill="#fff" stroke={ACCENT} strokeWidth={inv} />}
                  {n.hOut && <Circle x={n.hOut.x} y={n.hOut.y} radius={3 * inv} fill="#fff" stroke={ACCENT} strokeWidth={inv} />}
                  <Rect x={n.x - 3.5 * inv} y={n.y - 3.5 * inv} width={7 * inv} height={7 * inv} fill={i === 0 ? ACCENT : '#fff'} stroke={ACCENT} strokeWidth={inv} />
                </Group>
              ))}
            </Group>
          )}

          {/* hover outline */}
          {hoverObj && hoverPoly && hoverPoly.length > 2 && (
            <Line listening={false} x={hoverObj.x} y={hoverObj.y} rotation={hoverObj.rotation} points={hoverPoly.flatMap((p) => [p.x, p.y])} closed stroke={ACCENT} strokeWidth={1.5 * inv} />
          )}

          {/* node editing */}
          {editVisual && editingObj && (
            <Group x={editingObj.x} y={editingObj.y}>
              <Line listening={false} points={flatten(editVisual, 0.3).pts.flatMap((p) => [p.x, p.y])} closed={editVisual.closed} stroke={ACCENT} strokeWidth={inv} opacity={0.9} />
              {editVisual.nodes.map((n, i) => {
                const show = editSel.has(i) || editSel.has(i - 1) || editSel.has(i + 1) || (editVisual.closed && (editSel.has((i + 1) % editVisual.nodes.length) || editSel.has((i - 1 + editVisual.nodes.length) % editVisual.nodes.length)));
                return (
                  <Group key={i}>
                    {show && n.hIn && <Line listening={false} points={[n.hIn.x, n.hIn.y, n.x, n.y]} stroke={ACCENT} strokeWidth={inv} />}
                    {show && n.hOut && <Line listening={false} points={[n.x, n.y, n.hOut.x, n.hOut.y]} stroke={ACCENT} strokeWidth={inv} />}
                    {show && n.hIn && <Circle x={n.hIn.x} y={n.hIn.y} radius={3.5 * inv} fill="#fff" stroke={ACCENT} strokeWidth={inv} onMouseDown={(e) => onNodeDown('hIn', i, e)} />}
                    {show && n.hOut && <Circle x={n.hOut.x} y={n.hOut.y} radius={3.5 * inv} fill="#fff" stroke={ACCENT} strokeWidth={inv} onMouseDown={(e) => onNodeDown('hOut', i, e)} />}
                    <Rect x={n.x - 4 * inv} y={n.y - 4 * inv} width={8 * inv} height={8 * inv} fill={editSel.has(i) ? ACCENT : '#fff'} stroke={ACCENT} strokeWidth={inv}
                      onMouseDown={(e) => onNodeDown('node', i, e)} onDblClick={(e) => onNodeDblClick(i, e)} />
                  </Group>
                );
              })}
            </Group>
          )}

          {insertHint && editing && !editDrag.current && (
            <Circle listening={false} x={insertHint.x} y={insertHint.y} radius={4 * inv} fill="#fff" stroke={ACCENT} strokeWidth={1.5 * inv} />
          )}

          {/* marking tool: slots on strip-edge ends (hidden while a lane marking is picked) */}
          {tool === 'mark' && pending?.template.kind !== 'laneMarking' && markSlots.map((p, i) => (
            <Circle key={i} listening={false} x={p.x} y={p.y} radius={3.5 * inv} fill="#fff" stroke={ACCENT} strokeWidth={inv} opacity={0.9} />
          ))}

          {/* link tool: dots on every free end; preview of the connecting piece */}
          {joinPreview && <PreviewNode obj={joinPreview} />}
          {tool === 'link' && project.objects.map((o) => {
            if ((o.type !== 'strip' && o.type !== 'line') || o.path.closed || o.locked || o.visible === false || o.path.nodes.length < 2) return null;
            return [true, false].map((atStart) => {
              const p = endPoint(o, atStart);
              const picked = joinPick?.id === o.id && joinPick.atStart === atStart;
              const hovered = joinHover?.id === o.id && joinHover.atStart === atStart;
              const compatible = !joinPick || (project.objects.find((x) => x.id === joinPick.id)?.type === o.type);
              return (
                <Circle key={o.id + String(atStart)} x={p.x} y={p.y} radius={(hovered || picked ? 7 : 5.5) * inv}
                  fill={picked ? ACCENT : '#fff'} stroke={compatible ? ACCENT : '#bbb'} strokeWidth={2 * inv}
                  onMouseDown={(e) => { if (compatible) onJoinEnd(o.id, atStart, e); else e.cancelBubble = true; }}
                  onMouseEnter={() => setJoinHover({ id: o.id, atStart })} onMouseLeave={() => setJoinHover(null)} />
              );
            });
          })}

          {/* single selected path: outline + end handles (no bounding box) */}
          {(() => {
            if (editing || tool !== 'select' || selectedObjs.length === 0 || selectedObjs.length > 40) return null;
            return selectedObjs.map((o) => {
            if (o.type !== 'strip' && o.type !== 'line') return null;
            const outline = hitPolygon(o, 0.05);
            const center = flatten(o.path, 0.4).pts;
            const first = o.path.nodes[0], last = o.path.nodes[o.path.nodes.length - 1];
            const H = 9 * inv;
            return (
              <Group x={o.x} y={o.y} key={o.id}>
                {outline.length > 2 && <Line listening={false} points={outline.flatMap((p) => [p.x, p.y])} closed stroke={ACCENT} strokeWidth={1.5 * inv} />}
                {center.length > 1 && <Line listening={false} points={center.flatMap((p) => [p.x, p.y])} closed={o.path.closed} stroke={ACCENT} strokeWidth={inv} dash={[4 * inv, 3 * inv]} opacity={0.8} />}
                {!o.path.closed && !o.locked && o.path.nodes.length >= 2 && [true, false].map((atStart) => {
                  const n = atStart ? first : last;
                  return (
                    <Rect key={String(atStart)} x={n.x - H / 2} y={n.y - H / 2} width={H} height={H} fill="#fff" stroke={ACCENT} strokeWidth={1.5 * inv} cornerRadius={1.5 * inv}
                      onMouseDown={(e) => onEndDown(o, atStart, e)}
                      onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'ew-resize'; }}
                      onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ''; }} />
                  );
                })}
              </Group>
            );
            }).map((el, i) => <Group key={selectedObjs[i]?.id ?? i}>{el}</Group>);
          })()}
          {endLabel && (
            <Group listening={false} x={endLabel.x + 12 * inv} y={endLabel.y + 12 * inv}>
              <Rect width={70 * inv} height={20 * inv} fill={ACCENT} cornerRadius={4 * inv} />
              <Text text={endLabel.text} width={70 * inv} height={20 * inv} align="center" verticalAlign="middle" fontSize={11 * inv} fill="#fff" fontStyle="bold" />
            </Group>
          )}

          {/* transformer */}
          <Transformer ref={trRef} rotateEnabled rotationSnaps={snapRotation ? Array.from({ length: 24 }, (_, i) => i * 15) : []} rotationSnapTolerance={4}
            enabledAnchors={anchors} keepRatio={keepRatio} ignoreStroke anchorSize={8} anchorStroke={ACCENT} anchorFill="#fff" anchorCornerRadius={1}
            borderStroke={ACCENT} borderStrokeWidth={1} rotateAnchorOffset={24} flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 2 || newBox.height < 2 ? oldBox : newBox)} />

          {/* rubber band */}
          {rubber && (
            <Rect x={(Math.min(rubber.x0, rubber.x1) - viewport.x) * inv} y={(Math.min(rubber.y0, rubber.y1) - viewport.y) * inv}
              width={Math.abs(rubber.x1 - rubber.x0) * inv} height={Math.abs(rubber.y1 - rubber.y0) * inv}
              fill="rgba(13,153,255,0.1)" stroke={ACCENT} strokeWidth={inv} listening={false} />
          )}

          {/* snap feedback */}
          {snapHint?.poly && (
            <Line listening={false} points={snapHint.poly.pts.flatMap((p) => [p.x, p.y])} closed={snapHint.poly.closed} stroke={GUIDE} strokeWidth={1.5 * inv} opacity={0.75} />
          )}
          {snapHint?.guide && (
            <Line listening={false} points={[snapHint.guide[0].x, snapHint.guide[0].y, snapHint.guide[1].x, snapHint.guide[1].y]} stroke={GUIDE} strokeWidth={1.5 * inv} dash={[5 * inv, 3 * inv]} />
          )}
          {snapHint && (
            <Group listening={false}>
              <Line points={[snapHint.x - 6 * inv, snapHint.y, snapHint.x + 6 * inv, snapHint.y]} stroke={GUIDE} strokeWidth={inv} />
              <Line points={[snapHint.x, snapHint.y - 6 * inv, snapHint.x, snapHint.y + 6 * inv]} stroke={GUIDE} strokeWidth={inv} />
              {snapHint.kind === 'point' && <Circle x={snapHint.x} y={snapHint.y} radius={5 * inv} stroke={GUIDE} strokeWidth={inv} />}
            </Group>
          )}
          {guides.map((g, i) => (
            <Line key={i} listening={false} points={g.axis === 'x' ? [g.at, g.from, g.at, g.to] : [g.from, g.at, g.to, g.at]} stroke={GUIDE} strokeWidth={inv} />
          ))}

          {/* measure */}
          {measurePts.length >= 2 && (
            <Group listening={false}>
              <Line points={measurePts.length === 4 ? measurePts : cursor ? [...measurePts, cursor.x, cursor.y] : measurePts} stroke={ACCENT} strokeWidth={2 * inv} dash={[6 * inv, 4 * inv]} />
              {measurePts.length === 4 && (
                <Text x={(measurePts[0] + measurePts[2]) / 2} y={(measurePts[1] + measurePts[3]) / 2 - 18 * inv} text={formatLength(Math.hypot(measurePts[2] - measurePts[0], measurePts[3] - measurePts[1]), project.units)} fontSize={12 * inv} fill="#fff" padding={4 * inv} fontStyle="bold" />
              )}
            </Group>
          )}

          {/* locked selection outline */}
          {selectedObjs.filter((o) => o.locked).map((o) => { const b = objectBounds(o); return <Rect key={o.id} x={o.x} y={o.y} rotation={o.rotation} offsetX={-b.x} offsetY={-b.y} width={b.w} height={b.h} stroke="#888" dash={[4 * inv, 4 * inv]} strokeWidth={inv} listening={false} />; })}
        </Layer>
      </Stage>
      {ctxMenu && <ContextMenu at={ctxMenu} onClose={() => setCtxMenu(null)} onPaste={pasteClipboard} onCopy={() => { const s = store.getState(); clipboard = s.project!.objects.filter((o) => s.selection.includes(o.id)).map((o) => structuredClone(o)); }} onEdit={(id) => { store.getState().setEditing({ id, nodes: [] }); }} onEditText={(id) => setTextEdit({ id })} onCut={(id) => cutAt(id, ctxMenu.w)} />}
      {textEdit && <InlineText id={textEdit.id} onDone={() => setTextEdit(null)} />}
    </div>
  );
}

function ContextMenu({ at, onClose, onPaste, onCopy, onEdit, onEditText, onCut }: { at: { x: number; y: number; id: string | null }; onClose: () => void; onPaste: () => void; onCopy: () => void; onEdit: (id: string) => void; onEditText: (id: string) => void; onCut: (id: string) => void }) {
  const s = useProject.getState();
  const sel = s.selection;
  const obj = at.id ? s.project!.objects.find((o) => o.id === at.id) : null;
  const run = (fn: () => void) => () => { fn(); onClose(); };
  const locked = sel.length > 0 && s.project!.objects.filter((o) => sel.includes(o.id)).every((o) => o.locked);
  return (
    <div className="ctx-menu" style={{ left: at.x, top: at.y }} onMouseLeave={onClose} onContextMenu={(e) => e.preventDefault()}>
      {obj && (obj.type === 'strip' || obj.type === 'line') && !obj.locked && <button onClick={run(() => onCut(obj.id))}>Przetnij tutaj</button>}
      {obj && (obj.type === 'strip' || obj.type === 'line') && <button onClick={run(() => onEdit(obj.id))}>Edytuj węzły <kbd>Enter</kbd></button>}
      {obj && obj.type === 'text' && <button onClick={run(() => onEditText(obj.id))}>Edytuj tekst</button>}
      {(() => {
        const ps = s.project!.objects.filter((o) => sel.includes(o.id) && (o.type === 'strip' || o.type === 'line') && !o.path.closed) as PathObj[];
        if (ps.length < 2 || !ps.every((o) => o.type === ps[0].type)) return null;
        return <button onClick={run(() => { const r = mergeChain(ps); if (r) s.mergeObjects(r.merged, r.removed); })}>Scal w jeden obiekt</button>;
      })()}
      {sel.length > 1 && <button onClick={run(() => s.group(sel))}>Grupuj <kbd>Ctrl G</kbd></button>}
      {s.project!.objects.some((o) => sel.includes(o.id) && o.groupId) && <button onClick={run(() => s.ungroup(sel))}>Rozgrupuj <kbd>Ctrl Shift G</kbd></button>}
      {sel.length > 0 && <button onClick={run(onCopy)}>Kopiuj <kbd>Ctrl C</kbd></button>}
      <button onClick={run(onPaste)} disabled={!clipboard.length}>Wklej <kbd>Ctrl V</kbd></button>
      {sel.length > 0 && <button onClick={run(() => s.duplicateObjects(sel))}>Duplikuj <kbd>Ctrl D</kbd></button>}
      {sel.length > 0 && <button onClick={run(() => s.removeObjects(sel))}>Usuń <kbd>Del</kbd></button>}
      {sel.length > 0 && <div className="ctx-sep" />}
      {sel.length > 0 && <button onClick={run(() => s.updateObjects(sel.map((id) => ({ id, patch: { locked: !locked } }))))}>{locked ? 'Odblokuj' : 'Zablokuj'} <kbd>Ctrl Shift L</kbd></button>}
      {sel.length > 0 && <button onClick={run(() => s.updateObjects(sel.map((id) => ({ id, patch: { visible: false } }))))}>Ukryj <kbd>Ctrl Shift H</kbd></button>}
      {sel.length === 0 && <button onClick={run(() => s.select(s.project!.objects.filter((o) => !o.locked).map((o) => o.id)))}>Zaznacz wszystko <kbd>Ctrl A</kbd></button>}
    </div>
  );
}

/** Figma-like inline text editing: a textarea positioned over the text object. */
function InlineText({ id, onDone }: { id: string; onDone: () => void }) {
  const obj = useProject((s) => s.project?.objects.find((o) => o.id === id) as TextObj | undefined);
  const viewport = useProject((s) => s.viewport);
  const upd = useProject((s) => s.updateObject);
  const remove = useProject((s) => s.removeObjects);
  const [val, setVal] = useState(obj?.text ?? '');
  const mountedAt = useRef(performance.now());
  if (!obj) return null;
  const px = obj.x * viewport.scale + viewport.x, py = obj.y * viewport.scale + viewport.y;
  const fontPx = Math.max(12, obj.fontSize * viewport.scale);
  const commit = () => { const t = val.trim(); if (!t) remove([id]); else if (t !== obj.text) upd(id, { text: t }); onDone(); };
  return (
    <textarea
      className="inline-text"
      autoFocus
      value={val}
      style={{ left: px, top: py, fontSize: fontPx, transform: `translate(-50%, -50%) rotate(${obj.rotation}deg)`, color: obj.color }}
      placeholder="Wpisz tekst"
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => { if (performance.now() - mountedAt.current < 250) { e.target.focus(); return; } commit(); }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') { setVal(obj.text); onDone(); if (!obj.text) remove([id]); } }}
    />
  );
}

function gridStep(scale: number) {
  return scale > 25 ? 1 : scale > 6 ? 5 : scale > 2 ? 10 : 50;
}

function PreviewNode({ obj }: { obj: BzObject }) {
  const sceneFunc = useCallback((context: Konva.Context) => {
    const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
    ctx.save(); ctx.globalAlpha = 0.85;
    drawObject(ctx, obj as Exclude<BzObject, { type: 'symbol' }>);
    ctx.restore();
  }, [obj]);
  return <Group x={obj.x} y={obj.y} listening={false}><Shape sceneFunc={sceneFunc} listening={false} /></Group>;
}
