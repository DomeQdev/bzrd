import { create } from 'zustand';
import type { Background, BzObject, Preset, Project } from '../model/types';
import { DEFAULT_PX_PER_METER } from '../model/units';

export type Tool = 'select' | 'hand' | 'pen' | 'polygon' | 'line' | 'rect' | 'ellipse' | 'text' | 'measure' | 'join';

export interface Viewport {
  x: number;
  y: number;
  scale: number; // px per meter
}

export interface EditState {
  /** object being node-edited */
  id: string;
  /** selected node indices */
  nodes: number[];
}

export interface ProjectState {
  project: Project | null;
  selection: string[];
  tool: Tool;
  viewport: Viewport;
  past: Project[];
  future: Project[];
  dirty: boolean;
  wheelMode: 'auto' | 'zoom' | 'pan';
  showGrid: boolean;
  snap: boolean;
  snapRotation: boolean;
  /** keep existing lanes in place on the map when the cross-section is edited */
  lockLanes: boolean;
  toggleLockLanes: () => void;
  /** library item chosen for drawing (strip or marking) */
  pending: Preset | null;
  editing: EditState | null;
  hoverId: string | null;

  newProject: (p: Project) => void;
  loadProject: (p: Project) => void;
  closeProject: () => void;
  setBackground: (bg: Background) => void;
  setProjectMeta: (patch: Partial<Pick<Project, 'name' | 'units' | 'widthM' | 'heightM'>>) => void;

  addObject: (obj: BzObject, select?: boolean) => void;
  addObjects: (objs: BzObject[], select?: boolean) => void;
  updateObject: (id: string, patch: Partial<BzObject>, opts?: { history?: boolean }) => void;
  updateObjects: (patches: Array<{ id: string; patch: Partial<BzObject> }>, opts?: { history?: boolean }) => void;
  /** replace one object with several (split / explode) */
  replaceWith: (id: string, objs: BzObject[]) => void;
  /** replace existing objects (same ids) and insert new ones after `insertAfter`, as ONE undo step */
  replaceMany: (replace: BzObject[], insert: BzObject[], insertAfter?: string, select?: string[]) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  reorder: (ids: string[], dir: 'up' | 'down' | 'top' | 'bottom') => void;
  moveToIndex: (ids: string[], index: number) => void;
  group: (ids: string[]) => void;
  /** replace `keep` (same id) and delete `removeIds` as ONE undo step; selects `keep` */
  mergeObjects: (keep: BzObject, removeIds: string[]) => void;
  ungroup: (ids: string[]) => void;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setHover: (id: string | null) => void;
  setTool: (t: Tool) => void;
  setPending: (p: Preset | null) => void;
  setEditing: (e: EditState | null) => void;
  setViewport: (v: Viewport) => void;
  setWheelMode: (m: ProjectState['wheelMode']) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleSnapRotation: () => void;

  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  /** start a continuous edit: live updates with {history:false}, then endGesture() records ONE undo step */
  beginGesture: () => void;
  endGesture: () => void;
}

