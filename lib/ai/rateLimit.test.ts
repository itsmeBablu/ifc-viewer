import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn() } }));
vi.mock("@upstash/ratelimit", () => ({ Ratelimit: class { static slidingWindow = vi.fn(); limit = mocks.limit; } }));
import { AI_USER_LIMIT, limitAiUser } from "./rateLimit";
beforeEach(() => { mocks.limit.mockReset(); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.test"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only"); });
it("uses counted fallback when Upstash reports a timeout", async () => {
  mocks.limit.mockResolvedValue({ success: true, reason: "timeout", pending: Promise.resolve() });
  expect(await limitAiUser("timeout-user")).toMatchObject({ success: true, remaining: AI_USER_LIMIT - 1 });
});
it("uses Google identity and a counted fallback without Redis configuration", async () => {
  mocks.limit.mockResolvedValue({ success: true, remaining: 59, reset: 10, pending: Promise.resolve() });
  expect(await limitAiUser("google-123")).toEqual({ success: true, remaining: 59, reset: 10, total: AI_USER_LIMIT });
  expect(mocks.limit).toHaveBeenCalledWith("google-123");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  expect(await limitAiUser("unconfigured-user")).toMatchObject({ success: true, remaining: AI_USER_LIMIT - 1 });
});
it("uses a local per-user fallback when Redis is absent", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  const user = `local-${Date.now()}`;
  for (let i = 0; i < AI_USER_LIMIT; i++) expect((await limitAiUser(user)).success).toBe(true);
  expect((await limitAiUser(user)).success).toBe(false);
});
