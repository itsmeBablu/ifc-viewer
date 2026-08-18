"use client";

import { create } from "zustand";
import {
  DEFAULT_DOOR_HEIGHT_MM,
  DEFAULT_DOOR_WIDTH_MM,
  DEFAULT_LEVEL_HEIGHT_MM,
  DEFAULT_SLAB_THICKNESS_MM,
  DEFAULT_WALL_THICKNESS_MM,
  DEFAULT_WINDOW_HEIGHT_MM,
  DEFAULT_WINDOW_SILL_MM,
  DEFAULT_WINDOW_WIDTH_MM,
  EMPTY_LAYOUT_PRESETS,
  emptyProjectKey,
  newLayoutId,
  normalizeDoor,
  rememberDoorSize,
  rememberNumber,
  rememberWindowSize,
  snapWallEndpointMm,
  type LayoutDoor,
  type LayoutLevel,
  type LayoutPresets,
  type LayoutRoom,
  type LayoutSlab,
  type LayoutToolId,
  type LayoutWall,
  type LayoutWindow,
} from "@/lib/layoutDrawing";
import {
  idbDeleteDoor,
  idbDeleteLevel,
  idbDeleteSlab,
  idbDeleteUnderlay,
  idbDeleteWall,
  idbDeleteWindow,
  idbGetPresets,
  idbListDoors,
  idbListLevels,
  idbListSlabs,
  idbListUnderlays,
  idbListWalls,
  idbListWindows,
  idbPutDoor,
  idbPutLevel,
  idbPutPresets,
  idbPutSlab,
  idbPutUnderlay,
  idbPutWall,
  idbPutWindow,
} from "@/lib/layoutDrawingDb";
import {
  calibrateUnderlayFromWorldPoints,
  createUnderlayRecord,
  ingestReferenceDrawingFile,
  type ReferenceUnderlay,
} from "@/lib/referenceUnderlay";
import { snapPlanToUnderlayLines } from "@/lib/underlaySnap";
import {
  detectTraceCandidatesNearPoint,
  type TraceCandidate,
  type TraceCandidateKind,
} from "@/lib/underlayTrace";
import { detectWallThicknessFromUnderlay } from "@/lib/underlayWallTrace";
import {
  clearWerkzeugHistory,
  pushWerkzeugHistory,
} from "@/lib/werkzeugHistory";

export type WallDrawState = {
  levelId: string;
  /** Polyline points in plan mm (X, Y=Z). */
  points: { xMm: number; yMm: number }[];
  /** Live cursor while drawing. */
  cursor: { xMm: number; yMm: number } | null;
  /** Live angle assist readout. */
  angleDeg: number | null;
  angleSnapped: boolean;
  lengthMm: number | null;
  /** Active snap type indicator shown in HUD. */
  snapType?: "endpoint" | "midpoint" | "center" | "intersection" | "perpendicular" | "extension" | null;
} | null;

export type SlabDrawState = {
  kind: "floor" | "roof";
  levelId: string;
  /** First corner; null until first click. */
  start: { xMm: number; yMm: number } | null;
  cursor: { xMm: number; yMm: number } | null;
} | null;

/** Tier 2 hover auto-trace preview (Tab cycles candidates). */
export type TracePreviewState = {
  levelId: string;
  tool: TraceCandidateKind;
  candidates: TraceCandidate[];
  index: number;
  cursor: { xMm: number; yMm: number };
} | null;

