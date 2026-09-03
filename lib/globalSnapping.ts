/**
 * Global Revit-grade Snapping System.
 *
 * Applies globally to all line-based drawing tools (floors, walls, sketch lines, MEP).
 * Uses screen-pixel tolerance (default 14px) for consistent precision at any zoom level,
 * and supports desktop mouse hover, iPad touch drag, and auto-close boundary assist.
 */

import * as THREE from "three";
import type {
  LayoutWall,
  LayoutSlab,
  LayoutSketchLine,
  LayoutGridLine,
} from "./layoutDrawing";
import type { ReferenceUnderlay } from "./referenceUnderlay";
import { underlaySnapSegmentsWorld } from "./underlaySnap";

export type GlobalSnapType =
  | "endpoint"       // Small square at exact vertex
  | "midpoint"       // Small triangle at segment midpoint
  | "center"         // Small circle at arc / shape center
  | "intersection"   // Small X where two lines cross
  | "perpendicular"  // Right-angle bracket symbol
  | "nearest"        // Small dot / hourglass on line itself
  | "autoclose";      // Pulsing halo for closing boundary / hole

export type GlobalSnapResult = {
  snapped: boolean;
  type: GlobalSnapType | null;
  /** Snapped world point (in mm: xMm, yMm) */
  worldMm: { xMm: number; yMm: number };
  /** Screen client coordinates (clientX, clientY) */
  screen: { clientX: number; clientY: number };
  /** Distance in screen pixels */
  pixelDist: number;
  /** Whether this point completes / auto-closes a polygon loop */
  isAutoClose?: boolean;
  /** Optional label for HUD display */
  label?: string;
  /** Reference line angle in radians for perpendicular glyph alignment */
  referenceAngle?: number;
};

export type GlobalSnapSegment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  source?: string;
};

export type GlobalSnapOptions = {
  clientPos: { x: number; y: number };
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  levelElevationMm?: number;
  tolerancePx?: number; // default 14px
  fromMm?: { xMm: number; yMm: number } | null;
  /** Active in-progress chain or polygon vertices */
  inProgressPoints?: { xMm: number; yMm: number }[] | null;
  /** Whether the in-progress shape is trying to close (e.g. >= 3 points) */
  checkAutoClose?: boolean;
  walls?: LayoutWall[];
  slabs?: LayoutSlab[];
  sketchLines?: LayoutSketchLine[];
  gridLines?: LayoutGridLine[];
  underlays?: ReferenceUnderlay[];
  levelId?: string | null;
  activeModes?: Partial<Record<GlobalSnapType, boolean>>;
};

const _projVec = new THREE.Vector3();

/** Convert mm coordinates at elevation to screen client pixels */
export function worldMmToScreen(
  xMm: number,
  yMm: number,
  elevationMm: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): { clientX: number; clientY: number } {
  _projVec.set(xMm / 1000, elevationMm / 1000, yMm / 1000);
  _projVec.project(camera);

  const rect = canvas.getBoundingClientRect();
  const screenX = rect.left + (_projVec.x * 0.5 + 0.5) * rect.width;
  const screenY = rect.top + (-_projVec.y * 0.5 + 0.5) * rect.height;
  return { clientX: screenX, clientY: screenY };
}

