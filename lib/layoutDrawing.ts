/**
 * Layout drawing (levels / walls / doors / windows) — mm-based site sketch
 * data, independent of IFC shell but shareable under the same project key.
 */

export const DEFAULT_LEVEL_HEIGHT_MM = 3000;
export const DEFAULT_WALL_THICKNESS_MM = 200;
export const DEFAULT_DOOR_WIDTH_MM = 900;
export const DEFAULT_DOOR_HEIGHT_MM = 2100;
export const DEFAULT_WINDOW_WIDTH_MM = 1200;
export const DEFAULT_WINDOW_HEIGHT_MM = 1400;
export const DEFAULT_WINDOW_SILL_MM = 900;

export type LayoutLevel = {
  id: string;
  projectId: string;
  name: string;
  /** Elevation of this storey floor, mm. */
  elevationMm: number;
  /** Floor-to-floor / wall default height for this level, mm. */
  heightMm: number;
  createdAt: number;
};

export type LayoutWall = {
  id: string;
  projectId: string;
  levelId: string;
  /** Optional upper level constraint; height is its elevation minus base level. */
  topLevelId?: string;
  /** Plan X/Z in mm (Y-up scene: X → X, Y → Z). */
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  thicknessMm: number;
  heightMm: number;
  createdAt: number;
  // -- Section 5: Curved wall (arc) --------------------------------------
  /** If true, wall follows an arc defined by arcCenter + arcRadius. */
  curved?: boolean;
  arcCenterXmm?: number;
  arcCenterYmm?: number;
  arcRadiusMm?: number;
  arcStartAngleDeg?: number;
  arcEndAngleDeg?: number;
  color?: string;
  /** Preset or custom material-library id. */
  material?: string;
  // -- Layered Wall Assemblies -------------------------------------------
  wallTypeId?: string;
  layers?: WallLayer[];
};

export type LayoutDoor = {
  id: string;
  projectId: string;
  wallId: string;
  /** Offset along wall from start, mm. */
  positionMm: number;
  widthMm: number;
  heightMm: number;
  /** Which jamb the hinge sits on (along the wall). */
  hinge: "start" | "end";
  /** Which side of the wall the leaf swings into (+1 / −1). */
  swing: 1 | -1;
  createdAt: number;
  // -- Section 6: Door style, head shape, color --------------------------
  style?: "wood" | "metal" | "glass" | "double";
  headShape?: "flat" | "arched" | "triangular";
  color?: string;
  material?: string;
};

export type LayoutWindow = {
  id: string;
  projectId: string;
  wallId: string;
  positionMm: number;
  widthMm: number;
  heightMm: number;
  /** Sill height above level floor, mm. */
  sillHeightMm: number;
  createdAt: number;
  // -- Section 6: Head shape + color -------------------------------------
  headShape?: "flat" | "arched" | "triangular";
  color?: string;
  material?: string;
};

/** Horizontal slab — floor plate or roof plate. */
export type LayoutSlab = {
  id: string;
  projectId: string;
  levelId: string;
  kind: "floor" | "roof";
  // -- Legacy rectangle fields (kept for backwards compatibility) ---------
  /** Plan rectangle AABB (mm). Computed from boundary if polygon mode. */
  minXmm: number;
  minYmm: number;
  maxXmm: number;
  maxYmm: number;
  /** Slab thickness mm. */
  thicknessMm: number;
  /**
   * Vertical offset from level elevation (mm).
   * Floor: usually 0. Roof: typically level heightMm.
   */
  elevationOffsetMm: number;
  createdAt: number;
  // -- Section 7: Sketch-based polygon boundary + holes ------------------
  /** Outer boundary polygon (plan mm). When present, supersedes the AABB. */
  boundary?: { xMm: number; yMm: number }[];
  /** Inner hole polygons (plan mm). */
  holes?: { xMm: number; yMm: number }[][];
  // -- Section 8: Roof per-edge slope control ----------------------------
  edgeSlopes?: { edgeIdx: number; pitchDeg: number; isSloped: boolean }[];
  /** Boundary was inferred from an enclosed wall region and follows wall edits. */
  autoBoundaryFromWalls?: boolean;
  // -- Section 9: Material & color ---------------------------------------
  color?: string;
  /** Preset or custom material-library id. */
  material?: string;
};

export const DEFAULT_SLAB_THICKNESS_MM = 200;

export function normalizeDoor(
  d: LayoutDoor & { hinge?: "start" | "end"; swing?: 1 | -1 },
): LayoutDoor {
  return {
    ...d,
    hinge: d.hinge === "end" ? "end" : "start",
    swing: d.swing === -1 ? -1 : 1,
  };
}

export type LayoutSketchLine = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  /** Drafting appearance. Boundary sketches override the display color to blue. */
  color?: string;
  thicknessPx?: number;
  pattern?: "solid" | "dashed" | "dotted" | "dash-dot";
  dashSizeMm?: number;
  gapSizeMm?: number;
  createdAt: number;
};

export type WallLayerFunction = "finish1" | "substrate" | "insulation" | "structure" | "core" | "finish2";

export type WallLayer = {
  id: string;
  name: string;
  function: WallLayerFunction;
  material: string;
  thicknessMm: number;
  color?: string;
};

export type WallType = {
  id: string;
  name: string;
  layers: WallLayer[];
  totalThicknessMm: number;
};

export type LayoutColumn = {
  id: string;
  projectId: string;
  levelId: string;
  topLevelId?: string;
  xMm: number;
  yMm: number;
  profile: "rect" | "circle";
  widthMm: number;
  depthMm: number;
  heightMm?: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutBeam = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  widthMm: number;
  depthMm: number;
  elevationOffsetMm: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type LayoutGridLine = {
  id: string;
  projectId: string;
  label: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  visibleLevels?: string[];
  createdAt: number;
};

export type StairShapeType = "straight" | "l-shape" | "u-shape" | "spiral";

export type LayoutStair = {
  id: string;
  projectId: string;
  levelId: string;
  /** Optional upper level constraint; rise is top level elevation minus base level. */
  topLevelId?: string;
  baseOffsetMm?: number;
  topOffsetMm?: number;
  stairType: StairShapeType;
  stairTypeId?: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  /** Second point / landing point for L-shape (turn vertex) or U-shape */
  landingXmm?: number;
  landingYmm?: number;
  turnDirection?: "left" | "right";
  widthMm: number;
  targetRiserHeightMm: number;
  treadDepthMm: number;
  nosingDepthMm?: number;
  hasRailingLeft?: boolean;
  hasRailingRight?: boolean;
  railingHeightMm?: number;
  railingStyle?: "standard" | "glass" | "pipe";
  // Spiral stair specific
  outerRadiusMm?: number;
  innerRadiusMm?: number;
  spiralAngleDeg?: number;
  color?: string;
  material?: string;
  treadMaterial?: string;
  stringerMaterial?: string;
  createdAt: number;
};

export type LayoutRamp = {
  id: string;
  projectId: string;
  levelId: string;
  topLevelId?: string;
  baseOffsetMm?: number;
  topOffsetMm?: number;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  landingXmm?: number;
  landingYmm?: number;
  widthMm: number;
  thicknessMm: number;
  hasRailingLeft?: boolean;
  hasRailingRight?: boolean;
  railingHeightMm?: number;
  railingStyle?: "standard" | "glass" | "pipe";
  maxSlopeRatio?: number; // e.g. 12 for 1:12
  color?: string;
  material?: string;
  createdAt: number;
};

export type DuctShape = "rectangular" | "round";
export type DuctSystemType = "supply" | "extract" | "exhaust" | "outdoor";

export type LayoutDuct = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationOffsetMm: number; // Height above floor level (default: 2600mm)
  shape: DuctShape;
  widthMm: number; // for rectangular
  heightMm: number; // for rectangular
  diameterMm: number; // for round
  system: DuctSystemType;
  flowM3h?: number;
  velocityMs?: number;
  insulationThicknessMm?: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type PipeSystemType =
  | "hydronic_supply"
  | "hydronic_return"
  | "domestic_cold"
  | "domestic_hot"
  | "sanitary_waste"
  | "gas";

export type LayoutPipe = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationOffsetMm: number; // default: 2700mm
  diameterMm: number; // outer diameter mm (e.g. 15, 22, 28, 35, 42, 54, 76, 108)
  system: PipeSystemType;
  slopePercent?: number; // for drainage / sanitary waste
  insulationThicknessMm?: number;
  material?: string;
  color?: string;
  createdAt: number;
};

