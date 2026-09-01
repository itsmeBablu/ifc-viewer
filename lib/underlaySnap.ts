/**
 * Snap helpers for reference underlay vector lines (DWG) / edge segments (PDF).
 */

import {
  effectiveMmPerPixel,
  underlayHeightMm,
  underlayUvToWorld,
  underlayWidthMm,
  type ReferenceUnderlay,
  type UnderlaySnapSegment,
} from "./referenceUnderlay";

export type PlanPointMm = { xMm: number; yMm: number };

/** Nearest point on segment A→B to P. */
function nearestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; dist: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) {
    const dist = Math.hypot(px - ax, py - ay);
    return { x: ax, y: ay, dist };
  }
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * abx;
  const y = ay + t * aby;
  return { x, y, dist: Math.hypot(px - x, py - y) };
}

/** Convert underlay UV snap segments into world plan mm segments. */
export function underlaySnapSegmentsWorld(
  u: ReferenceUnderlay,
): { ax: number; ay: number; bx: number; by: number }[] {
  const segs = u.snapSegments ?? [];
  if (!segs.length) return [];
  return segs.map((s) => {
    const a = underlayUvToWorld(u, s.u0, s.v0);
    const b = underlayUvToWorld(u, s.u1, s.v1);
    return { ax: a.xMm, ay: a.yMm, bx: b.xMm, by: b.yMm };
  });
}

export function segLineIntersection(
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
 * Snap a plan point to reference underlay vector lines (DWG) with full OSNAP support:
 * Endpoints, Midpoints, Intersections, Nearest, Perpendiculars.
 */
export function snapPlanToUnderlayLines(
  point: PlanPointMm,
  underlays: ReferenceUnderlay[],
  levelId: string | null,
  thresholdMm = 350,
  modes?: Record<string, boolean>,
  from?: PlanPointMm | null,
): PlanPointMm & { snapped: boolean; snapType?: string } {
  if (!levelId) return { ...point, snapped: false };

  const checkEndpoint = modes ? Boolean(modes.endpoint || modes.node) : true;
  const checkMidpoint = modes ? Boolean(modes.midpoint) : true;
  const checkIntersection = modes ? Boolean(modes.intersection) : true;
  const checkNearest = modes ? Boolean(modes.nearest) : true;
  const checkPerpendicular = modes ? Boolean(modes.perpendicular && from) : false;

  type Candidate = {
    point: { xMm: number; yMm: number };
    type: string;
    priority: number;
    distance: number;
  };
  const candidates: Candidate[] = [];

  const add = (x: number, y: number, type: string, priority: number) => {
    const dist = Math.hypot(point.xMm - x, point.yMm - y);
    if (dist <= thresholdMm) {
      candidates.push({
        point: { xMm: Math.round(x), yMm: Math.round(y) },
        type,
        priority,
        distance: dist,
      });
    }
  };

  const activeSegments: { ax: number; ay: number; bx: number; by: number }[] = [];
  for (const u of underlays) {
    if (u.levelId !== levelId) continue;
    for (const s of underlaySnapSegmentsWorld(u)) {
      activeSegments.push(s);
    }
  }

  if (!activeSegments.length) return { ...point, snapped: false };

  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];
    // Filter segments too far away
    const midX = (seg.ax + seg.bx) / 2;
    const midY = (seg.ay + seg.by) / 2;
    const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    if (Math.hypot(point.xMm - midX, point.yMm - midY) > segLen / 2 + thresholdMm + 100) {
      continue;
    }

    if (checkEndpoint) {
      add(seg.ax, seg.ay, "endpoint", 0);
      add(seg.bx, seg.by, "endpoint", 0);
    }
    if (checkMidpoint) {
      add(midX, midY, "midpoint", 2);
    }
    if (checkNearest) {
      const n = nearestOnSegment(point.xMm, point.yMm, seg.ax, seg.ay, seg.bx, seg.by);
      if (n.dist <= thresholdMm) {
        add(n.x, n.y, "nearest", 6);
      }
    }
    if (checkPerpendicular && from) {
      const perp = nearestOnSegment(from.xMm, from.yMm, seg.ax, seg.ay, seg.bx, seg.by);
      add(perp.x, perp.y, "perpendicular", 4);
    }

    if (checkIntersection) {
      for (let j = i + 1; j < Math.min(activeSegments.length, i + 30); j++) {
        const segB = activeSegments[j];
        const hit = segLineIntersection(
          seg.ax, seg.ay, seg.bx, seg.by,
          segB.ax, segB.ay, segB.bx, segB.by,
        );
        if (hit) {
          add(hit.x, hit.y, "intersection", 1);
        }
      }
    }
  }

  if (!candidates.length) return { ...point, snapped: false };

  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority);
  const best = candidates[0];
  return {
    xMm: best.point.xMm,
    yMm: best.point.yMm,
    snapped: true,
    snapType: best.type,
  };
}