/** Distance from point P to segment A->B in 2D */
function distPointToSegment(
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

/** Intersection between segment A->B and segment C->D */
function segmentIntersection(
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
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den;
  if (t >= -0.01 && t <= 1.01 && u >= -0.01 && u <= 1.01) {
    return { x: ax + t * rX, y: ay + t * rY };
  }
  return null;
}

/**
 * Main Global Snap Evaluator.
 * Checks all active geometry within a screen-pixel radius (default 14px).
 */
export function findGlobalSnap(opts: GlobalSnapOptions): GlobalSnapResult {
  const {
    clientPos,
    canvas,
    camera,
    levelElevationMm = 0,
    tolerancePx = 14,
    fromMm,
    inProgressPoints,
    checkAutoClose = true,
    walls = [],
    slabs = [],
    sketchLines = [],
    gridLines = [],
    underlays = [],
    levelId,
    activeModes,
  } = opts;

  const modes = {
    endpoint: activeModes?.endpoint ?? true,
    midpoint: activeModes?.midpoint ?? true,
    center: activeModes?.center ?? true,
    intersection: activeModes?.intersection ?? true,
    perpendicular: activeModes?.perpendicular ?? true,
    nearest: activeModes?.nearest ?? true,
    autoclose: activeModes?.autoclose ?? true,
  };

  type Candidate = {
    xMm: number;
    yMm: number;
    type: GlobalSnapType;
    priority: number; // 0 = highest (autoclose/endpoint), 1 = intersection, 2 = midpoint, 3 = perp, 4 = center, 5 = nearest
    pixelDist: number;
    screen: { clientX: number; clientY: number };
    isAutoClose?: boolean;
    label?: string;
    referenceAngle?: number;
  };

  const candidates: Candidate[] = [];

  const addCandidate = (
    xMm: number,
    yMm: number,
    type: GlobalSnapType,
    priority: number,
    label?: string,
    referenceAngle?: number,
    isAutoClose?: boolean,
  ) => {
    const screen = worldMmToScreen(xMm, yMm, levelElevationMm, camera, canvas);
    const pixelDist = Math.hypot(clientPos.x - screen.clientX, clientPos.y - screen.clientY);

    // Auto-close assist gets a slightly generous 18px radius for smooth ergonomics
    const maxPx = isAutoClose ? Math.max(tolerancePx, 18) : tolerancePx;

    if (pixelDist <= maxPx) {
      candidates.push({
        xMm: Math.round(xMm),
        yMm: Math.round(yMm),
        type,
        priority,
        pixelDist,
        screen,
        isAutoClose,
        label,
        referenceAngle,
      });
    }
  };

  // 1. Check in-progress polygon / chain points (Auto-close assist has top priority)
  if (inProgressPoints && inProgressPoints.length > 0) {
    const pts = inProgressPoints;
    const start = pts[0];

    // Auto-close check on the very first point of the in-progress shape
    if (modes.autoclose && checkAutoClose && pts.length >= 3) {
      addCandidate(
        start.xMm,
        start.yMm,
        "autoclose",
        -1, // Top priority above all else
        "Auto-Close Boundary",
        undefined,
        true,
      );
    }

    // Previous committed vertices as endpoints
    if (modes.endpoint) {
      for (let i = 0; i < pts.length; i++) {
        addCandidate(pts[i].xMm, pts[i].yMm, "endpoint", 0, "Vertex");
      }
    }

    // Midpoints of in-progress committed segments
    if (modes.midpoint && pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const mx = (pts[i].xMm + pts[i + 1].xMm) / 2;
        const my = (pts[i].yMm + pts[i + 1].yMm) / 2;
        addCandidate(mx, my, "midpoint", 2, "Midpoint");
      }
    }
  }

  // 2. Collect all active line segments for Midpoints, Intersections, Nearest & Perpendiculars
  const activeSegments: GlobalSnapSegment[] = [];

  // Walls
  const activeWalls = levelId ? walls.filter((w) => w.levelId === levelId) : walls;
  for (const w of activeWalls) {
    if (modes.endpoint) {
      addCandidate(w.startXmm, w.startYmm, "endpoint", 0, "Wall End");
      addCandidate(w.endXmm, w.endYmm, "endpoint", 0, "Wall End");
    }
    if (w.curved && w.arcCenterXmm != null && w.arcCenterYmm != null && modes.center) {
      addCandidate(w.arcCenterXmm, w.arcCenterYmm, "center", 4, "Arc Center");
    }
    activeSegments.push({
      ax: w.startXmm,
      ay: w.startYmm,
      bx: w.endXmm,
      by: w.endYmm,
      source: "wall",
    });

    // Wall face lines (outer and inner edges)
    const dx = w.endXmm - w.startXmm;
    const dy = w.endYmm - w.startYmm;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const halfThick = (w.thicknessMm || 200) / 2;
      const nx = (-dy / len) * halfThick;
      const ny = (dx / len) * halfThick;
      for (const side of [1, -1]) {
        activeSegments.push({
          ax: w.startXmm + nx * side,
          ay: w.startYmm + ny * side,
          bx: w.endXmm + nx * side,
          by: w.endYmm + ny * side,
          source: "wall-face",
        });
      }
    }
  }

  // Slabs / Floors (Outer boundaries and holes)
  const activeSlabs = levelId ? slabs.filter((s) => s.levelId === levelId) : slabs;
  for (const slab of activeSlabs) {
    const boundary = slab.boundary && slab.boundary.length >= 3 ? slab.boundary : [
      { xMm: slab.minXmm, yMm: slab.minYmm },
      { xMm: slab.maxXmm, yMm: slab.minYmm },
      { xMm: slab.maxXmm, yMm: slab.maxYmm },
      { xMm: slab.minXmm, yMm: slab.maxYmm },
    ];

    // Boundary vertices & segments
    for (let i = 0; i < boundary.length; i++) {
      const p1 = boundary[i];
      const p2 = boundary[(i + 1) % boundary.length];
      if (modes.endpoint) {
        addCandidate(p1.xMm, p1.yMm, "endpoint", 0, "Floor Corner");
      }
      activeSegments.push({ ax: p1.xMm, ay: p1.yMm, bx: p2.xMm, by: p2.yMm, source: "floor-boundary" });
    }

    // Slab holes
    if (slab.holes) {
      for (const hole of slab.holes) {
        for (let i = 0; i < hole.length; i++) {
          const p1 = hole[i];
          const p2 = hole[(i + 1) % hole.length];
          if (modes.endpoint) {
            addCandidate(p1.xMm, p1.yMm, "endpoint", 0, "Hole Corner");
          }
          activeSegments.push({ ax: p1.xMm, ay: p1.yMm, bx: p2.xMm, by: p2.yMm, source: "floor-hole" });
        }
      }
    }
  }

  // Sketch Lines
  for (const sk of sketchLines) {
    if (modes.endpoint) {
      addCandidate(sk.startXmm, sk.startYmm, "endpoint", 0, "Line End");
      addCandidate(sk.endXmm, sk.endYmm, "endpoint", 0, "Line End");
    }
    activeSegments.push({ ax: sk.startXmm, ay: sk.startYmm, bx: sk.endXmm, by: sk.endYmm, source: "sketch" });
  }

  // Grid Lines
  for (const g of gridLines) {
    if (modes.endpoint) {
      addCandidate(g.startXmm, g.startYmm, "endpoint", 0, `Grid ${g.label}`);
      addCandidate(g.endXmm, g.endYmm, "endpoint", 0, `Grid ${g.label}`);
    }
    activeSegments.push({ ax: g.startXmm, ay: g.startYmm, bx: g.endXmm, by: g.endYmm, source: "grid" });
  }

  // Reference Underlays (DWG/PDF lines)
  if (underlays && underlays.length > 0) {
    for (const u of underlays) {
      if (levelId && u.levelId !== levelId) continue;
      for (const s of underlaySnapSegmentsWorld(u)) {
        if (modes.endpoint) {
          addCandidate(s.ax, s.ay, "endpoint", 0, "DWG Vertex");
          addCandidate(s.bx, s.by, "endpoint", 0, "DWG Vertex");
        }
        activeSegments.push({ ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, source: "underlay" });
      }
    }
  }

  // 3. Process active segments: Midpoints, Nearest, and Perpendiculars
  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];

    // Midpoint
    if (modes.midpoint) {
      const mx = (seg.ax + seg.bx) / 2;
      const my = (seg.ay + seg.by) / 2;
      addCandidate(mx, my, "midpoint", 2, "Midpoint");
    }

    // Perpendicular projection from previous point
    if (modes.perpendicular && fromMm) {
      const proj = distPointToSegment(fromMm.xMm, fromMm.yMm, seg.ax, seg.ay, seg.bx, seg.by);
      if (proj.t > 0.02 && proj.t < 0.98) {
        const segAngle = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
        addCandidate(proj.x, proj.y, "perpendicular", 3, "Perpendicular", segAngle);
      }
    }

    // Nearest point on line (lowest priority)
    if (modes.nearest) {
      // Find approximate plan point under cursor
      const midScreen = worldMmToScreen((seg.ax + seg.bx) / 2, (seg.ay + seg.by) / 2, levelElevationMm, camera, canvas);
      const segLenPx = Math.hypot(
        worldMmToScreen(seg.bx, seg.by, levelElevationMm, camera, canvas).clientX -
        worldMmToScreen(seg.ax, seg.ay, levelElevationMm, camera, canvas).clientX,
        worldMmToScreen(seg.bx, seg.by, levelElevationMm, camera, canvas).clientY -
        worldMmToScreen(seg.ax, seg.ay, levelElevationMm, camera, canvas).clientY
      );
      if (Math.hypot(clientPos.x - midScreen.clientX, clientPos.y - midScreen.clientY) < segLenPx / 2 + 50) {
        // Sample 8 points along segment to find closest point on line
        for (let s = 1; s <= 7; s++) {
          const t = s / 8;
          const sx = seg.ax + t * (seg.bx - seg.ax);
          const sy = seg.ay + t * (seg.by - seg.ay);
          addCandidate(sx, sy, "nearest", 5, "On Line");
        }
      }
    }
  }

  // 4. Intersections between active segments
  if (modes.intersection && activeSegments.length > 1) {
    const limit = Math.min(activeSegments.length, 60);
    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        const inter = segmentIntersection(
          activeSegments[i].ax, activeSegments[i].ay, activeSegments[i].bx, activeSegments[i].by,
          activeSegments[j].ax, activeSegments[j].ay, activeSegments[j].bx, activeSegments[j].by,
        );
        if (inter) {
          addCandidate(inter.x, inter.y, "intersection", 1, "Intersection");
        }
      }
    }
  }

  if (!candidates.length) {
    return {
      snapped: false,
      type: null,
      worldMm: { xMm: 0, yMm: 0 },
      screen: { clientX: clientPos.x, clientY: clientPos.y },
      pixelDist: Infinity,
    };
  }

  // Sort candidates by priority (lower number = higher priority), then by pixel distance
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.pixelDist - b.pixelDist;
  });

  const best = candidates[0];
  return {
    snapped: true,
    type: best.type,
    worldMm: { xMm: best.xMm, yMm: best.yMm },
    screen: best.screen,
    pixelDist: best.pixelDist,
    isAutoClose: best.isAutoClose,
    label: best.label,
    referenceAngle: best.referenceAngle,
  };
}

