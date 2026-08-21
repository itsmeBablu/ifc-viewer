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

export type SelectedElementRef = {
  kind: "wall" | "door" | "window" | "slab" | "placement" | "column" | "beam" | "line" | "grid" | "group";
  id: string;
};

export type LayoutGroup = {
  id: string;
  projectId: string;
  name: string;
  elementRefs: SelectedElementRef[];
  createdAt: number;
};

export type LayoutToolId = "wall" | "door" | "window" | "floor" | "roof" | "column" | "beam" | "grid" | "lines" | "trim";

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
      if (modes.quadrant) for (const [qx, qy] of [[cx+r,cy],[cx-r,cy],[cx,cy+r],[cx,cy-r]]) add(qx, qy, "quadrant", 2, wall.id);
      const vx = point.xMm-cx, vy = point.yMm-cy, vl = Math.hypot(vx,vy) || 1;
      if (modes.nearest) add(cx+vx/vl*r, cy+vy/vl*r, "nearest", 6, wall.id);
      if (modes.tangent && from) {
        const fx=from.xMm-cx, fy=from.yMm-cy, d=Math.hypot(fx,fy);
        if (d>r) { const a=Math.atan2(fy,fx), off=Math.acos(r/d); for (const ta of [a+off,a-off]) add(cx+Math.cos(ta)*r,cy+Math.sin(ta)*r,"tangent",3,wall.id); }
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
      const a = Math.atan2(dy, dx), len = Math.hypot(point.xMm-from.xMm, point.yMm-from.yMm);
      for (const pa of [a,a+Math.PI]) add(from.xMm+Math.cos(pa)*len, from.yMm+Math.sin(pa)*len, "parallel", 5, wall.id);
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

export type LayoutRoom = {
  id: string;
  projectId: string;
  levelId: string;
  name: string;
  number: string;
  areaSqM: number;
  boundaryPoints: { xMm: number; yMm: number }[];
  tagPosMm: { xMm: number; yMm: number };
  createdAt: number;
};

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

