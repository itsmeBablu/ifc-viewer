import type { ReferenceUnderlay } from "./referenceUnderlay";
import type {
  LayoutBeam,
  LayoutColumn,
  LayoutDoor,
  LayoutGridLine,
  LayoutGroup,
  LayoutLevel,
  LayoutPresets,
  LayoutSlab,
  LayoutWall,
  LayoutWindow,
  WallType,
} from "./layoutDrawing";
import { EMPTY_LAYOUT_PRESETS } from "./layoutDrawing";

const DB_NAME = "ibviewer-layout-drawing";
const DB_VERSION = 4;
const LEVELS = "levels";
const WALLS = "walls";
const DOORS = "doors";
const WINDOWS = "windows";
const SLABS = "slabs";
const UNDERLAYS = "underlays";
const PRESETS = "presets";
const COLUMNS = "columns";
const BEAMS = "beams";
const GRID_LINES = "gridLines";
const GROUPS = "groups";
const WALL_TYPES = "wallTypes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [
        LEVELS,
        WALLS,
        DOORS,
        WINDOWS,
        SLABS,
        UNDERLAYS,
        COLUMNS,
        BEAMS,
        GRID_LINES,
        GROUPS,
        WALL_TYPES,
      ]) {
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

export const idbListColumns = (projectId: string) =>
  listByProject<LayoutColumn>(COLUMNS, projectId);
export const idbPutColumn = (row: LayoutColumn) => putRow(COLUMNS, row);
export const idbDeleteColumn = (id: string) => deleteRow(COLUMNS, id);

export const idbListBeams = (projectId: string) =>
  listByProject<LayoutBeam>(BEAMS, projectId);
export const idbPutBeam = (row: LayoutBeam) => putRow(BEAMS, row);
export const idbDeleteBeam = (id: string) => deleteRow(BEAMS, id);

export const idbListGridLines = (projectId: string) =>
  listByProject<LayoutGridLine>(GRID_LINES, projectId);
export const idbPutGridLine = (row: LayoutGridLine) => putRow(GRID_LINES, row);
export const idbDeleteGridLine = (id: string) => deleteRow(GRID_LINES, id);

export const idbListGroups = (projectId: string) =>
  listByProject<LayoutGroup>(GROUPS, projectId);
export const idbPutGroup = (row: LayoutGroup) => putRow(GROUPS, row);
export const idbDeleteGroup = (id: string) => deleteRow(GROUPS, id);

export const idbListWallTypes = (projectId: string) =>
  listByProject<WallType>(WALL_TYPES, projectId);
export const idbPutWallType = (row: WallType) => putRow(WALL_TYPES, row);
export const idbDeleteWallType = (id: string) => deleteRow(WALL_TYPES, id);

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
