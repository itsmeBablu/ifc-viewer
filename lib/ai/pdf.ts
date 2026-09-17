import { compressCanvasImage } from "@/lib/imageCompress";

export async function renderAiPdfPage(file: File, pageNumber = 1) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?v=${pdfjs.version}`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) throw new Error(`Choose a page from 1 to ${doc.numPages}.`);
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, 2400 / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not preview this PDF in your browser.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return { image: await compressCanvasImage(canvas, 2400, .85), pageNumber, pageCount: doc.numPages };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("This PDF is password protected. Save an unlocked copy to use its floor plan.");
    throw new Error(error instanceof Error && /Choose a page|preview/.test(error.message) ? error.message : "Could not read this PDF. Try exporting it again, or upload a plan image.");
  } finally { await task.destroy(); }
}
