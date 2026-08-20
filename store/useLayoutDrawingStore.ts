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
  snapPlanPointToWalls,
  snapWallEndpointMm,
  trimWallPair,
  type LayoutBeam,
  type LayoutColumn,
  type LayoutDoor,
  type LayoutGridLine,
  type LayoutGroup,
  type LayoutLevel,
  type LayoutPresets,
  type LayoutRoom,
  type LayoutSlab,
  type LayoutSketchLine,
  type LayoutToolId,
  type LayoutWall,
  type LayoutWindow,
  type SelectedElementRef,
  type WallType,
} from "@/lib/layoutDrawing";
import {
  detectLoopsFromSegments,
  isPointInsidePolygon,
} from "@/lib/linesLoopDetector";
import {
  idbDeleteBeam,
  idbDeleteColumn,
  idbDeleteDoor,
  idbDeleteGridLine,
  idbDeleteGroup,
  idbDeleteLevel,
  idbDeleteSlab,
  idbDeleteUnderlay,
  idbDeleteWall,
  idbDeleteWallType,
  idbDeleteWindow,
  idbGetPresets,
  idbListBeams,
  idbListColumns,
  idbListDoors,
  idbListGridLines,
  idbListGroups,
  idbListLevels,
  idbListSlabs,
  idbListUnderlays,
  idbListWalls,
  idbListWallTypes,
  idbListWindows,
  idbPutBeam,
  idbPutColumn,
  idbPutDoor,
  idbPutGridLine,
  idbPutGroup,
  idbPutLevel,
  idbPutPresets,
  idbPutSlab,
  idbPutUnderlay,
  idbPutWall,
  idbPutWallType,
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

export type SketchDrawState = {
  levelId: string;
  points: { xMm: number; yMm: number }[];
  cursor: { xMm: number; yMm: number } | null;
  angleDeg: number | null;
  angleSnapped: boolean;
  lengthMm: number | null;
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
  columns: LayoutColumn[];
  beams: LayoutBeam[];
  gridLines: LayoutGridLine[];
  groups: LayoutGroup[];
  wallTypes: WallType[];
  activeGroupId: string | null;
  layoutRooms: LayoutRoom[];
  sketchLines: LayoutSketchLine[];
  sketchDraw: SketchDrawState;
  gapHighlightPoints: { xMm: number; yMm: number }[];
  drawingScale: "1:20" | "1:50" | "1:100" | "1:200" | "1:500";
  unitSystem: "metric" | "imperial";
  underlays: ReferenceUnderlay[];
  presets: LayoutPresets;
  armedLayoutTool: LayoutToolId | null;
  wallDraw: WallDrawState;
  slabDraw: SlabDrawState;
  tracePreview: TracePreviewState;
  selectedElements: SelectedElementRef[];
  marqueeBox: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isCrossing: boolean;
  } | null;
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
  draftColumnWidthMm: number;
  draftColumnDepthMm: number;
  draftBeamWidthMm: number;
  draftBeamDepthMm: number;

  browserSearch: string;
  setBrowserSearch: (val: string) => void;
  elementsCategoryFilter: string;
  setElementsCategoryFilter: (val: string) => void;

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
  setUnitSystem: (system: "metric" | "imperial") => void;
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

  trimFirstPick: { wallId: string; clickPointMm: { xMm: number; yMm: number } } | null;
  setTrimFirstPick: (pick: { wallId: string; clickPointMm: { xMm: number; yMm: number } } | null) => void;
  trimWalls: (
    wall1Id: string,
    clickPt1Mm: { xMm: number; yMm: number },
    wall2Id: string,
    clickPt2Mm: { xMm: number; yMm: number },
  ) => Promise<boolean>;

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
        "positionMm" | "widthMm" | "heightMm" | "hinge" | "swing" | "style" | "headShape" | "color" | "material"
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
        | "material"
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

  // Lines / Sketch tool
  beginSketchLineDraw: (levelId: string, start: { xMm: number; yMm: number }) => void;
  updateSketchLineCursor: (cursor: { xMm: number; yMm: number } | null) => void;
  addSketchLinePoint: (point: { xMm: number; yMm: number }) => Promise<LayoutSketchLine | null>;
  finishSketchLineDraw: () => void;
  cancelSketchLineDraw: () => void;
  selectedSketchLineId: string | null;
  selectSketchLine: (id: string | null) => void;
  deleteSketchLine: (id: string) => void;
  clearSketchLines: () => void;
  convertSketchToSlab: (kind: "floor" | "roof") => Promise<{
    success: boolean;
    error?: string;
    gapPoints?: { xMm: number; yMm: number }[];
  }>;

  clearLayoutSelection: () => void;

  // -- Section 1: Multi-Selection & Batch Modify --------------------------
  selectElement: (ref: SelectedElementRef | null, mode?: "replace" | "toggle" | "add" | "remove") => void;
  selectMultiple: (refs: SelectedElementRef[], mode?: "replace" | "add") => void;
  clearSelection: () => void;
  setMarqueeBox: (box: { startX: number; startY: number; currentX: number; currentY: number; isCrossing: boolean } | null) => void;
  deleteSelected: () => Promise<void>;
  moveSelected: (deltaXmm: number, deltaYmm: number) => Promise<void>;
  copySelected: (deltaXmm: number, deltaYmm: number) => Promise<SelectedElementRef[]>;
  mirrorSelected: (axisP1: { xMm: number; yMm: number }, axisP2: { xMm: number; yMm: number }) => Promise<void>;
  rotateSelected: (center: { xMm: number; yMm: number }, angleDeg: number) => Promise<void>;
  scaleSelected: (origin: { xMm: number; yMm: number }, scaleFactor: number) => Promise<void>;

  // -- Section 2: Grouping ------------------------------------------------
  createGroupFromSelection: (name?: string) => Promise<LayoutGroup | null>;
  ungroup: (groupId: string) => Promise<void>;
  enterGroupEdit: (groupId: string) => void;
  exitGroupEdit: () => void;

  // -- Section 3: Layered Wall Assemblies --------------------------------
  addWallType: (wt: WallType) => Promise<void>;
  updateWallType: (id: string, patch: Partial<WallType>) => Promise<void>;
  deleteWallType: (id: string) => Promise<void>;

  // -- Section 4: Structural Columns & Beams ------------------------------
  addColumn: (col: Omit<LayoutColumn, "id" | "projectId" | "createdAt">) => Promise<LayoutColumn | null>;
  updateColumn: (id: string, patch: Partial<LayoutColumn>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  selectColumn: (id: string | null) => void;
  setDraftColumnSize: (widthMm: number, depthMm: number) => void;

  addBeam: (beam: Omit<LayoutBeam, "id" | "projectId" | "createdAt">) => Promise<LayoutBeam | null>;
  updateBeam: (id: string, patch: Partial<LayoutBeam>) => Promise<void>;
  deleteBeam: (id: string) => Promise<void>;
  selectBeam: (id: string | null) => void;
  setDraftBeamSize: (widthMm: number, depthMm: number) => void;

  // -- Section 5: Reference / Grid Planes ---------------------------------
  addGridLine: (grid: Omit<LayoutGridLine, "id" | "projectId" | "createdAt">) => Promise<LayoutGridLine | null>;
  updateGridLine: (id: string, patch: Partial<LayoutGridLine>) => Promise<void>;
  deleteGridLine: (id: string) => Promise<void>;
  selectGridLine: (id: string | null) => void;
};

async function persistPresets(projectId: string, presets: LayoutPresets) {
  await idbPutPresets(projectId, presets);
}

function wallRegionAtPoint(
  walls: LayoutWall[],
  levelId: string,
  point: { xMm: number; yMm: number },
) {
  const loops = detectLoopsFromSegments(
    walls.filter((wall) => wall.levelId === levelId && !wall.curved),
    140,
  ).closedLoops;
  return loops
    .filter((loop) => isPointInsidePolygon(point, loop.points))
    .sort((a, b) => a.areaSqMm - b.areaSqMm)[0] ?? null;
}

function refreshAutoSlabBoundaries(
  walls: LayoutWall[],
  slabs: LayoutSlab[],
): LayoutSlab[] {
  return slabs.map((slab) => {
    if (!slab.autoBoundaryFromWalls || !slab.boundary?.length) return slab;
    const center = slab.boundary.reduce(
      (sum, point) => ({
        xMm: sum.xMm + point.xMm / slab.boundary!.length,
        yMm: sum.yMm + point.yMm / slab.boundary!.length,
      }),
      { xMm: 0, yMm: 0 },
    );
    const region = wallRegionAtPoint(walls, slab.levelId, center);
    if (!region) return slab;
    const xs = region.points.map((point) => point.xMm);
    const ys = region.points.map((point) => point.yMm);
    return {
      ...slab,
      boundary: region.points,
      minXmm: Math.min(...xs),
      minYmm: Math.min(...ys),
      maxXmm: Math.max(...xs),
      maxYmm: Math.max(...ys),
    };
  });
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
  columns: [],
  beams: [],
  gridLines: [],
  groups: [],
  wallTypes: [],
  activeGroupId: null,
  selectedElements: [],
  marqueeBox: null,
  layoutRooms: [],
  sketchLines: [],
  sketchDraw: null,
  selectedSketchLineId: null,
  gapHighlightPoints: [],
  drawingScale: "1:100",
  unitSystem: typeof window !== "undefined" ? (localStorage.getItem("vstudio:unitSystem") as "metric" | "imperial") || "metric" : "metric",
  underlays: [],
  presets: { ...EMPTY_LAYOUT_PRESETS },
  armedLayoutTool: null,
  wallDraw: null,
  slabDraw: null,
  tracePreview: null,
  trimFirstPick: null,
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
  draftColumnWidthMm: 300,
  draftColumnDepthMm: 300,
  draftBeamWidthMm: 200,
  draftBeamDepthMm: 400,

  browserSearch: "",
  setBrowserSearch: (val) => set({ browserSearch: val }),
  elementsCategoryFilter: "all",
  setElementsCategoryFilter: (val) => set({ elementsCategoryFilter: val }),

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
        columns: [],
        beams: [],
        gridLines: [],
        groups: [],
        wallTypes: [],
        activeGroupId: null,
        selectedElements: [],
        marqueeBox: null,
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
    const [
      levels,
      walls,
      doors,
      windows,
      slabs,
      columns,
      beams,
      gridLines,
      groups,
      wallTypes,
      underlays,
      presets,
    ] = await Promise.all([
      idbListLevels(projectId),
      idbListWalls(projectId),
      idbListDoors(projectId),
      idbListWindows(projectId),
      idbListSlabs(projectId),
      idbListColumns(projectId),
      idbListBeams(projectId),
      idbListGridLines(projectId),
      idbListGroups(projectId),
      idbListWallTypes(projectId),
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
      columns,
      beams,
      gridLines,
      groups,
      wallTypes,
      activeGroupId: null,
      selectedElements: [],
      marqueeBox: null,
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
    const levelEG: LayoutLevel = {
      id: newLayoutId("lvl"),
      projectId,
      name: "Erdgeschoss",
      elevationMm: 0,
      heightMm: DEFAULT_LEVEL_HEIGHT_MM,
      createdAt: Date.now(),
    };
    const levelUG: LayoutLevel = {
      id: newLayoutId("lvl"),
      projectId,
      name: "Untergeschoss",
      elevationMm: -DEFAULT_LEVEL_HEIGHT_MM,
      heightMm: DEFAULT_LEVEL_HEIGHT_MM,
      createdAt: Date.now() + 1,
    };
    await idbPutLevel(levelEG);
    await idbPutLevel(levelUG);
    await idbPutPresets(projectId, { ...EMPTY_LAYOUT_PRESETS });
    await get().loadForProject(projectId, true);
    return { projectId, level: levelEG };
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
  setUnitSystem: (system) => {
    set({ unitSystem: system });
    if (typeof window !== "undefined") {
      localStorage.setItem("vstudio:unitSystem", system);
    }
  },
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
    const wallSnap = snapPlanPointToWalls(
      { xMm: underSnap.xMm, yMm: underSnap.yMm },
      get().walls,
      levelId,
    );
    const pt = wallSnap.point;
    set({
      wallDraw: {
        levelId,
        points: [pt],
        cursor: pt,
        angleDeg: null,
        angleSnapped: false,
        lengthMm: null,
        snapType: wallSnap.type,
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
    const underPoint = underSnap.snapped
      ? { xMm: underSnap.xMm, yMm: underSnap.yMm }
      : snapped.point;
    const wallSnap = snapPlanPointToWalls(
      underPoint,
      get().walls,
      draw.levelId,
    );
    const point = wallSnap.point;
    const lengthMm = Math.hypot(point.xMm - last.xMm, point.yMm - last.yMm);
    set({
      wallDraw: {
        ...draw,
        cursor: point,
        angleDeg: snapped.angleDeg,
        angleSnapped: snapped.snapped || underSnap.snapped,
        lengthMm,
        snapType: wallSnap.type,
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
    const underPoint = underSnap.snapped
      ? { xMm: underSnap.xMm, yMm: underSnap.yMm }
      : snapped.point;
    const wallSnap = snapPlanPointToWalls(
      underPoint,
      get().walls,
      draw.levelId,
    );
    const end = wallSnap.point;
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
      material: "concrete",
      color: "#878683",
      createdAt: Date.now(),
    };
    pushWerkzeugHistory();
    await idbPutWall(wall);
    const presets = {
      ...get().presets,
      wallThicknessMm: rememberNumber(get().presets.wallThicknessMm, thicknessMm),
    };
    await persistPresets(projectId, presets);
    const nextWalls = [...get().walls, wall];
    const nextSlabs = refreshAutoSlabBoundaries(nextWalls, get().slabs);
    set({
      walls: nextWalls,
      slabs: nextSlabs,
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
        snapType: wallSnap.type,
      },
    });
    await Promise.all(
      nextSlabs
        .filter((slab) => slab.autoBoundaryFromWalls)
        .map((slab) => idbPutSlab(slab)),
    );
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
    const wallSnap = snapPlanPointToWalls(
      { xMm: underSnap.xMm, yMm: underSnap.yMm },
      get().walls,
      draw.levelId,
    );
    set({
      slabDraw: {
        ...draw,
        cursor: wallSnap.point,
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
    const pt = snapPlanPointToWalls(
      { xMm: underSnap.xMm, yMm: underSnap.yMm },
      get().walls,
      draw.levelId,
    ).point;
    if (!draw.start) {
      const region =
        draw.kind === "floor"
          ? wallRegionAtPoint(get().walls, draw.levelId, pt)
          : null;
      if (region) {
        const xs = region.points.map((p) => p.xMm);
        const ys = region.points.map((p) => p.yMm);
        const slab: LayoutSlab = {
          id: newLayoutId("floor"),
          projectId,
          levelId: draw.levelId,
          kind: "floor",
          minXmm: Math.min(...xs),
          minYmm: Math.min(...ys),
          maxXmm: Math.max(...xs),
          maxYmm: Math.max(...ys),
          boundary: region.points,
          autoBoundaryFromWalls: true,
          thicknessMm: get().draftSlabThicknessMm,
          elevationOffsetMm: 0,
          createdAt: Date.now(),
        };
        pushWerkzeugHistory();
        await idbPutSlab(slab);
        set({
          slabs: [...get().slabs, slab],
          selectedSlabId: slab.id,
          lastMutatedAt: Date.now(),
        });
        return slab;
      }
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

  selectSlab: (id) => {
    if (!id) {
      set({
        selectedSlabId: null,
        selectedElements: get().selectedElements.filter((e) => e.kind !== "slab"),
        wallDraw: null,
        slabDraw: null,
      });
      return;
    }
    const group = get().groups.find((g) => g.elementRefs.some((r) => r.kind === "slab" && r.id === id));
    if (group && get().activeGroupId !== group.id) {
      set({
        selectedElements: [...group.elementRefs],
        selectedSlabId: id,
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedUnderlayId: null,
        armedLayoutTool: null,
        wallDraw: null,
        slabDraw: null,
      });
      return;
    }
    set({
      selectedSlabId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedUnderlayId: null,
      selectedElements: [{ kind: "slab", id }],
      armedLayoutTool: null,
      wallDraw: null,
      slabDraw: null,
    });
  },

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
    const nextWalls = get().walls.map((w) => (w.id === id ? next : w));
    const nextSlabs = refreshAutoSlabBoundaries(nextWalls, get().slabs);
    set({
      walls: nextWalls,
      slabs: nextSlabs,
      lastMutatedAt: Date.now(),
    });
    await idbPutWall(next);
    await Promise.all(
      nextSlabs
        .filter((slab) => slab.autoBoundaryFromWalls)
        .map((slab) => idbPutSlab(slab)),
    );
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

  selectWall: (id) => {
    if (!id) {
      set({
        selectedWallId: null,
        selectedElements: get().selectedElements.filter((e) => e.kind !== "wall"),
        wallDraw: null,
        slabDraw: null,
      });
      return;
    }
    const group = get().groups.find((g) => g.elementRefs.some((r) => r.kind === "wall" && r.id === id));
    if (group && get().activeGroupId !== group.id) {
      set({
        selectedElements: [...group.elementRefs],
        selectedWallId: id,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedSlabId: null,
        selectedUnderlayId: null,
        armedLayoutTool: null,
        wallDraw: null,
        slabDraw: null,
      });
      return;
    }
    set({
      selectedWallId: id,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      selectedElements: [{ kind: "wall", id }],
      armedLayoutTool: null,
      wallDraw: null,
      slabDraw: null,
    });
  },

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

  setTrimFirstPick: (pick) => set({ trimFirstPick: pick }),

  trimWalls: async (w1Id, pt1, w2Id, pt2) => {
    const w1 = get().walls.find((w) => w.id === w1Id);
    const w2 = get().walls.find((w) => w.id === w2Id);
    if (!w1 || !w2 || w1.id === w2.id) return false;
    const res = trimWallPair(w1, pt1, w2, pt2);
    if (!res) return false;

    pushWerkzeugHistory();
    const updated1 = { ...w1, ...res.wall1Patch };
    const updated2 = { ...w2, ...res.wall2Patch };

    set({
      walls: get().walls.map((w) =>
        w.id === w1Id ? updated1 : w.id === w2Id ? updated2 : w,
      ),
      trimFirstPick: null,
      lastMutatedAt: Date.now(),
    });
    await idbPutWall(updated1);
    await idbPutWall(updated2);
    return true;
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

  selectDoor: (id) => {
    if (!id) {
      set({
        selectedDoorId: null,
        selectedElements: get().selectedElements.filter((e) => e.kind !== "door"),
      });
      return;
    }
    const group = get().groups.find((g) => g.elementRefs.some((r) => r.kind === "door" && r.id === id));
    if (group && get().activeGroupId !== group.id) {
      set({
        selectedElements: [...group.elementRefs],
        selectedDoorId: id,
        selectedWallId: null,
        selectedWindowId: null,
        selectedSlabId: null,
        selectedUnderlayId: null,
        armedLayoutTool: null,
      });
      return;
    }
    set({
      selectedDoorId: id,
      selectedWallId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      selectedElements: [{ kind: "door", id }],
      armedLayoutTool: null,
    });
  },

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
      color: "#1e293b",
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

  selectWindow: (id) => {
    if (!id) {
      set({
        selectedWindowId: null,
        selectedElements: get().selectedElements.filter((e) => e.kind !== "window"),
      });
      return;
    }
    const group = get().groups.find((g) => g.elementRefs.some((r) => r.kind === "window" && r.id === id));
    if (group && get().activeGroupId !== group.id) {
      set({
        selectedElements: [...group.elementRefs],
        selectedWindowId: id,
        selectedWallId: null,
        selectedDoorId: null,
        selectedSlabId: null,
        selectedUnderlayId: null,
        armedLayoutTool: null,
      });
      return;
    }
    set({
      selectedWindowId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      selectedElements: [{ kind: "window", id }],
      armedLayoutTool: null,
    });
  },

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
      selectedElements: [{ kind: "window", id: clone.id }],
      lastMutatedAt: Date.now(),
    });
    return clone;
  },

  clearLayoutSelection: () =>
    set({
      selectedElements: [],
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedSketchLineId: null,
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
      underlay.levelId,
    );
    pushWerkzeugHistory();
    const levelCalibrations = {
      ...(underlay.levelCalibrations || {}),
      [underlay.levelId]: {
        mmPerPixel: patch.mmPerPixel,
        offsetXmm: patch.offsetXmm,
        offsetYmm: patch.offsetYmm,
        rotationDeg: underlay.rotationDeg,
      },
    };
    const next: ReferenceUnderlay = {
      ...underlay,
      ...patch,
      levelCalibrations,
    };
    await idbPutUnderlay(next);
    set({
      underlays: get().underlays.map((u) => (u.id === id ? next : u)),
      calibrateUnderlayId: null,
      calibratePoints: [],
      lastMutatedAt: Date.now(),
    });
  },

  // -- Lines / Sketch Tool Implementation ------------------------------------
  beginSketchLineDraw: (levelId, start) => {
    const underSnap = snapPlanToUnderlayLines(start, get().underlays, levelId);
    const pt = { xMm: underSnap.xMm, yMm: underSnap.yMm };
    set({
      sketchDraw: {
        levelId,
        points: [pt],
        cursor: pt,
        angleDeg: null,
        angleSnapped: false,
        lengthMm: null,
      },
      wallDraw: null,
      slabDraw: null,
      armedLayoutTool: "lines",
      gapHighlightPoints: [],
    });
  },

  updateSketchLineCursor: (cursor) => {
    const draw = get().sketchDraw;
    if (!draw) return;
    if (!cursor) {
      set({
        sketchDraw: {
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
      const underSnap = snapPlanToUnderlayLines(cursor, get().underlays, draw.levelId);
      set({
        sketchDraw: {
          ...draw,
          cursor: { xMm: underSnap.xMm, yMm: underSnap.yMm },
        },
      });
      return;
    }
    const prevFrom = draw.points.length >= 2 ? draw.points[draw.points.length - 2] : null;
    const snapped = snapWallEndpointMm(last, cursor, { prevFrom });
    const underSnap = snapPlanToUnderlayLines(snapped.point, get().underlays, draw.levelId);
    const point = underSnap.snapped ? { xMm: underSnap.xMm, yMm: underSnap.yMm } : snapped.point;
    const lengthMm = Math.hypot(point.xMm - last.xMm, point.yMm - last.yMm);
    set({
      sketchDraw: {
        ...draw,
        cursor: point,
        angleDeg: snapped.angleDeg,
        angleSnapped: snapped.snapped || underSnap.snapped,
        lengthMm,
      },
    });
  },

  addSketchLinePoint: async (point) => {
    const draw = get().sketchDraw;
    const projectId = get().projectId;
    if (!draw || !projectId) return null;
    const last = draw.points[draw.points.length - 1];
    if (!last) {
      set({
        sketchDraw: {
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
    const prevFrom = draw.points.length >= 2 ? draw.points[draw.points.length - 2] : null;
    const snapped = snapWallEndpointMm(last, point, { prevFrom });
    const underSnap = snapPlanToUnderlayLines(snapped.point, get().underlays, draw.levelId);
    const end = underSnap.snapped ? { xMm: underSnap.xMm, yMm: underSnap.yMm } : snapped.point;
    const dx = end.xMm - last.xMm;
    const dy = end.yMm - last.yMm;
    if (Math.hypot(dx, dy) < 50) return null;

    const line: LayoutSketchLine = {
      id: newLayoutId("line"),
      projectId,
      levelId: draw.levelId,
      startXmm: last.xMm,
      startYmm: last.yMm,
      endXmm: end.xMm,
      endYmm: end.yMm,
      createdAt: Date.now(),
    };

    pushWerkzeugHistory();
    set({
      sketchLines: [...get().sketchLines, line],
      lastMutatedAt: Date.now(),
      gapHighlightPoints: [],
      sketchDraw: {
        ...draw,
        points: [...draw.points, end],
        cursor: end,
        angleDeg: snapped.angleDeg,
        angleSnapped: snapped.snapped,
        lengthMm: Math.hypot(dx, dy),
      },
    });
    return line;
  },

  finishSketchLineDraw: () => set({ sketchDraw: null }),
  cancelSketchLineDraw: () => set({ sketchDraw: null, armedLayoutTool: null }),
  clearSketchLines: () => set({ sketchLines: [], sketchDraw: null, gapHighlightPoints: [] }),

  convertSketchToSlab: async (kind) => {
    const lines = get().sketchLines;
    if (!lines || lines.length < 3) {
      return {
        success: false,
        error: "At least 3 connected line segments are required to form a closed shape.",
      };
    }

    const projectId = get().projectId;
    if (!projectId) return { success: false, error: "No active project." };

    const levelId = lines[0].levelId || get().levels[0]?.id || "default";
    const level = get().levels.find((l) => l.id === levelId);

    const result = detectLoopsFromSegments(lines);

    if (!result.isFullyClosed || result.outerLoops.length === 0) {
      set({ gapHighlightPoints: result.gapPoints });
      return {
        success: false,
        error: "The sketched shape is not fully closed. Check highlighted endpoints for gaps.",
        gapPoints: result.gapPoints,
      };
    }

    pushWerkzeugHistory();

    // Convert outer loops to slabs (with nested holes if present)
    for (const outer of result.outerLoops) {
      const holes = result.nestedHoles.get(outer) || [];
      const xs = outer.points.map((p) => p.xMm);
      const ys = outer.points.map((p) => p.yMm);
      const minXmm = Math.min(...xs);
      const maxXmm = Math.max(...xs);
      const minYmm = Math.min(...ys);
      const maxYmm = Math.max(...ys);

      const thicknessMm = get().draftSlabThicknessMm;
      const elevationOffsetMm =
        kind === "roof" ? (level?.heightMm ?? DEFAULT_LEVEL_HEIGHT_MM) : 0;

      const slab: LayoutSlab = {
        id: newLayoutId(kind === "roof" ? "roof" : "floor"),
        projectId,
        levelId,
        kind,
        minXmm,
        minYmm,
        maxXmm,
        maxYmm,
        thicknessMm,
        elevationOffsetMm,
        boundary: outer.points,
        holes: holes.map((h) => h.points),
        createdAt: Date.now(),
      };

      await idbPutSlab(slab);
      set((s) => ({
        slabs: [...s.slabs, slab],
        selectedSlabId: slab.id,
      }));
    }

    // Clear the sketched lines after successful conversion
    set({
      sketchLines: [],
      sketchDraw: null,
      selectedSketchLineId: null,
      gapHighlightPoints: [],
      armedLayoutTool: null,
      lastMutatedAt: Date.now(),
    });

    return { success: true };
  },

  selectSketchLine: (id) => {
    if (!id) {
      set({
        selectedSketchLineId: null,
        selectedElements: get().selectedElements.filter((e) => e.kind !== "line"),
      });
      return;
    }
    set({
      selectedSketchLineId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedUnderlayId: null,
      selectedElements: [{ kind: "line", id }],
    });
  },
  deleteSketchLine: (id) =>
    set((s) => ({
      sketchLines: s.sketchLines.filter((l) => l.id !== id),
      selectedSketchLineId:
        s.selectedSketchLineId === id ? null : s.selectedSketchLineId,
      selectedElements: s.selectedElements.filter((e) => !(e.kind === "line" && e.id === id)),
      lastMutatedAt: Date.now(),
    })),

  // -- Section 1: Multi-Selection System ---------------------------------
  selectElement: (ref, mode = "replace") => {
    if (!ref) {
      get().clearSelection();
      return;
    }
    // If element belongs to a group and not currently editing inside that group:
    const group = get().groups.find((g) =>
      g.elementRefs.some((r) => r.kind === ref.kind && r.id === ref.id),
    );
    const refsToSelect: SelectedElementRef[] =
      group && get().activeGroupId !== group.id ? group.elementRefs : [ref];

    let next: SelectedElementRef[] = [];
    if (mode === "replace") {
      next = [...refsToSelect];
    } else if (mode === "add") {
      const existing = new Set(get().selectedElements.map((e) => `${e.kind}:${e.id}`));
      next = [...get().selectedElements];
      for (const r of refsToSelect) {
        if (!existing.has(`${r.kind}:${r.id}`)) next.push(r);
      }
    } else if (mode === "remove") {
      const removeSet = new Set(refsToSelect.map((r) => `${r.kind}:${r.id}`));
      next = get().selectedElements.filter((e) => !removeSet.has(`${e.kind}:${e.id}`));
    } else if (mode === "toggle") {
      const isSelected = refsToSelect.some((r) =>
        get().selectedElements.some((e) => e.kind === r.kind && e.id === r.id),
      );
      if (isSelected) {
        const removeSet = new Set(refsToSelect.map((r) => `${r.kind}:${r.id}`));
        next = get().selectedElements.filter((e) => !removeSet.has(`${e.kind}:${e.id}`));
      } else {
        next = [...get().selectedElements, ...refsToSelect];
      }
    }

    const primary = next[next.length - 1] ?? null;
    set({
      selectedElements: next,
      selectedWallId: primary?.kind === "wall" ? primary.id : null,
      selectedDoorId: primary?.kind === "door" ? primary.id : null,
      selectedWindowId: primary?.kind === "window" ? primary.id : null,
      selectedSlabId: primary?.kind === "slab" ? primary.id : null,
      selectedSketchLineId: primary?.kind === "line" ? primary.id : null,
      selectedUnderlayId: null,
    });
  },

  selectMultiple: (refs, mode = "replace") => {
    let next: SelectedElementRef[] = [];
    if (mode === "replace") {
      next = [...refs];
    } else {
      const existing = new Set(get().selectedElements.map((e) => `${e.kind}:${e.id}`));
      next = [...get().selectedElements];
      for (const r of refs) {
        if (!existing.has(`${r.kind}:${r.id}`)) next.push(r);
      }
    }
    const primary = next[next.length - 1] ?? null;
    set({
      selectedElements: next,
      selectedWallId: primary?.kind === "wall" ? primary.id : null,
      selectedDoorId: primary?.kind === "door" ? primary.id : null,
      selectedWindowId: primary?.kind === "window" ? primary.id : null,
      selectedSlabId: primary?.kind === "slab" ? primary.id : null,
      selectedSketchLineId: primary?.kind === "line" ? primary.id : null,
      selectedUnderlayId: null,
    });
  },

  clearSelection: () => {
    set({
      selectedElements: [],
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedSketchLineId: null,
      selectedUnderlayId: null,
    });
  },

  setMarqueeBox: (box) => set({ marqueeBox: box }),

  deleteSelected: async () => {
    const sel = get().selectedElements;
    if (sel.length === 0) return;
    pushWerkzeugHistory();

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const doorIds = new Set(sel.filter((e) => e.kind === "door").map((e) => e.id));
    const winIds = new Set(sel.filter((e) => e.kind === "window").map((e) => e.id));
    const slabIds = new Set(sel.filter((e) => e.kind === "slab").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));
    const gridIds = new Set(sel.filter((e) => e.kind === "grid").map((e) => e.id));
    const lineIds = new Set(sel.filter((e) => e.kind === "line").map((e) => e.id));

    // Also delete child openings of deleted walls
    for (const d of get().doors) {
      if (wallIds.has(d.wallId)) doorIds.add(d.id);
    }
    for (const w of get().windows) {
      if (wallIds.has(w.wallId)) winIds.add(w.id);
    }

    for (const id of wallIds) await idbDeleteWall(id);
    for (const id of doorIds) await idbDeleteDoor(id);
    for (const id of winIds) await idbDeleteWindow(id);
    for (const id of slabIds) await idbDeleteSlab(id);
    for (const id of colIds) await idbDeleteColumn(id);
    for (const id of beamIds) await idbDeleteBeam(id);
    for (const id of gridIds) await idbDeleteGridLine(id);

    set((s) => ({
      walls: s.walls.filter((w) => !wallIds.has(w.id)),
      doors: s.doors.filter((d) => !doorIds.has(d.id)),
      windows: s.windows.filter((w) => !winIds.has(w.id)),
      slabs: s.slabs.filter((sl) => !slabIds.has(sl.id)),
      columns: s.columns.filter((c) => !colIds.has(c.id)),
      beams: s.beams.filter((b) => !beamIds.has(b.id)),
      gridLines: s.gridLines.filter((g) => !gridIds.has(g.id)),
      sketchLines: s.sketchLines.filter((l) => !lineIds.has(l.id)),
      selectedElements: [],
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedSlabId: null,
      selectedSketchLineId: null,
      lastMutatedAt: Date.now(),
    }));
  },

  moveSelected: async (deltaXmm, deltaYmm) => {
    const sel = get().selectedElements;
    if (sel.length === 0 || (deltaXmm === 0 && deltaYmm === 0)) return;
    pushWerkzeugHistory();

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const slabIds = new Set(sel.filter((e) => e.kind === "slab").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));
    const gridIds = new Set(sel.filter((e) => e.kind === "grid").map((e) => e.id));
    const lineIds = new Set(sel.filter((e) => e.kind === "line").map((e) => e.id));

    const nextWalls = get().walls.map((w) => {
      if (!wallIds.has(w.id)) return w;
      return {
        ...w,
        startXmm: w.startXmm + deltaXmm,
        startYmm: w.startYmm + deltaYmm,
        endXmm: w.endXmm + deltaXmm,
        endYmm: w.endYmm + deltaYmm,
        arcCenterXmm: w.arcCenterXmm != null ? w.arcCenterXmm + deltaXmm : undefined,
        arcCenterYmm: w.arcCenterYmm != null ? w.arcCenterYmm + deltaYmm : undefined,
      };
    });

    const nextSlabs = get().slabs.map((sl) => {
      if (!slabIds.has(sl.id)) return sl;
      return {
        ...sl,
        minXmm: sl.minXmm + deltaXmm,
        maxXmm: sl.maxXmm + deltaXmm,
        minYmm: sl.minYmm + deltaYmm,
        maxYmm: sl.maxYmm + deltaYmm,
        boundary: sl.boundary?.map((p) => ({ xMm: p.xMm + deltaXmm, yMm: p.yMm + deltaYmm })),
        holes: sl.holes?.map((h) => h.map((p) => ({ xMm: p.xMm + deltaXmm, yMm: p.yMm + deltaYmm }))),
      };
    });

    const nextCols = get().columns.map((c) => {
      if (!colIds.has(c.id)) return c;
      return { ...c, xMm: c.xMm + deltaXmm, yMm: c.yMm + deltaYmm };
    });

    const nextBeams = get().beams.map((b) => {
      if (!beamIds.has(b.id)) return b;
      return {
        ...b,
        startXmm: b.startXmm + deltaXmm,
        startYmm: b.startYmm + deltaYmm,
        endXmm: b.endXmm + deltaXmm,
        endYmm: b.endYmm + deltaYmm,
      };
    });

    const nextGrids = get().gridLines.map((g) => {
      if (!gridIds.has(g.id)) return g;
      return {
        ...g,
        startXmm: g.startXmm + deltaXmm,
        startYmm: g.startYmm + deltaYmm,
        endXmm: g.endXmm + deltaXmm,
        endYmm: g.endYmm + deltaYmm,
      };
    });

    const nextLines = get().sketchLines.map((l) => {
      if (!lineIds.has(l.id)) return l;
      return {
        ...l,
        startXmm: l.startXmm + deltaXmm,
        startYmm: l.startYmm + deltaYmm,
        endXmm: l.endXmm + deltaXmm,
        endYmm: l.endYmm + deltaYmm,
      };
    });

    for (const w of nextWalls) if (wallIds.has(w.id)) await idbPutWall(w);
    for (const sl of nextSlabs) if (slabIds.has(sl.id)) await idbPutSlab(sl);
    for (const c of nextCols) if (colIds.has(c.id)) await idbPutColumn(c);
    for (const b of nextBeams) if (beamIds.has(b.id)) await idbPutBeam(b);
    for (const g of nextGrids) if (gridIds.has(g.id)) await idbPutGridLine(g);

    set({
      walls: nextWalls,
      slabs: nextSlabs,
      columns: nextCols,
      beams: nextBeams,
      gridLines: nextGrids,
      sketchLines: nextLines,
      lastMutatedAt: Date.now(),
    });
  },

  copySelected: async (deltaXmm, deltaYmm) => {
    const sel = get().selectedElements;
    const projectId = get().projectId;
    if (sel.length === 0 || !projectId) return [];
    pushWerkzeugHistory();

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const slabIds = new Set(sel.filter((e) => e.kind === "slab").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));
    const gridIds = new Set(sel.filter((e) => e.kind === "grid").map((e) => e.id));
    const lineIds = new Set(sel.filter((e) => e.kind === "line").map((e) => e.id));

    const newRefs: SelectedElementRef[] = [];
    const newWalls: LayoutWall[] = [];
    const newDoors: LayoutDoor[] = [];
    const newWindows: LayoutWindow[] = [];
    const newSlabs: LayoutSlab[] = [];
    const newCols: LayoutColumn[] = [];
    const newBeams: LayoutBeam[] = [];
    const newGrids: LayoutGridLine[] = [];
    const newLines: LayoutSketchLine[] = [];

    const wallIdMap = new Map<string, string>();

    for (const w of get().walls) {
      if (!wallIds.has(w.id)) continue;
      const copyId = newLayoutId("wall");
      wallIdMap.set(w.id, copyId);
      const copy: LayoutWall = {
        ...w,
        id: copyId,
        startXmm: w.startXmm + deltaXmm,
        startYmm: w.startYmm + deltaYmm,
        endXmm: w.endXmm + deltaXmm,
        endYmm: w.endYmm + deltaYmm,
        createdAt: Date.now(),
      };
      newWalls.push(copy);
      newRefs.push({ kind: "wall", id: copyId });
      await idbPutWall(copy);
    }

    // Duplicate openings on copied walls
    for (const d of get().doors) {
      const newWallId = wallIdMap.get(d.wallId);
      if (!newWallId) continue;
      const copyDoor: LayoutDoor = {
        ...d,
        id: newLayoutId("door"),
        wallId: newWallId,
        createdAt: Date.now(),
      };
      newDoors.push(copyDoor);
      await idbPutDoor(copyDoor);
    }
    for (const win of get().windows) {
      const newWallId = wallIdMap.get(win.wallId);
      if (!newWallId) continue;
      const copyWin: LayoutWindow = {
        ...win,
        id: newLayoutId("win"),
        wallId: newWallId,
        createdAt: Date.now(),
      };
      newWindows.push(copyWin);
      await idbPutWindow(copyWin);
    }

    for (const sl of get().slabs) {
      if (!slabIds.has(sl.id)) continue;
      const copyId = newLayoutId(sl.kind === "roof" ? "roof" : "floor");
      const copy: LayoutSlab = {
        ...sl,
        id: copyId,
        minXmm: sl.minXmm + deltaXmm,
        maxXmm: sl.maxXmm + deltaXmm,
        minYmm: sl.minYmm + deltaYmm,
        maxYmm: sl.maxYmm + deltaYmm,
        boundary: sl.boundary?.map((p) => ({ xMm: p.xMm + deltaXmm, yMm: p.yMm + deltaYmm })),
        holes: sl.holes?.map((h) => h.map((p) => ({ xMm: p.xMm + deltaXmm, yMm: p.yMm + deltaYmm }))),
        createdAt: Date.now(),
      };
      newSlabs.push(copy);
      newRefs.push({ kind: "slab", id: copyId });
      await idbPutSlab(copy);
    }

    for (const c of get().columns) {
      if (!colIds.has(c.id)) continue;
      const copyId = newLayoutId("col");
      const copy: LayoutColumn = {
        ...c,
        id: copyId,
        xMm: c.xMm + deltaXmm,
        yMm: c.yMm + deltaYmm,
        createdAt: Date.now(),
      };
      newCols.push(copy);
      newRefs.push({ kind: "column", id: copyId });
      await idbPutColumn(copy);
    }

    for (const b of get().beams) {
      if (!beamIds.has(b.id)) continue;
      const copyId = newLayoutId("beam");
      const copy: LayoutBeam = {
        ...b,
        id: copyId,
        startXmm: b.startXmm + deltaXmm,
        startYmm: b.startYmm + deltaYmm,
        endXmm: b.endXmm + deltaXmm,
        endYmm: b.endYmm + deltaYmm,
        createdAt: Date.now(),
      };
      newBeams.push(copy);
      newRefs.push({ kind: "beam", id: copyId });
      await idbPutBeam(copy);
    }

    for (const g of get().gridLines) {
      if (!gridIds.has(g.id)) continue;
      const copyId = newLayoutId("grid");
      const copy: LayoutGridLine = {
        ...g,
        id: copyId,
        label: `${g.label}'`,
        startXmm: g.startXmm + deltaXmm,
        startYmm: g.startYmm + deltaYmm,
        endXmm: g.endXmm + deltaXmm,
        endYmm: g.endYmm + deltaYmm,
        createdAt: Date.now(),
      };
      newGrids.push(copy);
      newRefs.push({ kind: "grid", id: copyId });
      await idbPutGridLine(copy);
    }

    for (const l of get().sketchLines) {
      if (!lineIds.has(l.id)) continue;
      const copyId = newLayoutId("line");
      const copy: LayoutSketchLine = {
        ...l,
        id: copyId,
        startXmm: l.startXmm + deltaXmm,
        startYmm: l.startYmm + deltaYmm,
        endXmm: l.endXmm + deltaXmm,
        endYmm: l.endYmm + deltaYmm,
        createdAt: Date.now(),
      };
      newLines.push(copy);
      newRefs.push({ kind: "line", id: copyId });
    }

    set((s) => ({
      walls: [...s.walls, ...newWalls],
      doors: [...s.doors, ...newDoors],
      windows: [...s.windows, ...newWindows],
      slabs: [...s.slabs, ...newSlabs],
      columns: [...s.columns, ...newCols],
      beams: [...s.beams, ...newBeams],
      gridLines: [...s.gridLines, ...newGrids],
      sketchLines: [...s.sketchLines, ...newLines],
      selectedElements: newRefs,
      lastMutatedAt: Date.now(),
    }));

    return newRefs;
  },

  mirrorSelected: async (axisP1, axisP2) => {
    const sel = get().selectedElements;
    if (sel.length === 0) return;
    pushWerkzeugHistory();

    const dx = axisP2.xMm - axisP1.xMm;
    const dy = axisP2.yMm - axisP1.yMm;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return;

    const mirrorPoint = (x: number, y: number) => {
      const u = ((x - axisP1.xMm) * dx + (y - axisP1.yMm) * dy) / lenSq;
      const projX = axisP1.xMm + u * dx;
      const projY = axisP1.yMm + u * dy;
      return { x: 2 * projX - x, y: 2 * projY - y };
    };

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const slabIds = new Set(sel.filter((e) => e.kind === "slab").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));
    const lineIds = new Set(sel.filter((e) => e.kind === "line").map((e) => e.id));

    const nextWalls = get().walls.map((w) => {
      if (!wallIds.has(w.id)) return w;
      const p1 = mirrorPoint(w.startXmm, w.startYmm);
      const p2 = mirrorPoint(w.endXmm, w.endYmm);
      return { ...w, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    const nextCols = get().columns.map((c) => {
      if (!colIds.has(c.id)) return c;
      const p = mirrorPoint(c.xMm, c.yMm);
      return { ...c, xMm: Math.round(p.x), yMm: Math.round(p.y) };
    });

    const nextBeams = get().beams.map((b) => {
      if (!beamIds.has(b.id)) return b;
      const p1 = mirrorPoint(b.startXmm, b.startYmm);
      const p2 = mirrorPoint(b.endXmm, b.endYmm);
      return { ...b, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    const nextSlabs = get().slabs.map((sl) => {
      if (!slabIds.has(sl.id)) return sl;
      const p1 = mirrorPoint(sl.minXmm, sl.minYmm);
      const p2 = mirrorPoint(sl.maxXmm, sl.maxYmm);
      return {
        ...sl,
        minXmm: Math.min(Math.round(p1.x), Math.round(p2.x)),
        maxXmm: Math.max(Math.round(p1.x), Math.round(p2.x)),
        minYmm: Math.min(Math.round(p1.y), Math.round(p2.y)),
        maxYmm: Math.max(Math.round(p1.y), Math.round(p2.y)),
        boundary: sl.boundary?.map((p) => {
          const mp = mirrorPoint(p.xMm, p.yMm);
          return { xMm: Math.round(mp.x), yMm: Math.round(mp.y) };
        }),
      };
    });

    const nextLines = get().sketchLines.map((l) => {
      if (!lineIds.has(l.id)) return l;
      const p1 = mirrorPoint(l.startXmm, l.startYmm);
      const p2 = mirrorPoint(l.endXmm, l.endYmm);
      return { ...l, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    for (const w of nextWalls) if (wallIds.has(w.id)) await idbPutWall(w);
    for (const c of nextCols) if (colIds.has(c.id)) await idbPutColumn(c);
    for (const b of nextBeams) if (beamIds.has(b.id)) await idbPutBeam(b);
    for (const sl of nextSlabs) if (slabIds.has(sl.id)) await idbPutSlab(sl);

    set({
      walls: nextWalls,
      columns: nextCols,
      beams: nextBeams,
      slabs: nextSlabs,
      sketchLines: nextLines,
      lastMutatedAt: Date.now(),
    });
  },

  rotateSelected: async (center, angleDeg) => {
    const sel = get().selectedElements;
    if (sel.length === 0 || angleDeg === 0) return;
    pushWerkzeugHistory();

    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatePoint = (x: number, y: number) => {
      const rx = x - center.xMm;
      const ry = y - center.yMm;
      return {
        x: center.xMm + rx * cos - ry * sin,
        y: center.yMm + rx * sin + ry * cos,
      };
    };

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));

    const nextWalls = get().walls.map((w) => {
      if (!wallIds.has(w.id)) return w;
      const p1 = rotatePoint(w.startXmm, w.startYmm);
      const p2 = rotatePoint(w.endXmm, w.endYmm);
      return { ...w, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    const nextCols = get().columns.map((c) => {
      if (!colIds.has(c.id)) return c;
      const p = rotatePoint(c.xMm, c.yMm);
      return { ...c, xMm: Math.round(p.x), yMm: Math.round(p.y) };
    });

    const nextBeams = get().beams.map((b) => {
      if (!beamIds.has(b.id)) return b;
      const p1 = rotatePoint(b.startXmm, b.startYmm);
      const p2 = rotatePoint(b.endXmm, b.endYmm);
      return { ...b, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    for (const w of nextWalls) if (wallIds.has(w.id)) await idbPutWall(w);
    for (const c of nextCols) if (colIds.has(c.id)) await idbPutColumn(c);
    for (const b of nextBeams) if (beamIds.has(b.id)) await idbPutBeam(b);

    set({
      walls: nextWalls,
      columns: nextCols,
      beams: nextBeams,
      lastMutatedAt: Date.now(),
    });
  },

  scaleSelected: async (origin, scaleFactor) => {
    const sel = get().selectedElements;
    if (sel.length === 0 || scaleFactor <= 0 || scaleFactor === 1) return;
    pushWerkzeugHistory();

    const scalePoint = (x: number, y: number) => ({
      x: origin.xMm + (x - origin.xMm) * scaleFactor,
      y: origin.yMm + (y - origin.yMm) * scaleFactor,
    });

    const wallIds = new Set(sel.filter((e) => e.kind === "wall").map((e) => e.id));
    const colIds = new Set(sel.filter((e) => e.kind === "column").map((e) => e.id));
    const beamIds = new Set(sel.filter((e) => e.kind === "beam").map((e) => e.id));

    const nextWalls = get().walls.map((w) => {
      if (!wallIds.has(w.id)) return w;
      const p1 = scalePoint(w.startXmm, w.startYmm);
      const p2 = scalePoint(w.endXmm, w.endYmm);
      return {
        ...w,
        startXmm: Math.round(p1.x),
        startYmm: Math.round(p1.y),
        endXmm: Math.round(p2.x),
        endYmm: Math.round(p2.y),
      };
    });

    const nextCols = get().columns.map((c) => {
      if (!colIds.has(c.id)) return c;
      const p = scalePoint(c.xMm, c.yMm);
      return { ...c, xMm: Math.round(p.x), yMm: Math.round(p.y) };
    });

    const nextBeams = get().beams.map((b) => {
      if (!beamIds.has(b.id)) return b;
      const p1 = scalePoint(b.startXmm, b.startYmm);
      const p2 = scalePoint(b.endXmm, b.endYmm);
      return { ...b, startXmm: Math.round(p1.x), startYmm: Math.round(p1.y), endXmm: Math.round(p2.x), endYmm: Math.round(p2.y) };
    });

    for (const w of nextWalls) if (wallIds.has(w.id)) await idbPutWall(w);
    for (const c of nextCols) if (colIds.has(c.id)) await idbPutColumn(c);
    for (const b of nextBeams) if (beamIds.has(b.id)) await idbPutBeam(b);

    set({
      walls: nextWalls,
      columns: nextCols,
      beams: nextBeams,
      lastMutatedAt: Date.now(),
    });
  },

  // -- Section 2: Grouping ------------------------------------------------
  createGroupFromSelection: async (name) => {
    const sel = get().selectedElements;
    const projectId = get().projectId;
    if (sel.length < 2 || !projectId) return null;
    pushWerkzeugHistory();

    const group: LayoutGroup = {
      id: newLayoutId("group"),
      projectId,
      name: name || `Group ${get().groups.length + 1}`,
      elementRefs: [...sel],
      createdAt: Date.now(),
    };

    await idbPutGroup(group);
    set((s) => ({
      groups: [...s.groups, group],
      lastMutatedAt: Date.now(),
    }));
    return group;
  },

  ungroup: async (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) return;
    pushWerkzeugHistory();
    await idbDeleteGroup(groupId);
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      activeGroupId: s.activeGroupId === groupId ? null : s.activeGroupId,
      lastMutatedAt: Date.now(),
    }));
  },

  enterGroupEdit: (groupId) => set({ activeGroupId: groupId }),
  exitGroupEdit: () => set({ activeGroupId: null }),

  // -- Section 3: Layered Wall Assemblies --------------------------------
  addWallType: async (wt) => {
    const projectId = get().projectId;
    if (!projectId) return;
    pushWerkzeugHistory();
    await idbPutWallType(wt);
    set((s) => ({
      wallTypes: [...s.wallTypes, wt],
      lastMutatedAt: Date.now(),
    }));
  },

  updateWallType: async (id, patch) => {
    const prev = get().wallTypes.find((wt) => wt.id === id);
    if (!prev) return;
    pushWerkzeugHistory();
    const updated: WallType = { ...prev, ...patch };
    if (patch.layers) {
      updated.totalThicknessMm = patch.layers.reduce((sum, l) => sum + l.thicknessMm, 0);
    }
    await idbPutWallType(updated);

    // Update all walls utilizing this type
    const nextWalls = get().walls.map((w) => {
      if (w.wallTypeId !== id) return w;
      return {
        ...w,
        thicknessMm: updated.totalThicknessMm,
        layers: updated.layers,
      };
    });
    for (const w of nextWalls) {
      if (w.wallTypeId === id) await idbPutWall(w);
    }

    set((s) => ({
      wallTypes: s.wallTypes.map((wt) => (wt.id === id ? updated : wt)),
      walls: nextWalls,
      lastMutatedAt: Date.now(),
    }));
  },

  deleteWallType: async (id) => {
    await idbDeleteWallType(id);
    set((s) => ({
      wallTypes: s.wallTypes.filter((wt) => wt.id !== id),
      lastMutatedAt: Date.now(),
    }));
  },

  // -- Section 4: Structural Columns & Beams ------------------------------
  addColumn: async (col) => {
    const projectId = get().projectId;
    if (!projectId) return null;
    pushWerkzeugHistory();

    const column: LayoutColumn = {
      ...col,
      id: newLayoutId("col"),
      projectId,
      createdAt: Date.now(),
    };
    await idbPutColumn(column);
    set((s) => ({
      columns: [...s.columns, column],
      selectedElements: [{ kind: "column", id: column.id }],
      lastMutatedAt: Date.now(),
    }));
    return column;
  },

  updateColumn: async (id, patch) => {
    const prev = get().columns.find((c) => c.id === id);
    if (!prev) return;
    pushWerkzeugHistory();
    const updated: LayoutColumn = { ...prev, ...patch };
    await idbPutColumn(updated);
    set((s) => ({
      columns: s.columns.map((c) => (c.id === id ? updated : c)),
      lastMutatedAt: Date.now(),
    }));
  },

  deleteColumn: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteColumn(id);
    set((s) => ({
      columns: s.columns.filter((c) => c.id !== id),
      selectedElements: s.selectedElements.filter((e) => !(e.kind === "column" && e.id === id)),
      lastMutatedAt: Date.now(),
    }));
  },

  selectColumn: (id) => {
    if (!id) {
      set({
        selectedElements: get().selectedElements.filter((e) => e.kind !== "column"),
      });
      return;
    }
    get().selectElement({ kind: "column", id });
  },

  setDraftColumnSize: (widthMm, depthMm) =>
    set({ draftColumnWidthMm: widthMm, draftColumnDepthMm: depthMm }),

  addBeam: async (beam) => {
    const projectId = get().projectId;
    if (!projectId) return null;
    pushWerkzeugHistory();

    const newBeam: LayoutBeam = {
      ...beam,
      id: newLayoutId("beam"),
      projectId,
      createdAt: Date.now(),
    };
    await idbPutBeam(newBeam);
    set((s) => ({
      beams: [...s.beams, newBeam],
      selectedElements: [{ kind: "beam", id: newBeam.id }],
      lastMutatedAt: Date.now(),
    }));
    return newBeam;
  },

  updateBeam: async (id, patch) => {
    const prev = get().beams.find((b) => b.id === id);
    if (!prev) return;
    pushWerkzeugHistory();
    const updated: LayoutBeam = { ...prev, ...patch };
    await idbPutBeam(updated);
    set((s) => ({
      beams: s.beams.map((b) => (b.id === id ? updated : b)),
      lastMutatedAt: Date.now(),
    }));
  },

  deleteBeam: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteBeam(id);
    set((s) => ({
      beams: s.beams.filter((b) => b.id !== id),
      selectedElements: s.selectedElements.filter((e) => !(e.kind === "beam" && e.id === id)),
      lastMutatedAt: Date.now(),
    }));
  },

  selectBeam: (id) => {
    if (!id) {
      set({
        selectedElements: get().selectedElements.filter((e) => e.kind !== "beam"),
      });
      return;
    }
    get().selectElement({ kind: "beam", id });
  },

  setDraftBeamSize: (widthMm, depthMm) =>
    set({ draftBeamWidthMm: widthMm, draftBeamDepthMm: depthMm }),

  // -- Section 5: Reference / Grid Planes ---------------------------------
  addGridLine: async (grid) => {
    const projectId = get().projectId;
    if (!projectId) return null;
    pushWerkzeugHistory();

    const gridLine: LayoutGridLine = {
      ...grid,
      id: newLayoutId("grid"),
      projectId,
      createdAt: Date.now(),
    };
    await idbPutGridLine(gridLine);
    set((s) => ({
      gridLines: [...s.gridLines, gridLine],
      selectedElements: [{ kind: "grid", id: gridLine.id }],
      lastMutatedAt: Date.now(),
    }));
    return gridLine;
  },

  updateGridLine: async (id, patch) => {
    const prev = get().gridLines.find((g) => g.id === id);
    if (!prev) return;
    pushWerkzeugHistory();
    const updated: LayoutGridLine = { ...prev, ...patch };
    await idbPutGridLine(updated);
    set((s) => ({
      gridLines: s.gridLines.map((g) => (g.id === id ? updated : g)),
      lastMutatedAt: Date.now(),
    }));
  },

  deleteGridLine: async (id) => {
    pushWerkzeugHistory();
    await idbDeleteGridLine(id);
    set((s) => ({
      gridLines: s.gridLines.filter((g) => g.id !== id),
      selectedElements: s.selectedElements.filter((e) => !(e.kind === "grid" && e.id === id)),
      lastMutatedAt: Date.now(),
    }));
  },

  selectGridLine: (id) => {
    if (!id) {
      set({
        selectedElements: get().selectedElements.filter((e) => e.kind !== "grid"),
      });
      return;
    }
    get().selectElement({ kind: "grid", id });
  },
}));
