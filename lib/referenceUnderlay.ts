/**
 * Per-level PDF/image/DWG reference underlay — calibrated plan texture.
 */

import {
  compressImageFile,
  UNDERLAY_JPEG_QUALITY,
  UNDERLAY_MAX_EDGE,
  type CompressedImage,
} from "./imageCompress";
import { rasterizeDwg } from "./dwgRasterize";
import { rasterizePdfPage } from "./pdfRasterize";
import { newLayoutId } from "./layoutDrawing";

/** Line segment in underlay image UV space (0–1). */
export type UnderlaySnapSegment = {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
};

export type ReferenceUnderlay = {
  id: string;
  projectId: string;
  levelId: string;
  /** Compressed JPEG data URL. */
  imageDataUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  /**
   * Real-world mm per image pixel (from calibration).
   * 0 = not yet calibrated → UI uses a default display width.
   */
  mmPerPixel: number;
  /** Plan center of the underlay (mm). Scene: X → X, Y → Z. */
  offsetXmm: number;
  offsetYmm: number;
  rotationDeg: number;
  /** 0–1 */
  opacity: number;
  locked: boolean;
  sourceName: string;
  /** Vector/edge snap lines in UV (DWG strokes or PDF edges). */
  snapSegments?: UnderlaySnapSegment[];
  createdAt: number;
};

export const DEFAULT_UNDERLAY_DISPLAY_WIDTH_MM = 20000;

export function effectiveMmPerPixel(u: ReferenceUnderlay): number {
  if (u.mmPerPixel > 0) return u.mmPerPixel;
  return DEFAULT_UNDERLAY_DISPLAY_WIDTH_MM / Math.max(1, u.pixelWidth);
}

export function underlayWidthMm(u: ReferenceUnderlay): number {
  return u.pixelWidth * effectiveMmPerPixel(u);
}

export function underlayHeightMm(u: ReferenceUnderlay): number {
  return u.pixelHeight * effectiveMmPerPixel(u);
}

/** World plan mm → UV on underlay (0–1). */
export function worldToUnderlayUv(
  u: ReferenceUnderlay,
  xMm: number,
  yMm: number,
): { u: number; v: number } {
  const w = underlayWidthMm(u);
  const h = underlayHeightMm(u);
  const rad = (u.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = xMm - u.offsetXmm;
  const dy = yMm - u.offsetYmm;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return {
    u: localX / w + 0.5,
    v: localY / h + 0.5,
  };
}

export function underlayUvToWorld(
  underlay: ReferenceUnderlay,
  u: number,
  v: number,
): { xMm: number; yMm: number } {
  const w = underlayWidthMm(underlay);
  const h = underlayHeightMm(underlay);
  const localX = (u - 0.5) * w;
  const localY = (v - 0.5) * h;
  const rad = (underlay.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    xMm: underlay.offsetXmm + localX * cos - localY * sin,
    yMm: underlay.offsetYmm + localX * sin + localY * cos,
  };
}

/**
 * After two calibration clicks in world mm and a known distance,
 * compute mmPerPixel and keep the midpoint of the segment fixed.
 */
export function calibrateUnderlayFromWorldPoints(
  underlay: ReferenceUnderlay,
  a: { xMm: number; yMm: number },
  b: { xMm: number; yMm: number },
  realDistanceMm: number,
): Pick<ReferenceUnderlay, "mmPerPixel" | "offsetXmm" | "offsetYmm"> {
  const distWorld = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
  if (distWorld < 1e-6 || realDistanceMm < 1) {
    return {
      mmPerPixel: underlay.mmPerPixel,
      offsetXmm: underlay.offsetXmm,
      offsetYmm: underlay.offsetYmm,
    };
  }
  const oldMmPerPx = effectiveMmPerPixel(underlay);
  const pixelDist = distWorld / oldMmPerPx;
  const mmPerPixel = realDistanceMm / Math.max(1e-6, pixelDist);
  // Scale about segment midpoint so that point stays put in world.
  const midX = (a.xMm + b.xMm) / 2;
  const midY = (a.yMm + b.yMm) / 2;
  const scale = mmPerPixel / oldMmPerPx;
  const offsetXmm = midX + (underlay.offsetXmm - midX) * scale;
  const offsetYmm = midY + (underlay.offsetYmm - midY) * scale;
  return { mmPerPixel, offsetXmm, offsetYmm };
}

export async function ingestReferenceDrawingFile(
  file: File,
): Promise<
  CompressedImage & { pageCount?: number; snapSegments?: UnderlaySnapSegment[] }
> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return rasterizePdfPage(file, 0);
  }
  if (name.endsWith(".dwg")) {
    return rasterizeDwg(file);
  }
  if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    file.type.startsWith("image/")
  ) {
    const img = await compressImageFile(
      file,
      UNDERLAY_MAX_EDGE,
      UNDERLAY_JPEG_QUALITY,
    );
    return img;
  }
  throw new Error("Unsupported file — use PDF, DWG, PNG, or JPG");
}

export function createUnderlayRecord(opts: {
  projectId: string;
  levelId: string;
  image: CompressedImage & { snapSegments?: UnderlaySnapSegment[] };
  sourceName: string;
}): ReferenceUnderlay {
  return {
    id: newLayoutId("ref"),
    projectId: opts.projectId,
    levelId: opts.levelId,
    imageDataUrl: opts.image.dataUrl,
    pixelWidth: opts.image.width,
    pixelHeight: opts.image.height,
    mmPerPixel: 0,
    offsetXmm: 0,
    offsetYmm: 0,
    rotationDeg: 0,
    opacity: 0.55,
    locked: false,
    sourceName: opts.sourceName,
    snapSegments: opts.image.snapSegments ?? [],
    createdAt: Date.now(),
  };
}