export type CableTrayType = "ladder" | "perforated" | "wire_mesh" | "conduit";

export type LayoutCableTray = {
  id: string;
  projectId: string;
  levelId: string;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  elevationOffsetMm: number; // default: 2800mm
  widthMm: number; // e.g. 100, 150, 200, 300, 400
  heightMm: number; // e.g. 50, 60, 100
  trayType: CableTrayType;
  material?: string;
  color?: string;
  createdAt: number;
};

export type MepEquipmentCategory =
  | "diffuser_supply"
  | "diffuser_extract"
  | "diffuser_overflow"
  | "panel"
  | "socket"
  | "light"
  | "radiator"
  | "sink"
  | "toilet";

export type LayoutMepEquipment = {
  id: string;
  projectId: string;
  levelId: string;
  category: MepEquipmentCategory;
  xMm: number;
  yMm: number;
  elevationOffsetMm: number; // e.g. 2600mm ceiling or 1000mm wall
  rotationDeg: number;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  flowM3h?: number;
  powerWatts?: number;
  connectedHostId?: string; // e.g. ductId, pipeId, or wallId
  name?: string;
  material?: string;
  color?: string;
  createdAt: number;
};

export type SelectedElementRef = {
  kind:
    | "wall"
    | "door"
    | "window"
    | "slab"
    | "placement"
    | "column"
    | "beam"
    | "line"
    | "grid"
    | "group"
    | "stair"
    | "ramp"
    | "duct"
    | "pipe"
    | "cabletray"
    | "equipment";
  id: string;
};

export type LayoutGroup = {
  id: string;
  projectId: string;
  name: string;
  elementRefs: SelectedElementRef[];
  createdAt: number;
};

export type LayoutToolId =
  | "wall"
  | "door"
  | "window"
  | "floor"
  | "roof"
  | "column"
  | "beam"
  | "grid"
  | "lines"
  | "trim"
  | "stair"
  | "ramp"
  | "duct"
  | "pipe"
  | "cabletray"
  | "equipment";

export const DEFAULT_STAIR_WIDTH_MM = 1000;
export const DEFAULT_STAIR_RISER_MM = 175;
export const DEFAULT_STAIR_TREAD_MM = 280;
export const DEFAULT_STAIR_NOSING_MM = 25;
export const DEFAULT_RAMP_WIDTH_MM = 1200;
export const DEFAULT_RAMP_THICKNESS_MM = 150;
export const DEFAULT_RAILING_HEIGHT_MM = 900;

export const DEFAULT_DUCT_WIDTH_MM = 250;
export const DEFAULT_DUCT_HEIGHT_MM = 150;
export const DEFAULT_DUCT_DIAMETER_MM = 160;
export const DEFAULT_DUCT_ELEVATION_MM = 2600;

export const DEFAULT_PIPE_DIAMETER_MM = 32;
export const DEFAULT_PIPE_ELEVATION_MM = 2700;

export const DEFAULT_CABLE_TRAY_WIDTH_MM = 200;
export const DEFAULT_CABLE_TRAY_HEIGHT_MM = 60;
export const DEFAULT_CABLE_TRAY_ELEVATION_MM = 2800;

export const MEP_SYSTEM_COLORS = {
  duct_supply: "#06b6d4", // Cyan
  duct_extract: "#eab308", // Yellow
  duct_exhaust: "#ea580c", // Orange
  duct_outdoor: "#10b981", // Emerald
  pipe_hydronic_supply: "#ef4444", // Red
  pipe_hydronic_return: "#3b82f6", // Blue
  pipe_domestic_cold: "#0ea5e9", // Sky Blue
  pipe_domestic_hot: "#f43f5e", // Rose
  pipe_sanitary_waste: "#8b5cf6", // Purple
  pipe_gas: "#eab308", // Amber
  cabletray: "#64748b", // Slate
  equipment_supply: "#06b6d4",
  equipment_extract: "#eab308",
  equipment_overflow: "#10b981",
  equipment_electrical: "#f59e0b",
  equipment_plumbing: "#3b82f6",
} as const;

/**
 * Derive total rise (mm) from level elevation constraints + offsets.
 */
export function deriveRiseMm(
  levels: LayoutLevel[],
  baseLevelId: string,
  topLevelId?: string,
  baseOffsetMm = 0,
  topOffsetMm = 0,
  fallbackRiseMm = DEFAULT_LEVEL_HEIGHT_MM,
): number {
  const baseLevel = levels.find((l) => l.id === baseLevelId);
  const baseElev = (baseLevel?.elevationMm ?? 0) + (baseOffsetMm || 0);

  if (topLevelId) {
    const topLevel = levels.find((l) => l.id === topLevelId);
    if (topLevel) {
      const topElev = topLevel.elevationMm + (topOffsetMm || 0);
      const diff = topElev - baseElev;
      if (Math.abs(diff) >= 100) return Math.abs(diff);
    }
  }

  // If no top level specified, use base level height
  const levelHeight = baseLevel?.heightMm ?? fallbackRiseMm;
  return Math.max(100, levelHeight + (topOffsetMm || 0) - (baseOffsetMm || 0));
}

/**
 * Calculate stair metrics (riser count, actual riser height, actual tread count, stride formula 2R + T).
 */
export function calculateStairMetrics(
  totalRiseMm: number,
  targetRiserMm = DEFAULT_STAIR_RISER_MM,
  targetTreadMm = DEFAULT_STAIR_TREAD_MM,
) {
  const riserCount = Math.max(1, Math.round(totalRiseMm / Math.max(50, targetRiserMm)));
  const actualRiserMm = totalRiseMm / riserCount;
  const treadCount = Math.max(1, riserCount - 1);
  const totalRunLengthMm = treadCount * targetTreadMm;
  const strideValue = 2 * actualRiserMm + targetTreadMm; // 2R + T rule (ideal: 620-640mm)

  const warnings: string[] = [];
  if (actualRiserMm > 200) {
    warnings.push(`Riser height (${Math.round(actualRiserMm)}mm) exceeds recommended max 200mm.`);
  } else if (actualRiserMm < 140) {
    warnings.push(`Riser height (${Math.round(actualRiserMm)}mm) is below standard min 140mm.`);
  }

  if (targetTreadMm < 250) {
    warnings.push(`Tread depth (${Math.round(targetTreadMm)}mm) is below minimum 250mm.`);
  }

  if (strideValue < 600 || strideValue > 660) {
    warnings.push(`2R + T (${Math.round(strideValue)}mm) is outside ideal comfort range (620–640mm).`);
  }

  return {
    riserCount,
    actualRiserMm,
    treadCount,
    totalRunLengthMm,
    strideValue,
    isComfortable: warnings.length === 0,
    warnings,
  };
}