let idCounter = Date.now() % 100000;
export function uid(prefix = 'o'): string {
  idCounter++;
  return `${prefix}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const HISTORY_LIMIT = 100;
let gestureBase: Project | null = null;

export function blankProject(name: string, widthM: number, heightM: number): Project {
  return {
    version: 2,
    name,
    units: 'm',
    widthM,
    heightM,
    pxPerMeter: DEFAULT_PX_PER_METER,
    background: { kind: 'blank', color: '#9aa394' },
    objects: [],
    updatedAt: Date.now(),
  };
}

export const useProject = create<ProjectState>((set, get) => {
  const pushHistory = (p: Project) => {
    const past = [...get().past, p];
    if (past.length > HISTORY_LIMIT) past.shift();
    return { past, future: [] as Project[] };
  };
  const mutate = (fn: (p: Project) => Project, history = true) => {
    const cur = get().project;
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    set({ project: next, dirty: true, ...(history ? pushHistory(cur) : {}) });
  };

  return {
    project: null,
    selection: [],
    tool: 'select',
    viewport: { x: 0, y: 0, scale: DEFAULT_PX_PER_METER },
    past: [],
    future: [],
    dirty: false,
    wheelMode: 'auto',
    showGrid: false,
    snap: true,
    snapRotation: true,
    lockLanes: true,
    toggleLockLanes: () => set({ lockLanes: !get().lockLanes }),
    pending: null,
    editing: null,
    hoverId: null,

    newProject: (p) => set({ project: p, selection: [], past: [], future: [], dirty: true, tool: 'select', editing: null, pending: null }),
    loadProject: (p) => set({ project: p, selection: [], past: [], future: [], dirty: false, tool: 'select', editing: null, pending: null }),
    closeProject: () => set({ project: null, selection: [], past: [], future: [], dirty: false, editing: null }),
    setBackground: (bg) => mutate((p) => ({ ...p, background: bg })),
    setProjectMeta: (patch) => mutate((p) => ({ ...p, ...patch })),

    addObject: (obj, select = true) => {
      mutate((p) => ({ ...p, objects: [...p.objects, obj] }));
      if (select) set({ selection: [obj.id], editing: null });
    },
    addObjects: (objs, select = true) => {
      mutate((p) => ({ ...p, objects: [...p.objects, ...objs] }));
      if (select) set({ selection: objs.map((o) => o.id), editing: null });
    },
    updateObject: (id, patch, opts) =>
      mutate((p) => ({ ...p, objects: p.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as BzObject) : o)) }), opts?.history ?? true),
    updateObjects: (patches, opts) =>
      mutate((p) => {
        const map = new Map(patches.map((x) => [x.id, x.patch]));
        return { ...p, objects: p.objects.map((o) => (map.has(o.id) ? ({ ...o, ...map.get(o.id) } as BzObject) : o)) };
      }, opts?.history ?? true),
    replaceWith: (id, objs) => {
      mutate((p) => {
        const i = p.objects.findIndex((o) => o.id === id);
        if (i < 0) return { ...p, objects: [...p.objects, ...objs] };
        return { ...p, objects: [...p.objects.slice(0, i), ...objs, ...p.objects.slice(i + 1)] };
      });
      set({ selection: objs.map((o) => o.id), editing: null });
    },
    replaceMany: (replace, insert, insertAfter, select) => {
      mutate((p) => {
        const map = new Map(replace.map((o) => [o.id, o]));
        const objs = p.objects.map((o) => map.get(o.id) ?? o);
        const i = insertAfter ? objs.findIndex((o) => o.id === insertAfter) : -1;
        if (i < 0) return { ...p, objects: [...objs, ...insert] };
        return { ...p, objects: [...objs.slice(0, i + 1), ...insert, ...objs.slice(i + 1)] };
      });
      if (select) set({ selection: select, editing: null });
    },
    removeObjects: (ids) => {
      const s = new Set(ids);
      mutate((p) => ({ ...p, objects: p.objects.filter((o) => !s.has(o.id)) }));
      const ed = get().editing;
      set({ selection: get().selection.filter((id) => !s.has(id)), editing: ed && s.has(ed.id) ? null : ed });
    },
    duplicateObjects: (ids) => {
      const s = new Set(ids);
      const copies: BzObject[] = [];
      mutate((p) => {
        const remap = new Map<string, string>();
        for (const o of p.objects) if (s.has(o.id)) {
          const g = o.groupId ? remap.get(o.groupId) ?? (remap.set(o.groupId, uid('g')), remap.get(o.groupId)) : undefined;
          copies.push({ ...o, id: uid(), x: o.x + 2, y: o.y + 2, groupId: g } as BzObject);
        }
        return { ...p, objects: [...p.objects, ...copies] };
      });
      set({ selection: copies.map((c) => c.id), editing: null });
    },
    reorder: (ids, dir) =>
      mutate((p) => {
        const s = new Set(ids);
        const objs = [...p.objects];
        if (dir === 'top') return { ...p, objects: [...objs.filter((o) => !s.has(o.id)), ...objs.filter((o) => s.has(o.id))] };
        if (dir === 'bottom') return { ...p, objects: [...objs.filter((o) => s.has(o.id)), ...objs.filter((o) => !s.has(o.id))] };
        if (dir === 'up') {
          for (let i = objs.length - 2; i >= 0; i--) if (s.has(objs[i].id) && !s.has(objs[i + 1].id)) [objs[i], objs[i + 1]] = [objs[i + 1], objs[i]];
        } else {
          for (let i = 1; i < objs.length; i++) if (s.has(objs[i].id) && !s.has(objs[i - 1].id)) [objs[i], objs[i - 1]] = [objs[i - 1], objs[i]];
        }
        return { ...p, objects: objs };
      }),
    moveToIndex: (ids, index) =>
      mutate((p) => {
        const s = new Set(ids);
        const moving = p.objects.filter((o) => s.has(o.id));
        const rest = p.objects.filter((o) => !s.has(o.id));
        const before = p.objects.slice(0, index).filter((o) => !s.has(o.id)).length;
        rest.splice(before, 0, ...moving);
        return { ...p, objects: rest };
      }),

    mergeObjects: (keep, removeIds) => {
      const rm = new Set(removeIds);
      mutate((p) => ({ ...p, objects: p.objects.filter((o) => !rm.has(o.id)).map((o) => (o.id === keep.id ? keep : o)) }));
      set({ selection: [keep.id], editing: null });
    },
    group: (ids) => {
      if (ids.length < 2) return;
      const gid = uid('g');
      const set_ = new Set(ids);
      mutate((p) => ({ ...p, objects: p.objects.map((o) => (set_.has(o.id) ? ({ ...o, groupId: gid } as BzObject) : o)) }));
    },
    ungroup: (ids) => {
      const set_ = new Set(ids);
      mutate((p) => ({ ...p, objects: p.objects.map((o) => (set_.has(o.id) && o.groupId ? ({ ...o, groupId: undefined } as BzObject) : o)) }));
    },
    select: (ids) => set({ selection: ids, editing: null }),
    toggleSelect: (id) => {
      const sel = get().selection;
      set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id], editing: null });
    },
    setHover: (id) => { if (get().hoverId !== id) set({ hoverId: id }); },
    setTool: (t) => set({ tool: t, ...(t !== 'select' ? { editing: null } : {}) }),
    setPending: (p) => set({ pending: p }),
    setEditing: (e) => set({ editing: e }),
    setViewport: (v) => set({ viewport: v }),
    setWheelMode: (m) => set({ wheelMode: m }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    toggleSnap: () => set({ snap: !get().snap }),
    toggleSnapRotation: () => set({ snapRotation: !get().snapRotation }),

    undo: () => {
      const { past, project, future } = get();
      if (!project || past.length === 0) return;
      const prev = past[past.length - 1];
      const ids = new Set(prev.objects.map((o) => o.id));
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: true, selection: get().selection.filter((id) => ids.has(id)), editing: null });
    },
    redo: () => {
      const { past, project, future } = get();
      if (!project || future.length === 0) return;
      const next = future[0];
      const ids = new Set(next.objects.map((o) => o.id));
      set({ project: next, past: [...past, project], future: future.slice(1), dirty: true, selection: get().selection.filter((id) => ids.has(id)), editing: null });
    },
    markSaved: () => set({ dirty: false }),
    beginGesture: () => { gestureBase = get().project; },
    endGesture: () => {
      const base = gestureBase;
      gestureBase = null;
      const cur = get().project;
      if (!base || !cur || base === cur) return;
      set({ ...pushHistory(base), dirty: true });
    },
  };
});