/** Check if point P is strictly inside a 2D polygon using winding number / raycast */
export function isPointInPolygon(
  px: number,
  py: number,
  poly: { xMm: number; yMm: number }[],
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].xMm, yi = poly[i].yMm;
    const xj = poly[j].xMm, yj = poly[j].yMm;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check if polygon Inner is completely contained inside polygon Outer */
export function isPolygonInsidePolygon(
  inner: { xMm: number; yMm: number }[],
  outer: { xMm: number; yMm: number }[],
): boolean {
  if (inner.length < 3 || outer.length < 3) return false;
  // All vertices of inner must be inside outer
  for (const pt of inner) {
    if (!isPointInPolygon(pt.xMm, pt.yMm, outer)) {
      return false;
    }
  }
  // Check no edges intersect
  for (let i = 0; i < inner.length; i++) {
    const p1 = inner[i];
    const p2 = inner[(i + 1) % inner.length];
    for (let j = 0; j < outer.length; j++) {
      const q1 = outer[j];
      const q2 = outer[(j + 1) % outer.length];
      if (segmentIntersection(p1.xMm, p1.yMm, p2.xMm, p2.yMm, q1.xMm, q1.yMm, q2.xMm, q2.yMm)) {
        return false;
      }
    }
  }
  return true;
}
