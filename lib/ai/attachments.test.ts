import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentsSchema } from "./attachments";
import { generateCommand } from "./gemini";
import { commandRequestSchema } from "./protocol";

const pdf = { name: "walls.pdf", mimeType: "application/pdf", data: "JVBERi0xLjc=" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("drawing attachments", () => {
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
