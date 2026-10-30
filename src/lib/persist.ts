import type { Project } from '../model/types';

const LS_KEY = 'bzrd:autosave';
const LS_META = 'bzrd:autosave:meta';
const IDB_NAME = 'bzrd';
const IDB_STORE = 'projects';
const IDB_KEY = 'autosave';

export interface AutosaveMeta { name: string; updatedAt: number; objects: number; where: 'ls' | 'idb' }

// ───────────────────────── IndexedDB (large satellite backgrounds) ─────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(p: Project): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(p, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<Project | null> {
  const db = await openDb();
  const p = await new Promise<Project | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Project) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return p;
}


// ───────────────────────── migration ─────────────────────────

type Raw = Record<string, unknown>;

/** v2 line styles → v3 LineSpec fields */
function migrateStyle(style: string, width: number): { style: string; width: number; dash?: [number, number] } {
  switch (style) {
    case 'dashed': return { style: 'dashed', width, dash: [2, 4] };
    case 'dashedLong': return { style: 'dashed', width, dash: [4, 2] };
    case 'dotted': return { style: 'dashed', width, dash: [1, 1] };
    case 'doubleDashedLeft': return { style: 'doubleDashedLeft', width, dash: [2, 4] };
    case 'doubleDashedRight': return { style: 'doubleDashedRight', width, dash: [2, 4] };
    case 'edge': return { style: 'solid', width: Math.max(width, 0.24) };
    case 'double': case 'solid': case 'none': return { style, width };
    default: return { style: 'solid', width };
  }
}

function migrateDivider(d: Raw | undefined): Raw | undefined {
  if (!d || typeof d !== 'object') return undefined;
  if (typeof d.width === 'number' && typeof d.color === 'string' && (d.color as string).startsWith('#')) return d;
  const st = migrateStyle(String(d.style ?? 'solid'), 0.12);
  if (st.style === 'none') return undefined;
  return { ...st, color: d.color === 'yellow' ? '#f2c230' : '#f4f4f4' };
}

const V2_MARKING: Record<string, string> = {
  none: 'none', bikeSymbols: 'p23', busText: 'p22', tramTracks: 'tracks', parkingBays: 'p18', hatch: 'p21',
  arrowsStraight: 'p8a', arrowsLeft: 'p8b', arrowsRight: 'p8d', arrowsStraightLeft: 'p8e', arrowsStraightRight: 'p8f',
  arrowsLeftRight: 'p8g', arrowsAll: 'p8h', arrowsUturn: 'p8c',
};
/** v2 implied a marking from the lane kind; v3 lanes are bare asphalt, so make the old default explicit. */
const V2_DEFAULT_MARKING: Record<string, string> = { bike: 'p23', bikePath: 'p23', bus: 'p22', tram: 'tracks', parking: 'p18', parkingPerp: 'p18', parkingAngle: 'p18', buffer: 'p21' };

function migrateLane(l: Raw): Raw {
  const m = typeof l.marking === 'string' ? V2_MARKING[l.marking] : V2_DEFAULT_MARKING[String(l.kind)];
  const out = { ...l };
  if (m && m !== 'none') out.marking = m; else delete out.marking;
  return out;
}

/** v2 arrow symbol ids used the wrong Polish letters (P-8c was "w prawo"); v3 follows the regulation. */
const V2_ARROW_ID: Record<string, string> = { 'arr-p8c': 'arr-p8d', 'arr-p8d': 'arr-p8e', 'arr-p8e': 'arr-p8f', 'arr-p8f': 'arr-p8g', 'arr-p8g': 'arr-p8c' };

