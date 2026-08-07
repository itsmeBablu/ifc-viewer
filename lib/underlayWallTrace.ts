/**
 * Tier 1 wall-thickness auto-detection from a reference underlay.
 *
 * Prefer vector/edge snap segments (DWG / PDF edges). Fall back to OpenCV.js
 * Canny + HoughLinesP on a cropped region of the underlay image.
 */

import { loadOpenCv, type CvRuntime } from "./opencvLoader";
import {
  effectiveMmPerPixel,
  underlayUvToWorld,
  worldToUnderlayUv,
  type ReferenceUnderlay,
} from "./referenceUnderlay";
import { underlaySnapSegmentsWorld } from "./underlaySnap";

export type WallThicknessDetectResult = {
  thicknessMm: number;
  /** 0–1 rough confidence. */
  confidence: number;
  source: "snap" | "opencv";
};

type WorldSeg = { ax: number; ay: number; bx: number; by: number };

const MIN_THICKNESS_MM = 50;
const MAX_THICKNESS_MM = 450;
const ANGLE_TOL_DEG = 12;
const PATH_BAND_MM = 600;

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

/**
 * Among segments near the click path, find the best parallel pair whose
 * perpendicular spacing looks like a wall thickness.
 */
export function thicknessFromParallelSegments(
  segs: WorldSeg[],
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): WallThicknessDetectResult | null {
  const pathAngle =
    (Math.atan2(end.yMm - start.yMm, end.xMm - start.xMm) * 180) / Math.PI;
  const mid = {
    x: (start.xMm + end.xMm) / 2,
    y: (start.yMm + end.yMm) / 2,
  };
  const pathLen = Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm);
  if (pathLen < 100) return null;

  const near: WorldSeg[] = [];
  for (const s of segs) {
    if (segLength(s) < 80) continue;
    if (normalizeAngleDiffDeg(segAngleDeg(s), pathAngle) > ANGLE_TOL_DEG) {
      continue;
    }
    const dMid = distPointToSeg(mid.x, mid.y, s);
    const dA = distPointToSeg(start.xMm, start.yMm, s);
    const dB = distPointToSeg(end.xMm, end.yMm, s);
    if (Math.min(dMid, dA, dB) > PATH_BAND_MM) continue;
    near.push(s);
  }
  if (near.length < 2) return null;

  let best: { thicknessMm: number; score: number } | null = null;

  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = near[i]!;
      const b = near[j]!;
      if (
        normalizeAngleDiffDeg(segAngleDeg(a), segAngleDeg(b)) > ANGLE_TOL_DEG
      ) {
        continue;
      }
      const ma = midOf(a);
      const mb = midOf(b);
      const d1 = Math.abs(signedDistToLine(ma.x, ma.y, b));
      const d2 = Math.abs(signedDistToLine(mb.x, mb.y, a));
      const gap = (d1 + d2) / 2;
      if (gap < MIN_THICKNESS_MM || gap > MAX_THICKNESS_MM) continue;

      const sideA = signedDistToLine(mid.x, mid.y, a);
      const sideB = signedDistToLine(mid.x, mid.y, b);
      if (sideA * sideB > 0) continue;

      const betweenBonus =
        Math.abs(Math.abs(sideA) + Math.abs(sideB) - gap) < gap * 0.45
          ? 1.2
          : 0.7;
      const lenScore =
        Math.min(segLength(a), segLength(b)) / Math.max(pathLen, 1);
      const prox =
        1 /
        (1 +
          Math.min(
            distPointToSeg(mid.x, mid.y, a),
            distPointToSeg(mid.x, mid.y, b),
          ) /
            200);
      const score =
        betweenBonus * (0.4 + 0.6 * Math.min(1, lenScore)) * prox;
      if (!best || score > best.score) {
        best = { thicknessMm: Math.round(gap), score };
      }
    }
  }
  if (!best || best.score < 0.25) return null;
  return {
    thicknessMm: best.thicknessMm,
    confidence: Math.min(1, best.score),
    source: "snap",
  };
}

