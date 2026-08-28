/**
 * Undo / redo snapshots for Werkzeug markup + layout drawing.
 * Call `pushWerkzeugHistory()` before a user-visible mutation.
 */

import type {
  LayoutBeam,
  LayoutColumn,
  LayoutDoor,
  LayoutGridLine,
  LayoutGroup,
  LayoutLevel,
  LayoutRamp,
  LayoutSlab,
  LayoutStair,
  LayoutWall,
  LayoutWindow,
} from "@/lib/layoutDrawing";
import type { ReferenceUnderlay } from "@/lib/referenceUnderlay";
import type { MarkupNote, MarkupPlacement } from "@/lib/toolMarkup";
import {
  idbDeleteBeam,
  idbDeleteColumn,
  idbDeleteDoor,
  idbDeleteGridLine,
  idbDeleteGroup,
  idbDeleteLevel,
  idbDeleteRamp,
  idbDeleteSlab,
  idbDeleteStair,
  idbDeleteUnderlay,
  idbDeleteWall,
  idbDeleteWindow,
  idbPutBeam,
  idbPutColumn,
  idbPutDoor,
  idbPutGridLine,
  idbPutGroup,
  idbPutLevel,
  idbPutRamp,
  idbPutSlab,
  idbPutStair,
  idbPutUnderlay,
  idbPutWall,
  idbPutWindow,
} from "@/lib/layoutDrawingDb";
import { idbDeleteNote, idbDeletePlacement, idbPutNote, idbPutPlacement } from "@/lib/toolMarkupDb";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import {
  useToolMarkupStore,
  type MarkupMeasurement,
} from "@/store/useToolMarkupStore";

const MAX_STACK = 60;

export type WerkzeugSnapshot = {
  modelKey: string | null;
  projectId: string | null;
  placements: MarkupPlacement[];
  notes: MarkupNote[];
  measurements: MarkupMeasurement[];
  levels: LayoutLevel[];
  walls: LayoutWall[];
  doors: LayoutDoor[];
  windows: LayoutWindow[];
  slabs: LayoutSlab[];
  columns?: LayoutColumn[];
  beams?: LayoutBeam[];
  stairs?: LayoutStair[];
  ramps?: LayoutRamp[];
  gridLines?: LayoutGridLine[];
  groups?: LayoutGroup[];
  underlays: ReferenceUnderlay[];
};

let undoStack: WerkzeugSnapshot[] = [];
let redoStack: WerkzeugSnapshot[] = [];
/** While true, pushWerkzeugHistory is a no-op (e.g. mid gizmo drag after first push). */
let suspended = false;
let restoring = false;

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function takeWerkzeugSnapshot(): WerkzeugSnapshot {
  const m = useToolMarkupStore.getState();
  const l = useLayoutDrawingStore.getState();
  return {
    modelKey: m.modelKey,
    projectId: l.projectId,
    placements: cloneJson(m.placements),
    notes: cloneJson(m.notes),
    measurements: cloneJson(m.measurements),
    levels: cloneJson(l.levels),
    walls: cloneJson(l.walls),
    doors: cloneJson(l.doors),
    windows: cloneJson(l.windows),
    slabs: cloneJson(l.slabs),
    columns: cloneJson(l.columns ?? []),
    beams: cloneJson(l.beams ?? []),
    stairs: cloneJson(l.stairs ?? []),
    ramps: cloneJson(l.ramps ?? []),
    gridLines: cloneJson(l.gridLines ?? []),
    groups: cloneJson(l.groups ?? []),
    underlays: cloneJson(l.underlays),
  };
}

export function clearWerkzeugHistory(): void {
  undoStack = [];
  redoStack = [];
  suspended = false;
}

export function suspendWerkzeugHistory(on: boolean): void {
  suspended = on;
}

export function pushWerkzeugHistory(): void {
  if (suspended || restoring) return;
  const snap = takeWerkzeugSnapshot();
  undoStack.push(snap);
  if (undoStack.length > MAX_STACK) undoStack.shift();
  redoStack = [];
}

