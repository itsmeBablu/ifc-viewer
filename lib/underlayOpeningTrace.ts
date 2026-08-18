/**
 * Door / window auto-trace on existing walls.
 * - Door: swing arc (quarter-circle) → hinge + chord width; gap fallback
 * - Window: simultaneous break in both wall faces + short cross double-line
 */

import { loadOpenCv } from "./opencvLoader";
import {
  nearestOffsetOnWallMm,
  wallLengthMm,
  type LayoutWall,
} from "./layoutDrawing";
import {
  effectiveMmPerPixel,
  underlayUvToWorld,
  worldToUnderlayUv,
  type ReferenceUnderlay,
} from "./referenceUnderlay";
import { underlaySnapSegmentsWorld } from "./underlaySnap";
import type { TraceCandidate } from "./underlayTrace";

type WorldSeg = { ax: number; ay: number; bx: number; by: number };
type PlanPt = { xMm: number; yMm: number };

const CURSOR_WALL_BAND_MM = 500;
const MIN_DOOR_W = 550;
const MAX_DOOR_W = 1300;
const MIN_WIN_W = 400;
const MAX_WIN_W = 2800;

function distPointToSeg(px: number, py: number, s: WorldSeg): number {
  const abx = s.bx - s.ax;
  const aby = s.by - s.ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return Math.hypot(px - s.ax, py - s.ay);
  let t = ((px - s.ax) * abx + (py - s.ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.ax + t * abx), py - (s.ay + t * aby));
}

function wallUnit(w: LayoutWall): { ux: number; uy: number; nx: number; ny: number; len: number } {
  const dx = w.endXmm - w.startXmm;
  const dy = w.endYmm - w.startYmm;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { ux, uy, nx: -uy, ny: ux, len };
}

function signedSideOfWall(w: LayoutWall, p: PlanPt): number {
  const { nx, ny } = wallUnit(w);
  return (p.xMm - w.startXmm) * nx + (p.yMm - w.startYmm) * ny;
}

function projectAlongWall(w: LayoutWall, p: PlanPt): number {
  return nearestOffsetOnWallMm(w, p.xMm, p.yMm);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = dataUrl;
  });
}

type ArcHit = {
  cx: number;
  cy: number;
  radiusMm: number;
  /** Sampled points on arc in world mm (for endpoint estimation). */
  points: PlanPt[];
  confidence: number;
  source: "opencv" | "raster";
};

/**
 * Detect door-swing arcs near a wall (600–1200mm radius).
 * Uses OpenCV HoughCircles when available; else local ring voting on edges.
 */
