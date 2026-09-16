import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateCommand } from "./gemini";
import type { CommandRequest } from "./protocol";

const input: CommandRequest = { command: "Add a wall", context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } }, history: [], attachments: [] };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_MODEL", ""); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("defaults to Flash-Lite with minimal thinking and no automatic retry", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "How long should the wall be?" }] } }] }));
  expect(await generateCommand(input)).toEqual({ kind: "advice", message: "How long should the wall be?", model: "gemini-3.1-flash-lite", mode: "build" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(fetchMock.mock.calls[0][0]).toContain("/gemini-3.1-flash-lite:generateContent");
  expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "MINIMAL" });
  expect(request.generationConfig.maxOutputTokens).toBe(8192);
  expect(request.contents.at(-1).parts).toHaveLength(1);
});

it("supports a server default but rejects models outside the supported list", async () => {
  vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Dimensions?" }] } }] }));
  await generateCommand(input);
  expect(fetchMock.mock.calls[0][0]).toContain("/gemini-3.5-flash-lite:generateContent");
  fetchMock.mockClear();
  vi.stubEnv("GEMINI_MODEL", "gemini-3.6-flash");
  await expect(generateCommand(input)).rejects.toThrow(/not supported/);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  ["gemini-3.5-flash-lite", "LOW", 8192],
  ["gemini-3.8-flash", "MEDIUM", 12000],
  ["gemini-3.1-pro-preview", "MEDIUM", 16000],
] as const)("honors explicit %s selection and supported reasoning settings", async (model, thinkingLevel, maxOutputTokens) => {
  vi.stubEnv("GEMINI_MODEL", "gemini-3.1-flash-lite");
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "answer_question", args: { answer: "Review the door clearance before placing furniture." } } }] } }] }));
  const result = await generateCommand({ ...input, model, mode: "review" });
  expect(result).toMatchObject({ model, mode: "review", kind: "advice" });
  expect(fetchMock.mock.calls[0][0]).toContain(`/${model}:generateContent`);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.generationConfig).toMatchObject({ maxOutputTokens, thinkingConfig: { thinkingLevel } });
  expect(request.tools[0].functionDeclarations.map((tool: { name: string }) => tool.name)).not.toContain("propose_model");
});

it.each(["review", "guide"] as const)("rejects unexpected geometry in %s mode", async mode => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "propose_model", args: { summary: "A level", assumptions: [], actions: [{ kind: "level", operation: "create", id: "l", name: "Ground", elevationMm: 0, heightMm: 3000 }] } } }] } }] }));
  await expect(generateCommand({ ...input, mode })).rejects.toThrow(/cannot create changes/);
});

it("reports unavailable selected models without falling back or spending another request", async () => {
  fetchMock.mockResolvedValue(new Response("provider details", { status: 404 }));
  await expect(generateCommand({ ...input, model: "gemini-3.1-pro-preview" })).rejects.toThrow(/Pro.*unavailable/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
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
