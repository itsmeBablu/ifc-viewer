import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 2_500_000;
export const MAX_REQUEST_BYTES = 3_800_000;
export const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  data: z.string().min(4).max(3_333_336).refine(value => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), "Invalid file encoding"),
}).strict();
export type AiAttachment = z.infer<typeof attachmentSchema>;
export const attachmentBytes = (file: AiAttachment) => file.data.length * 3 / 4 - (file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0);
export const attachmentsSchema = z.array(attachmentSchema).max(3).refine(files => files.reduce((sum, file) => sum + attachmentBytes(file), 0) <= MAX_ATTACHMENT_BYTES, "Attachments must total 2.5 MB or less");

export async function readAttachments(files: File[]): Promise<AiAttachment[]> {
  if (files.length > 3 || files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_BYTES) throw new Error("Choose up to 3 files, 2.5 MB total.");
  return attachmentsSchema.parse(await Promise.all(files.map(file => new Promise<AiAttachment>((resolve, reject) => {
    if (!file.size || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) { reject(new Error("Choose a non-empty PDF, PNG, JPEG or WebP file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({ name: file.name.slice(0, 200), mimeType: file.type as AiAttachment["mimeType"], data: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  }))));
}