async function detectSwingArcsNearWall(
  underlay: ReferenceUnderlay,
  wall: LayoutWall,
  cursor: PlanPt,
): Promise<ArcHit[]> {
  const mpp = effectiveMmPerPixel(underlay);
  const padMm = Math.max(wall.thicknessMm * 2, MAX_DOOR_W) + 200;
  const mid = {
    xMm: (wall.startXmm + wall.endXmm) / 2,
    yMm: (wall.startYmm + wall.endYmm) / 2,
  };
  const focus = {
    xMm: (cursor.xMm + mid.xMm) / 2,
    yMm: (cursor.yMm + mid.yMm) / 2,
  };
  const uv = worldToUnderlayUv(underlay, focus.xMm, focus.yMm);
  const padPx = Math.ceil(padMm / mpp) + 24;
  const cxPx = uv.u * underlay.pixelWidth;
  const cyPx = uv.v * underlay.pixelHeight;
  const x0 = Math.max(0, Math.floor(cxPx - padPx));
  const y0 = Math.max(0, Math.floor(cyPx - padPx));
  const x1 = Math.min(underlay.pixelWidth, Math.ceil(cxPx + padPx));
  const y1 = Math.min(underlay.pixelHeight, Math.ceil(cyPx + padPx));
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 24 || ch < 24) return [];

  let img: HTMLImageElement;
  try {
    img = await loadImage(underlay.imageDataUrl);
  } catch {
    return [];
  }

  const minRpx = Math.max(8, Math.floor(MIN_DOOR_W / mpp));
  const maxRpx = Math.ceil(MAX_DOOR_W / mpp);

  // Prefer OpenCV HoughCircles
  try {
    const cv = await loadOpenCv();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = cv as any;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("ctx");
    ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
    const src =
      typeof C.imread === "function"
        ? C.imread(canvas)
        : C.matFromImageData(ctx.getImageData(0, 0, cw, ch));
    const gray = new C.Mat();
    const blurred = new C.Mat();
    const circles = new C.Mat();
    try {
      C.cvtColor(src, gray, C.COLOR_RGBA2GRAY);
      if (typeof C.GaussianBlur === "function") {
        try {
          C.GaussianBlur(gray, blurred, new C.Size(9, 9), 2, 2);
        } catch {
          gray.copyTo(blurred);
        }
      } else {
        gray.copyTo(blurred);
      }
      C.HoughCircles(
        blurred,
        circles,
        C.HOUGH_GRADIENT ?? 3,
        1.2,
        minRpx * 0.8,
        100,
        28,
        minRpx,
        maxRpx,
      );
      const hits: ArcHit[] = [];
      const n = circles.cols || circles.rows;
      for (let i = 0; i < n; i++) {
        // data32F layout: x,y,r per circle
        const data = circles.data32F as Float32Array;
        const ox = data[i * 3]!;
        const oy = data[i * 3 + 1]!;
        const r = data[i * 3 + 2]!;
        const world = underlayUvToWorld(
          underlay,
          (ox + x0) / underlay.pixelWidth,
          (oy + y0) / underlay.pixelHeight,
        );
        const radiusMm = r * mpp;
        if (radiusMm < MIN_DOOR_W || radiusMm > MAX_DOOR_W) continue;
        // Sample quarter-ish points; keep those near the wall
        const pts: PlanPt[] = [];
        for (let a = 0; a < 360; a += 8) {
          const rad = (a * Math.PI) / 180;
          const px = ox + Math.cos(rad) * r;
          const py = oy + Math.sin(rad) * r;
          const wp = underlayUvToWorld(
            underlay,
            (px + x0) / underlay.pixelWidth,
            (py + y0) / underlay.pixelHeight,
          );
          const wallSeg: WorldSeg = {
            ax: wall.startXmm,
            ay: wall.startYmm,
            bx: wall.endXmm,
            by: wall.endYmm,
          };
          if (distPointToSeg(wp.xMm, wp.yMm, wallSeg) < wall.thicknessMm * 2.5 + 80) {
            pts.push(wp);
          }
        }
        if (pts.length < 3) continue;
        const distCursor = Math.hypot(world.xMm - cursor.xMm, world.yMm - cursor.yMm);
        if (distCursor > MAX_DOOR_W + 400) continue;
        hits.push({
          cx: world.xMm,
          cy: world.yMm,
          radiusMm,
          points: pts,
          confidence: Math.min(0.95, 0.55 + pts.length / 40),
          source: "opencv",
        });
      }
      if (hits.length) return hits;
    } finally {
      src.delete();
      gray.delete();
      blurred.delete();
      circles.delete();
    }
  } catch {
    // fall through to raster ring vote
  }

  // Local ring vote on edge pixels (no OpenCV) — keep cheap
  const scale = Math.min(1, 280 / Math.max(cw, ch));
  const tw = Math.max(24, Math.round(cw * scale));
  const th = Math.max(24, Math.round(ch * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  const edgeSet = new Set<number>();
  for (let y = 1; y < th - 1; y += 1) {
    for (let x = 1; x < tw - 1; x += 1) {
      const i = (y * tw + x) * 4;
      const lum =
        0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const i2 = (y * tw + x + 1) * 4;
      const lum2 =
        0.299 * data[i2]! + 0.587 * data[i2 + 1]! + 0.114 * data[i2 + 2]!;
      if (Math.abs(lum - lum2) > 30) edgeSet.add(y * tw + x);
    }
  }
  if (edgeSet.size < 30) return [];

  const minRt = Math.max(6, Math.floor((MIN_DOOR_W / mpp) * scale));
  const maxRt = Math.ceil((MAX_DOOR_W / mpp) * scale);
  type Vote = { cx: number; cy: number; r: number; score: number };
  const votes: Vote[] = [];
  const wallSeg: WorldSeg = {
    ax: wall.startXmm,
    ay: wall.startYmm,
    bx: wall.endXmm,
    by: wall.endYmm,
  };
  for (let cy = 6; cy < th - 6; cy += 6) {
    for (let cx = 6; cx < tw - 6; cx += 6) {
      const world = underlayUvToWorld(
        underlay,
        (cx / scale + x0) / underlay.pixelWidth,
        (cy / scale + y0) / underlay.pixelHeight,
      );
      const dWall = distPointToSeg(world.xMm, world.yMm, wallSeg);
      if (dWall < MIN_DOOR_W * 0.35 || dWall > MAX_DOOR_W * 1.15) continue;
      let bestR = 0;
      let bestScore = 0;
      for (let r = minRt; r <= maxRt; r += 3) {
        let score = 0;
        for (let a = 0; a < 360; a += 15) {
          const rad = (a * Math.PI) / 180;
          const ex = Math.round(cx + Math.cos(rad) * r);
          const ey = Math.round(cy + Math.sin(rad) * r);
          if (ex < 1 || ey < 1 || ex >= tw - 1 || ey >= th - 1) continue;
          if (edgeSet.has(ey * tw + ex)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestR = r;
        }
      }
      if (bestScore >= 7) {
        votes.push({ cx, cy, r: bestR, score: bestScore });
      }
    }
  }
  votes.sort((a, b) => b.score - a.score);
  const hits: ArcHit[] = [];
  for (const v of votes.slice(0, 4)) {
    const world = underlayUvToWorld(
      underlay,
      (v.cx / scale + x0) / underlay.pixelWidth,
      (v.cy / scale + y0) / underlay.pixelHeight,
    );
    const radiusMm = (v.r / scale) * mpp;
    const pts: PlanPt[] = [];
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const px = v.cx + Math.cos(rad) * v.r;
      const py = v.cy + Math.sin(rad) * v.r;
      const wp = underlayUvToWorld(
        underlay,
        (px / scale + x0) / underlay.pixelWidth,
        (py / scale + y0) / underlay.pixelHeight,
      );
      if (distPointToSeg(wp.xMm, wp.yMm, wallSeg) < wall.thicknessMm * 2.5 + 100) {
        pts.push(wp);
      }
    }
    if (pts.length < 2) continue;
    hits.push({
      cx: world.xMm,
      cy: world.yMm,
      radiusMm,
      points: pts,
      confidence: Math.min(0.85, 0.35 + v.score / 40),
      source: "raster",
    });
  }
  return hits;
}

function arcToDoorCandidate(
  wall: LayoutWall,
  arc: ArcHit,
  cursor: PlanPt,
): TraceCandidate | null {
  const wallSeg: WorldSeg = {
    ax: wall.startXmm,
    ay: wall.startYmm,
    bx: wall.endXmm,
    by: wall.endYmm,
  };
  // Endpoints ≈ arc points closest to the wall face (hinge + open edge)
  const sorted = [...arc.points].sort(
    (a, b) =>
      distPointToSeg(a.xMm, a.yMm, wallSeg) -
      distPointToSeg(b.xMm, b.yMm, wallSeg),
  );
  // Among points near the wall, pick two extremes along wall axis as chord ends
  const nearWall = sorted.filter(
    (p) => distPointToSeg(p.xMm, p.yMm, wallSeg) < wall.thicknessMm + 150,
  );
  if (nearWall.length < 1) return null;

  let hinge = nearWall[0]!;
  let open = nearWall[nearWall.length - 1]!;
  // Prefer hinge = closer to cursor among near-wall points if chord tiny
  let widthMm = Math.hypot(open.xMm - hinge.xMm, open.yMm - hinge.yMm);
  if (widthMm < MIN_DOOR_W * 0.7) {
    // Fall back to radius
    widthMm = arc.radiusMm;
    // Open point = hinge along wall by radius toward cursor projection
    const off = projectAlongWall(wall, hinge);
    const { ux, uy } = wallUnit(wall);
    const toward =
      projectAlongWall(wall, cursor) >= off ? 1 : -1;
    open = {
      xMm: hinge.xMm + ux * toward * widthMm,
      yMm: hinge.yMm + uy * toward * widthMm,
    };
  }
  widthMm = Math.max(MIN_DOOR_W, Math.min(MAX_DOOR_W, Math.round(widthMm)));

  // Hinge = endpoint nearer to arc center projected? Spec: endpoint on wall = hinge
  // Keep hinge as the nearWall point closest to wall; if open is closer to wall swap
  if (
    distPointToSeg(open.xMm, open.yMm, wallSeg) <
    distPointToSeg(hinge.xMm, hinge.yMm, wallSeg)
  ) {
    const t = hinge;
    hinge = open;
    open = t;
  }

  const positionMm = projectAlongWall(wall, hinge);
  // hinge start vs end: closer to wall start → hinge "start"
  const hingeSide: "start" | "end" =
    positionMm < wallLengthMm(wall) / 2 ? "start" : "end";

  // Swing: which side of wall the arc center sits on
  const swing: 1 | -1 = signedSideOfWall(wall, { xMm: arc.cx, yMm: arc.cy }) >= 0 ? 1 : -1;

  const conf =
    arc.confidence *
    (1 / (1 + Math.hypot(cursor.xMm - hinge.xMm, cursor.yMm - hinge.yMm) / 400));

  return {
    id: `door-arc:${wall.id}:${Math.round(positionMm)}:${widthMm}`,
    kind: "door",
    startXmm: wall.startXmm,
    startYmm: wall.startYmm,
    endXmm: wall.endXmm,
    endYmm: wall.endYmm,
    thicknessMm: wall.thicknessMm,
    positionMm: Math.round(positionMm),
    widthMm,
    wallId: wall.id,
    hinge: hingeSide,
    swing,
    confidence: Math.min(1, conf),
    source: arc.source,
    method: "arc",
  };
}

/** Gap-based door: single break along wall centerline from snap segments. */
function gapDoorCandidates(
  wall: LayoutWall,
  segs: WorldSeg[],
  cursor: PlanPt,
): TraceCandidate[] {
  const { ux, uy, len } = wallUnit(wall);
  const halfT = wall.thicknessMm / 2 + 40;
  // Project segment coverage onto wall
  const covered: { a: number; b: number }[] = [];
  for (const s of segs) {
    if (distPointToSeg(s.ax, s.ay, {
      ax: wall.startXmm,
      ay: wall.startYmm,
      bx: wall.endXmm,
      by: wall.endYmm,
    }) > halfT + 80 &&
      distPointToSeg(s.bx, s.by, {
        ax: wall.startXmm,
        ay: wall.startYmm,
        bx: wall.endXmm,
        by: wall.endYmm,
      }) > halfT + 80
    ) {
      continue;
    }
    const a = projectAlongWall(wall, { xMm: s.ax, yMm: s.ay });
    const b = projectAlongWall(wall, { xMm: s.bx, yMm: s.by });
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(len, Math.max(a, b));
    if (hi - lo > 60) covered.push({ a: lo, b: hi });
  }
  if (!covered.length) return [];
  covered.sort((x, y) => x.a - y.a);
  const merged: { a: number; b: number }[] = [covered[0]!];
  for (let i = 1; i < covered.length; i++) {
    const c = covered[i]!;
    const last = merged[merged.length - 1]!;
    if (c.a <= last.b + 100) last.b = Math.max(last.b, c.b);
    else merged.push({ ...c });
  }
  const gaps: { a: number; b: number }[] = [];
  let cur = 0;
  for (const c of merged) {
    if (c.a - cur >= MIN_DOOR_W * 0.85) gaps.push({ a: cur, b: c.a });
    cur = Math.max(cur, c.b);
  }
  if (len - cur >= MIN_DOOR_W * 0.85) gaps.push({ a: cur, b: len });

  const out: TraceCandidate[] = [];
  for (const g of gaps) {
    const width = g.b - g.a;
    if (width < MIN_DOOR_W || width > MAX_DOOR_W) continue;
    const mid = (g.a + g.b) / 2;
    const mx = wall.startXmm + ux * mid;
    const my = wall.startYmm + uy * mid;
    const dist = Math.hypot(cursor.xMm - mx, cursor.yMm - my);
    if (dist > CURSOR_WALL_BAND_MM) continue;
    out.push({
      id: `door-gap:${wall.id}:${Math.round(mid)}:${Math.round(width)}`,
      kind: "door",
      startXmm: wall.startXmm,
      startYmm: wall.startYmm,
      endXmm: wall.endXmm,
      endYmm: wall.endYmm,
      thicknessMm: wall.thicknessMm,
      positionMm: Math.round(g.a),
      widthMm: Math.round(width),
      wallId: wall.id,
      hinge: "start",
      swing: 1,
      confidence: Math.min(0.72, 0.4 + (1 - dist / CURSOR_WALL_BAND_MM) * 0.35),
      source: "snap",
      method: "gap",
    });
  }
  return out;
}

/**
 * Window: both faces break + short cross-ish double segment in the gap.
 */
function windowCandidates(
  wall: LayoutWall,
  segs: WorldSeg[],
  cursor: PlanPt,
): TraceCandidate[] {
  const { ux, uy, nx, ny, len } = wallUnit(wall);
  const halfT = wall.thicknessMm / 2;
  const faceA: PlanPt[] = [];
  const faceB: PlanPt[] = [];
  // Collect points of segments roughly parallel to wall on each face
  const wallAng = Math.atan2(uy, ux);
  for (const s of segs) {
    const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
    let dAng = Math.abs(((ang - wallAng) * 180) / Math.PI) % 180;
    if (dAng > 90) dAng = 180 - dAng;
    const mid = { xMm: (s.ax + s.bx) / 2, yMm: (s.ay + s.by) / 2 };
    const side = (mid.xMm - wall.startXmm) * nx + (mid.yMm - wall.startYmm) * ny;
    const along = projectAlongWall(wall, mid);
    if (along < 0 || along > len) continue;
    if (dAng < 20) {
      // parallel to wall → face line
      if (Math.abs(Math.abs(side) - halfT) < halfT * 0.85 + 50) {
        if (side >= 0) faceA.push(mid);
        else faceB.push(mid);
      }
    }
  }

  // Coverage on each face along wall
  const cover = (pts: PlanPt[]) => {
    const intervals: { a: number; b: number }[] = [];
    for (const p of pts) {
      const t = projectAlongWall(wall, p);
      intervals.push({ a: t - 40, b: t + 40 });
    }
    // Also use parallel segs more carefully
    for (const s of segs) {
      const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
      let dAng = Math.abs(((ang - wallAng) * 180) / Math.PI) % 180;
      if (dAng > 90) dAng = 180 - dAng;
      if (dAng > 20) continue;
      const mid = { xMm: (s.ax + s.bx) / 2, yMm: (s.ay + s.by) / 2 };
      const side = (mid.xMm - wall.startXmm) * nx + (mid.yMm - wall.startYmm) * ny;
      const wantPositive = pts === faceA;
      if (wantPositive ? side < 0 : side >= 0) continue;
      if (Math.abs(Math.abs(side) - halfT) > halfT * 0.9 + 60) continue;
      const a = projectAlongWall(wall, { xMm: s.ax, yMm: s.ay });
      const b = projectAlongWall(wall, { xMm: s.bx, yMm: s.by });
      intervals.push({ a: Math.min(a, b), b: Math.max(a, b) });
    }
    if (!intervals.length) return [] as { a: number; b: number }[];
    intervals.sort((x, y) => x.a - y.a);
    const m: { a: number; b: number }[] = [{ ...intervals[0]! }];
    for (let i = 1; i < intervals.length; i++) {
      const c = intervals[i]!;
      const last = m[m.length - 1]!;
      if (c.a <= last.b + 80) last.b = Math.max(last.b, c.b);
      else m.push({ ...c });
    }
    return m;
  };

  const covA = cover(faceA);
  const covB = cover(faceB);
  const gapsA: { a: number; b: number }[] = [];
  const gapsB: { a: number; b: number }[] = [];
  const toGaps = (
    cov: { a: number; b: number }[],
    out: { a: number; b: number }[],
  ) => {
    let c = 0;
    for (const iv of cov) {
      if (iv.a - c >= MIN_WIN_W * 0.8) out.push({ a: c, b: iv.a });
      c = Math.max(c, iv.b);
    }
    if (len - c >= MIN_WIN_W * 0.8) out.push({ a: c, b: len });
  };
  toGaps(covA, gapsA);
  toGaps(covB, gapsB);

  // Overlapping gaps on both faces = simultaneous break
  const out: TraceCandidate[] = [];
  for (const ga of gapsA) {
    for (const gb of gapsB) {
      const a = Math.max(ga.a, gb.a);
      const b = Math.min(ga.b, gb.b);
      const width = b - a;
      if (width < MIN_WIN_W || width > MAX_WIN_W) continue;
      const mid = (a + b) / 2;
      const mx = wall.startXmm + ux * mid;
      const my = wall.startYmm + uy * mid;
      const dist = Math.hypot(cursor.xMm - mx, cursor.yMm - my);
      if (dist > CURSOR_WALL_BAND_MM) continue;

      // Prefer if a short cross-ish segment exists in the gap (double-line symbol)
      let crossBonus = 0.15;
      for (const s of segs) {
        const smid = { xMm: (s.ax + s.bx) / 2, yMm: (s.ay + s.by) / 2 };
        const along = projectAlongWall(wall, smid);
        if (along < a - 40 || along > b + 40) continue;
        const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
        let dAng = Math.abs(((ang - wallAng) * 180) / Math.PI) % 180;
        if (dAng > 90) dAng = 180 - dAng;
        // roughly perpendicular to wall
        if (dAng > 55 && dAng < 90) {
          const slen = Math.hypot(s.bx - s.ax, s.by - s.ay);
          if (slen > wall.thicknessMm * 0.4 && slen < wall.thicknessMm * 3) {
            crossBonus = 0.4;
            break;
          }
        }
      }

      out.push({
        id: `window:${wall.id}:${Math.round(mid)}:${Math.round(width)}`,
        kind: "window",
        startXmm: wall.startXmm,
        startYmm: wall.startYmm,
        endXmm: wall.endXmm,
        endYmm: wall.endYmm,
        thicknessMm: wall.thicknessMm,
        positionMm: Math.round(mid),
        widthMm: Math.round(width),
        wallId: wall.id,
        confidence: Math.min(0.9, 0.35 + crossBonus + (1 - dist / CURSOR_WALL_BAND_MM) * 0.3),
        source: "snap",
        method: "window-gap",
      });
    }
  }
  return out;
}

function wallsNearCursor(
  walls: LayoutWall[],
  levelId: string,
  cursor: PlanPt,
): LayoutWall[] {
  return walls
    .filter((w) => {
      if (w.levelId !== levelId) return false;
      const d = distPointToSeg(cursor.xMm, cursor.yMm, {
        ax: w.startXmm,
        ay: w.startYmm,
        bx: w.endXmm,
        by: w.endYmm,
      });
      return d <= CURSOR_WALL_BAND_MM;
    })
    .sort((a, b) => {
      const da = distPointToSeg(cursor.xMm, cursor.yMm, {
        ax: a.startXmm,
        ay: a.startYmm,
        bx: a.endXmm,
        by: a.endYmm,
      });
      const db = distPointToSeg(cursor.xMm, cursor.yMm, {
        ax: b.startXmm,
        ay: b.startYmm,
        bx: b.endXmm,
        by: b.endYmm,
      });
      return da - db;
    });
}

/**
 * Opening candidates on existing walls only (doors + windows).
 * Mixed list for Tab cycling; ranking favors clean arcs then windows then gaps.
 */
export async function detectOpeningCandidatesOnExistingWalls(
  cursor: PlanPt,
  underlay: ReferenceUnderlay,
  walls: LayoutWall[],
  levelId: string,
): Promise<TraceCandidate[]> {
  const near = wallsNearCursor(walls, levelId, cursor).slice(0, 4);
  if (!near.length) return [];

  const segs = underlaySnapSegmentsWorld(underlay);
  const out: TraceCandidate[] = [];

  for (const wall of near) {
    // Arc doors
    const arcs = await detectSwingArcsNearWall(underlay, wall, cursor);
    for (const arc of arcs) {
      const door = arcToDoorCandidate(wall, arc, cursor);
      if (door) out.push(door);
    }
    // Gap doors
    out.push(...gapDoorCandidates(wall, segs, cursor));
    // Windows
    out.push(...windowCandidates(wall, segs, cursor));
  }

  // Ranking: arc doors > window-with-cross > gap doors > other windows
  out.sort((a, b) => {
    const rank = (c: TraceCandidate) => {
      if (c.kind === "door" && c.method === "arc") return 3 + c.confidence;
      if (c.kind === "window" && (c.confidence ?? 0) > 0.55) return 2 + c.confidence;
      if (c.kind === "door" && c.method === "gap") return 1.5 + c.confidence;
      if (c.kind === "window") return 1 + c.confidence;
      return c.confidence;
    };
    return rank(b) - rank(a);
  });

  const seen = new Set<string>();
  return out.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 16);
}
