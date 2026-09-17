import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 2_500_000;
export const MAX_REQUEST_BYTES = 3_800_000;
export const MAX_SOURCE_FILE_BYTES = 20_000_000;
export const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  data: z.string().min(4).max(3_333_336).refine(value => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), "Invalid file encoding"),
  pageNumber: z.number().int().min(1).max(10000).optional(), pageCount: z.number().int().min(1).max(10000).optional(),
  sourceMimeType: z.literal("application/pdf").optional(),
}).strict();
export type AiAttachment = z.infer<typeof attachmentSchema>;
export const attachmentBytes = (file: AiAttachment) => file.data.length * 3 / 4 - (file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0);
export const attachmentsSchema = z.array(attachmentSchema).max(3).refine(files => files.reduce((sum, file) => sum + attachmentBytes(file), 0) <= MAX_ATTACHMENT_BYTES, "Attachments must total 2.5 MB or less");

export function sourceFileType(file: Pick<File, "type" | "name">) {
  if (["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) return file.type;
  if (!file.type || file.type === "application/octet-stream") return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" } as Record<string, string>)[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
  return undefined;
}

export async function readAttachments(files: File[], pageNumber = 1): Promise<AiAttachment[]> {
  if (files.length > 3 || files.some(file => file.size > MAX_SOURCE_FILE_BYTES)) throw new Error("Choose up to 3 files, at most 20 MB each. Only the selected PDF page is sent.");
  const prepared: AiAttachment[] = [];
  // Limit simultaneous canvas/PDF allocations on phones.
  for (const file of files) {
    const type = sourceFileType(file);
    if (!file.size || !type) throw new Error("Choose a non-empty PDF, PNG, JPEG or WebP file.");
    const { compressImageFile, compressDataUrl } = await import("@/lib/imageCompress");
    const pdf = type === "application/pdf" ? await (await import("./pdf")).renderAiPdfPage(file, pageNumber) : null;
    let image = pdf?.image ?? await compressImageFile(file, 2400, .85);
    for (const [edge, quality] of [[2048, .8], [1600, .75], [1200, .7]]) {
      if (image.byteLength <= MAX_ATTACHMENT_BYTES / 3) break;
      image = await compressDataUrl(image.dataUrl, edge, quality);
    }
    if (image.byteLength > MAX_ATTACHMENT_BYTES / 3) throw new Error("This drawing is too large after resizing. Crop the floor plan and try again.");
    prepared.push({ name: file.name.slice(0, 200), mimeType: "image/jpeg", data: image.dataUrl.split(",")[1], ...(pdf ? { sourceMimeType: "application/pdf", pageNumber: pdf.pageNumber, pageCount: pdf.pageCount } : {}) });
  }
  return attachmentsSchema.parse(prepared);
}