type LayoutDrawingState = {
  projectId: string | null;
  /** True when project was created without an IFC. */
  isEmptyProject: boolean;
  /** Last layout mutation time (for unsaved-work guards). */
  lastMutatedAt: number;
  levels: LayoutLevel[];
  walls: LayoutWall[];
  doors: LayoutDoor[];
  windows: LayoutWindow[];
  slabs: LayoutSlab[];
  layoutRooms: LayoutRoom[];
  drawingScale: "1:20" | "1:50" | "1:100" | "1:200" | "1:500";
  underlays: ReferenceUnderlay[];
  presets: LayoutPresets;
  armedLayoutTool: LayoutToolId | null;
  wallDraw: WallDrawState;
  slabDraw: SlabDrawState;
  tracePreview: TracePreviewState;
  selectedWallId: string | null;
  selectedDoorId: string | null;
  selectedWindowId: string | null;
  selectedSlabId: string | null;
  selectedUnderlayId: string | null;
  /** Two-point calibrate mode for the selected underlay. */
  calibrateUnderlayId: string | null;
  calibratePoints: { xMm: number; yMm: number }[];
  /** Active draw thickness (mm) — remembered after draw. */
  draftWallThicknessMm: number;
  draftDoorWidthMm: number;
  draftDoorHeightMm: number;
  draftWindowWidthMm: number;
  draftWindowHeightMm: number;
  draftWindowSillMm: number;
  draftSlabThicknessMm: number;

  loadForProject: (projectId: string | null, isEmpty?: boolean) => Promise<void>;
  createEmptyProject: (name: string) => Promise<{
    projectId: string;
    level: LayoutLevel;
  }>;
  addLevel: (opts?: { name?: string; elevationMm?: number; heightMm?: number }) => Promise<LayoutLevel | null>;
  updateLevel: (
    id: string,
    patch: Partial<Pick<LayoutLevel, "name" | "elevationMm" | "heightMm">>,
  ) => Promise<void>;
  deleteLevel: (id: string) => Promise<void>;
  setDrawingScale: (scale: "1:20" | "1:50" | "1:100" | "1:200" | "1:500") => void;
  addRoom: (room: Omit<LayoutRoom, "id" | "projectId" | "levelId" | "createdAt">) => void;
  updateRoom: (id: string, patch: Partial<LayoutRoom>) => void;
  deleteRoom: (id: string) => void;

  setArmedLayoutTool: (tool: LayoutToolId | null) => void;
  setDraftWallThicknessMm: (mm: number) => void;
  setDraftDoorSize: (widthMm: number, heightMm: number) => void;
  setDraftWindowSize: (
    widthMm: number,
    heightMm: number,
    sillHeightMm: number,
  ) => void;

  beginWallDraw: (levelId: string, start: { xMm: number; yMm: number }) => void;
  updateWallCursor: (cursor: { xMm: number; yMm: number } | null) => void;
  addWallPoint: (point: { xMm: number; yMm: number }) => Promise<LayoutWall | null>;
  finishWallDraw: () => void;
  cancelWallDraw: () => void;

  updateWall: (
    id: string,
    patch: Partial<
      Pick<
        LayoutWall,
        | "startXmm"
        | "startYmm"
        | "endXmm"
        | "endYmm"
        | "thicknessMm"
        | "heightMm"
        | "curved"
        | "arcCenterXmm"
        | "arcCenterYmm"
        | "arcRadiusMm"
        | "arcStartAngleDeg"
        | "arcEndAngleDeg"
        | "color"
        | "material"
      >
    >,
  ) => Promise<void>;
  deleteWall: (id: string) => Promise<void>;
  selectWall: (id: string | null) => void;
  duplicateWall: (id: string) => Promise<LayoutWall | null>;
  /** Set a straight wall to follow an arc. */
  setWallCurved: (
    wallId: string,
    arcCenter: { xMm: number; yMm: number },
    arcRadiusMm: number,
  ) => void;

  placeDoorOnWall: (
    wallId: string,
    positionMm: number,
    opts?: {
      widthMm?: number;
      heightMm?: number;
      hinge?: "start" | "end";
      swing?: 1 | -1;
    },
  ) => Promise<LayoutDoor | null>;
  updateDoor: (
    id: string,
    patch: Partial<
      Pick<
        LayoutDoor,
        "positionMm" | "widthMm" | "heightMm" | "hinge" | "swing"
      >
    >,
  ) => Promise<void>;
  deleteDoor: (id: string) => Promise<void>;
  selectDoor: (id: string | null) => void;
  duplicateDoor: (id: string) => Promise<LayoutDoor | null>;

  placeWindowOnWall: (
    wallId: string,
    positionMm: number,
    opts?: {
      widthMm?: number;
      heightMm?: number;
      sillHeightMm?: number;
    },
  ) => Promise<LayoutWindow | null>;
  updateWindow: (
    id: string,
    patch: Partial<
      Pick<
        LayoutWindow,
        | "positionMm"
        | "widthMm"
        | "heightMm"
        | "sillHeightMm"
        | "headShape"
        | "color"
      >
    >,
  ) => Promise<void>;
  deleteWindow: (id: string) => Promise<void>;
  selectWindow: (id: string | null) => void;
  duplicateWindow: (id: string) => Promise<LayoutWindow | null>;

  setDraftSlabThicknessMm: (mm: number) => void;
  refreshTracePreview: (
    levelId: string,
    tool: TraceCandidateKind,
    cursor: { xMm: number; yMm: number },
    underlayId?: string | null,
  ) => Promise<void>;
  cycleTraceCandidate: (dir?: 1 | -1) => void;
  clearTracePreview: () => void;
  confirmTraceCandidate: () => Promise<
    LayoutWall | LayoutDoor | LayoutWindow | null
  >;
  beginSlabDraw: (kind: "floor" | "roof", levelId: string) => void;
  updateSlabCursor: (cursor: { xMm: number; yMm: number } | null) => void;
  addSlabCorner: (
    point: { xMm: number; yMm: number },
  ) => Promise<LayoutSlab | null>;
  cancelSlabDraw: () => void;
  updateSlab: (
    id: string,
    patch: Partial<
      Pick<
        LayoutSlab,
        | "minXmm"
        | "minYmm"
        | "maxXmm"
        | "maxYmm"
        | "thicknessMm"
        | "elevationOffsetMm"
        | "boundary"
        | "holes"
        | "edgeSlopes"
        | "color"
        | "material"
      >
    >,
  ) => Promise<void>;
  deleteSlab: (id: string) => Promise<void>;
  selectSlab: (id: string | null) => void;
  duplicateSlab: (id: string) => Promise<LayoutSlab | null>;

  addUnderlayFromFile: (
    levelId: string,
    file: File,
  ) => Promise<ReferenceUnderlay | null>;
  updateUnderlay: (
    id: string,
    patch: Partial<
      Pick<
        ReferenceUnderlay,
        | "mmPerPixel"
        | "offsetXmm"
        | "offsetYmm"
        | "rotationDeg"
        | "opacity"
        | "locked"
      >
    >,
  ) => Promise<void>;
  deleteUnderlay: (id: string) => Promise<void>;
  selectUnderlay: (id: string | null) => void;
  beginCalibrateUnderlay: (id: string) => void;
  cancelCalibrateUnderlay: () => void;
  addCalibratePoint: (pt: { xMm: number; yMm: number }) => void;
  commitCalibrateDistance: (distanceMm: number) => Promise<void>;

  clearLayoutSelection: () => void;
};

async function persistPresets(projectId: string, presets: LayoutPresets) {
  await idbPutPresets(projectId, presets);
}

