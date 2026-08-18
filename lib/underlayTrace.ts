/**
 * Tier 2 underlay auto-trace: ranked wall / door / window candidates near cursor.
 * Prefer snap segments; fall back to local raster edges (no CDN required).
 * OpenCV is optional when available.
 */

import { loadOpenCv } from "./opencvLoader";
import {
  effectiveMmPerPixel,
  underlayUvToWorld,
  worldToUnderlayUv,
  type ReferenceUnderlay,
} from "./referenceUnderlay";
import { underlaySnapSegmentsWorld } from "./underlaySnap";
import type { LayoutWall } from "./layoutDrawing";

export type TraceCandidateKind = "wall" | "door" | "window";

export type TraceCandidate = {
  id: string;
  kind: TraceCandidateKind;
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  thicknessMm: number;
  positionMm?: number;
  widthMm?: number;
  /** Existing wall to attach openings to (required for door/window confirm). */
  wallId?: string;
  hinge?: "start" | "end";
  swing?: 1 | -1;
  method?: "arc" | "gap" | "window-gap" | "wall";
  confidence: number;
  source: "snap" | "opencv" | "raster";
};

type WorldSeg = { ax: number; ay: number; bx: number; by: number };

const MIN_THICKNESS_MM = 40;
const MAX_THICKNESS_MM = 500;
const ANGLE_TOL_DEG = 18;
const CURSOR_BAND_MM = 700;
const MIN_WALL_LEN_MM = 250;
const MIN_DOOR_GAP_MM = 600;
const MAX_DOOR_GAP_MM = 1600;
const MIN_WINDOW_GAP_MM = 400;
const MAX_WINDOW_GAP_MM = 2400;
const DEFAULT_FALLBACK_THICKNESS_MM = 200;

function segAngleDeg(s: WorldSeg): number {
  return (Math.atan2(s.by - s.ay, s.bx - s.ax) * 180) / Math.PI;
}

function normalizeAngleDiffDeg(a: number, b: number): number {
  let d = Math.abs(a - b) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

function segLength(s: WorldSeg): number {
  return Math.hypot(s.bx - s.ax, s.by - s.ay);
}

function signedDistToLine(px: number, py: number, s: WorldSeg): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(px - s.ax, py - s.ay);
  return ((px - s.ax) * dy - (py - s.ay) * dx) / len;
}

function midOf(s: WorldSeg): { x: number; y: number } {
  return { x: (s.ax + s.bx) / 2, y: (s.ay + s.by) / 2 };
}

function distPointToSeg(px: number, py: number, s: WorldSeg): number {
  const abx = s.bx - s.ax;
  const aby = s.by - s.ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return Math.hypot(px - s.ax, py - s.ay);
  let t = ((px - s.ax) * abx + (py - s.ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.ax + t * abx), py - (s.ay + t * aby));
}

function projectT(
  px: number,
  py: number,
  ox: number,
  oy: number,
  ux: number,
  uy: number,
): number {
  return (px - ox) * ux + (py - oy) * uy;
}

function candidateId(
  kind: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  extra = 0,
): string {
  return `${kind}:${Math.round(x0)}:${Math.round(y0)}:${Math.round(x1)}:${Math.round(y1)}:${Math.round(extra)}`;
}

type WallPair = {
  startXmm: number;
  startYmm: number;
  endXmm: number;
  endYmm: number;
  thicknessMm: number;
  confidence: number;
  faceA: WorldSeg;
  faceB: WorldSeg;
  ux: number;
  uy: number;
  originX: number;
  originY: number;
  t0: number;
  t1: number;
};

