/**
 * Rasterize PDF first page (or chosen page) via pdf.js → high-res JPEG + edge snap.
 */

import {
  compressCanvasImage,
  UNDERLAY_JPEG_QUALITY,
  UNDERLAY_MAX_EDGE,
  type CompressedImage,
} from "./imageCompress";
import type { UnderlaySnapSegment } from "./referenceUnderlay";
import { extractRasterSnapSegments } from "./underlaySnap";

export async function rasterizePdfPage(
  file: File | ArrayBuffer,
  pageIndex = 0,
): Promise<
  CompressedImage & { pageCount: number; snapSegments: UnderlaySnapSegment[] }
> {
  const data =
    file instanceof File
      ? new Uint8Array(await file.arrayBuffer())
      : new Uint8Array(file);

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const page = await doc.getPage(
    Math.min(Math.max(1, pageIndex + 1), pageCount),
  );
  const base = page.getViewport({ scale: 1 });
  const long = Math.max(base.width, base.height);
  const scale = Math.min(6, Math.max(2.5, UNDERLAY_MAX_EDGE / Math.max(1, long)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const snapSegments = extractRasterSnapSegments(canvas);
  const compressed = await compressCanvasImage(
    canvas,
    UNDERLAY_MAX_EDGE,
    UNDERLAY_JPEG_QUALITY,
  );
  return { ...compressed, pageCount, snapSegments };
}
