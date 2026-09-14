import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ generateCommand: vi.fn() }));
import { auth } from "@/auth";
import { generateCommand } from "@/lib/ai/gemini";
import { POST } from "./route";

const body = { command: "Build a house", context: { projectId: "p", activeLevelId: null, elements: [] } };
const request = (data = body, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/ai-command", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000"); });
describe("AI command authorization", () => {
  it("rejects anonymous requests before calling Gemini", async () => {
    expect((await POST(request())).status).toBe(401);
    expect(generateCommand).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and malformed requests", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "google-123" } } as never);
    expect((await POST(request(body, "https://elsewhere.test"))).status).toBe(403);
    expect((await POST(request({ ...body, command: "" }))).status).toBe(400);
    expect(generateCommand).not.toHaveBeenCalled();
  });
  it("accepts clarification history for a signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "google-123" } } as never);
    vi.mocked(generateCommand).mockResolvedValue({ kind: "clarification", message: "How many floors?" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: "clarification", message: "How many floors?" });
  });
});