async function persistSnapshot(snap: WerkzeugSnapshot): Promise<void> {
  const projectId = snap.projectId;
  const modelKey = snap.modelKey;

  // Markup IDB
  if (modelKey) {
    const m = useToolMarkupStore.getState();
    const keepP = new Set(snap.placements.map((p) => p.id));
    const keepN = new Set(snap.notes.map((n) => n.id));
    for (const p of m.placements) {
      if (!keepP.has(p.id)) await idbDeletePlacement(p.id);
    }
    for (const n of m.notes) {
      if (!keepN.has(n.id)) await idbDeleteNote(n.id);
    }
    for (const p of snap.placements) await idbPutPlacement(p);
    for (const n of snap.notes) await idbPutNote(n);
  }

  // Layout IDB
  if (projectId) {
    const l = useLayoutDrawingStore.getState();
    const keepL = new Set(snap.levels.map((x) => x.id));
    const keepW = new Set(snap.walls.map((x) => x.id));
    const keepD = new Set(snap.doors.map((x) => x.id));
    const keepWin = new Set(snap.windows.map((x) => x.id));
    const keepS = new Set((snap.slabs ?? []).map((x) => x.id));
    const keepC = new Set((snap.columns ?? []).map((x) => x.id));
    const keepB = new Set((snap.beams ?? []).map((x) => x.id));
    const keepSt = new Set((snap.stairs ?? []).map((x) => x.id));
    const keepR = new Set((snap.ramps ?? []).map((x) => x.id));
    const keepG = new Set((snap.gridLines ?? []).map((x) => x.id));
    const keepGrp = new Set((snap.groups ?? []).map((x) => x.id));
    const keepU = new Set(snap.underlays.map((x) => x.id));

    for (const w of l.walls) {
      if (!keepW.has(w.id)) await idbDeleteWall(w.id);
    }
    for (const d of l.doors) {
      if (!keepD.has(d.id)) await idbDeleteDoor(d.id);
    }
    for (const w of l.windows) {
      if (!keepWin.has(w.id)) await idbDeleteWindow(w.id);
    }
    for (const s of l.slabs) {
      if (!keepS.has(s.id)) await idbDeleteSlab(s.id);
    }
    for (const c of l.columns ?? []) {
      if (!keepC.has(c.id)) await idbDeleteColumn(c.id);
    }
    for (const b of l.beams ?? []) {
      if (!keepB.has(b.id)) await idbDeleteBeam(b.id);
    }
    for (const st of l.stairs ?? []) {
      if (!keepSt.has(st.id)) await idbDeleteStair(st.id);
    }
    for (const r of l.ramps ?? []) {
      if (!keepR.has(r.id)) await idbDeleteRamp(r.id);
    }
    for (const g of l.gridLines ?? []) {
      if (!keepG.has(g.id)) await idbDeleteGridLine(g.id);
    }
    for (const grp of l.groups ?? []) {
      if (!keepGrp.has(grp.id)) await idbDeleteGroup(grp.id);
    }
    for (const u of l.underlays) {
      if (!keepU.has(u.id)) await idbDeleteUnderlay(u.id);
    }
    for (const lvl of l.levels) {
      if (!keepL.has(lvl.id)) await idbDeleteLevel(lvl.id);
    }

    for (const lvl of snap.levels) await idbPutLevel(lvl);
    for (const w of snap.walls) await idbPutWall(w);
    for (const d of snap.doors) await idbPutDoor(d);
    for (const w of snap.windows) await idbPutWindow(w);
    for (const s of snap.slabs ?? []) await idbPutSlab(s);
    for (const c of snap.columns ?? []) await idbPutColumn(c);
    for (const b of snap.beams ?? []) await idbPutBeam(b);
    for (const st of snap.stairs ?? []) await idbPutStair(st);
    for (const r of snap.ramps ?? []) await idbPutRamp(r);
    for (const g of snap.gridLines ?? []) await idbPutGridLine(g);
    for (const grp of snap.groups ?? []) await idbPutGroup(grp);
    for (const u of snap.underlays) await idbPutUnderlay(u);
  }
}

async function applySnapshot(snap: WerkzeugSnapshot): Promise<void> {
  restoring = true;
  try {
    await persistSnapshot(snap);
    useToolMarkupStore.setState({
      placements: cloneJson(snap.placements),
      notes: cloneJson(snap.notes),
      measurements: cloneJson(snap.measurements),
      selectedPlacementId: null,
      selectedNoteId: null,
      pendingNote: null,
      cubeDraw: null,
      measureDraft: null,
    });
    useLayoutDrawingStore.setState({
      levels: cloneJson(snap.levels),
      walls: cloneJson(snap.walls),
      doors: cloneJson(snap.doors),
      windows: cloneJson(snap.windows),
      slabs: cloneJson(snap.slabs ?? []),
      columns: cloneJson(snap.columns ?? []),
      beams: cloneJson(snap.beams ?? []),
      stairs: cloneJson(snap.stairs ?? []),
      ramps: cloneJson(snap.ramps ?? []),
      gridLines: cloneJson(snap.gridLines ?? []),
      groups: cloneJson(snap.groups ?? []),
      underlays: cloneJson(snap.underlays ?? []),
      selectedElements: [],
      wallDraw: null,
      slabDraw: null,
      tracePreview: null,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedStairId: null,
      selectedRampId: null,
      selectedUnderlayId: null,
      calibrateUnderlayId: null,
      calibratePoints: [],
      lastMutatedAt: Date.now(),
    });
    useToolMarkupStore.setState({ contentTouchedAt: Date.now() });
  } finally {
    restoring = false;
  }
}

export function canUndoWerkzeug(): boolean {
  return undoStack.length > 0;
}

export function canRedoWerkzeug(): boolean {
  return redoStack.length > 0;
}

export async function undoWerkzeug(): Promise<boolean> {
  if (!undoStack.length) return false;
  const current = takeWerkzeugSnapshot();
  const prev = undoStack.pop()!;
  redoStack.push(current);
  await applySnapshot(prev);
  return true;
}

export async function redoWerkzeug(): Promise<boolean> {
  if (!redoStack.length) return false;
  const current = takeWerkzeugSnapshot();
  const next = redoStack.pop()!;
  undoStack.push(current);
  await applySnapshot(next);
  return true;
}

export function isWerkzeugHistoryRestoring(): boolean {
  return restoring;
}