function findWallPairsNearPoint(
  segs: WorldSeg[],
  cursor: { xMm: number; yMm: number },
): WallPair[] {
  const near = segs.filter((s) => {
    if (segLength(s) < 60) return false;
    return distPointToSeg(cursor.xMm, cursor.yMm, s) <= CURSOR_BAND_MM;
  });
  if (near.length < 2) return [];

  const pairs: WallPair[] = [];
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = near[i]!;
      const b = near[j]!;
      if (normalizeAngleDiffDeg(segAngleDeg(a), segAngleDeg(b)) > ANGLE_TOL_DEG) {
        continue;
      }

      const ma = midOf(a);
      const mb = midOf(b);
      const gap =
        (Math.abs(signedDistToLine(ma.x, ma.y, b)) +
          Math.abs(signedDistToLine(mb.x, mb.y, a))) /
        2;
      if (gap < MIN_THICKNESS_MM || gap > MAX_THICKNESS_MM) continue;

      // Prefer cursor between faces, but allow near either face
      const sideA = signedDistToLine(cursor.xMm, cursor.yMm, a);
      const sideB = signedDistToLine(cursor.xMm, cursor.yMm, b);
      const nearStrip =
        sideA * sideB <= 0 ||
        Math.min(Math.abs(sideA), Math.abs(sideB)) < Math.max(gap, 120);
      if (!nearStrip) continue;

      const face = segLength(a) >= segLength(b) ? a : b;
      let dx = face.bx - face.ax;
      let dy = face.by - face.ay;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      dx /= len;
      dy /= len;

      const ox = (ma.x + mb.x) / 2;
      const oy = (ma.y + mb.y) / 2;

      const ta0 = projectT(a.ax, a.ay, ox, oy, dx, dy);
      const ta1 = projectT(a.bx, a.by, ox, oy, dx, dy);
      const tb0 = projectT(b.ax, b.ay, ox, oy, dx, dy);
      const tb1 = projectT(b.bx, b.by, ox, oy, dx, dy);
      // Use union of spans (more forgiving than strict overlap)
      const t0 = Math.min(ta0, ta1, tb0, tb1);
      const t1 = Math.max(ta0, ta1, tb0, tb1);
      if (t1 - t0 < MIN_WALL_LEN_MM) continue;

      const startXmm = ox + dx * t0;
      const startYmm = oy + dy * t0;
      const endXmm = ox + dx * t1;
      const endYmm = oy + dy * t1;

      const prox =
        1 /
        (1 +
          Math.min(
            distPointToSeg(cursor.xMm, cursor.yMm, a),
            distPointToSeg(cursor.xMm, cursor.yMm, b),
          ) /
            220);
      const conf = Math.min(1, prox * 0.85 + 0.15);
      if (conf < 0.18) continue;

      pairs.push({
        startXmm,
        startYmm,
        endXmm,
        endYmm,
        thicknessMm: Math.round(gap),
        confidence: conf,
        faceA: a,
        faceB: b,
        ux: dx,
        uy: dy,
        originX: ox,
        originY: oy,
        t0,
        t1,
      });
    }
  }

  pairs.sort((p, q) => q.confidence - p.confidence);
  const kept: WallPair[] = [];
  for (const p of pairs) {
    const dup = kept.some((k) => {
      const midDist = Math.hypot(
        (p.startXmm + p.endXmm) / 2 - (k.startXmm + k.endXmm) / 2,
        (p.startYmm + p.endYmm) / 2 - (k.startYmm + k.endYmm) / 2,
      );
      return midDist < 280 && Math.abs(p.thicknessMm - k.thicknessMm) < 60;
    });
    if (!dup) kept.push(p);
  }
  return kept;
}

/** Single-line fallback: wall along nearest segment with default thickness. */
function fallbackFromNearestSeg(
  segs: WorldSeg[],
  cursor: { xMm: number; yMm: number },
  thicknessMm: number,
  source: TraceCandidate["source"],
): TraceCandidate | null {
  let best: { s: WorldSeg; dist: number } | null = null;
  for (const s of segs) {
    if (segLength(s) < 200) continue;
    const d = distPointToSeg(cursor.xMm, cursor.yMm, s);
    if (d > CURSOR_BAND_MM) continue;
    if (!best || d < best.dist) best = { s, dist: d };
  }
  if (!best) return null;
  const s = best.s;
  // Extend short segments a bit so preview is visible
  let ax = s.ax;
  let ay = s.ay;
  let bx = s.bx;
  let by = s.by;
  const len = segLength(s);
  if (len < 800) {
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const extra = (800 - len) / 2;
    ax -= ux * extra;
    ay -= uy * extra;
    bx += ux * extra;
    by += uy * extra;
  }
  return {
    id: candidateId("wall", ax, ay, bx, by, thicknessMm),
    kind: "wall",
    startXmm: Math.round(ax),
    startYmm: Math.round(ay),
    endXmm: Math.round(bx),
    endYmm: Math.round(by),
    thicknessMm,
    confidence: Math.max(0.22, Math.min(0.5, 1 - best.dist / CURSOR_BAND_MM)),
    source,
  };
}

