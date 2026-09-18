import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateCommand } from "./gemini";
import type { CommandRequest } from "./protocol";
import { residentialSketches } from "./modeling/preview";
import { suggestHomes } from "./modeling/home";

const input: CommandRequest = { command: "Add a wall", context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } }, history: [], attachments: [] };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_MODEL", ""); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("asks Gemini for a residential arrangement while preserving the user's shape and dimensions", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "propose_residential_design", args: { layoutSeed: 91234, layoutStyle: "courtyard", reasoning: "Place bedrooms away from shared living; courtyard wings remain open shared space." } } }] } }] }));
  const result = await generateCommand({ ...input, history: [{ role: "user", text: "Keep the kids rooms together." }, { role: "assistant", text: "I will group them near the common bathroom." }], intent: "layout", mode: "build", residential: { variant: "villa", bedrooms: 3, footprint: "u", bedroomAreaM2: 18 } });
  expect(result).toMatchObject({ kind: "layout", parameters: { footprint: "u", bedrooms: 3, bedroomAreaM2: 18, layoutSeed: 91234 } });
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.tools[0].functionDeclarations[0].name).toBe("propose_residential_design");
  expect(request.toolConfig.functionCallingConfig.mode).toBe("ANY");
  expect(request.contents.slice(0, 2)).toEqual([{ role: "user", parts: [{ text: "Keep the kids rooms together." }] }, { role: "model", parts: [{ text: "I will group them near the common bathroom." }] }]);
});

it("accepts a line-only Gemini layout inside the current outline and sends a compact planning prompt", async () => {
  const p = suggestHomes({ areaM2: 120 })[0].parameters;
  const sketches = residentialSketches({ ...p, layoutRevision: 1 });
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "propose_residential_design", args: { layoutSeed: 123, layoutStyle: "linear", sketches, reasoning: "Move bedrooms to the rear and keep access through the hall." } } }] } }] }));
  const result = await generateCommand({ ...input, command: "Bedrooms towards the garden", intent: "layout", mode: "build", residential: p });
  expect(result).toMatchObject({ kind: "layout", parameters: { bedrooms: p.bedrooms, sketches } });
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.contents).toHaveLength(1);
  expect(request.contents[0].parts[0].text).not.toContain("Catalogue");
  expect(request.systemInstruction.parts[0].text.toLowerCase()).toContain("regenerate");
});

it("defaults to Flash-Lite with minimal thinking and no automatic retry", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "How long should the wall be?" }] } }] }));
  expect(await generateCommand(input)).toEqual({ kind: "advice", message: "How long should the wall be?", model: "gemini-3.1-flash-lite", mode: "build" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(fetchMock.mock.calls[0][0]).toContain("/gemini-3.1-flash-lite:generateContent");
  expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "MINIMAL" });
  expect(request.generationConfig.maxOutputTokens).toBe(8192);
  expect(request.contents.at(-1).parts).toHaveLength(1);
  expect(request.toolConfig.functionCallingConfig).toMatchObject({ mode: "AUTO" });
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
  ["gemini-3.5-flash-lite", "MINIMAL", 8192],
  ["gemini-3.8-flash", "LOW", 12000],
  ["gemini-3.1-pro-preview", "LOW", 16000],
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

it("retries only transient server errors on the same selected model", async () => {
  vi.useFakeTimers();
  fetchMock.mockResolvedValueOnce(new Response("private upstream payload", { status: 503 }))
    .mockResolvedValueOnce(new Response("private upstream payload", { status: 502 }))
    .mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "ask_clarification", args: { question: "Which route?" } } }] } }] }));
  const pending = generateCommand({ ...input, model: "gemini-3.8-flash" });
  await vi.advanceTimersByTimeAsync(4000);
  expect(await pending).toMatchObject({ model: "gemini-3.8-flash", kind: "clarification" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls.every(call => call[0].includes("gemini-3.8-flash"))).toBe(true);
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[2][1].body);
});

it("stops after bounded retries and distinguishes connection errors from invalid responses", async () => {
  vi.useFakeTimers();
  fetchMock.mockRejectedValue(new TypeError("private network details"));
  const pending = expect(generateCommand(input)).rejects.toMatchObject({ code: "GEMINI_CONNECTION", status: 503 });
  await vi.advanceTimersByTimeAsync(4000);
  await pending;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("keeps provider quota separate from app allowance without retrying", async () => {
  fetchMock.mockResolvedValue(new Response("private payload", { status: 429, headers: { "Retry-After": "60" } }));
  await expect(generateCommand(input)).rejects.toMatchObject({ code: "GEMINI_QUOTA", status: 429, retryAfter: 60 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("reports malformed tool arguments without applying or repeatedly generating geometry", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "propose_model", args: { actions: [{ kind: "wall" }] } } }] } }] }));
  await expect(generateCommand(input)).rejects.toMatchObject({ code: "GEMINI_INVALID_RESPONSE" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("returns actual provider token usage and omits unrelated catalogue rows", async () => {
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "answer_question", args: { answer: "Use a wall path." } } }] } }], usageMetadata: { promptTokenCount: 3100, candidatesTokenCount: 80, thoughtsTokenCount: 12 } }));
  expect(await generateCommand(input)).toMatchObject({ usage: { inputTokens: 3100, outputTokens: 80, thinkingTokens: 12 } });
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.contents[0].parts[0].text).not.toContain("mep-boiler");
});
