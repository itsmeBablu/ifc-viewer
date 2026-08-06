import type { MarkupNote, MarkupPlacement } from "./toolMarkup";

const DB_NAME = "ibviewer-tool-markup";
const DB_VERSION = 1;
const PLACEMENTS = "placements";
const NOTES = "notes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PLACEMENTS)) {
        const store = db.createObjectStore(PLACEMENTS, { keyPath: "id" });
        store.createIndex("byModel", "modelKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(NOTES)) {
        const store = db.createObjectStore(NOTES, { keyPath: "id" });
        store.createIndex("byModel", "modelKey", { unique: false });
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

export async function idbListPlacements(
  modelKey: string,
): Promise<MarkupPlacement[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(PLACEMENTS, "readonly");
    const idx = tx.objectStore(PLACEMENTS).index("byModel");
    const rows = await reqToPromise(idx.getAll(modelKey));
    return rows as MarkupPlacement[];
  } finally {
    db.close();
  }
}

export async function idbPutPlacement(
  placement: MarkupPlacement,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(PLACEMENTS, "readwrite");
    await reqToPromise(tx.objectStore(PLACEMENTS).put(placement));
  } finally {
    db.close();
  }
}

export async function idbDeletePlacement(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(PLACEMENTS, "readwrite");
    await reqToPromise(tx.objectStore(PLACEMENTS).delete(id));
  } finally {
    db.close();
  }
}

export async function idbListNotes(modelKey: string): Promise<MarkupNote[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(NOTES, "readonly");
    const idx = tx.objectStore(NOTES).index("byModel");
    const rows = await reqToPromise(idx.getAll(modelKey));
    return rows as MarkupNote[];
  } finally {
    db.close();
  }
}

export async function idbPutNote(note: MarkupNote): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(NOTES, "readwrite");
    await reqToPromise(tx.objectStore(NOTES).put(note));
  } finally {
    db.close();
  }
}

export async function idbDeleteNote(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(NOTES, "readwrite");
    await reqToPromise(tx.objectStore(NOTES).delete(id));
  } finally {
    db.close();
  }
}