function faceCoverageIntervals(
  faces: WorldSeg[],
  ox: number,
  oy: number,
  ux: number,
  uy: number,
  t0: number,
  t1: number,
): { a: number; b: number }[] {
  const intervals: { a: number; b: number }[] = [];
  for (const f of faces) {
    const p0 = projectT(f.ax, f.ay, ox, oy, ux, uy);
    const p1 = projectT(f.bx, f.by, ox, oy, ux, uy);
    const a = Math.max(t0, Math.min(p0, p1));
    const b = Math.min(t1, Math.max(p0, p1));
    if (b - a > 80) intervals.push({ a, b });
  }
  if (!intervals.length) return [];
  intervals.sort((x, y) => x.a - y.a);
  const merged: { a: number; b: number }[] = [intervals[0]!];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.a <= last.b + 120) last.b = Math.max(last.b, cur.b);
    else merged.push({ ...cur });
  }
  return merged;
}

function gapsFromCoverage(
  covered: { a: number; b: number }[],
  t0: number,
  t1: number,
): { a: number; b: number }[] {
  if (!covered.length) return [];
  const gaps: { a: number; b: number }[] = [];
  let cursor = t0;
  for (const c of covered) {
    if (c.a - cursor >= MIN_WINDOW_GAP_MM) gaps.push({ a: cursor, b: c.a });
    cursor = Math.max(cursor, c.b);
  }
  if (t1 - cursor >= MIN_WINDOW_GAP_MM) gaps.push({ a: cursor, b: t1 });
  return gaps;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("underlay image"));
    img.src = dataUrl;
  });
}

/** Local Sobel-ish edge runs on a crop — no OpenCV CDN. */
function rasterEdgeSegsNearCursor(
  img: HTMLImageElement,
  underlay: ReferenceUnderlay,
  cursor: { xMm: number; yMm: number },
): WorldSeg[] {
  const mpp = effectiveMmPerPixel(underlay);
  const padMm = CURSOR_BAND_MM * 1.3;
  const padPx = Math.ceil(padMm / mpp) + 20;
  const uv = worldToUnderlayUv(underlay, cursor.xMm, cursor.yMm);
  if (uv.u < -0.05 || uv.u > 1.05 || uv.v < -0.05 || uv.v > 1.05) return [];

  const cx = uv.u * underlay.pixelWidth;
  const cy = uv.v * underlay.pixelHeight;
  const x0 = Math.max(0, Math.floor(cx - padPx));
  const y0 = Math.max(0, Math.floor(cy - padPx));
  const x1 = Math.min(underlay.pixelWidth, Math.ceil(cx + padPx));
  const y1 = Math.min(underlay.pixelHeight, Math.ceil(cy + padPx));
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 16 || ch < 16) return [];

  const canvas = document.createElement("canvas");
  // Cap work size
  const scale = Math.min(1, 512 / Math.max(cw, ch));
  const tw = Math.max(16, Math.round(cw * scale));
  const th = Math.max(16, Math.round(ch * scale));
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  const lum = new Float32Array(tw * th);
  for (let i = 0; i < tw * th; i++) {
    const o = i * 4;
    lum[i] = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
  }
  const mag = new Float32Array(tw * th);
  let sum = 0;
  let n = 0;
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
      n++;
    }
  }
  const thr = Math.max(28, (sum / Math.max(1, n)) * 2.2);
  const segs: WorldSeg[] = [];
  const visited = new Uint8Array(tw * th);

  const pushRun = (
    cells: { x: number; y: number }[],
  ) => {
    if (cells.length < 8) return;
    const a = cells[0]!;
    const b = cells[cells.length - 1]!;
    const px0 = x0 + a.x / scale;
    const py0 = y0 + a.y / scale;
    const px1 = x0 + b.x / scale;
    const py1 = y0 + b.y / scale;
    const wa = underlayUvToWorld(
      underlay,
      px0 / underlay.pixelWidth,
      py0 / underlay.pixelHeight,
    );
    const wb = underlayUvToWorld(
      underlay,
      px1 / underlay.pixelWidth,
      py1 / underlay.pixelHeight,
    );
    if (Math.hypot(wa.xMm - wb.xMm, wa.yMm - wb.yMm) >= 80) {
      segs.push({ ax: wa.xMm, ay: wa.yMm, bx: wb.xMm, by: wb.yMm });
    }
  };

  // Horizontal runs
  for (let y = 1; y < th - 1; y++) {
    let run: { x: number; y: number }[] = [];
    for (let x = 1; x < tw - 1; x++) {
      const i = y * tw + x;
      if (mag[i]! >= thr) {
        run.push({ x, y });
        visited[i] = 1;
      } else {
        pushRun(run);
        run = [];
      }
    }
    pushRun(run);
  }
  // Vertical runs
  for (let x = 1; x < tw - 1; x++) {
    let run: { x: number; y: number }[] = [];
    for (let y = 1; y < th - 1; y++) {
      const i = y * tw + x;
      if (mag[i]! >= thr) run.push({ x, y });
      else {
        pushRun(run);
        run = [];
      }
    }
    pushRun(run);
  }
  return segs.slice(0, 400);
}

