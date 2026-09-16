import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateCommand } from "./gemini";
import type { CommandRequest } from "./protocol";

const input: CommandRequest = { command: "Add a wall", context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } }, history: [], attachments: [] };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("returns a clarification using low thinking effort and no automatic retry", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "How long should the wall be?" }] } }] }));
  expect(await generateCommand(input)).toEqual({ kind: "clarification", message: "How long should the wall be?" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  expect(request.contents.at(-1).parts).toHaveLength(1);
});

it("explains missing configuration without making a provider request", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(generateCommand(input)).rejects.toThrow(/GEMINI_API_KEY/);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does not expose provider payloads or retry quota failures", async () => {
  fetchMock.mockResolvedValue(new Response("private provider payload", { status: 429 }));
  await expect(generateCommand(input)).rejects.toThrow("Gemini's quota is exhausted");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("rejects a truncated plan instead of offering partial geometry", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] }));
  await expect(generateCommand(input)).rejects.toThrow(/incomplete/);
});