/**
 * Calculate ramp metrics (slope ratio 1:N, slope percentage, angle, ADA accessibility warning).
 */
export function calculateRampMetrics(
  totalRiseMm: number,
  runLengthMm: number,
) {
  const length = Math.max(10, runLengthMm);
  const slope = totalRiseMm / length;
  const slopeRatio = slope > 0 ? 1 / slope : Infinity;
  const slopePercent = slope * 100;
  const slopeAngleDeg = (Math.atan(slope) * 180) / Math.PI;

  const warnings: string[] = [];
  if (slopeRatio < 12) {
    warnings.push(
      `Slope 1:${slopeRatio.toFixed(1)} (${slopePercent.toFixed(1)}%) is steeper than recommended 1:12 (8.3%) max slope.`,
    );
  }

  return {
    slope,
    slopeRatio,
    slopePercent,
    slopeAngleDeg,
    exceedsMaxSlope: slopeRatio < 12,
    warnings,
  };
}

/**
 * Trim or extend two walls so they meet cleanly at their intersection point,
 * preserving the portions closest to clickPt1 and clickPt2 (Revit / AutoCAD standard).
 */
export function trimWallPair(
  w1: LayoutWall,
  clickPt1: { xMm: number; yMm: number },
  w2: LayoutWall,
  clickPt2: { xMm: number; yMm: number },
): {
  wall1Patch: Partial<LayoutWall>;
  wall2Patch: Partial<LayoutWall>;
} | null {
  if (w1.curved || w2.curved) return null;
  const hit = lineLineIntersection(
    w1.startXmm,
    w1.startYmm,
    w1.endXmm,
    w1.endYmm,
    w2.startXmm,
    w2.startYmm,
    w2.endXmm,
    w2.endYmm,
  );
  if (!hit) return null;

  // Retain the side that was actually picked. Comparing distances to the two
  // endpoints gives the wrong result when the intersection lies beyond a wall.
  const pickedSide = (wall: LayoutWall, point: { xMm: number; yMm: number }) => {
    const dx = wall.endXmm - wall.startXmm;
    const dy = wall.endYmm - wall.startYmm;
    const hitT = ((hit.x - wall.startXmm) * dx + (hit.y - wall.startYmm) * dy) /
      Math.max(dx * dx + dy * dy, 1e-9);
    const clickT = ((point.xMm - wall.startXmm) * dx + (point.yMm - wall.startYmm) * dy) /
      Math.max(dx * dx + dy * dy, 1e-9);
    return clickT <= hitT ? "start" : "end";
  };
  const side1 = pickedSide(w1, clickPt1);
  const wall1Patch: Partial<LayoutWall> =
    side1 === "start"
      ? { endXmm: Math.round(hit.x), endYmm: Math.round(hit.y) }
      : { startXmm: Math.round(hit.x), startYmm: Math.round(hit.y) };

  // For w2: keep endpoint closer to clickPt2, move other endpoint to hit
  const side2 = pickedSide(w2, clickPt2);
  const wall2Patch: Partial<LayoutWall> =
    side2 === "start"
      ? { endXmm: Math.round(hit.x), endYmm: Math.round(hit.y) }
      : { startXmm: Math.round(hit.x), startYmm: Math.round(hit.y) };

  return { wall1Patch, wall2Patch };
}

export type LayoutPresets = {
  wallThicknessMm: number[];
  doorSizes: { widthMm: number; heightMm: number }[];
  windowSizes: { widthMm: number; heightMm: number; sillHeightMm: number }[];
};

export const EMPTY_LAYOUT_PRESETS: LayoutPresets = {
  wallThicknessMm: [DEFAULT_WALL_THICKNESS_MM],
  doorSizes: [{ widthMm: DEFAULT_DOOR_WIDTH_MM, heightMm: DEFAULT_DOOR_HEIGHT_MM }],
  windowSizes: [
    {
      widthMm: DEFAULT_WINDOW_WIDTH_MM,
      heightMm: DEFAULT_WINDOW_HEIGHT_MM,
      sillHeightMm: DEFAULT_WINDOW_SILL_MM,
    },
  ],
};

export function newLayoutId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function wallLengthMm(w: LayoutWall): number {
  if (w.curved && w.arcRadiusMm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const deltaAngle = Math.abs(w.arcEndAngleDeg - w.arcStartAngleDeg);
    return w.arcRadiusMm * (deltaAngle * Math.PI) / 180;
  }
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  return Math.hypot(dx, dy);
}

export function wallAngleRad(w: LayoutWall): number {
  if (w.curved && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    // Tangent angle at the midpoint of the arc
    const midAngleDeg = (w.arcStartAngleDeg + w.arcEndAngleDeg) / 2;
    const midAngleRad = (midAngleDeg * Math.PI) / 180;
    return midAngleRad + Math.PI / 2; // Tangent direction
  }
  return Math.atan2(w.endYmm - w.startYmm, w.endXmm - w.startXmm);
}

export function wallAngleAtPositionRad(w: LayoutWall, positionMm: number): number {
  if (w.curved && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const len = wallLengthMm(w);
    const t = len > 0 ? Math.max(0, Math.min(1, positionMm / len)) : 0;
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const angle = startRad + (endRad - startRad) * t;
    return angle + Math.PI / 2;
  }
  return Math.atan2(w.endYmm - w.startYmm, w.endXmm - w.startXmm);
}

export function wallAngleDeg(w: LayoutWall): number {
  return (wallAngleRad(w) * 180) / Math.PI;
}

/** Keep start fixed; set length along current direction (min 50 mm). */
export function wallWithLengthFromStart(
  w: LayoutWall,
  lengthMm: number,
): Pick<LayoutWall, "endXmm" | "endYmm"> {
  const len = Math.max(50, lengthMm);
  const ang = wallAngleRad(w);
  return {
    endXmm: Math.round(w.startXmm + Math.cos(ang) * len),
    endYmm: Math.round(w.startYmm + Math.sin(ang) * len),
  };
}

/** Keep end fixed; set length by moving start. */
export function wallWithLengthFromEnd(
  w: LayoutWall,
  lengthMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm"> {
  const len = Math.max(50, lengthMm);
  const ang = wallAngleRad(w);
  return {
    startXmm: Math.round(w.endXmm - Math.cos(ang) * len),
    startYmm: Math.round(w.endYmm - Math.sin(ang) * len),
  };
}

/** Translate whole wall in plan mm (X → scene X, Y → scene Z). */
export function wallTranslated(
  w: LayoutWall,
  dxMm: number,
  dyMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: Math.round(w.startXmm + dxMm),
    startYmm: Math.round(w.startYmm + dyMm),
    endXmm: Math.round(w.endXmm + dxMm),
    endYmm: Math.round(w.endYmm + dyMm),
  };
}

/** Rotate about midpoint by delta degrees. */
export function wallRotatedAboutCenter(
  w: LayoutWall,
  deltaDeg: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const cx = (w.startXmm + w.endXmm) / 2;
  const cy = (w.startYmm + w.endYmm) / 2;
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: Math.round(cx + dx * cos - dy * sin),
      y: Math.round(cy + dx * sin + dy * cos),
    };
  };
  const s = rot(w.startXmm, w.startYmm);
  const e = rot(w.endXmm, w.endYmm);
  return { startXmm: s.x, startYmm: s.y, endXmm: e.x, endYmm: e.y };
}

