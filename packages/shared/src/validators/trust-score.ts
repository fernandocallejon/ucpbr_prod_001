// ============================================================
// RetailNexus — Seller Trust Score Calculator
// ============================================================

import type { SellerMetrics, CoreWebVitals } from "../types/ucp.js";

export interface TrustScoreBreakdown {
  score: number; // 0-100
  level: "excellent" | "good" | "fair" | "poor";
  factors: TrustScoreFactor[];
}

export interface TrustScoreFactor {
  name: string;
  weight: number;
  rawValue: number;
  normalizedScore: number; // 0-100
  weightedScore: number;
}

/**
 * Calculates the Seller Trust Score (0-100).
 *
 * Weights:
 *   Price Parity Score      = 25
 *   GTIN Coverage           = 20
 *   Uptime SLA              = 15
 *   Time Active             = 10
 *   Google Push Frequency   = 10
 *   Feedback Score          = 10
 *   Return Rate (inverse)   = 5
 *   Core Web Vitals         = 5
 */
export function calculateTrustScore(
  metrics: SellerMetrics,
  webVitals?: CoreWebVitals | null
): TrustScoreBreakdown {
  const factors: TrustScoreFactor[] = [];

  // 1. Price Parity (25%) — already 0-100
  const parityNorm = Math.min(metrics.priceParity, 100);
  factors.push({
    name: "priceParity",
    weight: 25,
    rawValue: metrics.priceParity,
    normalizedScore: parityNorm,
    weightedScore: (parityNorm / 100) * 25,
  });

  // 2. GTIN Coverage (20%) — already 0-100
  const gtinNorm = Math.min(metrics.gtinCoverage, 100);
  factors.push({
    name: "gtinCoverage",
    weight: 20,
    rawValue: metrics.gtinCoverage,
    normalizedScore: gtinNorm,
    weightedScore: (gtinNorm / 100) * 20,
  });

  // 3. Uptime SLA (15%) — already 0-100
  const uptimeNorm = Math.min(metrics.uptimeSLA, 100);
  factors.push({
    name: "uptimeSLA",
    weight: 15,
    rawValue: metrics.uptimeSLA,
    normalizedScore: uptimeNorm,
    weightedScore: (uptimeNorm / 100) * 15,
  });

  // 4. Time Active (10%) — caps at 365 days for 100%
  const timeNorm = Math.min((metrics.timeActive / 365) * 100, 100);
  factors.push({
    name: "timeActive",
    weight: 10,
    rawValue: metrics.timeActive,
    normalizedScore: timeNorm,
    weightedScore: (timeNorm / 100) * 10,
  });

  // 5. Google Push Frequency (10%) — already 0-100
  const pushNorm = Math.min(metrics.googlePushFrequency, 100);
  factors.push({
    name: "googlePushFrequency",
    weight: 10,
    rawValue: metrics.googlePushFrequency,
    normalizedScore: pushNorm,
    weightedScore: (pushNorm / 100) * 10,
  });

  // 6. Feedback Score (10%) — already 0-100
  const feedbackNorm = Math.min(metrics.feedbackScore, 100);
  factors.push({
    name: "feedbackScore",
    weight: 10,
    rawValue: metrics.feedbackScore,
    normalizedScore: feedbackNorm,
    weightedScore: (feedbackNorm / 100) * 10,
  });

  // 7. Return Rate — inverse (5%) — already 0-100, lower is better
  const returnNorm = Math.max(100 - metrics.returnRate, 0);
  factors.push({
    name: "returnRate",
    weight: 5,
    rawValue: metrics.returnRate,
    normalizedScore: returnNorm,
    weightedScore: (returnNorm / 100) * 5,
  });

  // 8. Core Web Vitals (5%)
  let cwvNorm = 50; // default if no data
  if (webVitals) {
    let cwvScore = 0;
    let cwvCount = 0;
    if (webVitals.lcp > 0) {
      cwvScore += webVitals.lcp <= 2.5 ? 100 : webVitals.lcp <= 4.0 ? 50 : 0;
      cwvCount++;
    }
    if (webVitals.fid > 0) {
      cwvScore += webVitals.fid <= 100 ? 100 : webVitals.fid <= 300 ? 50 : 0;
      cwvCount++;
    }
    if (webVitals.cls > 0) {
      cwvScore += webVitals.cls <= 0.1 ? 100 : webVitals.cls <= 0.25 ? 50 : 0;
      cwvCount++;
    }
    cwvNorm = cwvCount > 0 ? cwvScore / cwvCount : 50;
  }
  factors.push({
    name: "coreWebVitals",
    weight: 5,
    rawValue: cwvNorm,
    normalizedScore: cwvNorm,
    weightedScore: (cwvNorm / 100) * 5,
  });

  const score = Math.round(
    factors.reduce((sum, f) => sum + f.weightedScore, 0)
  );

  const level: TrustScoreBreakdown["level"] =
    score >= 85
      ? "excellent"
      : score >= 70
        ? "good"
        : score >= 50
          ? "fair"
          : "poor";

  return { score, level, factors };
}