async function loadImageDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Underlay image failed to load"));
    img.src = dataUrl;
  });
}

function houghSegmentsNearPath(
  cv: CvRuntime,
  img: HTMLImageElement,
  underlay: ReferenceUnderlay,
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
): WorldSeg[] {
  const uv0 = worldToUnderlayUv(underlay, start.xMm, start.yMm);
  const uv1 = worldToUnderlayUv(underlay, end.xMm, end.yMm);
  const mpp = effectiveMmPerPixel(underlay);
  const padPx = Math.ceil(PATH_BAND_MM / mpp) + 24;
  const px0 = uv0.u * underlay.pixelWidth;
  const py0 = uv0.v * underlay.pixelHeight;
  const px1 = uv1.u * underlay.pixelWidth;
  const py1 = uv1.v * underlay.pixelHeight;

  let x0 = Math.floor(Math.min(px0, px1) - padPx);
  let y0 = Math.floor(Math.min(py0, py1) - padPx);
  let x1 = Math.ceil(Math.max(px0, px1) + padPx);
  let y1 = Math.ceil(Math.max(py0, py1) + padPx);
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(underlay.pixelWidth, x1);
  y1 = Math.min(underlay.pixelHeight, y1);
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 8 || ch < 8) return [];

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);

  // OpenCV.js runtime is untyped; keep access local.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const C = cv as any;
  let src: { delete: () => void };
  if (typeof C.imread === "function") {
    src = C.imread(canvas);
  } else if (typeof C.matFromImageData === "function") {
    src = C.matFromImageData(ctx.getImageData(0, 0, cw, ch));
  } else {
    return [];
  }
  const gray = new C.Mat();
  const edges = new C.Mat();
  const lines = new C.Mat();
  const segs: WorldSeg[] = [];
  try {
    C.cvtColor(src, gray, C.COLOR_RGBA2GRAY);
    C.Canny(gray, edges, 50, 150, 3, false);
    C.HoughLinesP(edges, lines, 1, Math.PI / 180, 40, 25, 12);
    const d = lines.data32S as Int32Array;
    for (let i = 0; i < lines.rows; i++) {
      const i0 = i * 4;
      const lx0 = d[i0]! + x0;
      const ly0 = d[i0 + 1]! + y0;
      const lx1 = d[i0 + 2]! + x0;
      const ly1 = d[i0 + 3]! + y0;
      const wa = underlayUvToWorld(
        underlay,
        lx0 / underlay.pixelWidth,
        ly0 / underlay.pixelHeight,
      );
      const wb = underlayUvToWorld(
        underlay,
        lx1 / underlay.pixelWidth,
        ly1 / underlay.pixelHeight,
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
}

/**
 * Detect wall thickness along a drawn centerline from the level's underlay.
 * Returns null if nothing plausible is found (keep draft thickness).
 */
export async function detectWallThicknessFromUnderlay(
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
  underlays: ReferenceUnderlay[],
  levelId: string,
): Promise<WallThicknessDetectResult | null> {
  const underlay = underlays.find((u) => u.levelId === levelId) ?? null;
  if (!underlay) return null;

  const snapSegs = underlaySnapSegmentsWorld(underlay);
  if (snapSegs.length >= 2) {
    const fromSnap = thicknessFromParallelSegments(snapSegs, start, end);
    if (fromSnap && fromSnap.confidence >= 0.35) return fromSnap;
  }

  try {
    const cv = await loadOpenCv();
    const img = await loadImageDataUrl(underlay.imageDataUrl);
    const segs = houghSegmentsNearPath(cv, img, underlay, start, end);
    const fromCv = thicknessFromParallelSegments(segs, start, end);
    if (fromCv) return { ...fromCv, source: "opencv" };
  } catch {
    // OpenCV unavailable — keep draft thickness
  }
  return null;
}
