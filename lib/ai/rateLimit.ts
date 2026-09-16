import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Use full potential of Google Gemini AI (1500 requests daily window)
export const AI_USER_LIMIT = 1500;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours daily sliding window

let limiter: Ratelimit | undefined;
const localBuckets = new Map<string, number[]>();

function localDevelopmentLimit(googleUserId: string) {
  const now = Date.now();
  const bucket = (localBuckets.get(googleUserId) ?? []).filter(timestamp => now - timestamp < WINDOW_MS);
  const success = bucket.length < AI_USER_LIMIT;
  if (success) bucket.push(now);
  localBuckets.set(googleUserId, bucket);
  const reset = (bucket[0] ?? now) + WINDOW_MS;
  return { success, remaining: Math.max(0, AI_USER_LIMIT - bucket.length), reset, total: AI_USER_LIMIT };
}

export async function limitAiUser(googleUserId: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Allows full potential of Google Gemini without artificial Redis blocking
    return localDevelopmentLimit(googleUserId);
  }
  try {
    limiter ??= new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(AI_USER_LIMIT, "24 h"),
      prefix: "v-studio:ai:google",
      analytics: false,
      timeout: 4000,
    });
    const result = await limiter.limit(googleUserId);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      total: AI_USER_LIMIT,
    };
  } catch {
    // Graceful fallback to memory tracking so Gemini AI calls never fail due to Redis
    return localDevelopmentLimit(googleUserId);
  }
}

export async function getAiUserQuota(googleUserId: string) {
  const now = Date.now();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    const bucket = (localBuckets.get(googleUserId) ?? []).filter(timestamp => now - timestamp < WINDOW_MS);
    const reset = (bucket[0] ?? now) + WINDOW_MS;
    return { remaining: Math.max(0, AI_USER_LIMIT - bucket.length), reset, total: AI_USER_LIMIT };
  }
  try {
    limiter ??= new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(AI_USER_LIMIT, "24 h"),
      prefix: "v-studio:ai:google",
      analytics: false,
      timeout: 4000,
    });
    const result = await limiter.getRemaining(googleUserId);
    return {
      remaining: result.remaining,
      reset: result.reset,
      total: AI_USER_LIMIT,
    };
  } catch {
    const bucket = (localBuckets.get(googleUserId) ?? []).filter(timestamp => now - timestamp < WINDOW_MS);
    const reset = (bucket[0] ?? now) + WINDOW_MS;
    return { remaining: Math.max(0, AI_USER_LIMIT - bucket.length), reset, total: AI_USER_LIMIT };
  }
}