/** Nudge perpendicular to wall (+ = left of start→end direction). */
export function wallOffsetPerpendicular(
  w: LayoutWall,
  distanceMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const ang = wallAngleRad(w);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  return wallTranslated(w, nx * distanceMm, ny * distanceMm);
}

/** Flip start/end (reverses hinge reference along wall). */
export function wallFlipped(
  w: LayoutWall,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: w.endXmm,
    startYmm: w.endYmm,
    endXmm: w.startXmm,
    endYmm: w.startYmm,
  };
}

// -- Beam geometry helpers -------------------------------------------------

export function beamLengthMm(b: LayoutBeam): number {
  return Math.hypot(b.endXmm - b.startXmm, b.endYmm - b.startYmm);
}

export function beamAngleDeg(b: LayoutBeam): number {
  return (
    (Math.atan2(b.endYmm - b.startYmm, b.endXmm - b.startXmm) * 180) / Math.PI
  );
}

/** Keep start fixed; set length along current direction (min 50 mm). */
export function beamWithLengthFromStart(
  b: LayoutBeam,
  lengthMm: number,
): Pick<LayoutBeam, "endXmm" | "endYmm"> {
  const len = Math.max(50, lengthMm);
  const dx = b.endXmm - b.startXmm;
  const dy = b.endYmm - b.startYmm;
  const len0 = Math.hypot(dx, dy);
  const ux = len0 > 1e-9 ? dx / len0 : 1;
  const uy = len0 > 1e-9 ? dy / len0 : 0;
  return {
    endXmm: Math.round(b.startXmm + ux * len),
    endYmm: Math.round(b.startYmm + uy * len),
  };
}

/** Keep end fixed; set length by moving start. */
export function beamWithLengthFromEnd(
  b: LayoutBeam,
  lengthMm: number,
): Pick<LayoutBeam, "startXmm" | "startYmm"> {
  const len = Math.max(50, lengthMm);
  const dx = b.endXmm - b.startXmm;
  const dy = b.endYmm - b.startYmm;
  const len0 = Math.hypot(dx, dy);
  const ux = len0 > 1e-9 ? dx / len0 : 1;
  const uy = len0 > 1e-9 ? dy / len0 : 0;
  return {
    startXmm: Math.round(b.endXmm - ux * len),
    startYmm: Math.round(b.endYmm - uy * len),
  };
}

/** Translate whole beam in plan mm (X → scene X, Y → scene Z). */
export function beamTranslated(
  b: LayoutBeam,
  dxMm: number,
  dyMm: number,
): Pick<LayoutBeam, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  return {
    startXmm: Math.round(b.startXmm + dxMm),
    startYmm: Math.round(b.startYmm + dyMm),
    endXmm: Math.round(b.endXmm + dxMm),
    endYmm: Math.round(b.endYmm + dyMm),
  };
}

/** Rotate both endpoints about the beam midpoint by delta degrees. */
export function beamRotatedAboutCenter(
  b: LayoutBeam,
  deltaDeg: number,
): Pick<LayoutBeam, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const cx = (b.startXmm + b.endXmm) / 2;
  const cy = (b.startYmm + b.endYmm) / 2;
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: Math.round(cx + dx * cos - dy * sin),
      y: Math.round(cy + dx * sin + dy * cos),
    };
  };
  const s = rot(b.startXmm, b.startYmm);
  const e = rot(b.endXmm, b.endYmm);
  return { startXmm: s.x, startYmm: s.y, endXmm: e.x, endYmm: e.y };
}

// -- Column geometry helpers -----------------------------------------------

/** Translate a column in plan mm (X → scene X, Y → scene Z). */
export function columnTranslated(
  c: LayoutColumn,
  dxMm: number,
  dyMm: number,
): Pick<LayoutColumn, "xMm" | "yMm"> {
  return { xMm: Math.round(c.xMm + dxMm), yMm: Math.round(c.yMm + dyMm) };
}

/** Unit normal in plan (+ = left of start→end). */
export function wallUnitPerp(w: LayoutWall): { nx: number; ny: number } {
  const ang = wallAngleRad(w);
  return { nx: -Math.sin(ang), ny: Math.cos(ang) };
}

export function wallsAreParallel(
  a: LayoutWall,
  b: LayoutWall,
  tolDeg = 8,
): boolean {
  let d = Math.abs(wallAngleDeg(a) - wallAngleDeg(b)) % 180;
  if (d > 90) d = 180 - d;
  return d <= tolDeg;
}

/** Signed centerline-to-centerline gap along A's normal. */
export function parallelWallCenterGapMm(a: LayoutWall, b: LayoutWall): number {
  const { nx, ny } = wallUnitPerp(a);
  const acx = (a.startXmm + a.endXmm) / 2;
  const acy = (a.startYmm + a.endYmm) / 2;
  const bcx = (b.startXmm + b.endXmm) / 2;
  const bcy = (b.startYmm + b.endYmm) / 2;
  return (bcx - acx) * nx + (bcy - acy) * ny;
}

/**
 * Nearest parallel wall face-to-face gap (mm, absolute).
 * Face gap ≈ |center gap| − (thicknessA + thicknessB) / 2.
 */
export function nearestParallelFaceGapMm(
  wall: LayoutWall,
  walls: LayoutWall[],
): { otherId: string; faceGapMm: number; signedCenterGapMm: number } | null {
  let best: {
    otherId: string;
    faceGapMm: number;
    signedCenterGapMm: number;
  } | null = null;
  for (const other of walls) {
    if (other.id === wall.id) continue;
    if (other.levelId !== wall.levelId) continue;
    if (!wallsAreParallel(wall, other)) continue;
    const signed = parallelWallCenterGapMm(wall, other);
    const face =
      Math.abs(signed) - (wall.thicknessMm + other.thicknessMm) / 2;
    if (!best || Math.abs(face) < Math.abs(best.faceGapMm)) {
      best = {
        otherId: other.id,
        faceGapMm: Math.round(face),
        signedCenterGapMm: signed,
      };
    }
  }
  return best;
}

/**
 * Move `wall` so its face-to-face gap to `other` becomes `targetFaceGapMm`
 * (preserves which side the other wall is on).
 */
export function wallWithFaceGapTo(
  wall: LayoutWall,
  other: LayoutWall,
  targetFaceGapMm: number,
): Pick<LayoutWall, "startXmm" | "startYmm" | "endXmm" | "endYmm"> {
  const signed = parallelWallCenterGapMm(wall, other);
  const side = signed >= 0 ? 1 : -1;
  const desiredCenter =
    side *
    (Math.max(0, targetFaceGapMm) +
      (wall.thicknessMm + other.thicknessMm) / 2);
  const delta = desiredCenter - signed;
  return wallOffsetPerpendicular(wall, delta);
}

export type WallCenterlineMm = {
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
};

const JOIN_EPS_MM = 160;

export type PlanSnapType =
  | "endpoint"
  | "midpoint"
  | "center"
  | "node"
  | "quadrant"
  | "intersection"
  | "apparent"
  | "insertion"
  | "perpendicular"
  | "extension"
  | "tangent"
  | "nearest"
  | "parallel";

export type PlanSnapModes = Record<PlanSnapType, boolean>;
export const DEFAULT_PLAN_SNAP_MODES: PlanSnapModes = {
  endpoint: true, midpoint: true, center: true, node: false, quadrant: true,
  intersection: true, apparent: true, insertion: true, perpendicular: true,
  extension: true, tangent: true, nearest: true, parallel: true,
};

