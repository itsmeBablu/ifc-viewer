import type { ReferenceUnderlay } from "./referenceUnderlay";
import type {
  LayoutDoor,
  LayoutLevel,
  LayoutPresets,
  LayoutSlab,
  LayoutWall,
  LayoutWindow,
} from "./layoutDrawing";
import { EMPTY_LAYOUT_PRESETS } from "./layoutDrawing";

const DB_NAME = "ibviewer-layout-drawing";
const DB_VERSION = 3;
const LEVELS = "levels";
const WALLS = "walls";
const DOORS = "doors";
const WINDOWS = "windows";
const SLABS = "slabs";
const UNDERLAYS = "underlays";
const PRESETS = "presets";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [LEVELS, WALLS, DOORS, WINDOWS, SLABS, UNDERLAYS]) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("byProject", "projectId", { unique: false });
        }
      }
      if (!db.objectStoreNames.contains(PRESETS)) {
        db.createObjectStore(PRESETS, { keyPath: "projectId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

async function listByProject<T>(storeName: string, projectId: string): Promise<T[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, "readonly");
    const idx = tx.objectStore(storeName).index("byProject");
    return (await reqToPromise(idx.getAll(projectId))) as T[];
  } finally {
    db.close();
  }
}

async function putRow<T>(storeName: string, row: T): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, "readwrite");
    await reqToPromise(tx.objectStore(storeName).put(row));
  } finally {
    db.close();
  }
}

async function deleteRow(storeName: string, id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, "readwrite");
    await reqToPromise(tx.objectStore(storeName).delete(id));
  } finally {
    db.close();
  }
}

export const idbListLevels = (projectId: string) =>
  listByProject<LayoutLevel>(LEVELS, projectId);
export const idbPutLevel = (row: LayoutLevel) => putRow(LEVELS, row);
export const idbDeleteLevel = (id: string) => deleteRow(LEVELS, id);

export const idbListWalls = (projectId: string) =>
  listByProject<LayoutWall>(WALLS, projectId);
export const idbPutWall = (row: LayoutWall) => putRow(WALLS, row);
export const idbDeleteWall = (id: string) => deleteRow(WALLS, id);

export const idbListDoors = (projectId: string) =>
  listByProject<LayoutDoor>(DOORS, projectId);
export const idbPutDoor = (row: LayoutDoor) => putRow(DOORS, row);
export const idbDeleteDoor = (id: string) => deleteRow(DOORS, id);

export const idbListWindows = (projectId: string) =>
  listByProject<LayoutWindow>(WINDOWS, projectId);
export const idbPutWindow = (row: LayoutWindow) => putRow(WINDOWS, row);
export const idbDeleteWindow = (id: string) => deleteRow(WINDOWS, id);

export const idbListSlabs = (projectId: string) =>
  listByProject<LayoutSlab>(SLABS, projectId);
export const idbPutSlab = (row: LayoutSlab) => putRow(SLABS, row);
export const idbDeleteSlab = (id: string) => deleteRow(SLABS, id);

export const idbListUnderlays = (projectId: string) =>
  listByProject<ReferenceUnderlay>(UNDERLAYS, projectId);
export const idbPutUnderlay = (row: ReferenceUnderlay) =>
  putRow(UNDERLAYS, row);
export const idbDeleteUnderlay = (id: string) => deleteRow(UNDERLAYS, id);

export async function idbGetPresets(projectId: string): Promise<LayoutPresets> {
  const db = await openDb();
  try {
    const tx = db.transaction(PRESETS, "readonly");
    const row = (await reqToPromise(
      tx.objectStore(PRESETS).get(projectId),
    )) as { projectId: string; presets: LayoutPresets } | undefined;
    return row?.presets ?? { ...EMPTY_LAYOUT_PRESETS };
  } finally {
    db.close();
  }
}

export async function idbPutPresets(
  projectId: string,
  presets: LayoutPresets,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(PRESETS, "readwrite");
    await reqToPromise(
      tx.objectStore(PRESETS).put({ projectId, presets }),
    );
  } finally {
    db.close();
  }
}
