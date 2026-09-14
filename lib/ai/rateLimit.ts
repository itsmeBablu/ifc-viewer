import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let limiter: Ratelimit | undefined;
export async function limitAiUser(googleUserId: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error("AI rate limiting is not configured.");
  limiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "v-studio:ai:google",
    analytics: false,
    timeout: 3000,
  });
  const result = await limiter.limit(googleUserId);
  // Upstash may return success=true on timeout. Never let an outage bypass this gate.
  if (result.reason === "timeout") throw new Error("AI rate limiting is temporarily unavailable.");
  await result.pending;
  return { success: result.success, remaining: result.remaining, reset: result.reset };
}
