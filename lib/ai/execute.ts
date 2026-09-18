"use client";

import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import { idbApplyAiChanges, type AiDbChange } from "@/lib/layoutDrawingDb";
import { pushWerkzeugHistory, takeWerkzeugSnapshot, isWerkzeugHistoryRestoring } from "@/lib/werkzeugHistory";
import { contextSchema, type AiAction, type AiContext, type AiPlan } from "./schema";
import { validatePlan } from "./validate";

type State = ReturnType<typeof useLayoutDrawingStore.getState>;
type Rows = Pick<State, "levels" | "walls" | "doors" | "windows" | "slabs" | "columns" | "beams" | "mepEquipment" | "ducts" | "pipes" | "cableTrays">;
const collection = (kind: Exclude<AiAction["kind"], "delete">): keyof Rows => ({
  level: "levels",
  wall: "walls",
  door: "doors",
  window: "windows",
  floor: "slabs",
  roof: "slabs",
  column: "columns",
  beam: "beams",
  equipment: "mepEquipment",
  duct: "ducts",
  pipe: "pipes",
  cabletray: "cableTrays",
} as const)[kind];

export function currentAiContext(): AiContext {
  const s = useLayoutDrawingStore.getState();
  if (!s.projectId) throw new Error("Open or create a project before using AI.");
  const elements: AiContext["elements"] = [];
  function add(kind: AiContext["elements"][number]["kind"], rows: Array<{ id: string; levelId?: string; wallId?: string }>) {
    for (const row of rows) elements.push({ id: row.id, kind, levelId: row.levelId, wallId: row.wallId, properties: { ...row } });
  }
  add("level", s.levels); add("wall", s.walls); add("door", s.doors); add("window", s.windows);
  add("floor", s.slabs.filter(p => p.kind === "floor")); add("roof", s.slabs.filter(p => p.kind === "roof"));
  add("column", s.columns); add("beam", s.beams); add("equipment", s.mepEquipment);
  add("cabletray", s.cableTrays); add("duct", s.ducts); add("pipe", s.pipes);
  return contextSchema.parse({
    projectId: s.projectId,
    activeLevelId: useToolMarkupStore.getState().markupFloorId ?? s.levels[0]?.id ?? null,
    elements,
    selection: s.selectedElements,
    defaults: { wallHeightMm: s.draftWallHeightMm, wallThicknessMm: s.draftWallThicknessMm },
  });
}

export function aiFingerprint() {
  const s = useLayoutDrawingStore.getState();
  return JSON.stringify({ snapshot: takeWerkzeugSnapshot(), locked: s.lockedElementKeys, groups: s.groups, activeLevelId: useToolMarkupStore.getState().markupFloorId, selection: s.selectedElements });
}

// These arrays are private copies: update in place during assembly, publish once.
function upsert<T extends { id: string }>(rows: T[], value: T) {
  const index = rows.findIndex(row => row.id === value.id);
  if (index === -1) rows.push(value);
  else rows[index] = value;
  return rows;
}

