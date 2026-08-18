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
  /** Plan X/Z in mm (Y-up scene: X → X, Y → Z). */
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  thicknessMm: number;
  heightMm: number;
  createdAt: number;
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
};

/** Horizontal slab — floor plate or roof plate (axis-aligned rectangle in plan). */
export type LayoutSlab = {
  id: string;
  projectId: string;
  levelId: string;
  kind: "floor" | "roof";
  /** Plan rectangle (mm). Scene: X → X, Y → Z. */
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

export type LayoutToolId = "wall" | "door" | "window" | "floor" | "roof";

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
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  return Math.hypot(dx, dy);
}

export function wallAngleRad(w: LayoutWall): number {
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

const JOIN_EPS_MM = 80;

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

/** Point along wall at offset mm from start (clamped). */
export function pointOnWallMm(
  w: LayoutWall,
  offsetMm: number,
): { xMm: number; yMm: number } {
  const len = wallLengthMm(w);
  const t = len > 0 ? Math.max(0, Math.min(1, offsetMm / len)) : 0;
  return {
    xMm: w.startXmm + (w.endXmm - w.startXmm) * t,
    yMm: w.startYmm + (w.endYmm - w.startYmm) * t,
  };
}

/** Nearest offset along wall to a plan point (mm). */
export function nearestOffsetOnWallMm(
  w: LayoutWall,
  xMm: number,
  yMm: number,
): number {
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
