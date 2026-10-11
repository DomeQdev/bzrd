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


/** Upgrade older project files (v1 had straight roads / intersections; lines had flat point arrays). */
export function migrateProject(raw: unknown): Project {
  const p = raw as Project & { version: number };
  if (!p || typeof p !== 'object' || !Array.isArray(p.objects)) throw new Error('To nie jest plik projektu BZRD');
  if (p.version === 2) return p;
  if (p.version !== 1) throw new Error('Nieznana wersja pliku projektu');
  const objects = (p.objects as unknown as Array<Record<string, unknown>>)
    .map((o) => {
      if (o.type === 'symbol' || o.type === 'text') return o as unknown as Project['objects'][number];
      if (o.type === 'line' && Array.isArray(o.points)) {
        const pts = o.points as number[];
        const nodes = [];
        for (let i = 0; i + 1 < pts.length; i += 2) nodes.push({ x: pts[i], y: pts[i + 1], mode: 'corner' as const });
        const v = (o.variant as string) ?? 'plain';
        return { ...o, path: { nodes, closed: !!o.closed }, variant: ['plain', 'crosswalk', 'bikeCrossing', 'hatch', 'curb', 'grass', 'pavement'].includes(v) ? v : 'plain' } as unknown as Project['objects'][number];
      }
      return null; // roads / intersections / roundabouts from v1 are dropped
    })
    .filter((o): o is Project['objects'][number] => !!o);
  return { ...p, version: 2, objects };
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
      if (p && (p.version === 2 || p.version === 1) && Array.isArray(p.objects)) return migrateProject(p);
    }
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return meta ? await idbGet() : null;
    const p = JSON.parse(raw) as Project;
    if (p && (p.version === 2 || p.version === 1) && Array.isArray(p.objects)) return migrateProject(p);
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