/** Build UV segments from CAD strokes + the same bounds used for the canvas. */
export function strokesToSnapSegmentsUv(
  strokes: { points: { x: number; y: number }[] }[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  maxSegments = 4000,
): UnderlaySnapSegment[] {
  const pad = 0.02;
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const mx = bounds.minX - bw * pad;
  const my = bounds.minY - bh * pad;
  const spanX = bw * (1 + pad * 2);
  const spanY = bh * (1 + pad * 2);
  const out: UnderlaySnapSegment[] = [];
  for (const s of strokes) {
    for (let i = 0; i < s.points.length - 1; i++) {
      if (out.length >= maxSegments) return out;
      const a = s.points[i]!;
      const b = s.points[i + 1]!;
      // Canvas Y is flipped vs CAD Y — match strokesToCanvas mapping.
      const u0 = (a.x - mx) / spanX;
      const v0 = 1 - (a.y - my) / spanY;
      const u1 = (b.x - mx) / spanX;
      const v1 = 1 - (b.y - my) / spanY;
      if (
        !Number.isFinite(u0) ||
        !Number.isFinite(v0) ||
        !Number.isFinite(u1) ||
        !Number.isFinite(v1)
      )
        continue;
      out.push({ u0, v0, u1, v1 });
    }
  }
  return out;
}

/**
 * Rough edge segments from a raster (PDF/PNG) for snap.
 * Detects strong luminance gradients and keeps short H/V/diagonal runs.
 */
export function extractRasterSnapSegments(
  canvas: HTMLCanvasElement,
  maxSegments = 2500,
): UnderlaySnapSegment[] {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 8 || h < 8) return [];
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  // Downsample for speed
  const tw = Math.min(w, 1024);
  const th = Math.max(1, Math.round((h * tw) / w));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tctx = tmp.getContext("2d");
  if (!tctx) return [];
  tctx.drawImage(canvas, 0, 0, tw, th);
  const { data } = tctx.getImageData(0, 0, tw, th);
  const lum = new Float32Array(tw * th);
  for (let i = 0; i < tw * th; i++) {
    const o = i * 4;
    lum[i] =
      0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
  }
  const mag = new Float32Array(tw * th);
  let sum = 0;
  let count = 0;
  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const i = y * tw + x;
      const gx =
        -lum[i - tw - 1]! -
        2 * lum[i - 1]! -
        lum[i + tw - 1]! +
        lum[i - tw + 1]! +
        2 * lum[i + 1]! +
        lum[i + tw + 1]!;
      const gy =
        -lum[i - tw - 1]! -
        2 * lum[i - tw]! -
        lum[i - tw + 1]! +
        lum[i + tw - 1]! +
        2 * lum[i + tw]! +
        lum[i + tw + 1]!;
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      sum += m;
      count++;
    }
  }
  const mean = sum / Math.max(1, count);
  const thr = Math.max(40, mean * 2.2);
  const segs: UnderlaySnapSegment[] = [];

  const pushRun = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => {
    if (segs.length >= maxSegments) return;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 8) return;
    segs.push({
      u0: x0 / tw,
      v0: y0 / th,
      u1: x1 / tw,
      v1: y1 / th,
    });
  };

  // Horizontal runs
  for (let y = 1; y < th - 1; y++) {
    let runStart = -1;
    for (let x = 1; x < tw - 1; x++) {
      const strong = mag[y * tw + x]! >= thr;
      if (strong && runStart < 0) runStart = x;
      if ((!strong || x === tw - 2) && runStart >= 0) {
        const end = strong ? x : x - 1;
        if (end - runStart >= 8) pushRun(runStart, y, end, y);
        runStart = -1;
      }
    }
  }
  // Vertical runs
  for (let x = 1; x < tw - 1; x++) {
    let runStart = -1;
    for (let y = 1; y < th - 1; y++) {
      const strong = mag[y * tw + x]! >= thr;
      if (strong && runStart < 0) runStart = y;
      if ((!strong || y === th - 2) && runStart >= 0) {
        const end = strong ? y : y - 1;
        if (end - runStart >= 8) pushRun(x, runStart, x, end);
        runStart = -1;
      }
    }
  }
  return segs;
}

/** Debug: underlay size helpers kept available for snap UI. */
export function underlayPlanSizeMm(u: ReferenceUnderlay) {
  return {
    w: underlayWidthMm(u, u.levelId),
    h: underlayHeightMm(u, u.levelId),
    mmPerPx: effectiveMmPerPixel(u, u.levelId),
  };
}
