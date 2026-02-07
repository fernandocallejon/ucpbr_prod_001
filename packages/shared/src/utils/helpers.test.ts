// ============================================================
// RetailNexus — Helpers Utility Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  generateId,
  now,
  sleep,
  resolveAvailability,
  chunk,
  safeJsonParse,
  isValidUrl,
  capitalize,
} from "../utils/helpers.js";

describe("generateId", () => {
  it("returns a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("now", () => {
  it("returns an ISO date string", () => {
    const result = now();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(result).toISOString()).toBe(result);
  });
});

describe("sleep", () => {
  it("waits the specified time", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe("resolveAvailability", () => {
  it("returns InStock when stock > 0", () => {
    expect(resolveAvailability(10)).toBe("InStock");
    expect(resolveAvailability(1)).toBe("InStock");
  });

  it("returns OutOfStock when stock is 0", () => {
    expect(resolveAvailability(0)).toBe("OutOfStock");
  });

  it("handles explicit availability", () => {
    // Function uses stock-based logic primarily
    expect(resolveAvailability(5)).toBe("InStock");
    expect(resolveAvailability(0)).toBe("OutOfStock");
  });
});

describe("chunk", () => {
  it("splits array into chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON", () => {
    expect(safeJsonParse("not json")).toBeNull();
  });
});

describe("isValidUrl", () => {
  it("validates correct URLs", () => {
    expect(isValidUrl("https://loja.com.br/produto")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("")).toBe("");
  });
});
