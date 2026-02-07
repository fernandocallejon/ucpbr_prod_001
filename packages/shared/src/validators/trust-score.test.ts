// ============================================================
// RetailNexus — Trust Score Calculator Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "../validators/trust-score.js";
import type { SellerMetrics } from "../types/ucp.js";

function makeMetrics(overrides: Partial<SellerMetrics> = {}): SellerMetrics {
  return {
    priceParity: 99.5,
    gtinCoverage: 95,
    uptimeSLA: 99.9,
    timeActive: 365,
    googlePushFrequency: 50,
    feedbackScore: 4.7,
    returnRate: 2.1,
    coreWebVitals: {
      lcp: 1.8,
      fid: 50,
      cls: 0.02,
    },
    ...overrides,
  };
}

describe("calculateTrustScore", () => {
  it("returns high score for excellent metrics", () => {
    const result = calculateTrustScore(makeMetrics());

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["excellent", "good"]).toContain(result.level);
  });

  it("penalizes low priceParity heavily", () => {
    const good = calculateTrustScore(makeMetrics({ priceParity: 99.5 }));
    const bad = calculateTrustScore(makeMetrics({ priceParity: 80 }));

    expect(good.score).toBeGreaterThan(bad.score);
  });

  it("penalizes low gtinCoverage", () => {
    const good = calculateTrustScore(makeMetrics({ gtinCoverage: 95 }));
    const bad = calculateTrustScore(makeMetrics({ gtinCoverage: 40 }));

    expect(good.score).toBeGreaterThan(bad.score);
  });

  it("penalizes poor core web vitals", () => {
    const good = calculateTrustScore(
      makeMetrics({ coreWebVitals: { lcp: 1.5, fid: 50, cls: 0.02 } })
    );
    const bad = calculateTrustScore(
      makeMetrics({ coreWebVitals: { lcp: 8, fid: 500, cls: 0.5 } })
    );

    expect(good.score).toBeGreaterThanOrEqual(bad.score);
  });

  it("returns 'poor' level for very bad metrics", () => {
    const result = calculateTrustScore(
      makeMetrics({
        priceParity: 50,
        gtinCoverage: 20,
        uptimeSLA: 80,
        timeActive: 5,
        googlePushFrequency: 0,
        feedbackScore: 2.0,
        returnRate: 30,
        coreWebVitals: { lcp: 10, fid: 1000, cls: 1.0 },
      })
    );

    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe("poor");
  });
});