async function opencvSegsNearCursor(
  img: HTMLImageElement,
  underlay: ReferenceUnderlay,
  cursor: { xMm: number; yMm: number },
): Promise<WorldSeg[]> {
  try {
    const cv = await loadOpenCv();
    const mpp = effectiveMmPerPixel(underlay);
    const padPx = Math.ceil((CURSOR_BAND_MM * 1.2) / mpp) + 16;
    const uv = worldToUnderlayUv(underlay, cursor.xMm, cursor.yMm);
    const cx = uv.u * underlay.pixelWidth;
    const cy = uv.v * underlay.pixelHeight;
    const x0 = Math.max(0, Math.floor(cx - padPx));
    const y0 = Math.max(0, Math.floor(cy - padPx));
    const x1 = Math.min(underlay.pixelWidth, Math.ceil(cx + padPx));
    const y1 = Math.min(underlay.pixelHeight, Math.ceil(cy + padPx));
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw < 8 || ch < 8) return [];
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = cv as any;
    const src =
      typeof C.imread === "function"
        ? C.imread(canvas)
        : C.matFromImageData(ctx.getImageData(0, 0, cw, ch));
    const gray = new C.Mat();
    const edges = new C.Mat();
    const lines = new C.Mat();
    const segs: WorldSeg[] = [];
    try {
      C.cvtColor(src, gray, C.COLOR_RGBA2GRAY);
      C.Canny(gray, edges, 40, 120, 3, false);
      C.HoughLinesP(edges, lines, 1, Math.PI / 180, 30, 18, 10);
      const d = lines.data32S as Int32Array;
      for (let i = 0; i < lines.rows; i++) {
        const i0 = i * 4;
        const wa = underlayUvToWorld(
          underlay,
          (d[i0]! + x0) / underlay.pixelWidth,
          (d[i0 + 1]! + y0) / underlay.pixelHeight,
        );
        const wb = underlayUvToWorld(
          underlay,
          (d[i0 + 2]! + x0) / underlay.pixelWidth,
          (d[i0 + 3]! + y0) / underlay.pixelHeight,
        );
        segs.push({ ax: wa.xMm, ay: wa.yMm, bx: wb.xMm, by: wb.yMm });
      }
    } finally {
      src.delete();
      gray.delete();
      edges.delete();
      lines.delete();
    }
    return segs;
  } catch {
    return [];
  }
}

/** Pick the underlay to analyze for this hover. */
export function resolveUnderlayForTrace(
  underlays: ReferenceUnderlay[],
  levelId: string | null,
  cursor: { xMm: number; yMm: number },
  preferredUnderlayId?: string | null,
): ReferenceUnderlay | null {
  if (!underlays.length) return null;
  if (preferredUnderlayId) {
    const hit = underlays.find((u) => u.id === preferredUnderlayId);
    if (hit) return hit;
  }
  if (levelId) {
    const onLevel = underlays.find((u) => u.levelId === levelId);
    if (onLevel) return onLevel;
  }
  // Prefer underlay whose UV contains the cursor
  for (const u of underlays) {
    const uv = worldToUnderlayUv(u, cursor.xMm, cursor.yMm);
    if (uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1) return u;
  }
  return underlays[0] ?? null;
}

/**
 * Ranked auto-trace candidates near a plan point for the armed tool.
 * Door/window mode: openings on existing walls only (arc / gap / window symbol).
 */