export type PlanSnapResult = {
  point: { xMm: number; yMm: number };
  type: PlanSnapType | null;
  wallId?: string;
};

function lineLineIntersection(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-9) return null; // parallel
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  return { x: ax + t * rX, y: ay + t * rY };
}

function distPointSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number; x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    return { dist: Math.hypot(px - ax, py - ay), t: 0, x: ax, y: ay };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { dist: Math.hypot(px - x, py - y), t, x, y };
}

/**
 * CAD plan snap shared by wall drawing and slab boundary picking.
 * Priority is endpoint -> intersection -> midpoint -> perpendicular projection.
 */
export function snapPlanPointToWalls(
  point: { xMm: number; yMm: number },
  walls: LayoutWall[],
  levelId: string,
  toleranceMm = 140,
  modes: PlanSnapModes = DEFAULT_PLAN_SNAP_MODES,
  from?: { xMm: number; yMm: number } | null,
): PlanSnapResult {
  const levelWalls = walls.filter((w) => w.levelId === levelId);
  const straight = levelWalls.filter((w) => !w.curved);
  const candidates: Array<{
    point: { xMm: number; yMm: number };
    type: PlanSnapType;
    wallId?: string;
    priority: number;
    distance: number;
  }> = [];
  const add = (
    xMm: number,
    yMm: number,
    type: PlanSnapType,
    priority: number,
    wallId?: string,
  ) => {
    const distance = Math.hypot(point.xMm - xMm, point.yMm - yMm);
    if (distance <= toleranceMm) {
      candidates.push({
        point: { xMm: Math.round(xMm), yMm: Math.round(yMm) },
        type,
        wallId,
        priority,
        distance,
      });
    }
  };

  for (const wall of levelWalls) {
    if (modes.endpoint) {
      add(wall.startXmm, wall.startYmm, "endpoint", 0, wall.id);
      add(wall.endXmm, wall.endYmm, "endpoint", 0, wall.id);
    }
    if (modes.node) {
      add(wall.startXmm, wall.startYmm, "node", 1, wall.id);
      add(wall.endXmm, wall.endYmm, "node", 1, wall.id);
    }
    if (wall.curved && wall.arcCenterXmm != null && wall.arcCenterYmm != null && wall.arcRadiusMm != null) {
      const cx = wall.arcCenterXmm, cy = wall.arcCenterYmm, r = wall.arcRadiusMm;
      if (modes.center) add(cx, cy, "center", 1, wall.id);
      if (modes.quadrant) for (const [qx, qy] of [[cx + r, cy], [cx - r, cy], [cx, cy + r], [cx, cy - r]]) add(qx, qy, "quadrant", 2, wall.id);
      const vx = point.xMm - cx, vy = point.yMm - cy, vl = Math.hypot(vx, vy) || 1;
      if (modes.nearest) add(cx + vx / vl * r, cy + vy / vl * r, "nearest", 6, wall.id);
      if (modes.tangent && from) {
        const fx = from.xMm - cx, fy = from.yMm - cy, d = Math.hypot(fx, fy);
        if (d > r) { const a = Math.atan2(fy, fx), off = Math.acos(r / d); for (const ta of [a + off, a - off]) add(cx + Math.cos(ta) * r, cy + Math.sin(ta) * r, "tangent", 3, wall.id); }
      }
      continue;
    }
    const projected = distPointSeg(point.xMm, point.yMm, wall.startXmm, wall.startYmm, wall.endXmm, wall.endYmm);
    if (modes.midpoint)
      add(
        (wall.startXmm + wall.endXmm) / 2,
        (wall.startYmm + wall.endYmm) / 2,
        "midpoint",
        2,
        wall.id,
      );
    // Layout walls are parametric objects; their centerline origin is their
    // insertion/base point (openings and placed objects use the same concept).
    if (modes.insertion) add(
      (wall.startXmm + wall.endXmm) / 2,
      (wall.startYmm + wall.endYmm) / 2,
      "insertion",
      3,
      wall.id,
    );
    if (modes.nearest && projected.t > 0.01 && projected.t < 0.99) add(projected.x, projected.y, "nearest", 6, wall.id);
    if (modes.perpendicular && from) {
      const perp = distPointSeg(from.xMm, from.yMm, wall.startXmm, wall.startYmm, wall.endXmm, wall.endYmm);
      if (perp.t > 0.01 && perp.t < 0.99) add(perp.x, perp.y, "perpendicular", 3, wall.id);
    }
    // AutoCAD-style extension snap: use the unbounded wall line outside its
    // endpoints, while keeping the same finite aperture tolerance.
    const dx = wall.endXmm - wall.startXmm;
    const dy = wall.endYmm - wall.startYmm;
    const len2 = dx * dx + dy * dy;
    if (len2 > 1e-9) {
      const t = ((point.xMm - wall.startXmm) * dx + (point.yMm - wall.startYmm) * dy) / len2;
      if (modes.extension && (t < -0.01 || t > 1.01)) {
        add(wall.startXmm + t * dx, wall.startYmm + t * dy, "extension", 4, wall.id);
      }
    }
    if (modes.parallel && from) {
      const a = Math.atan2(dy, dx), len = Math.hypot(point.xMm - from.xMm, point.yMm - from.yMm);
      for (const pa of [a, a + Math.PI]) add(from.xMm + Math.cos(pa) * len, from.yMm + Math.sin(pa) * len, "parallel", 5, wall.id);
    }
  }

  for (let i = 0; i < straight.length; i++) {
    for (let j = i + 1; j < straight.length; j++) {
      const a = straight[i];
      const b = straight[j];
      const hit = lineLineIntersection(
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (!hit) continue;
      const onA = distPointSeg(
        hit.x,
        hit.y,
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
      );
      const onB = distPointSeg(
        hit.x,
        hit.y,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (modes.intersection && onA.dist <= 1 && onB.dist <= 1) {
        add(hit.x, hit.y, "intersection", 1);
      } else if (modes.apparent) {
        add(hit.x, hit.y, "apparent", 4);
      }
    }
  }

  // The aperture is proximity-led. Priority only breaks near-equal candidates;
  // otherwise a distant endpoint makes the cursor feel sticky and imprecise.
  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority);
  const best = candidates[0];
  return best
    ? { point: best.point, type: best.type, wallId: best.wallId }
    : { point: { ...point }, type: null };
}

/**
 * Extend wall centerlines to clean L / T joints (miter at intersection).
 * Recalculate whenever walls change — used by LayoutSceneLayer mesh build.
 */
export function joinedWallCenterlines(
  walls: LayoutWall[],
): Map<string, WallCenterlineMm> {
  const result = new Map<string, WallCenterlineMm>();
  for (const w of walls) {
    result.set(w.id, {
      startXmm: w.startXmm,
      startYmm: w.startYmm,
      endXmm: w.endXmm,
      endYmm: w.endYmm,
    });
  }

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i];
      const b = walls[j];
      if (a.levelId !== b.levelId) continue;
      const hit = lineLineIntersection(
        a.startXmm,
        a.startYmm,
        a.endXmm,
        a.endYmm,
        b.startXmm,
        b.startYmm,
        b.endXmm,
        b.endYmm,
      );
      if (!hit) continue;

      const endsA: Array<"start" | "end"> = ["start", "end"];
      const endsB: Array<"start" | "end"> = ["start", "end"];

      // L-corner: both walls have an endpoint near each other
      for (const ea of endsA) {
        const ax = ea === "start" ? a.startXmm : a.endXmm;
        const ay = ea === "start" ? a.startYmm : a.endYmm;
        for (const eb of endsB) {
          const bx = eb === "start" ? b.startXmm : b.endXmm;
          const by = eb === "start" ? b.startYmm : b.endYmm;
          if (Math.hypot(ax - bx, ay - by) > JOIN_EPS_MM) continue;
          // Intersection should lie near the shared corner
          if (Math.hypot(hit.x - ax, hit.y - ay) > JOIN_EPS_MM * 3) continue;
          const ra = result.get(a.id)!;
          const rb = result.get(b.id)!;
          if (ea === "start") {
            ra.startXmm = hit.x;
            ra.startYmm = hit.y;
          } else {
            ra.endXmm = hit.x;
            ra.endYmm = hit.y;
          }
          if (eb === "start") {
            rb.startXmm = hit.x;
            rb.startYmm = hit.y;
          } else {
            rb.endXmm = hit.x;
            rb.endYmm = hit.y;
          }
        }
      }

      // T-junction: endpoint of one wall sits mid-segment on the other
      const joinTol = Math.max(a.thicknessMm, b.thicknessMm) * 0.6 + 20;
      for (const [stem, through] of [
        [a, b],
        [b, a],
      ] as const) {
        for (const which of ["start", "end"] as const) {
          const px = which === "start" ? stem.startXmm : stem.endXmm;
          const py = which === "start" ? stem.startYmm : stem.endYmm;
          const near = distPointSeg(
            px,
            py,
            through.startXmm,
            through.startYmm,
            through.endXmm,
            through.endYmm,
          );
          if (near.dist > joinTol) continue;
          if (near.t < 0.02 || near.t > 0.98) continue; // L handled above
          const onThrough = distPointSeg(
            hit.x,
            hit.y,
            through.startXmm,
            through.startYmm,
            through.endXmm,
            through.endYmm,
          );
          const target =
            onThrough.t > 0.02 &&
              onThrough.t < 0.98 &&
              onThrough.dist < joinTol
              ? hit
              : { x: near.x, y: near.y };
          const rs = result.get(stem.id)!;
          if (which === "start") {
            rs.startXmm = target.x;
            rs.startYmm = target.y;
          } else {
            rs.endXmm = target.x;
            rs.endYmm = target.y;
          }
        }
      }
    }
  }

  return result;
}

