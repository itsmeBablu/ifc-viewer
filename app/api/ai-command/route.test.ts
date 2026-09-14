import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/gemini", () => ({ generateCommand: vi.fn() }));
vi.mock("@/lib/ai/rateLimit", () => ({ limitAiUser: vi.fn() }));
import { auth } from "@/auth";
import { generateCommand } from "@/lib/ai/gemini";
import { limitAiUser } from "@/lib/ai/rateLimit";
import { POST } from "./route";

const body = { command: "Build a house", context: { projectId: "p", activeLevelId: null, elements: [], selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 } } };
const request = (data = body, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/ai-command", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_URL", "http://localhost:3000"); vi.mocked(limitAiUser).mockResolvedValue({ success: true, remaining: 9, reset: Date.now() + 60_000 }); });
describe("AI command authorization", () => {
  it("rejects anonymous requests before calling Gemini", async () => {
    expect((await POST(request())).status).toBe(401);
    expect(generateCommand).not.toHaveBeenCalled();
    expect(limitAiUser).not.toHaveBeenCalled();
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
    expect(limitAiUser).toHaveBeenCalledWith("google-123");
  });
  it("blocks exhausted users and Redis outages before calling Gemini", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "google-123" } } as never);
    vi.mocked(limitAiUser).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    vi.mocked(limitAiUser).mockRejectedValue(new Error("Redis unavailable"));
    const outage = await POST(request());
    expect(outage.status).toBe(503);
    expect((await outage.json()).error).toMatch(/unreachable/);
    expect(generateCommand).not.toHaveBeenCalled();
  });
});
