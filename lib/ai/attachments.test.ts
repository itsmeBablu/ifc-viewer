import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentsSchema, readAttachments, sourceFileType } from "./attachments";
import { renderAiPdfPage } from "./pdf";
import { compressImageFile } from "@/lib/imageCompress";
vi.mock("./pdf", () => ({ renderAiPdfPage: vi.fn() }));
vi.mock("@/lib/imageCompress", () => ({ compressImageFile: vi.fn(), compressDataUrl: vi.fn() }));
import { generateCommand } from "./gemini";
import { commandRequestSchema } from "./protocol";

const pdf = { name: "walls.pdf", mimeType: "application/pdf", data: "JVBERi0xLjc=" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("drawing attachments", () => {
  it("passes reference points and PDF page provenance to vision without enabling generic home templates", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "ask_clarification", args: { question: "Which unclear interior partition continues across the doorway?" } } }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const image = { name: "plan.pdf", mimeType: "image/jpeg", data: "AAAA", sourceMimeType: "application/pdf", pageNumber: 2, pageCount: 4 };
    const drawingReference = { totalAreaM2: 100, line: { attachmentIndex: 0, pageNumber: 2, start: { x: .2, y: .3 }, end: { x: .8, y: .3 }, lengthMm: 6000 } };
    const context = { projectId: "p", activeLevelId: null, selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [] };
    await generateCommand(commandRequestSchema.parse({ command: "Reproduce this plan", context, attachments: [image], drawingReference }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const data = JSON.parse(body.contents.at(-1).parts[0].text);
    expect(data.drawingReference).toEqual(drawingReference);
    expect(data.drawingPages[0]).toMatchObject({ pageNumber: 2, pageCount: 4 });
    const tools = JSON.stringify(body.tools);
    expect(tools).not.toContain('"const":"house_layout"');
    expect(tools).not.toContain('"const":"apartment_layout"');
    expect(body.systemInstruction.parts[0].text).toContain("Never use the whole image/page rectangle");
    expect(commandRequestSchema.safeParse({ command: "Reproduce", context, attachments: [image], drawingReference: { line: { ...drawingReference.line, pageNumber: 1 } } }).success).toBe(false);
  });
  it("recognizes files whose browser MIME type is missing", () => {
    expect(sourceFileType({ type: "", name: "floor.PDF" })).toBe("application/pdf");
    expect(sourceFileType({ type: "application/octet-stream", name: "floor.jpeg" })).toBe("image/jpeg");
    expect(sourceFileType({ type: "text/html", name: "floor.pdf" })).toBeUndefined();
  });
  it("prepares a selected page from a PDF larger than the old upload limit", async () => {
    const file = new File([new Uint8Array(3_000_000)], "floor.pdf", { type: "" });
    vi.mocked(renderAiPdfPage).mockResolvedValue({ image: { dataUrl: "data:image/jpeg;base64,AAAA", width: 100, height: 100, byteLength: 3 }, pageNumber: 2, pageCount: 4 });
    expect(await readAttachments([file], 2)).toEqual([{ name: "floor.pdf", mimeType: "image/jpeg", data: "AAAA", sourceMimeType: "application/pdf", pageNumber: 2, pageCount: 4 }]);
    expect(renderAiPdfPage).toHaveBeenCalledWith(file, 2);
  });
  it("resizes large image sources before enforcing the transmitted-byte limit", async () => {
    vi.mocked(compressImageFile).mockResolvedValue({ dataUrl: "data:image/jpeg;base64,AAAA", width: 100, height: 100, byteLength: 3 });
    expect((await readAttachments([new File([new Uint8Array(3_000_000)], "floor.png", { type: "image/png" })]))[0].mimeType).toBe("image/jpeg");
  });
  it("rejects unsupported, malformed and oversized attachments", () => {
    expect(attachmentsSchema.safeParse([pdf]).success).toBe(true);
    for (const files of [[{ ...pdf, mimeType: "text/html" }], [{ ...pdf, data: "not base64!" }], Array(4).fill(pdf), [{ ...pdf, data: "AAAA".repeat(833334) }]]) {
      expect(attachmentsSchema.safeParse(files).success).toBe(false);
    }
  });
  it("sends document bytes to Gemini alongside the command and preserves clarification", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "ask_clarification", args: { question: "What is the wall height?" } } }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const context = { projectId: "p", activeLevelId: null, selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 }, elements: [] };
    const input = commandRequestSchema.parse({ command: "Build these walls", context, attachments: [pdf] });
    expect(await generateCommand(input)).toEqual({ kind: "clarification", message: "What is the wall height?", model: "gemini-3.1-flash-lite", mode: "build" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents.at(-1).parts[1]).toEqual({ inlineData: { mimeType: pdf.mimeType, data: pdf.data } });
  });
});
