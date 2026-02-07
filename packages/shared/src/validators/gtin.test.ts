// ============================================================
// RetailNexus — GTIN Validator Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  isValidGTIN13,
  normalizeToGTIN13,
  calculateGTIN13CheckDigit,
} from "../validators/gtin.js";

describe("isValidGTIN13", () => {
  it("validates correct GTIN-13", () => {
    // Real EANs
    expect(isValidGTIN13("5901234123457")).toBe(true);
    expect(isValidGTIN13("4006381333931")).toBe(true);
    expect(isValidGTIN13("0012345678905")).toBe(true);
  });

  it("rejects invalid check digits", () => {
    expect(isValidGTIN13("5901234123456")).toBe(false); // wrong check digit
    expect(isValidGTIN13("4006381333932")).toBe(false);
  });

  it("rejects non-13-digit strings", () => {
    expect(isValidGTIN13("12345")).toBe(false);
    expect(isValidGTIN13("12345678901234")).toBe(false);
    expect(isValidGTIN13("")).toBe(false);
    expect(isValidGTIN13("abcdefghijklm")).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isValidGTIN13(null as any)).toBe(false);
    expect(isValidGTIN13(undefined as any)).toBe(false);
  });

  it("trims whitespace", () => {
    expect(isValidGTIN13("  5901234123457  ")).toBe(true);
  });
});

describe("normalizeToGTIN13", () => {
  it("pads GTIN-8 (EAN-8) to GTIN-13", () => {
    // EAN-8: 96385074 → normalized 0000096385074
    const result = normalizeToGTIN13("96385074");
    expect(result).toHaveLength(13);
  });

  it("pads GTIN-12 (UPC-A) to GTIN-13", () => {
    const result = normalizeToGTIN13("012345678905");
    expect(result).toBe("0012345678905");
  });

  it("passes through valid GTIN-13", () => {
    expect(normalizeToGTIN13("5901234123457")).toBe("5901234123457");
  });

  it("returns null for invalid", () => {
    expect(normalizeToGTIN13("abc")).toBeNull();
    expect(normalizeToGTIN13("")).toBeNull();
    expect(normalizeToGTIN13(null as any)).toBeNull();
  });
});

describe("calculateGTIN13CheckDigit", () => {
  it("calculates correct check digit", () => {
    expect(calculateGTIN13CheckDigit("590123412345")).toBe(7); // 5901234123457
    expect(calculateGTIN13CheckDigit("001234567890")).toBe(5); // 0012345678905
  });

  it("returns null for invalid prefix", () => {
    expect(calculateGTIN13CheckDigit("12345")).toBeNull();
    expect(calculateGTIN13CheckDigit("abcdefghijkl")).toBeNull();
  });
});