export const useLayoutDrawingStore = create<LayoutDrawingState>((set, get) => ({
  projectId: null,
  isEmptyProject: false,
  lastMutatedAt: 0,
  levels: [],
  walls: [],
  doors: [],
  windows: [],
  slabs: [],
    layoutRooms: [],
    drawingScale: "1:100",
  underlays: [],
  presets: { ...EMPTY_LAYOUT_PRESETS },
  armedLayoutTool: null,
  wallDraw: null,
  slabDraw: null,
  tracePreview: null,
  selectedWallId: null,
  selectedDoorId: null,
  selectedWindowId: null,
  selectedSlabId: null,
  selectedUnderlayId: null,
  calibrateUnderlayId: null,
  calibratePoints: [],
  draftWallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
  draftDoorWidthMm: DEFAULT_DOOR_WIDTH_MM,
  draftDoorHeightMm: DEFAULT_DOOR_HEIGHT_MM,
  draftWindowWidthMm: DEFAULT_WINDOW_WIDTH_MM,
  draftWindowHeightMm: DEFAULT_WINDOW_HEIGHT_MM,
  draftWindowSillMm: DEFAULT_WINDOW_SILL_MM,
  draftSlabThicknessMm: DEFAULT_SLAB_THICKNESS_MM,

  loadForProject: async (projectId, isEmpty = false) => {
    clearWerkzeugHistory();

    if (!projectId) {
      set({
        projectId: null,
        isEmptyProject: false,
        lastMutatedAt: 0,
        levels: [],
        walls: [],
        doors: [],
        windows: [],
        slabs: [],
    layoutRooms: [],
    drawingScale: "1:100",
        underlays: [],
        presets: { ...EMPTY_LAYOUT_PRESETS },
        armedLayoutTool: null,
        wallDraw: null,
        slabDraw: null,
        tracePreview: null,
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedSlabId: null,
        selectedUnderlayId: null,
        calibrateUnderlayId: null,
        calibratePoints: [],
      });
      return;
    }
    const [levels, walls, doors, windows, slabs, underlays, presets] =
      await Promise.all([
        idbListLevels(projectId),
        idbListWalls(projectId),
        idbListDoors(projectId),
        idbListWindows(projectId),
        idbListSlabs(projectId),
        idbListUnderlays(projectId),
        idbGetPresets(projectId),
      ]);
    levels.sort((a, b) => a.elevationMm - b.elevationMm);
    set({
      projectId,
      isEmptyProject: isEmpty || projectId.startsWith("empty:"),
      lastMutatedAt: 0,
      levels,
      walls,
      doors: doors.map((d) => normalizeDoor(d)),
      windows,
      slabs,
      underlays,
      presets,
      armedLayoutTool: null,
      wallDraw: null,
      slabDraw: null,
      tracePreview: null,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      calibrateUnderlayId: null,
      calibratePoints: [],
      draftWallThicknessMm:
        presets.wallThicknessMm[0] ?? DEFAULT_WALL_THICKNESS_MM,
      draftDoorWidthMm: presets.doorSizes[0]?.widthMm ?? DEFAULT_DOOR_WIDTH_MM,
      draftDoorHeightMm:
        presets.doorSizes[0]?.heightMm ?? DEFAULT_DOOR_HEIGHT_MM,
      draftWindowWidthMm:
        presets.windowSizes[0]?.widthMm ?? DEFAULT_WINDOW_WIDTH_MM,
      draftWindowHeightMm:
        presets.windowSizes[0]?.heightMm ?? DEFAULT_WINDOW_HEIGHT_MM,
      draftWindowSillMm:
        presets.windowSizes[0]?.sillHeightMm ?? DEFAULT_WINDOW_SILL_MM,
      draftSlabThicknessMm: DEFAULT_SLAB_THICKNESS_MM,
    });
  },

  createEmptyProject: async (name) => {
    clearWerkzeugHistory();

    const projectId = emptyProjectKey(name);
    const level: LayoutLevel = {
      id: newLayoutId("lvl"),
      projectId,
      name: "EG",
      elevationMm: 0,
      heightMm: DEFAULT_LEVEL_HEIGHT_MM,
      createdAt: Date.now(),
    };
    await idbPutLevel(level);
    await idbPutPresets(projectId, { ...EMPTY_LAYOUT_PRESETS });
    await get().loadForProject(projectId, true);
    return { projectId, level };
  },

  addLevel: async (opts) => {
    pushWerkzeugHistory();

    const projectId = get().projectId;
    if (!projectId) return null;
    const levels = get().levels;
    const maxElev = levels.reduce((m, l) => Math.max(m, l.elevationMm), -DEFAULT_LEVEL_HEIGHT_MM);
    const elevationMm =
      opts?.elevationMm ?? maxElev + DEFAULT_LEVEL_HEIGHT_MM;
    const heightMm = opts?.heightMm ?? DEFAULT_LEVEL_HEIGHT_MM;
    const n = levels.length;
    const name =
      opts?.name ??
      (n === 0 ? "EG" : n === 1 ? "OG1" : `OG${n}`);
    const level: LayoutLevel = {
      id: newLayoutId("lvl"),
      projectId,
      name,
      elevationMm,
      heightMm,
      createdAt: Date.now(),
    };
    await idbPutLevel(level);
    set({
      levels: [...levels, level].sort((a, b) => a.elevationMm - b.elevationMm),
      lastMutatedAt: Date.now(),
    });
    return level;
  },

  updateLevel: async (id, patch) => {
    pushWerkzeugHistory();

    const level = get().levels.find((l) => l.id === id);
    if (!level) return;
    const next = { ...level, ...patch };
    await idbPutLevel(next);
    set({
      levels: get()
        .levels.map((l) => (l.id === id ? next : l))
        .sort((a, b) => a.elevationMm - b.elevationMm),
      lastMutatedAt: Date.now(),
    });
  },

  deleteLevel: async (id) => {
    pushWerkzeugHistory();

    const walls = get().walls.filter((w) => w.levelId === id);
    for (const w of walls) {
      await get().deleteWall(w.id);
    }
    const underlays = get().underlays.filter((u) => u.levelId === id);
    for (const u of underlays) {
      await idbDeleteUnderlay(u.id);
    }
    const slabs = get().slabs.filter((s) => s.levelId === id);
    for (const s of slabs) {
      await idbDeleteSlab(s.id);
    }
    await idbDeleteLevel(id);
    set({
      levels: get().levels.filter((l) => l.id !== id),
      underlays: get().underlays.filter((u) => u.levelId !== id),
      slabs: get().slabs.filter((s) => s.levelId !== id),
      selectedUnderlayId:
        get().selectedUnderlayId &&
        underlays.some((u) => u.id === get().selectedUnderlayId)
          ? null
          : get().selectedUnderlayId,
      selectedSlabId:
        get().selectedSlabId && slabs.some((s) => s.id === get().selectedSlabId)
          ? null
          : get().selectedSlabId,
      lastMutatedAt: Date.now(),
    });
  },

  setDrawingScale: (scale) => set({ drawingScale: scale }),
  addRoom: (r) => {
    const activeLevelId = get().levels[0]?.id || "default-level";
    const room: LayoutRoom = {
      id: newLayoutId("rm"),
      projectId: get().projectId || "default",
      levelId: activeLevelId,
      name: r.name,
      number: r.number,
      areaSqM: r.areaSqM,
      boundaryPoints: r.boundaryPoints,
      tagPosMm: r.tagPosMm,
      createdAt: Date.now(),
    };
    set((s) => ({ layoutRooms: [...(s.layoutRooms || []), room] }));
  },
  updateRoom: (id, patch) => {
    set((s) => ({
      layoutRooms: (s.layoutRooms || []).map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    }));
  },
  deleteRoom: (id) => {
    set((s) => ({
      layoutRooms: (s.layoutRooms || []).filter((r) => r.id !== id),
    }));
  },

  setArmedLayoutTool: (tool) => {
    set({
      armedLayoutTool: tool,
      wallDraw: null,
      slabDraw: null,
      tracePreview: null,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
    });
    if (
      (tool === "wall" || tool === "door" || tool === "window") &&
      typeof window !== "undefined"
    ) {
      void import("@/lib/opencvLoader")
        .then((m) => m.loadOpenCv())
        .catch(() => {});
    }
  },

  setDraftWallThicknessMm: (mm) =>
    set({ draftWallThicknessMm: Math.max(50, Math.round(mm)) }),

  setDraftDoorSize: (widthMm, heightMm) =>
    set({
      draftDoorWidthMm: Math.max(300, Math.round(widthMm)),
      draftDoorHeightMm: Math.max(600, Math.round(heightMm)),
    }),

  setDraftWindowSize: (widthMm, heightMm, sillHeightMm) =>
    set({
      draftWindowWidthMm: Math.max(200, Math.round(widthMm)),
      draftWindowHeightMm: Math.max(200, Math.round(heightMm)),
      draftWindowSillMm: Math.max(0, Math.round(sillHeightMm)),
    }),

  setDraftSlabThicknessMm: (mm) =>
    set({ draftSlabThicknessMm: Math.max(50, Math.round(mm)) }),

  refreshTracePreview: async (levelId, tool, cursor, underlayId) => {
    if (get().wallDraw || get().slabDraw) {
      set({ tracePreview: null });
      return;
    }
    const { resolveUnderlayForTrace } = await import("@/lib/underlayTrace");
    const underlay = resolveUnderlayForTrace(
      get().underlays,
      levelId,
      cursor,
      underlayId,
    );
    const effectiveLevelId = underlay?.levelId ?? levelId;
    const candidates = await detectTraceCandidatesNearPoint(
      cursor,
      get().underlays,
      effectiveLevelId,
      tool,
      underlayId,
      get().walls,
    );
    // Ignore stale results if tool changed mid-flight
    const armed = get().armedLayoutTool;
    if (armed !== tool) return;
    if (!candidates.length) {
      set({ tracePreview: null });
      return;
    }
    const prev = get().tracePreview;
    let index = 0;
    if (
      prev &&
      prev.levelId === effectiveLevelId &&
      prev.tool === tool &&
      prev.candidates[prev.index]
    ) {
      const keepId = prev.candidates[prev.index]!.id;
      const found = candidates.findIndex((c) => c.id === keepId);
      if (found >= 0) index = found;
    }
    set({
      tracePreview: {
        levelId: effectiveLevelId,
        tool,
        candidates,
        index,
        cursor,
      },
    });
  },

  cycleTraceCandidate: (dir = 1) => {
    const prev = get().tracePreview;
    if (!prev || prev.candidates.length < 2) return;
    const n = prev.candidates.length;
    const index = (prev.index + dir + n * 10) % n;
    set({ tracePreview: { ...prev, index } });
  },

  clearTracePreview: () => set({ tracePreview: null }),

  confirmTraceCandidate: async () => {
    const preview = get().tracePreview;
    const projectId = get().projectId;
    if (!preview || !projectId) return null;
    const cand = preview.candidates[preview.index];
    if (!cand) return null;

    if (cand.kind === "wall") {
      const level = get().levels.find((l) => l.id === preview.levelId);
      const wall: LayoutWall = {
        id: newLayoutId("wall"),
        projectId,
        levelId: preview.levelId,
        startXmm: cand.startXmm,
        startYmm: cand.startYmm,
        endXmm: cand.endXmm,
        endYmm: cand.endYmm,
        thicknessMm: cand.thicknessMm,
        heightMm: level?.heightMm ?? DEFAULT_LEVEL_HEIGHT_MM,
        createdAt: Date.now(),
      };
      pushWerkzeugHistory();
      await idbPutWall(wall);
      const presets = {
        ...get().presets,
        wallThicknessMm: rememberNumber(
          get().presets.wallThicknessMm,
          wall.thicknessMm,
        ),
      };
      await persistPresets(projectId, presets);
      set({
        walls: [...get().walls, wall],
        presets,
        draftWallThicknessMm: wall.thicknessMm,
        selectedWallId: wall.id,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedSlabId: null,
        tracePreview: null,
        lastMutatedAt: Date.now(),
      });
      return wall;
    }

    // Door / window: attach to existing wall only (never auto-create)
    const host =
      (cand.wallId
        ? get().walls.find((w) => w.id === cand.wallId)
        : null) ?? null;
    if (!host) return null;

    const wallId = host.id;
    const positionMm = cand.positionMm ?? 0;
    const widthMm =
      cand.widthMm ??
      (cand.kind === "door"
        ? get().draftDoorWidthMm
        : get().draftWindowWidthMm);

    if (cand.kind === "door") {
      set({ draftDoorWidthMm: widthMm });
      const door = await get().placeDoorOnWall(wallId, positionMm, {
        widthMm,
        hinge: cand.hinge,
        swing: cand.swing,
      });
      set({ tracePreview: null });
      return door;
    }

    set({ draftWindowWidthMm: widthMm });
    const win = await get().placeWindowOnWall(wallId, positionMm, {
      widthMm,
    });
    set({ tracePreview: null });
    return win;
  },

  beginWallDraw: (levelId, start) => {
    const underSnap = snapPlanToUnderlayLines(
      start,
      get().underlays,
      levelId,
    );
    const pt = { xMm: underSnap.xMm, yMm: underSnap.yMm };
    set({
      wallDraw: {
        levelId,
        points: [pt],
        cursor: pt,
        angleDeg: null,
        angleSnapped: false,
        lengthMm: null,
      },
      slabDraw: null,
      tracePreview: null,
      armedLayoutTool: "wall",
    });
  },

  updateWallCursor: (cursor) => {
    const draw = get().wallDraw;
    if (!draw) return;
    if (!cursor) {
      set({
        wallDraw: {
          ...draw,
          cursor: null,
          angleDeg: null,
          angleSnapped: false,
          lengthMm: null,
        },
      });
      return;
    }
    const last = draw.points[draw.points.length - 1];
    if (!last) {
      const underSnap = snapPlanToUnderlayLines(
        cursor,
        get().underlays,
        draw.levelId,
      );
      set({
        wallDraw: {
          ...draw,
          cursor: { xMm: underSnap.xMm, yMm: underSnap.yMm },
        },
      });
      return;
    }
    const prevFrom =
      draw.points.length >= 2 ? draw.points[draw.points.length - 2] : null;
    const snapped = snapWallEndpointMm(last, cursor, { prevFrom });
    const underSnap = snapPlanToUnderlayLines(
      snapped.point,
      get().underlays,
      draw.levelId,
    );
    const point = underSnap.snapped
      ? { xMm: underSnap.xMm, yMm: underSnap.yMm }
      : snapped.point;
    const lengthMm = Math.hypot(point.xMm - last.xMm, point.yMm - last.yMm);
    set({
      wallDraw: {
        ...draw,
        cursor: point,
        angleDeg: snapped.angleDeg,
        angleSnapped: snapped.snapped || underSnap.snapped,
        lengthMm,
      },
    });
  },

  addWallPoint: async (point) => {
    const draw = get().wallDraw;
    const projectId = get().projectId;
    if (!draw || !projectId) return null;
    const last = draw.points[draw.points.length - 1];
    if (!last) {
      set({
        wallDraw: {
          ...draw,
          points: [point],
          cursor: point,
          angleDeg: null,
          angleSnapped: false,
          lengthMm: null,
        },
      });
      return null;
    }
    const prevFrom =
      draw.points.length >= 2 ? draw.points[draw.points.length - 2] : null;
    const snapped = snapWallEndpointMm(last, point, { prevFrom });
    const underSnap = snapPlanToUnderlayLines(
      snapped.point,
      get().underlays,
      draw.levelId,
    );
    const end = underSnap.snapped
      ? { xMm: underSnap.xMm, yMm: underSnap.yMm }
      : snapped.point;
    const dx = end.xMm - last.xMm;
    const dy = end.yMm - last.yMm;
    if (Math.hypot(dx, dy) < 50) return null;

    const level = get().levels.find((l) => l.id === draw.levelId);
    let thicknessMm = get().draftWallThicknessMm;
    let autoThickness = false;
    try {
      const detected = await detectWallThicknessFromUnderlay(
        last,
        end,
        get().underlays,
        draw.levelId,
      );
      if (detected && detected.confidence >= 0.35) {
        thicknessMm = Math.max(
          50,
          Math.min(450, Math.round(detected.thicknessMm)),
        );
        autoThickness = true;
      }
    } catch {
      // keep draft thickness
    }
    const heightMm = level?.heightMm ?? DEFAULT_LEVEL_HEIGHT_MM;
    const wall: LayoutWall = {
      id: newLayoutId("wall"),
      projectId,
      levelId: draw.levelId,
      startXmm: last.xMm,
      startYmm: last.yMm,
      endXmm: end.xMm,
      endYmm: end.yMm,
      thicknessMm,
      heightMm,
      createdAt: Date.now(),
    };
    pushWerkzeugHistory();
    await idbPutWall(wall);
    const presets = {
      ...get().presets,
      wallThicknessMm: rememberNumber(get().presets.wallThicknessMm, thicknessMm),
    };
    await persistPresets(projectId, presets);
    set({
      walls: [...get().walls, wall],
      presets,
      draftWallThicknessMm: autoThickness
        ? thicknessMm
        : get().draftWallThicknessMm,
      lastMutatedAt: Date.now(),
      wallDraw: {
        ...draw,
        points: [...draw.points, end],
        cursor: end,
        angleDeg: snapped.angleDeg,
        angleSnapped: snapped.snapped,
        lengthMm: Math.hypot(dx, dy),
      },
    });
    return wall;
  },

  finishWallDraw: () => set({ wallDraw: null }),
  cancelWallDraw: () => set({ wallDraw: null, armedLayoutTool: null }),

  beginSlabDraw: (kind, levelId) =>
    set({
      slabDraw: { kind, levelId, start: null, cursor: null },
      wallDraw: null,
      armedLayoutTool: kind,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
    }),

  updateSlabCursor: (cursor) => {
    const draw = get().slabDraw;
    if (!draw) return;
    if (!cursor) {
      set({ slabDraw: { ...draw, cursor: null } });
      return;
    }
    const underSnap = snapPlanToUnderlayLines(
      cursor,
      get().underlays,
      draw.levelId,
    );
    set({
      slabDraw: {
        ...draw,
        cursor: { xMm: underSnap.xMm, yMm: underSnap.yMm },
      },
    });
  },

  addSlabCorner: async (point) => {
    const draw = get().slabDraw;
    const projectId = get().projectId;
    if (!draw || !projectId) return null;
    const underSnap = snapPlanToUnderlayLines(
      point,
      get().underlays,
      draw.levelId,
    );
    const pt = { xMm: underSnap.xMm, yMm: underSnap.yMm };
    if (!draw.start) {
      set({
        slabDraw: { ...draw, start: pt, cursor: pt },
      });
      return null;
    }
    const minXmm = Math.min(draw.start.xMm, pt.xMm);
    const maxXmm = Math.max(draw.start.xMm, pt.xMm);
    const minYmm = Math.min(draw.start.yMm, pt.yMm);
    const maxYmm = Math.max(draw.start.yMm, pt.yMm);
    if (maxXmm - minXmm < 100 || maxYmm - minYmm < 100) return null;

    const level = get().levels.find((l) => l.id === draw.levelId);
    const thicknessMm = get().draftSlabThicknessMm;
    const elevationOffsetMm =
      draw.kind === "roof" ? (level?.heightMm ?? DEFAULT_LEVEL_HEIGHT_MM) : 0;
    const slab: LayoutSlab = {
      id: newLayoutId(draw.kind === "roof" ? "roof" : "floor"),
      projectId,
      levelId: draw.levelId,
      kind: draw.kind,
      minXmm,
      minYmm,
      maxXmm,
      maxYmm,
      thicknessMm,
      elevationOffsetMm,
      createdAt: Date.now(),
    };
    pushWerkzeugHistory();
    await idbPutSlab(slab);
    set({
      slabs: [...get().slabs, slab],
      slabDraw: { ...draw, start: null, cursor: pt },
      selectedSlabId: slab.id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedUnderlayId: null,
      lastMutatedAt: Date.now(),
    });
    return slab;
  },

  cancelSlabDraw: () => set({ slabDraw: null, armedLayoutTool: null }),

  updateSlab: async (id, patch) => {
    const cur = get().slabs.find((s) => s.id === id);
    if (!cur) return;
    pushWerkzeugHistory();
    const next = { ...cur, ...patch };
    if (next.minXmm > next.maxXmm) {
      const t = next.minXmm;
      next.minXmm = next.maxXmm;
      next.maxXmm = t;
    }
    if (next.minYmm > next.maxYmm) {
      const t = next.minYmm;
      next.minYmm = next.maxYmm;
      next.maxYmm = t;
    }
    await idbPutSlab(next);
    set({
      slabs: get().slabs.map((s) => (s.id === id ? next : s)),
      lastMutatedAt: Date.now(),
    });
  },

  deleteSlab: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteSlab(id);
    set({
      slabs: get().slabs.filter((s) => s.id !== id),
      selectedSlabId:
        get().selectedSlabId === id ? null : get().selectedSlabId,
      lastMutatedAt: Date.now(),
    });
  },

  selectSlab: (id) =>
    set({
      selectedSlabId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedUnderlayId: null,
      armedLayoutTool: null,
      wallDraw: null,
      slabDraw: null,
    }),

  duplicateSlab: async (id) => {
    const slab = get().slabs.find((s) => s.id === id);
    if (!slab) return null;
    pushWerkzeugHistory();
    const clone: LayoutSlab = {
      ...slab,
      id: newLayoutId(slab.kind === "roof" ? "roof" : "floor"),
      minXmm: slab.minXmm + 500,
      maxXmm: slab.maxXmm + 500,
      minYmm: slab.minYmm + 500,
      maxYmm: slab.maxYmm + 500,
      createdAt: Date.now(),
    };
    await idbPutSlab(clone);
    set({
      slabs: [...get().slabs, clone],
      selectedSlabId: clone.id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      lastMutatedAt: Date.now(),
    });
    return clone;
  },

  updateWall: async (id, patch) => {
    pushWerkzeugHistory();

    const wall = get().walls.find((w) => w.id === id);
    if (!wall) return;
    const next = { ...wall, ...patch };
    // Optimistic UI — keep endpoint/move drags responsive.
    set({
      walls: get().walls.map((w) => (w.id === id ? next : w)),
      lastMutatedAt: Date.now(),
    });
    await idbPutWall(next);
    if (patch.thicknessMm != null && get().projectId) {
      const presets = {
        ...get().presets,
        wallThicknessMm: rememberNumber(
          get().presets.wallThicknessMm,
          patch.thicknessMm,
        ),
      };
      await persistPresets(get().projectId!, presets);
      set({
        presets,
        draftWallThicknessMm: patch.thicknessMm,
        lastMutatedAt: Date.now(),
      });
    }
  },

  deleteWall: async (id) => {
    pushWerkzeugHistory();

    const doors = get().doors.filter((d) => d.wallId === id);
    const windows = get().windows.filter((w) => w.wallId === id);
    for (const d of doors) await idbDeleteDoor(d.id);
    for (const w of windows) await idbDeleteWindow(w.id);
    await idbDeleteWall(id);
    set({
      walls: get().walls.filter((w) => w.id !== id),
      doors: get().doors.filter((d) => d.wallId !== id),
      windows: get().windows.filter((w) => w.wallId !== id),
      selectedWallId:
        get().selectedWallId === id ? null : get().selectedWallId,
      lastMutatedAt: Date.now(),
    });
  },

  selectWall: (id) =>
    set({
      selectedWallId: id,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      armedLayoutTool: null,
      wallDraw: null,
      slabDraw: null,
    }),

  duplicateWall: async (id) => {
    pushWerkzeugHistory();

    const wall = get().walls.find((w) => w.id === id);
    if (!wall) return null;
    const offset = 400;
    const clone: LayoutWall = {
      ...wall,
      id: newLayoutId("wall"),
      startXmm: wall.startXmm + offset,
      startYmm: wall.startYmm + offset,
      endXmm: wall.endXmm + offset,
      endYmm: wall.endYmm + offset,
      createdAt: Date.now(),
    };
    await idbPutWall(clone);
    set({
      walls: [...get().walls, clone],
      selectedWallId: clone.id,
      selectedDoorId: null,
      selectedWindowId: null,
      lastMutatedAt: Date.now(),
    });
    return clone;
  },

  setWallCurved: (wallId, arcCenter, arcRadiusMm) => {
    const wall = get().walls.find((w) => w.id === wallId);
    if (!wall) return;
    const startAngleDeg =
      (Math.atan2(wall.startYmm - arcCenter.yMm, wall.startXmm - arcCenter.xMm) * 180) / Math.PI;
    const endAngleDeg =
      (Math.atan2(wall.endYmm - arcCenter.yMm, wall.endXmm - arcCenter.xMm) * 180) / Math.PI;
    const updated: LayoutWall = {
      ...wall,
      curved: true,
      arcCenterXmm: arcCenter.xMm,
      arcCenterYmm: arcCenter.yMm,
      arcRadiusMm,
      arcStartAngleDeg: startAngleDeg,
      arcEndAngleDeg: endAngleDeg,
    };
    set({ walls: get().walls.map((w) => (w.id === wallId ? updated : w)) });
    idbPutWall(updated);
  },

 placeDoorOnWall: async (wallId, positionMm, opts) => {
    pushWerkzeugHistory();

    const projectId = get().projectId;
    if (!projectId) return null;
    const widthMm = opts?.widthMm ?? get().draftDoorWidthMm;
    const heightMm = opts?.heightMm ?? get().draftDoorHeightMm;
    const door: LayoutDoor = {
      id: newLayoutId("door"),
      projectId,
      wallId,
      positionMm: Math.round(positionMm),
      widthMm,
      heightMm,
      hinge: opts?.hinge === "end" ? "end" : "start",
      swing: opts?.swing === -1 ? -1 : 1,
      createdAt: Date.now(),
    };
    await idbPutDoor(door);
    const presets = {
      ...get().presets,
      doorSizes: rememberDoorSize(get().presets.doorSizes, widthMm, heightMm),
    };
    await persistPresets(projectId, presets);
    set({
      doors: [...get().doors, door],
      presets,
      selectedDoorId: door.id,
      selectedWallId: null,
      selectedWindowId: null,
      // Continuous placement — stay on Door until Esc / other tool.
      armedLayoutTool: get().armedLayoutTool ?? "door",
      lastMutatedAt: Date.now(),
    });
    return door;
  },

  updateDoor: async (id, patch) => {
    pushWerkzeugHistory();

    const door = get().doors.find((d) => d.id === id);
    if (!door) return;
    const next = { ...door, ...patch };
    await idbPutDoor(next);
    if (
      (patch.widthMm != null || patch.heightMm != null) &&
      get().projectId
    ) {
      const presets = {
        ...get().presets,
        doorSizes: rememberDoorSize(
          get().presets.doorSizes,
          next.widthMm,
          next.heightMm,
        ),
      };
      await persistPresets(get().projectId!, presets);
      set({
        doors: get().doors.map((d) => (d.id === id ? next : d)),
        presets,
        draftDoorWidthMm: next.widthMm,
        draftDoorHeightMm: next.heightMm,
        lastMutatedAt: Date.now(),
      });
      return;
    }
    set({
      doors: get().doors.map((d) => (d.id === id ? next : d)),
      lastMutatedAt: Date.now(),
    });
  },

  deleteDoor: async (id) => {
    pushWerkzeugHistory();

    await idbDeleteDoor(id);
    set({
      doors: get().doors.filter((d) => d.id !== id),
      selectedDoorId:
        get().selectedDoorId === id ? null : get().selectedDoorId,
      lastMutatedAt: Date.now(),
    });
  },

  selectDoor: (id) =>
    set({
      selectedDoorId: id,
      selectedWallId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      armedLayoutTool: null,
    }),

  duplicateDoor: async (id) => {
    pushWerkzeugHistory();

    const door = get().doors.find((d) => d.id === id);
    if (!door) return null;
    const clone: LayoutDoor = {
      ...door,
      id: newLayoutId("door"),
      positionMm: door.positionMm + 200,
      createdAt: Date.now(),
    };
    await idbPutDoor(clone);
    set({
      doors: [...get().doors, clone],
      selectedDoorId: clone.id,
      selectedWallId: null,
      selectedWindowId: null,
      lastMutatedAt: Date.now(),
    });
    return clone;
  },

  placeWindowOnWall: async (wallId, positionMm, opts) => {
    pushWerkzeugHistory();

    const projectId = get().projectId;
    if (!projectId) return null;
    const widthMm = opts?.widthMm ?? get().draftWindowWidthMm;
    const heightMm = opts?.heightMm ?? get().draftWindowHeightMm;
    const sillHeightMm = opts?.sillHeightMm ?? get().draftWindowSillMm;
    const win: LayoutWindow = {
      id: newLayoutId("win"),
      projectId,
      wallId,
      positionMm: Math.round(positionMm),
      widthMm,
      heightMm,
      sillHeightMm,
      createdAt: Date.now(),
    };
    await idbPutWindow(win);
    const presets = {
      ...get().presets,
      windowSizes: rememberWindowSize(
        get().presets.windowSizes,
        widthMm,
        heightMm,
        sillHeightMm,
      ),
    };
    await persistPresets(projectId, presets);
    set({
      windows: [...get().windows, win],
      presets,
      selectedWindowId: win.id,
      selectedWallId: null,
      selectedDoorId: null,
      // Continuous placement — stay on Window until Esc / other tool.
      armedLayoutTool: get().armedLayoutTool ?? "window",
      lastMutatedAt: Date.now(),
    });
    return win;
  },

  updateWindow: async (id, patch) => {
    pushWerkzeugHistory();

    const win = get().windows.find((w) => w.id === id);
    if (!win) return;
    const next = { ...win, ...patch };
    await idbPutWindow(next);
    if (
      (patch.widthMm != null ||
        patch.heightMm != null ||
        patch.sillHeightMm != null) &&
      get().projectId
    ) {
      const presets = {
        ...get().presets,
        windowSizes: rememberWindowSize(
          get().presets.windowSizes,
          next.widthMm,
          next.heightMm,
          next.sillHeightMm,
        ),
      };
      await persistPresets(get().projectId!, presets);
      set({
        windows: get().windows.map((w) => (w.id === id ? next : w)),
        presets,
        draftWindowWidthMm: next.widthMm,
        draftWindowHeightMm: next.heightMm,
        draftWindowSillMm: next.sillHeightMm,
        lastMutatedAt: Date.now(),
      });
      return;
    }
    set({
      windows: get().windows.map((w) => (w.id === id ? next : w)),
      lastMutatedAt: Date.now(),
    });
  },

  deleteWindow: async (id) => {
    pushWerkzeugHistory();

    await idbDeleteWindow(id);
    set({
      windows: get().windows.filter((w) => w.id !== id),
      selectedWindowId:
        get().selectedWindowId === id ? null : get().selectedWindowId,
      lastMutatedAt: Date.now(),
    });
  },

  selectWindow: (id) =>
    set({
      selectedWindowId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      armedLayoutTool: null,
    }),

  duplicateWindow: async (id) => {
    pushWerkzeugHistory();

    const win = get().windows.find((w) => w.id === id);
    if (!win) return null;
    const clone: LayoutWindow = {
      ...win,
      id: newLayoutId("window"),
      positionMm: win.positionMm + 200,
      createdAt: Date.now(),
    };
    await idbPutWindow(clone);
    set({
      windows: [...get().windows, clone],
      selectedWindowId: clone.id,
      selectedWallId: null,
      selectedDoorId: null,
      lastMutatedAt: Date.now(),
    });
    return clone;
  },

  clearLayoutSelection: () =>
    set({
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
    }),

  addUnderlayFromFile: async (levelId, file) => {
    const projectId = get().projectId;
    if (!projectId || !levelId) return null;
    const image = await ingestReferenceDrawingFile(file);
    pushWerkzeugHistory();
    // Replace existing underlay on this level (one per level for clarity).
    const existing = get().underlays.filter((u) => u.levelId === levelId);
    for (const u of existing) await idbDeleteUnderlay(u.id);
    const row = createUnderlayRecord({
      projectId,
      levelId,
      image,
      sourceName: file.name,
    });
    await idbPutUnderlay(row);
    set({
      underlays: [
        ...get().underlays.filter((u) => u.levelId !== levelId),
        row,
      ],
      selectedUnderlayId: row.id,
      calibrateUnderlayId: row.id,
      calibratePoints: [],
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      lastMutatedAt: Date.now(),
    });
    return row;
  },

  updateUnderlay: async (id, patch) => {
    const cur = get().underlays.find((u) => u.id === id);
    if (!cur) return;
    if (cur.locked) {
      const touchesPose =
        "offsetXmm" in patch ||
        "offsetYmm" in patch ||
        "rotationDeg" in patch ||
        "mmPerPixel" in patch;
      if (touchesPose) return;
    }
    const onlyOpacity =
      Object.keys(patch).length === 1 && "opacity" in patch;
    if (!onlyOpacity) pushWerkzeugHistory();
    const next = { ...cur, ...patch };
    await idbPutUnderlay(next);
    set({
      underlays: get().underlays.map((u) => (u.id === id ? next : u)),
      lastMutatedAt: Date.now(),
    });
  },

  deleteUnderlay: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteUnderlay(id);
    set({
      underlays: get().underlays.filter((u) => u.id !== id),
      selectedUnderlayId:
        get().selectedUnderlayId === id ? null : get().selectedUnderlayId,
      calibrateUnderlayId:
        get().calibrateUnderlayId === id ? null : get().calibrateUnderlayId,
      calibratePoints:
        get().calibrateUnderlayId === id ? [] : get().calibratePoints,
      lastMutatedAt: Date.now(),
    });
  },

  selectUnderlay: (id) =>
    set({
      selectedUnderlayId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
    }),

  beginCalibrateUnderlay: (id) =>
    set({
      calibrateUnderlayId: id,
      calibratePoints: [],
      selectedUnderlayId: id,
      armedLayoutTool: null,
    }),

  cancelCalibrateUnderlay: () =>
    set({ calibrateUnderlayId: null, calibratePoints: [] }),

  addCalibratePoint: (pt) => {
    const id = get().calibrateUnderlayId;
    if (!id) return;
    const pts = [...get().calibratePoints, pt].slice(0, 2);
    set({ calibratePoints: pts });
  },

  commitCalibrateDistance: async (distanceMm) => {
    const id = get().calibrateUnderlayId;
    const pts = get().calibratePoints;
    if (!id || pts.length < 2) return;
    const underlay = get().underlays.find((u) => u.id === id);
    if (!underlay) return;
    const patch = calibrateUnderlayFromWorldPoints(
      underlay,
      pts[0]!,
      pts[1]!,
      distanceMm,
    );
    pushWerkzeugHistory();
    const next = { ...underlay, ...patch };
    await idbPutUnderlay(next);
    set({
      underlays: get().underlays.map((u) => (u.id === id ? next : u)),
      calibrateUnderlayId: null,
      calibratePoints: [],
      lastMutatedAt: Date.now(),
    });
  },
}));