export type WallMiterOffsets = {
  startOffsetLeftMm: number;
  startOffsetRightMm: number;
  endOffsetLeftMm: number;
  endOffsetRightMm: number;
};

/**
 * Multi-wall junction solver for 2, 3, 4, or 5+ walls meeting at any angle.
 * Computes exact mitered boundary line intersections for seamless corner joins.
 */
export function solveWallJunctions(
  walls: LayoutWall[],
  centerlines?: Map<string, WallCenterlineMm>,
): Map<string, WallMiterOffsets> {
  const offsets = new Map<string, WallMiterOffsets>();
  for (const w of walls) {
    offsets.set(w.id, {
      startOffsetLeftMm: 0,
      startOffsetRightMm: 0,
      endOffsetLeftMm: 0,
      endOffsetRightMm: 0,
    });
  }

  // Group straight walls by level
  const levels = new Set(walls.map((w) => w.levelId));
  for (const levelId of levels) {
    const levelWalls = walls.filter((w) => w.levelId === levelId && !w.curved);
    if (levelWalls.length < 2) continue;

    type EndpointRef = {
      wall: LayoutWall;
      end: "start" | "end";
      xMm: number;
      yMm: number;
      dirX: number;
      dirY: number;
      angle: number;
      halfThick: number;
    };

    const endpoints: EndpointRef[] = [];
    for (const w of levelWalls) {
      const cl = centerlines?.get(w.id) ?? {
        startXmm: w.startXmm,
        startYmm: w.startYmm,
        endXmm: w.endXmm,
        endYmm: w.endYmm,
      };
      const dx = cl.endXmm - cl.startXmm;
      const dy = cl.endYmm - cl.startYmm;
      const len = Math.hypot(dx, dy);
      if (len < 10) continue;
      const ux = dx / len;
      const uy = dy / len;
      const halfThick = (w.thicknessMm || 200) / 2;

      // At start, direction pointing into the wall away from start is (+ux, +uy)
      endpoints.push({
        wall: w,
        end: "start",
        xMm: cl.startXmm,
        yMm: cl.startYmm,
        dirX: ux,
        dirY: uy,
        angle: Math.atan2(uy, ux),
        halfThick,
      });

      // At end, direction pointing into the wall away from end is (-ux, -uy)
      endpoints.push({
        wall: w,
        end: "end",
        xMm: cl.endXmm,
        yMm: cl.endYmm,
        dirX: -ux,
        dirY: -uy,
        angle: Math.atan2(-uy, -ux),
        halfThick,
      });
    }

    // Cluster endpoints into junction nodes. Use transitive clustering so a
    // slightly noisy multi-wall node is still solved as one junction.
    const visited = new Set<number>();
    for (let i = 0; i < endpoints.length; i++) {
      if (visited.has(i)) continue;
      const cluster: EndpointRef[] = [endpoints[i]];
      visited.add(i);

      for (let cursor = 0; cursor < cluster.length; cursor++) {
        const seed = cluster[cursor];
        for (let j = 0; j < endpoints.length; j++) {
          if (visited.has(j)) continue;
          const candidate = endpoints[j];
          const d = Math.hypot(
            seed.xMm - candidate.xMm,
            seed.yMm - candidate.yMm,
          );
          const tolerance = Math.max(
            JOIN_EPS_MM,
            Math.min(180, (seed.halfThick + candidate.halfThick) * 0.75),
          );
          if (d <= tolerance) {
            cluster.push(candidate);
            visited.add(j);
          }
        }
      }

      if (cluster.length < 2) continue;

      // Sort cluster radially by angle
      cluster.sort((a, b) => a.angle - b.angle);

      // Shared node point
      const nodeX = cluster.reduce((sum, e) => sum + e.xMm, 0) / cluster.length;
      const nodeY = cluster.reduce((sum, e) => sum + e.yMm, 0) / cluster.length;

      const N = cluster.length;
      for (let k = 0; k < N; k++) {
        const curr = cluster[k];
        const next = cluster[(k + 1) % N];

        if (curr.wall.id === next.wall.id) continue;

        // Curr left edge: normal is (-dirY, +dirX)
        const leftP1x = nodeX - curr.dirY * curr.halfThick;
        const leftP1y = nodeY + curr.dirX * curr.halfThick;
        const leftP2x = leftP1x + curr.dirX * 1000;
        const leftP2y = leftP1y + curr.dirY * 1000;

        // Next right edge: normal is (+dirY, -dirX)
        const rightP1x = nodeX + next.dirY * next.halfThick;
        const rightP1y = nodeY - next.dirX * next.halfThick;
        const rightP2x = rightP1x + next.dirX * 1000;
        const rightP2y = rightP1y + next.dirY * 1000;

        const hit = lineLineIntersection(leftP1x, leftP1y, leftP2x, leftP2y, rightP1x, rightP1y, rightP2x, rightP2y);
        if (hit) {
          const projCurr = (hit.x - nodeX) * curr.dirX + (hit.y - nodeY) * curr.dirY;
          const projNext = (hit.x - nodeX) * next.dirX + (hit.y - nodeY) * next.dirY;

          const maxMiterCurr = curr.halfThick * 3;
          const maxMiterNext = next.halfThick * 3;

          const clampedCurr = Math.max(-maxMiterCurr, Math.min(maxMiterCurr, projCurr));
          const clampedNext = Math.max(-maxMiterNext, Math.min(maxMiterNext, projNext));

          const offCurr = offsets.get(curr.wall.id);
          if (offCurr) {
            if (curr.end === "start") {
              offCurr.startOffsetLeftMm = clampedCurr;
            } else {
              offCurr.endOffsetRightMm = clampedCurr;
            }
          }

          const offNext = offsets.get(next.wall.id);
          if (offNext) {
            if (next.end === "start") {
              offNext.startOffsetRightMm = clampedNext;
            } else {
              offNext.endOffsetLeftMm = clampedNext;
            }
          }
        }
      }
    }
  }

  return offsets;
}

