// ============================================================
// RetailNexus — Rate Limiter Middleware
// Uses Redis for distributed rate limiting
// ============================================================

import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { getRedis } from "../lib/redis.js";
import { errorResponse } from "./auth.js";

interface RateLimitConfig {
  /** Max requests in the window */
  max: number;
  /** Window size in seconds */
  windowSeconds: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  anonymous: { max: 30, windowSeconds: 60 },
  authenticated: { max: 120, windowSeconds: 60 },
  api: { max: 600, windowSeconds: 60 },
};

/**
 * Rate limit check using Redis sliding window.
 * Returns null if allowed, or an error HttpResponseInit if rate limited.
 */
export async function rateLimit(
  req: HttpRequest,
  tier: "anonymous" | "authenticated" | "api" = "authenticated"
): Promise<HttpResponseInit | null> {
  try {
    const redis = getRedis();
    const config = DEFAULT_LIMITS[tier];
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const key = `rl:${tier}:${ip}`;
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;

    // Sliding window using sorted set
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, config.windowSeconds);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) || 0;

    if (count > config.max) {
      return {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(config.windowSeconds),
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(
            Math.ceil((now + config.windowSeconds * 1000) / 1000)
          ),
        },
        body: JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
        }),
      };
    }

    return null; // Allowed
  } catch {
    // If Redis is down, allow the request (fail open)
    return null;
  }
}
