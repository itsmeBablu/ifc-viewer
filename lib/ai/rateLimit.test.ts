import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn() } }));
vi.mock("@upstash/ratelimit", () => ({ Ratelimit: class { static slidingWindow = vi.fn(); limit = mocks.limit; } }));
import { limitAiUser } from "./rateLimit";
beforeEach(() => { mocks.limit.mockReset(); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only"); });
it("fails closed even when Upstash reports success on timeout", async () => {
  mocks.limit.mockResolvedValue({ success: true, reason: "timeout", pending: Promise.resolve() });
  await expect(limitAiUser("google-123")).rejects.toThrow(/unavailable/);
});
it("requires Redis configuration and uses the Google identity as key", async () => {
  mocks.limit.mockResolvedValue({ success: true, remaining: 9, reset: 10, pending: Promise.resolve() });
  expect(await limitAiUser("google-123")).toEqual({ success: true, remaining: 9, reset: 10 });
  expect(mocks.limit).toHaveBeenCalledWith("google-123");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  await expect(limitAiUser("google-123")).rejects.toThrow(/configured/);
});