export function prepareAiChanges(plan: AiPlan, state: State, makeId = () => `ai-${crypto.randomUUID()}`) {
  const next: Rows = {
    levels: state.levels,
    walls: state.walls,
    doors: state.doors,
    windows: state.windows,
    slabs: state.slabs,
    columns: state.columns,
    beams: state.beams,
    mepEquipment: state.mepEquipment,
    ducts: state.ducts,
    pipes: state.pipes,
    cableTrays: state.cableTrays,
  };
  const copied = new Set<keyof Rows>();
  const aliases = new Map(plan.actions.filter(a => a.kind !== "delete" && a.operation === "create").map(a => [a.id, makeId()]));
  const resolve = (id: string) => aliases.get(id) ?? id;
  const changes: AiDbChange[] = [];
  for (const action of plan.actions) {
    const kind = action.kind === "delete" ? action.targetKind : action.kind;
    const key = collection(kind);
    if (!copied.has(key)) {
      Object.assign(next, { [key]: [...next[key]] });
      copied.add(key);
    }
    const id = resolve(action.id);
    const old = next[key].find(row => row.id === id);
    const lockKind = kind === "floor" || kind === "roof" ? "slab" : kind;
    if (state.lockedElementKeys.includes(`${lockKind}:${id}`)) throw new Error(`Element ${id} is locked.`);
    if (state.groups.some(g => JSON.stringify(g).includes(`"${id}"`))) throw new Error(`Element ${id} belongs to a group. Edit it manually.`);
    if (action.kind === "delete") {
      // Dependencies outside the AI context must not be orphaned.
      const dependants = [...state.slabs, ...state.walls, ...state.mepEquipment, ...state.ducts, ...state.pipes, ...state.wires, ...state.cableTrays];
      if (dependants.some(row => row.id !== id && JSON.stringify(row).includes(`"${id}"`))) throw new Error(`Element ${id} has dependent geometry. Remove its constraints manually first.`);
      Object.assign(next, { [key]: next[key].filter(row => row.id !== id) });
      changes.push({ store: key, id });
      continue;
    }
    const common = { id, projectId: state.projectId!, createdAt: old?.createdAt ?? Date.now() };
    let value: Rows[keyof Rows][number];
    switch (action.kind) {
      case "level": {
        value = { ...next.levels.find(row => row.id === id), ...common, name: action.name, elevationMm: action.elevationMm, heightMm: action.heightMm };
        next.levels = upsert(next.levels, value); break;
      }
      case "wall": {
        value = { ...next.walls.find(row => row.id === id), ...common, levelId: resolve(action.levelId), startXmm: action.startXmm, startYmm: action.startYmm, endXmm: action.endXmm, endYmm: action.endYmm, thicknessMm: action.thicknessMm, heightMm: action.heightMm,
          ...(action.wallType ? { wallType: action.wallType } : {}),
          ...(action.wallType === "curtain" ? { isCurtainWall: true, wallTypeId: "curtain-wall", curtainGrid: { verticalSpacingMm: 1500, horizontalSpacingMm: 1500, mullionWidthMm: 50, mullionDepthMm: 100, panelMaterial: "glass" } } : {}) };
        next.walls = upsert(next.walls, value); break;
      }
      case "door": {
        value = { ...next.doors.find(row => row.id === id), ...common, wallId: resolve(action.wallId), positionMm: action.positionMm, widthMm: action.widthMm, heightMm: action.heightMm, hinge: action.hinge, swing: action.swing, style: action.style };
        next.doors = upsert(next.doors, value); break;
      }
      case "window": {
        value = { ...next.windows.find(row => row.id === id), ...common, wallId: resolve(action.wallId), positionMm: action.positionMm, widthMm: action.widthMm, heightMm: action.heightMm, sillHeightMm: action.sillHeightMm, operation: action.operationType };
        next.windows = upsert(next.windows, value); break;
      }
      case "floor": case "roof": {
        const xs = action.boundary.map(p => p.xMm), ys = action.boundary.map(p => p.yMm);
        value = { ...next.slabs.find(row => row.id === id), ...common, levelId: resolve(action.levelId), kind: action.kind, boundary: action.boundary, minXmm: Math.min(...xs), maxXmm: Math.max(...xs), minYmm: Math.min(...ys), maxYmm: Math.max(...ys), thicknessMm: action.thicknessMm, elevationOffsetMm: action.elevationOffsetMm, roofPreset: action.roofPreset, autoBoundaryFromWalls: false,
          edgeSlopes: action.boundary.map((_, edgeIdx) => ({ edgeIdx, pitchDeg: action.pitchDeg, isSloped: action.roofPreset === "hip" || (action.roofPreset === "gable" && edgeIdx % 2 === 0) || (action.roofPreset === "shed" && edgeIdx === 0) })) };
        next.slabs = upsert(next.slabs, value); break;
      }
      case "column": {
        value = { ...next.columns.find(row => row.id === id), ...common, levelId: resolve(action.levelId), xMm: action.xMm, yMm: action.yMm, profile: action.profile, widthMm: action.widthMm, depthMm: action.depthMm, heightMm: action.heightMm };
        next.columns = upsert(next.columns, value); break;
      }
      case "beam": {
        value = { ...next.beams.find(row => row.id === id), ...common, levelId: resolve(action.levelId), startXmm: action.startXmm, startYmm: action.startYmm, endXmm: action.endXmm, endYmm: action.endYmm, profile: action.profile, widthMm: action.widthMm, depthMm: action.depthMm, elevationOffsetMm: action.elevationOffsetMm };
        next.beams = upsert(next.beams, value); break;
      }
      case "equipment": {
        const preset = COMPONENT_CATALOG.find(p => p.id === action.familyId);
        if (!preset) throw new Error("Unsupported furniture or equipment family.");
        value = { ...next.mepEquipment.find(row => row.id === id), ...common, levelId: resolve(action.levelId), ...(action.connectedHostId ? { connectedHostId: resolve(action.connectedHostId) } : {}), familyId: preset.id, name: preset.name, category: preset.category, widthMm: action.widthMm ?? preset.widthMm, depthMm: action.depthMm ?? preset.depthMm, heightMm: action.heightMm ?? preset.heightMm, ...(action.color ? { color: action.color } : {}), xMm: action.xMm, yMm: action.yMm, elevationMm: action.elevationMm, rotationDeg: action.rotationDeg };
        next.mepEquipment = upsert(next.mepEquipment, value); break;
      }
      case "duct": {
        value = {
          ...next.ducts.find(row => row.id === id),
          ...common,
          levelId: resolve(action.levelId),
          startXmm: action.startXmm,
          startYmm: action.startYmm,
          endXmm: action.endXmm,
          endYmm: action.endYmm,
          elevationMm: action.elevationOffsetMm,
          shape: action.shape,
          widthMm: action.widthMm,
          heightMm: action.heightMm,
          diameterMm: action.diameterMm,
          systemType: action.systemType === "fresh_air" ? "outdoor" : action.systemType,
        };
        next.ducts = upsert(next.ducts, value); break;
      }
      case "cabletray": {
        value = { ...next.cableTrays.find(row => row.id === id), ...common, levelId: resolve(action.levelId), startXmm: action.startXmm, startYmm: action.startYmm, endXmm: action.endXmm, endYmm: action.endYmm, elevationMm: action.elevationOffsetMm, widthMm: action.widthMm, heightMm: action.heightMm, trayType: action.trayType };
        next.cableTrays = upsert(next.cableTrays, value); break;
      }
      case "pipe": {
        value = {
          ...next.pipes.find(row => row.id === id),
          ...common,
          levelId: resolve(action.levelId),
          startXmm: action.startXmm,
          startYmm: action.startYmm,
          endXmm: action.endXmm,
          endYmm: action.endYmm,
          elevationMm: action.elevationOffsetMm,
          diameterMm: action.diameterMm,
          systemType: action.systemType,
          slopePercent: action.slopePercent,
        };
        next.pipes = upsert(next.pipes, value); break;
      }
    }
    changes.push({ store: key, id, value });
  }
  return { next, changes };
}

