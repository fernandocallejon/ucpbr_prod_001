// ============================================================
// RetailNexus — Shared Utilities
// ============================================================

import { randomUUID } from "node:crypto";

/**
 * Generate a new UUID v4.
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Get current timestamp as ISO string.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Get tomorrow's date as ISO date string (YYYY-MM-DD).
 * Used for priceValidUntil.
 */
export function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/**
 * Calculate TTL expiry as Unix timestamp (seconds).
 * Used for Cosmos DB TTL auto-delete.
 */
export function ttlExpiry(ttlSeconds: number): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        const jitter = delay * (0.5 + Math.random() * 0.5);
        await sleep(jitter);
      }
    }
  }
  throw lastError;
}

/**
 * Chunk an array into batches of a given size.
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safely parse JSON, returning null on failure.
 */
export function safeJsonParse<T = unknown>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/**
 * Validate that a URL is well-formed.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Map product availability based on quantity.
 */
export function resolveAvailability(
  quantity: number
): "InStock" | "OutOfStock" {
  return quantity > 0 ? "InStock" : "OutOfStock";
}
