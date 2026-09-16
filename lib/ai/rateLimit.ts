import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const AI_USER_LIMIT = 60;
const LOCAL_WINDOW_MS = 10 * 60 * 1000;

let limiter: Ratelimit | undefined;
const localBuckets = new Map<string, number[]>();

function localDevelopmentLimit(googleUserId: string) {
  const now = Date.now();
  const bucket = (localBuckets.get(googleUserId) ?? []).filter(timestamp => now - timestamp < LOCAL_WINDOW_MS);
  const success = bucket.length < AI_USER_LIMIT;
  if (success) bucket.push(now);
  localBuckets.set(googleUserId, bucket);
  return { success, remaining: Math.max(0, AI_USER_LIMIT - bucket.length), reset: (bucket[0] ?? now) + LOCAL_WINDOW_MS, total: AI_USER_LIMIT };
}

export async function limitAiUser(googleUserId: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // This keeps local development usable when an Upstash database is unavailable.
    // Production always fails closed and requires the shared Redis limiter.
    if (process.env.NODE_ENV === "development") return localDevelopmentLimit(googleUserId);
    throw new Error("AI rate limiting is not configured.");
  }
  limiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(AI_USER_LIMIT, "10 m"),
    prefix: "v-studio:ai:google",
    analytics: false,
    timeout: 3000,
  });
  const result = await limiter.limit(googleUserId);
  // Upstash may return success=true on timeout. Never let an outage bypass this gate.
  if (result.reason === "timeout") throw new Error("AI rate limiting is temporarily unavailable.");
  await result.pending;
  return { success: result.success, remaining: result.remaining, reset: result.reset, total: AI_USER_LIMIT };
}

