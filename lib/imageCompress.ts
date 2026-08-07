/**
 * Resize an image (File / Blob / data URL) to max long-edge and JPEG quality.
 */

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.82;
/** Higher defaults for PDF/DWG underlays so plans stay readable when zoomed. */
export const UNDERLAY_MAX_EDGE = 4096;
export const UNDERLAY_JPEG_QUALITY = 0.92;

export type CompressedImage = {
  dataUrl: string;
  width: number;
  height: number;
  byteLength: number;
};

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = JPEG_QUALITY,
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("JPEG encode failed"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: String(reader.result),
            width: canvas.width,
            height: canvas.height,
            byteLength: blob.size,
          });
        };
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Draw source into a sized canvas (max long edge) and encode JPEG. */
export async function compressCanvasImage(
  source: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<CompressedImage> {
  const sw =
    "width" in source && typeof source.width === "number"
      ? source.width
      : (source as HTMLCanvasElement).width;
  const sh =
    "height" in source && typeof source.height === "number"
      ? source.height
      : (source as HTMLCanvasElement).height;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh, 1));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return canvasToJpeg(canvas, quality);
}

export async function compressImageFile(
  file: File | Blob,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<CompressedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(url);
    return compressCanvasImage(img, maxEdge, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressDataUrl(
  dataUrl: string,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<CompressedImage> {
  const img = await loadImageElement(dataUrl);
  return compressCanvasImage(img, maxEdge, quality);
}
