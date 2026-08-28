import type { ReferenceUnderlay } from "./referenceUnderlay";
import type {
  LayoutBeam,
  LayoutCableTray,
  LayoutColumn,
  LayoutDoor,
  LayoutDuct,
  LayoutGridLine,
  LayoutGroup,
  LayoutLevel,
  LayoutMepEquipment,
  LayoutPipe,
  LayoutPresets,
  LayoutRamp,
  LayoutRoom,
  LayoutSlab,
  LayoutStair,
  LayoutWall,
  LayoutWindow,
  LayoutWire,
  WallType,
} from "./layoutDrawing";
import { EMPTY_LAYOUT_PRESETS } from "./layoutDrawing";

const DB_NAME = "ibviewer-layout-drawing";
const DB_VERSION = 8;
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
const STAIRS = "stairs";
const RAMPS = "ramps";
const DUCTS = "ducts";
const PIPES = "pipes";
const CABLE_TRAYS = "cableTrays";
const MEP_EQUIPMENT = "mepEquipment";
const WIRES = "wires";
const ROOMS = "rooms";
const PROJECTS = "projects";

export type StoredLayoutProject = {
  id: string;
  name: string;
  lastModified: number;
  sizeBytes?: number;
  levelCount?: number;
  elementCount?: number;
  referenceFiles?: Array<{ name: string; type: "DWG" | "PDF" | "Image" }>;
};

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
        STAIRS,
        RAMPS,
        DUCTS,
        PIPES,
        CABLE_TRAYS,
        MEP_EQUIPMENT,
        WIRES,
        ROOMS,
      ]) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("byProject", "projectId", { unique: false });
        }
      }
      if (!db.objectStoreNames.contains(PRESETS)) {
        db.createObjectStore(PRESETS, { keyPath: "projectId" });
      }
      if (!db.objectStoreNames.contains(PROJECTS)) {
        const projects = db.createObjectStore(PROJECTS, { keyPath: "id" });
        const presets = req.transaction?.objectStore(PRESETS);
        presets?.openCursor().addEventListener("success", (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          const id = String(cursor.value?.projectId ?? "");
          if (id) projects.put({
            id,
            name: projectNameFromId(id),
            lastModified: Date.now(),
          });
          cursor.continue();
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

function projectNameFromId(projectId: string) {
  const raw = projectId.startsWith("empty:") ? projectId.slice(6) : projectId;
  try {
    return decodeURIComponent(raw).replace(/[-_]+/g, " ").trim() || "Untitled project";
  } catch {
    return raw.replace(/[-_]+/g, " ").trim() || "Untitled project";
  }
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

async function touchProject(projectId: string, name?: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(PROJECTS, "readwrite");
    const store = tx.objectStore(PROJECTS);
    const current = await reqToPromise(store.get(projectId)) as StoredLayoutProject | undefined;
    store.put({
      id: projectId,
      name: name?.trim() || current?.name || projectNameFromId(projectId),
      lastModified: Date.now(),
    } satisfies StoredLayoutProject);
    await transactionDone(tx);
  } finally {
    db.close();
  }
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
  const projectId = (row as { projectId?: unknown })?.projectId;
  if (typeof projectId === "string" && projectId) await touchProject(projectId);
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

export const idbListStairs = (projectId: string) =>
  listByProject<LayoutStair>(STAIRS, projectId);
export const idbPutStair = (row: LayoutStair) => putRow(STAIRS, row);
export const idbDeleteStair = (id: string) => deleteRow(STAIRS, id);

export const idbListRamps = (projectId: string) =>
  listByProject<LayoutRamp>(RAMPS, projectId);
export const idbPutRamp = (row: LayoutRamp) => putRow(RAMPS, row);
export const idbDeleteRamp = (id: string) => deleteRow(RAMPS, id);

export const idbListDucts = (projectId: string) =>
  listByProject<LayoutDuct>(DUCTS, projectId);
export const idbPutDuct = (row: LayoutDuct) => putRow(DUCTS, row);
export const idbDeleteDuct = (id: string) => deleteRow(DUCTS, id);

export const idbListPipes = (projectId: string) =>
  listByProject<LayoutPipe>(PIPES, projectId);
export const idbPutPipe = (row: LayoutPipe) => putRow(PIPES, row);
export const idbDeletePipe = (id: string) => deleteRow(PIPES, id);

export const idbListCableTrays = (projectId: string) =>
  listByProject<LayoutCableTray>(CABLE_TRAYS, projectId);
export const idbPutCableTray = (row: LayoutCableTray) => putRow(CABLE_TRAYS, row);
export const idbDeleteCableTray = (id: string) => deleteRow(CABLE_TRAYS, id);

export const idbListMepEquipment = (projectId: string) =>
  listByProject<LayoutMepEquipment>(MEP_EQUIPMENT, projectId);
export const idbPutMepEquipment = (row: LayoutMepEquipment) => putRow(MEP_EQUIPMENT, row);
export const idbDeleteMepEquipment = (id: string) => deleteRow(MEP_EQUIPMENT, id);

export const idbListWires = (projectId: string) =>
  listByProject<LayoutWire>(WIRES, projectId);
export const idbPutWire = (row: LayoutWire) => putRow(WIRES, row);
export const idbDeleteWire = (id: string) => deleteRow(WIRES, id);

export const idbListRooms = (projectId: string) =>
  listByProject<LayoutRoom>(ROOMS, projectId);
export const idbPutRoom = (row: LayoutRoom) => putRow(ROOMS, row);
export const idbDeleteRoom = (id: string) => deleteRow(ROOMS, id);

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
  metadata?: { name?: string },
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
  await touchProject(projectId, metadata?.name);
}

export async function idbListProjects(): Promise<StoredLayoutProject[]> {
  const db = await openDb();
  try {
    const detailStores = [
      LEVELS, WALLS, DOORS, WINDOWS, SLABS, UNDERLAYS, COLUMNS, BEAMS,
      GRID_LINES, GROUPS, WALL_TYPES, STAIRS, RAMPS, DUCTS, PIPES, CABLE_TRAYS, MEP_EQUIPMENT, ROOMS, PRESETS,
    ];
    const tx = db.transaction([PROJECTS, ...detailStores], "readonly");
    const [rows, ...storeRows] = await Promise.all([
      reqToPromise(tx.objectStore(PROJECTS).getAll()),
      ...detailStores.map((storeName) => reqToPromise(tx.objectStore(storeName).getAll())),
    ]) as [StoredLayoutProject[], ...unknown[][]];
    return rows
      .map((row) => {
        const projectRows = storeRows.map((items, index) => items.filter((item) => {
          const record = item as { projectId?: string };
          return record.projectId === row.id || (detailStores[index] === PRESETS && record.projectId === row.id);
        }));
        const underlays = projectRows[detailStores.indexOf(UNDERLAYS)] as ReferenceUnderlay[];
        const references = underlays.map((underlay) => {
          const lowerName = underlay.sourceName.toLocaleLowerCase();
          const type = lowerName.endsWith(".dwg") ? "DWG" : lowerName.endsWith(".pdf") ? "PDF" : "Image";
          return { name: underlay.sourceName, type } as const;
        });
        const serialized = JSON.stringify([row, ...projectRows.flat()]);
        const elementStores = [WALLS, DOORS, WINDOWS, SLABS, COLUMNS, BEAMS, GRID_LINES, GROUPS, STAIRS, RAMPS, DUCTS, PIPES, CABLE_TRAYS, MEP_EQUIPMENT, ROOMS];
        const elementCount = elementStores.reduce(
          (total, storeName) => total + projectRows[detailStores.indexOf(storeName)].length,
          0,
        );
        return {
          id: row.id,
          name: row.name || projectNameFromId(row.id),
          lastModified: Number.isFinite(row.lastModified) ? row.lastModified : 0,
          sizeBytes: new Blob([serialized]).size,
          levelCount: projectRows[detailStores.indexOf(LEVELS)].length,
          elementCount,
          referenceFiles: references,
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified);
  } finally {
    db.close();
  }
}

export async function idbExportProject(projectId: string): Promise<Record<string, unknown>> {
  const db = await openDb();
  try {
    const stores = [
      LEVELS, WALLS, DOORS, WINDOWS, SLABS, UNDERLAYS, COLUMNS, BEAMS,
      GRID_LINES, GROUPS, WALL_TYPES, STAIRS, RAMPS, DUCTS, PIPES, CABLE_TRAYS, MEP_EQUIPMENT, ROOMS, PRESETS,
    ];
    const tx = db.transaction([PROJECTS, ...stores], "readonly");
    const projectRequest = reqToPromise(tx.objectStore(PROJECTS).get(projectId));
    const dataRequests = stores.map((storeName) => {
      const store = tx.objectStore(storeName);
      return storeName === PRESETS
        ? reqToPromise(store.get(projectId)).then((row) => row ? [row] : [])
        : reqToPromise(store.index("byProject").getAll(projectId));
    });
    const [project, data] = await Promise.all([
      projectRequest,
      Promise.all(dataRequests),
    ]);
    return {
      format: "v-studio-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      project,
      data: Object.fromEntries(stores.map((storeName, index) => [storeName, data[index]])),
    };
  } finally {
    db.close();
  }
}

export async function idbDeleteProject(projectId: string): Promise<void> {
  const db = await openDb();
  try {
    const stores = [
      LEVELS, WALLS, DOORS, WINDOWS, SLABS, UNDERLAYS, COLUMNS, BEAMS,
      GRID_LINES, GROUPS, WALL_TYPES, STAIRS, RAMPS, DUCTS, PIPES, CABLE_TRAYS, MEP_EQUIPMENT, ROOMS, PRESETS, PROJECTS,
    ];
    const tx = db.transaction(stores, "readwrite");
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      if (storeName === PRESETS) {
        store.delete(projectId);
      } else if (storeName === PROJECTS) {
        store.delete(projectId);
      } else {
        const keys = await reqToPromise(store.index("byProject").getAllKeys(projectId));
        for (const key of keys) store.delete(key);
      }
    }
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