/** Point along wall at offset mm from start (clamped). */
export function pointOnWallMm(
  w: LayoutWall,
  offsetMm: number,
): { xMm: number; yMm: number } {
  const len = wallLengthMm(w);
  const t = len > 0 ? Math.max(0, Math.min(1, offsetMm / len)) : 0;
  if (w.curved && w.arcRadiusMm != null && w.arcCenterXmm != null && w.arcCenterYmm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const angle = startRad + (endRad - startRad) * t;
    return {
      xMm: Math.round(w.arcCenterXmm + w.arcRadiusMm * Math.cos(angle)),
      yMm: Math.round(w.arcCenterYmm + w.arcRadiusMm * Math.sin(angle)),
    };
  }
  return {
    xMm: Math.round(w.startXmm + (w.endXmm - w.startXmm) * t),
    yMm: Math.round(w.startYmm + (w.endYmm - w.startYmm) * t),
  };
}

/** Nearest offset along wall to a plan point (mm). */
export function nearestOffsetOnWallMm(
  w: LayoutWall,
  xMm: number,
  yMm: number,
): number {
  if (w.curved && w.arcRadiusMm != null && w.arcCenterXmm != null && w.arcCenterYmm != null && w.arcStartAngleDeg != null && w.arcEndAngleDeg != null) {
    const dx = xMm - w.arcCenterXmm;
    const dy = yMm - w.arcCenterYmm;
    const angleRad = Math.atan2(dy, dx);
    const startRad = (w.arcStartAngleDeg * Math.PI) / 180;
    const endRad = (w.arcEndAngleDeg * Math.PI) / 180;
    const diff = ((angleRad - startRad + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const totalDiff = endRad - startRad;
    let t = 0;
    if (Math.abs(totalDiff) > 1e-5) {
      t = Math.max(0, Math.min(1, diff / totalDiff));
    }
    return t * wallLengthMm(w);
  }
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return 0;
  const t = ((xMm - w.startXmm) * dx + (yMm - w.startYmm) * dy) / len2;
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * Math.sqrt(len2);
}

/** Cardinal angles (degrees) for wall drawing assist. */
export const WALL_CARDINAL_DEG = [0, 90, 180, 270] as const;

/**
 * Snap a draft endpoint toward 0/90/180/270° relative to `from`, or to the
 * previous segment direction when `prevFrom` is set.
 * Soft assist: only snaps when within `toleranceDeg` of a cardinal.
 */
export function snapWallEndpointMm(
  from: { xMm: number; yMm: number },
  to: { xMm: number; yMm: number },
  opts?: {
    prevFrom?: { xMm: number; yMm: number } | null;
    toleranceDeg?: number;
  },
): {
  point: { xMm: number; yMm: number };
  angleDeg: number;
  snapped: boolean;
} {
  const tolerance = opts?.toleranceDeg ?? 8;
  const dx = to.xMm - from.xMm;
  const dy = to.yMm - from.yMm;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) {
    return { point: { ...to }, angleDeg: 0, snapped: false };
  }

  let baseRad = 0;
  if (opts?.prevFrom) {
    baseRad = Math.atan2(
      from.yMm - opts.prevFrom.yMm,
      from.xMm - opts.prevFrom.xMm,
    );
  }

  const absRad = Math.atan2(dy, dx);
  const relDeg = ((absRad - baseRad) * 180) / Math.PI;
  const norm = ((relDeg % 360) + 360) % 360;

  let best: number = WALL_CARDINAL_DEG[0];
  let bestDelta = 999;
  for (const c of WALL_CARDINAL_DEG) {
    let d = Math.abs(norm - c);
    if (d > 180) d = 360 - d;
    if (d < bestDelta) {
      bestDelta = d;
      best = c;
    }
  }

  if (bestDelta <= tolerance) {
    const snappedRelRad = (best * Math.PI) / 180;
    const snappedAbsRad = baseRad + snappedRelRad;
    return {
      point: {
        xMm: from.xMm + Math.cos(snappedAbsRad) * len,
        yMm: from.yMm + Math.sin(snappedAbsRad) * len,
      },
      angleDeg: Math.round(best),
      snapped: true,
    };
  }

  return {
    point: { ...to },
    angleDeg: Math.round(norm),
    snapped: false,
  };
}

export function rememberNumber(list: number[], value: number, max = 8): number[] {
  const v = Math.round(value);
  const next = [v, ...list.filter((x) => x !== v)];
  return next.slice(0, max);
}

export function rememberDoorSize(
  list: { widthMm: number; heightMm: number }[],
  widthMm: number,
  heightMm: number,
  max = 8,
): { widthMm: number; heightMm: number }[] {
  const w = Math.round(widthMm);
  const h = Math.round(heightMm);
  const next = [
    { widthMm: w, heightMm: h },
    ...list.filter((x) => !(x.widthMm === w && x.heightMm === h)),
  ];
  return next.slice(0, max);
}

export function rememberWindowSize(
  list: { widthMm: number; heightMm: number; sillHeightMm: number }[],
  widthMm: number,
  heightMm: number,
  sillHeightMm: number,
  max = 8,
): { widthMm: number; heightMm: number; sillHeightMm: number }[] {
  const w = Math.round(widthMm);
  const h = Math.round(heightMm);
  const s = Math.round(sillHeightMm);
  const next = [
    { widthMm: w, heightMm: h, sillHeightMm: s },
    ...list.filter(
      (x) =>
        !(x.widthMm === w && x.heightMm === h && x.sillHeightMm === s),
    ),
  ];
  return next.slice(0, max);
}

/** Empty-project model key prefix. */
export const EMPTY_PROJECT_PREFIX = "empty:";

export function isEmptyProjectKey(modelKey: string | null): boolean {
  return Boolean(modelKey?.startsWith(EMPTY_PROJECT_PREFIX));
}

export function emptyProjectKey(name: string): string {
  const safe = name.trim().replace(/[^\w.-]+/g, "_") || "project";
  return `${EMPTY_PROJECT_PREFIX}${safe}`;
}

export type LayoutRoomVentilation = {
  abluftVolume: number; // Extract flow m³/h
  zuluftVolume: number; // Supply flow m³/h
  overflowVolume: number; // Überströmung m³/h
  aldVolume: number; // Outdoor air inlet m³/h
  roomArt: string; // DIN / SC RaumArt code (e.g. "204" Bad, "200" Wohnen)
  flowRole: "supply" | "extract" | "overflow" | "neutral";
  ventilationHeatLossWatts?: number;
};

export type LayoutRoom = {
  id: string;
  projectId: string;
  levelId: string;
  name: string;
  number: string;
  areaSqM: number;
  boundaryPoints: { xMm: number; yMm: number }[];
  tagPosMm: { xMm: number; yMm: number };
  ventilation?: LayoutRoomVentilation;
  createdAt: number;
};

/**
 * Propose recommended airflow (m³/h) and flow role based on room name or type
 */
export function estimateRoomVentilation(name: string, areaSqM: number): LayoutRoomVentilation {
  const lower = name.toLowerCase();
  const baseRatePerM2 = 1.2; // approx 1.2 m³/h per m²
  if (lower.includes("bad") || lower.includes("wc") || lower.includes("toilet") || lower.includes("bath")) {
    return {
      abluftVolume: Math.max(40, Math.round(areaSqM * 10)),
      zuluftVolume: 0,
      overflowVolume: 0,
      aldVolume: 0,
      roomArt: "204",
      flowRole: "extract",
      ventilationHeatLossWatts: Math.round(areaSqM * 25),
    };
  }
  if (lower.includes("küche") || lower.includes("kueche") || lower.includes("kitchen") || lower.includes("kochen")) {
    return {
      abluftVolume: Math.max(45, Math.round(areaSqM * 6)),
      zuluftVolume: 0,
      overflowVolume: 0,
      aldVolume: 0,
      roomArt: "205",
      flowRole: "extract",
      ventilationHeatLossWatts: Math.round(areaSqM * 20),
    };
  }
  if (lower.includes("flur") || lower.includes("korridor") || lower.includes("diele") || lower.includes("hall") || lower.includes("gang")) {
    return {
      abluftVolume: 0,
      zuluftVolume: 0,
      overflowVolume: Math.max(20, Math.round(areaSqM * 3)),
      aldVolume: 0,
      roomArt: "201",
      flowRole: "overflow",
      ventilationHeatLossWatts: Math.round(areaSqM * 10),
    };
  }
  // Living / bedroom / general supply
  const flow = Math.max(30, Math.round(areaSqM * baseRatePerM2 * 2.5));
  return {
    abluftVolume: 0,
    zuluftVolume: flow,
    overflowVolume: 0,
    aldVolume: 0,
    roomArt: "200",
    flowRole: "supply",
    ventilationHeatLossWatts: Math.round(areaSqM * 18),
  };
}

/**
 * Standard duct sizing based on flow volume (m³/h) and recommended velocity (m/s)
 * Q = A * v => A = Q / (3600 * v)
 */
export function calculateDuctSizing(flowM3h: number, velocityMs = 3.0): {
  roundDiameterMm: number;
  rectWidthMm: number;
  rectHeightMm: number;
  actualVelocityMs: number;
} {
  const safeFlow = Math.max(10, flowM3h);
  const requiredAreaM2 = safeFlow / (3600 * Math.max(0.5, velocityMs));
  // Round diameter D = sqrt(4 * A / PI)
  const exactDiaMm = Math.sqrt((4 * requiredAreaM2) / Math.PI) * 1000;
  const standardRound = [80, 100, 125, 150, 160, 200, 250, 315, 355, 400, 450, 500];
  const roundDiameterMm = standardRound.find((d) => d >= exactDiaMm) ?? 500;

  // Rectangular standard: aspect ratio ~ 1.5 - 2.0
  const standardRectHeights = [100, 150, 200, 250, 300];
  let rectHeightMm = 150;
  let rectWidthMm = 200;
  for (const h of standardRectHeights) {
    const w = (requiredAreaM2 * 1e6) / h;
    if (w >= h && w <= h * 3) {
      rectHeightMm = h;
      rectWidthMm = Math.ceil(w / 50) * 50; // round up to 50mm
      break;
    }
  }
  const rectAreaM2 = (rectWidthMm * rectHeightMm) * 1e-6;
  const actualVelocityMs = Number((safeFlow / (3600 * rectAreaM2)).toFixed(2));

  return { roundDiameterMm, rectWidthMm, rectHeightMm, actualVelocityMs };
}


/** Compute polygon area in m² from mm vertices using Shoelace formula */
export function computePolygonAreaSqM(points: { xMm: number; yMm: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p1.xMm * p2.yMm - p2.xMm * p1.yMm);
  }
  return Math.abs(sum) * 0.5 * 1e-6;
}

