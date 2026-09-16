import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateOllamaCommand } from "./ollama";
import type { CommandRequest } from "./protocol";

const input: CommandRequest = { command: "Place services", discipline: "mep", context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } }, history: [], attachments: [] };
const mock = vi.fn();
beforeEach(() => { vi.stubEnv("OLLAMA_MODEL", "installed-model"); vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"); vi.stubGlobal("fetch", mock); mock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses the configured local model and validates structured output", async () => {
  mock.mockResolvedValue(Response.json({ done: true, message: { content: JSON.stringify({ kind: "plan", plan: { summary: "Level", assumptions: [], actions: [{ kind: "level", operation: "create", id: "l", name: "Ground", elevationMm: 0, heightMm: 3000 }] } }) } }));
  expect(await generateOllamaCommand(input)).toMatchObject({ kind: "plan", model: "ollama-local" });
  expect(String(mock.mock.calls[0][0])).toBe("http://127.0.0.1:11434/api/chat");
  expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({ model: "installed-model", stream: false });
});
it("rejects geometry in review mode", async () => {
  mock.mockResolvedValue(Response.json({ done: true, message: { content: JSON.stringify({ kind: "plan", plan: { summary: "Level", assumptions: [], actions: [{ kind: "level", operation: "create", id: "l", name: "Ground", elevationMm: 0, heightMm: 3000 }] } }) } }));
  await expect(generateOllamaCommand({ ...input, mode: "review" })).rejects.toThrow(/cannot create/);
});
it("does not fall back to Gemini on local failure", async () => {
  mock.mockRejectedValue(new TypeError("fetch failed"));
  await expect(generateOllamaCommand(input)).rejects.toThrow(/Cannot reach Ollama/);
  expect(mock).toHaveBeenCalledTimes(1);
});
it("rejects attachments and missing model configuration before calling", async () => {
  vi.stubEnv("OLLAMA_MODEL", "");
  await expect(generateOllamaCommand(input)).rejects.toThrow(/OLLAMA_MODEL/);
  expect(mock).not.toHaveBeenCalled();
});
