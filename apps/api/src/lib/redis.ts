// ============================================================
// RetailNexus — Redis Client (Singleton)
// ============================================================

import Redis from "ioredis";
import { getConfig } from "../config/env.js";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const config = getConfig();
    _redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      lazyConnect: true,
    });
  }
  return _redis;
}

/**
 * Get a cached value from Redis.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const redis = getRedis();
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Set a cached value in Redis with TTL.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  const data = JSON.stringify(value);
  if (ttlSeconds > 0) {
    await redis.setex(key, ttlSeconds, data);
  } else {
    await redis.set(key, data);
  }
}

/**
 * Delete a cached value.
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

/**
 * Check if Redis is connected.
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