/** Ray-wall intersection helper */
function raySegmentIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; x: number; y: number } | null {
  const v1x = ox - x1;
  const v1y = oy - y1;
  const v2x = x2 - x1;
  const v2y = y2 - y1;
  const v3x = -dy;
  const v3y = dx;

  const dot = v2x * v3x + v2y * v3y;
  if (Math.abs(dot) < 1e-6) return null;

  const t1 = (v2x * v1y - v2y * v1x) / dot;
  const t2 = (v1x * v3x + v1y * v3y) / dot;

  if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
    return { dist: t1, x: ox + dx * t1, y: oy + dy * t1 };
  }
  return null;
}

/** Detect enclosed room polygon around seed point (px, py) using radial ray-casting */
export function detectEnclosedRoomBoundary(
  px: number,
  py: number,
  walls: LayoutWall[]
): { boundary: { xMm: number; yMm: number }[]; areaSqM: number } | null {
  if (walls.length < 3) {
    // Default 4x4m room boundary if not enclosed by walls
    const half = 2000;
    const boundary = [
      { xMm: px - half, yMm: py - half },
      { xMm: px + half, yMm: py - half },
      { xMm: px + half, yMm: py + half },
      { xMm: px - half, yMm: py + half },
    ];
    return { boundary, areaSqM: computePolygonAreaSqM(boundary) };
  }

  const numRays = 24;
  const hits: { xMm: number; yMm: number }[] = [];

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let closestDist = Infinity;
    let closestHit: { x: number; y: number } | null = null;

    for (const w of walls) {
      const hit = raySegmentIntersect(px, py, dx, dy, w.startXmm, w.startYmm, w.endXmm, w.endYmm);
      if (hit && hit.dist < closestDist && hit.dist > 10) {
        closestDist = hit.dist;
        closestHit = { x: hit.x, y: hit.y };
      }
    }

    if (closestHit && closestDist < 30000) {
      hits.push({ xMm: closestHit.x, yMm: closestHit.y });
    }
  }

  if (hits.length >= 3) {
    const area = computePolygonAreaSqM(hits);
    if (area > 1 && area < 10000) {
      return { boundary: hits, areaSqM: area };
    }
  }

  // Fallback room boundary 4x4m
  const half = 2000;
  const boundary = [
    { xMm: px - half, yMm: py - half },
    { xMm: px + half, yMm: py - half },
    { xMm: px + half, yMm: py + half },
    { xMm: px - half, yMm: py + half },
  ];
  return { boundary, areaSqM: computePolygonAreaSqM(boundary) };
}

// ---------------------------------------------------------------------------
// Sheet Composition & Title Block (Section 7)
// ---------------------------------------------------------------------------

export type SheetSize = "A1" | "A2" | "A3" | "A4";

export const SHEET_DIMENSIONS_MM: Record<SheetSize, { widthMm: number; heightMm: number }> = {
  A1: { widthMm: 841, heightMm: 594 },
  A2: { widthMm: 594, heightMm: 420 },
  A3: { widthMm: 420, heightMm: 297 },
  A4: { widthMm: 297, heightMm: 210 },
};

export type SheetViewport = {
  id: string;
  viewType: "floor_plan" | "3d_view" | "elevation";
  levelId?: string;
  name: string;
  scale: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type LayoutSheet = {
  id: string;
  projectId: string;
  sheetNumber: string;
  sheetName: string;
  sheetSize: SheetSize;
  projectName: string;
  clientName?: string;
  author: string;
  checker?: string;
  date: string;
  scale: string;
  revisions: { rev: string; desc: string; date: string }[];
  viewports: SheetViewport[];
  createdAt: number;
};