function migrateV2Object(o: Raw): Raw {
  if (o.type === 'strip') {
    const spec = { ...(o.spec as Raw) };
    spec.lanes = ((spec.lanes as Raw[]) ?? []).map(migrateLane);
    if (Array.isArray(spec.lanesEnd)) spec.lanesEnd = (spec.lanesEnd as Raw[]).map(migrateLane);
    if (Array.isArray(spec.dividers)) spec.dividers = (spec.dividers as Raw[]).map((d) => migrateDivider(d) ?? { style: 'none', width: 0, color: '#f4f4f4' });
    spec.edgeLeft = migrateDivider(spec.edgeLeft as Raw | undefined);
    spec.edgeRight = migrateDivider(spec.edgeRight as Raw | undefined);
    if (!spec.edgeLeft) delete spec.edgeLeft;
    if (!spec.edgeRight) delete spec.edgeRight;
    return { ...o, spec };
  }
  if (o.type === 'line') {
    const st = migrateStyle(String(o.style ?? 'solid'), Number(o.width ?? 0.12));
    return { ...o, ...st };
  }
  if (o.type === 'symbol' && typeof o.symbolId === 'string' && V2_ARROW_ID[o.symbolId]) return { ...o, symbolId: V2_ARROW_ID[o.symbolId] };
  return o;
}

/** Upgrade older project files (v1: straight roads; v2: Figma-like single z-order, implicit lane markings). */
export function migrateProject(raw: unknown): Project {
  const p = raw as Project & { version: number };
  if (!p || typeof p !== 'object' || !Array.isArray(p.objects)) throw new Error('To nie jest plik projektu BZRD');
  if (p.version === 3) return p;
  if (p.version !== 1 && p.version !== 2) throw new Error('Nieznana wersja pliku projektu');
  let objects: Raw[] = p.objects as unknown as Raw[];
  if (p.version === 1) {
    objects = objects
      .map((o) => {
        if (o.type === 'symbol' || o.type === 'text') return o;
        if (o.type === 'line' && Array.isArray(o.points)) {
          const pts = o.points as number[];
          const nodes = [];
          for (let i = 0; i + 1 < pts.length; i += 2) nodes.push({ x: pts[i], y: pts[i + 1], mode: 'corner' as const });
          const v = (o.variant as string) ?? 'plain';
          return { ...o, path: { nodes, closed: !!o.closed }, variant: ['plain', 'crosswalk', 'bikeCrossing', 'hatch', 'curb', 'grass', 'pavement'].includes(v) ? v : 'plain' };
        }
        return null; // roads / intersections / roundabouts from v1 are dropped
      })
      .filter((o): o is Raw => !!o);
  }
  objects = objects.map(migrateV2Object);
  return { ...p, version: 3, objects: objects as unknown as Project['objects'] };
}

// ───────────────────────── autosave ─────────────────────────

/** Save to localStorage; if the project is too big (satellite background), fall back to IndexedDB. */
export async function autosave(p: Project): Promise<boolean> {
  const meta: AutosaveMeta = { name: p.name, updatedAt: p.updatedAt, objects: p.objects.length, where: 'ls' };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
    localStorage.setItem(LS_META, JSON.stringify(meta));
    return true;
  } catch {
    try {
      await idbPut(p);
      localStorage.removeItem(LS_KEY);
      localStorage.setItem(LS_META, JSON.stringify({ ...meta, where: 'idb' }));
      return true;
    } catch {
      return false;
    }
  }
}

export async function loadAutosave(): Promise<Project | null> {
  const meta = autosaveMeta();
  try {
    if (meta?.where === 'idb') {
      const p = await idbGet();
      if (p && (p.version === 3 || p.version === 2 || p.version === 1) && Array.isArray(p.objects)) return migrateProject(p);
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return meta ? await idbGet() : null;
    const p = JSON.parse(raw) as Project;
    if (p && (p.version === 3 || p.version === 2 || p.version === 1) && Array.isArray(p.objects)) return migrateProject(p);
    return null;
  } catch {
    return null;
  }
}

export function autosaveMeta(): AutosaveMeta | null {
  try {
    const raw = localStorage.getItem(LS_META);
    return raw ? (JSON.parse(raw) as AutosaveMeta) : null;
  } catch {
    return null;
  }
}

// ───────────────────────── files ─────────────────────────

export function downloadProjectFile(p: Project) {
  const blob = new Blob([JSON.stringify(p)], { type: 'application/json' });
  const safe = (p.name || 'projekt').replace(/[^\w\-]+/g, '_');
  downloadBlob(blob, `${safe}.bzrd.json`);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        resolve(migrateProject(JSON.parse(String(r.result))));
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl: String(r.result), width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Nie udało się wczytać obrazu'));
      img.src = String(r.result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