export async function detectTraceCandidatesNearPoint(
  cursor: { xMm: number; yMm: number },
  underlays: ReferenceUnderlay[],
  levelId: string,
  mode: TraceCandidateKind,
  preferredUnderlayId?: string | null,
  existingWalls: LayoutWall[] = [],
): Promise<TraceCandidate[]> {
  const underlay = resolveUnderlayForTrace(
    underlays,
    levelId,
    cursor,
    preferredUnderlayId,
  );
  if (!underlay) return [];

  // Openings: only on existing walls; Tab cycles mixed door/window candidates
  if (mode === "door" || mode === "window") {
    const { detectOpeningCandidatesOnExistingWalls } = await import(
      "./underlayOpeningTrace"
    );
    const openings = await detectOpeningCandidatesOnExistingWalls(
      cursor,
      underlay,
      existingWalls,
      underlay.levelId,
    );
    if (!openings.length) return [];
    // Soft preference for armed tool, but keep mixed list for Tab
    openings.sort((a, b) => {
      const pref = (c: TraceCandidate) =>
        c.kind === mode ? 1 : 0;
      return pref(b) - pref(a) || b.confidence - a.confidence;
    });
    return openings;
  }

  const snap = underlaySnapSegmentsWorld(underlay);
  let segs: WorldSeg[] = snap.filter(
    (s) => distPointToSeg(cursor.xMm, cursor.yMm, s) <= CURSOR_BAND_MM * 1.5,
  );
  let source: TraceCandidate["source"] = "snap";

  let pairs = findWallPairsNearPoint(segs, cursor);

  // Local raster edges if snap pairs are weak
  if (pairs.length === 0) {
    try {
      const img = await loadImage(underlay.imageDataUrl);
      const raster = rasterEdgeSegsNearCursor(img, underlay, cursor);
      if (raster.length) {
        segs = [...segs, ...raster];
        source = "raster";
        pairs = findWallPairsNearPoint(segs, cursor);
      }
      // Optional OpenCV boost
      if (pairs.length === 0) {
        const cvSegs = await opencvSegsNearCursor(img, underlay, cursor);
        if (cvSegs.length) {
          segs = [...segs, ...cvSegs];
          source = "opencv";
          pairs = findWallPairsNearPoint(segs, cursor);
        }
      }
    } catch {
      // keep snap-only
    }
  }

  const out: TraceCandidate[] = [];

  for (const p of pairs) {
    const wallCand: TraceCandidate = {
      id: candidateId(
        "wall",
        p.startXmm,
        p.startYmm,
        p.endXmm,
        p.endYmm,
        p.thicknessMm,
      ),
      kind: "wall",
      startXmm: Math.round(p.startXmm),
      startYmm: Math.round(p.startYmm),
      endXmm: Math.round(p.endXmm),
      endYmm: Math.round(p.endYmm),
      thicknessMm: p.thicknessMm,
      confidence: p.confidence,
      source,
    };

    if (mode === "wall") {
      out.push(wallCand);
      continue;
    }

    const covered = faceCoverageIntervals(
      [p.faceA, p.faceB],
      p.originX,
      p.originY,
      p.ux,
      p.uy,
      p.t0,
      p.t1,
    );
    const gaps = gapsFromCoverage(covered, p.t0, p.t1);
    for (const g of gaps) {
      const width = g.b - g.a;
      const midT = (g.a + g.b) / 2;
      const gapCx = p.originX + p.ux * midT;
      const gapCy = p.originY + p.uy * midT;
      const dist = Math.hypot(cursor.xMm - gapCx, cursor.yMm - gapCy);
      if (dist > CURSOR_BAND_MM) continue;

      const isDoor = width >= MIN_DOOR_GAP_MM && width <= MAX_DOOR_GAP_MM;
      const isWindow =
        width >= MIN_WINDOW_GAP_MM && width <= MAX_WINDOW_GAP_MM;
      let kind: TraceCandidateKind | null = null;
      if (mode === "door" && (isDoor || isWindow)) kind = "door";
      else if (mode === "window" && (isWindow || isDoor)) kind = "window";
      if (!kind) continue;

      out.push({
        id: candidateId(kind, p.startXmm, p.startYmm, gapCx, gapCy, width),
        kind,
        startXmm: wallCand.startXmm,
        startYmm: wallCand.startYmm,
        endXmm: wallCand.endXmm,
        endYmm: wallCand.endYmm,
        thicknessMm: p.thicknessMm,
        positionMm: Math.round(midT - p.t0),
        widthMm: Math.round(width),
        confidence: Math.min(1, p.confidence * 0.9),
        source,
      });
    }
  }

  // Always offer a single-line fallback in wall mode so hover isn't empty
  if (mode === "wall" && out.length === 0) {
    const fb = fallbackFromNearestSeg(
      segs,
      cursor,
      DEFAULT_FALLBACK_THICKNESS_MM,
      source,
    );
    if (fb) out.push(fb);
  }

  out.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  return out
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .slice(0, 12);
}