let applying = false;
export async function applyAiPlan(plan: AiPlan, fingerprint: string, live = false) {
  if (applying || isWerkzeugHistoryRestoring()) throw new Error("Another model operation is still running.");
  const fresh = () => aiFingerprint() === fingerprint && !isWerkzeugHistoryRestoring();
  if (!fresh()) throw new Error("The project changed. Generate a new preview before applying.");
  const validated = validatePlan(plan, currentAiContext());
  const { next, changes } = prepareAiChanges(validated, useLayoutDrawingStore.getState());
  applying = true;
  try {
    await idbApplyAiChanges(changes, abort => {
      if (!fresh()) { abort(); throw new Error("The project changed. Generate a new preview."); }
      const check = () => { if (!fresh()) abort(); };
      const unsubscribe = useLayoutDrawingStore.subscribe(check);
      const unsubscribeMarkup = useToolMarkupStore.subscribe(check);
      return () => { unsubscribe(); unsubscribeMarkup(); };
    });
    pushWerkzeugHistory();
    if (live) {
      // Persist atomically first, then reveal committed geometry in bounded visual batches.
      const visible = { ...useLayoutDrawingStore.getState() };
      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const key = change.store as keyof Rows;
        Object.assign(visible, { [key]: [...visible[key].filter(row => row.id !== change.id), ...(change.value ? [change.value] : [])] });
        if (i % 5 === 4 || i === changes.length - 1) {
          useLayoutDrawingStore.setState(Object.fromEntries(Object.keys(next).map(key => [key, visible[key as keyof Rows]])));
          await new Promise(resolve => setTimeout(resolve, 60));
        }
      }
    }
    useLayoutDrawingStore.setState({
      ...next,
      selectedElements: [],
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedDuctId: null,
      selectedPipeId: null,
      lastMutatedAt: Date.now(),
    });
  } finally { applying = false; }
}
