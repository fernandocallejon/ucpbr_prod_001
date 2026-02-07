// ============================================================
// RetailNexus — UCP Signal Service
// Build, cache, and manage UCP signals in Redis
// Price parity checking, Seller Trust Score
// ============================================================

import { cacheGet, cacheSet, cacheDel } from "../lib/redis.js";
import {
  ucpSignalRepository,
  sellerProfileRepository,
  priceHistoryRepository,
  googleSyncLogRepository,
} from "../repositories/index.js";
import {
  generateId,
  now,
  calculateTrustScore,
  calculateUCPReadinessScore,
  CACHE_KEYS,
  UCP_THRESHOLDS,
} from "@retailnexus/shared";
import type {
  Product,
  Store,
  Tenant,
  UCPSignal,
  UCPSignalPayload,
  SellerProfile,
  SellerMetrics,
} from "@retailnexus/shared";

export interface ParityCheckResult {
  productId: string;
  gtin: string;
  storePrice: number;
  googlePrice: number | null;
  isParity: boolean;
  deltaPercent: number;
  action: "none" | "update_google" | "flag_mismatch";
}

export class UCPSignalService {
  /**
   * Build and cache a UCP signal for a product.
   */
  async buildAndCacheSignal(
    product: Product,
    store: Store,
    tenant: Tenant
  ): Promise<UCPSignal | null> {
    if (!product.gtin) return null;

    const sellerProfile = await this.getOrCreateSellerProfile(store, tenant);

    const payload: UCPSignalPayload = {
      price: product.price,
      currency: "BRL",
      availability: product.availability || "in_stock",
      stock: product.stock ?? null,
      url: product.url,
      lastUpdated: now(),
      gtin: product.gtin,
      brand: product.brand || null,
      shippingCost: product.shipping?.cost ?? null,
      shippingDays: product.shipping?.transitDays ?? null,
      returnDays: product.returnPolicy?.days ?? null,
      sellerName: store.name,
      sellerDomain: this.extractDomain(store.url),
    };

    const signal: UCPSignal = {
      id: generateId(),
      ean: product.gtin,
      tenantId: tenant.id,
      storeId: store.id,
      productId: product.id,
      payload,
      ucpReadinessScore: product.ucpReadinessScore || calculateUCPReadinessScore(product).score,
      trustScore: sellerProfile ? calculateTrustScore(sellerProfile.metrics).score : 0,
      isWinningOffer: false,
      lastSyncedAt: now(),
      ttl: Math.floor(Date.now() / 1000) + 900, // 15 min TTL
      createdAt: now(),
      updatedAt: now(),
    };

    // Determine if this is the winning offer for this EAN
    const bestOffer = await ucpSignalRepository.getBestOfferByEAN(product.gtin);
    if (!bestOffer || signal.payload.price <= bestOffer.payload.price) {
      signal.isWinningOffer = true;
    }

    // Save to Cosmos
    await ucpSignalRepository.create(signal);

    // Cache in Redis (hot path for UCP queries)
    const cacheKey = CACHE_KEYS.UCP_SIGNAL(product.gtin);
    await cacheSet(cacheKey, signal, 900);

    return signal;
  }

  /**
   * Get UCP signal from Redis (hot cache) or Cosmos (fallback).
   */
  async getSignal(ean: string): Promise<UCPSignal | null> {
    // Try Redis first
    const cached = await cacheGet<UCPSignal>(CACHE_KEYS.UCP_SIGNAL(ean));
    if (cached) return cached;

    // Fallback to Cosmos
    const signal = await ucpSignalRepository.getByEAN(ean);
    if (signal) {
      // Re-hydrate cache
      await cacheSet(CACHE_KEYS.UCP_SIGNAL(ean), signal, 900);
    }

    return signal;
  }

  /**
   * Get all offers for a given EAN (multi-seller comparison).
   */
  async getOffersForEAN(ean: string): Promise<UCPSignal[]> {
    const results = await ucpSignalRepository.query(
      { query: "SELECT * FROM c WHERE c.ean = @ean ORDER BY c.payload.price ASC", parameters: [{ name: "@ean", value: ean }] }
    );
    return results as unknown as UCPSignal[];
  }

  /**
   * Price Parity Check: verify store price matches Google Merchant.
   * Should run every ~15min.
   */
  async checkParity(
    product: Product,
    googlePrice: number | null
  ): Promise<ParityCheckResult> {
    const result: ParityCheckResult = {
      productId: product.id,
      gtin: product.gtin || "",
      storePrice: product.price,
      googlePrice,
      isParity: true,
      deltaPercent: 0,
      action: "none",
    };

    if (!googlePrice || googlePrice <= 0) {
      result.action = "update_google";
      result.isParity = false;
      return result;
    }

    const delta = Math.abs(product.price - googlePrice);
    const deltaPercent = (delta / product.price) * 100;
    result.deltaPercent = Math.round(deltaPercent * 100) / 100;

    if (deltaPercent > (1 - UCP_THRESHOLDS.PARITY_BAN_THRESHOLD) * 100) {
      result.isParity = false;
      result.action = "update_google";
    }

    return result;
  }

  /**
   * Invalidate cached signal for a product.
   */
  async invalidateSignal(ean: string): Promise<void> {
    await cacheDel(CACHE_KEYS.UCP_SIGNAL(ean));
  }

  /**
   * Bulk invalidate signals (e.g., after bulk price change).
   */
  async invalidateSignals(eans: string[]): Promise<void> {
    for (const ean of eans) {
      await cacheDel(CACHE_KEYS.UCP_SIGNAL(ean));
    }
  }

  // ─── Seller Trust Score ───

  /**
   * Get or create Seller Profile for a store.
   */
  async getOrCreateSellerProfile(
    store: Store,
    tenant: Tenant
  ): Promise<SellerProfile> {
    const existing = await this.findSellerProfile(store.id, tenant.id);
    if (existing) return existing;

    // Create initial profile
    const profile: SellerProfile = {
      id: generateId(),
      tenantId: tenant.id,
      storeId: store.id,
      domain: this.extractDomain(store.url),
      metrics: {
        priceParity: 100,
        gtinCoverage: 0,
        uptimeSLA: 99.9,
        timeActive: 0,
        googlePushFrequency: 0,
        feedbackScore: 100,
        returnRate: 0,
        coreWebVitals: {
          lcp: 2.5,
          fid: 100,
          cls: 0.1,
        },
      },
      trustScore: 0,
      lastCalculatedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    };

    profile.trustScore = calculateTrustScore(profile.metrics).score;
    await sellerProfileRepository.create(profile);
    return profile;
  }

  /**
   * Recalculate Seller Trust Score based on latest metrics.
   */
  async recalculateTrustScore(
    storeId: string,
    tenantId: string
  ): Promise<SellerProfile | null> {
    const profile = await this.findSellerProfile(storeId, tenantId);
    if (!profile) return null;

    // Gather fresh metrics
    const gtinCoverage = await this.calculateGTINCoverage(tenantId);
    const syncSuccessRate = await googleSyncLogRepository.getSuccessRate(
      tenantId,
      storeId
    );

    // Update metrics
    const updatedMetrics: SellerMetrics = {
      ...profile.metrics,
      gtinCoverage,
      googlePushFrequency: syncSuccessRate,
    };

    const newTrustScore = calculateTrustScore(updatedMetrics).score;

    const updated = await sellerProfileRepository.update(
      profile.id,
      tenantId,
      {
        metrics: updatedMetrics,
        trustScore: newTrustScore,
        lastCalculatedAt: now(),
        updatedAt: now(),
      }
    );

    return updated as SellerProfile;
  }

  // ─── UCP Dashboard Metrics ───

  /**
   * Get UCP metrics for a tenant's dashboard.
   */
  async getDashboardMetrics(
    tenantId: string
  ): Promise<{
    totalProducts: number;
    gtinCoverage: number;
    avgUCPReadiness: number;
    avgTrustScore: number;
    activeSignals: number;
    winningOffers: number;
  }> {
    const coverage = await this.calculateGTINCoverage(tenantId);

    // Get products with UCP readiness
    const products = await (
      await import("../repositories/index.js")
    ).productRepository.query(
      { query: "SELECT c.ucpReadinessScore FROM c WHERE c.tenantId = @tid AND c.status = 'active'", parameters: [{ name: "@tid", value: tenantId }] }
    );

    const totalProducts = products.length;
    const avgReadiness =
      totalProducts > 0
        ? products.reduce(
            (sum: number, p: any) => sum + (p.ucpReadinessScore || 0),
            0
          ) / totalProducts
        : 0;

    // Get signals
    const signals = await ucpSignalRepository.query(
      { query: "SELECT c.trustScore, c.isWinningOffer FROM c WHERE c.tenantId = @tid", parameters: [{ name: "@tid", value: tenantId }] }
    );

    const activeSignals = signals.length;
    const winningOffers = signals.filter(
      (s: any) => s.isWinningOffer
    ).length;
    const avgTrustScore =
      activeSignals > 0
        ? signals.reduce((sum: number, s: any) => sum + (s.trustScore || 0), 0) /
          activeSignals
        : 0;

    return {
      totalProducts,
      gtinCoverage: Math.round(coverage * 100) / 100,
      avgUCPReadiness: Math.round(avgReadiness * 100) / 100,
      avgTrustScore: Math.round(avgTrustScore * 100) / 100,
      activeSignals,
      winningOffers,
    };
  }

  // ─── Helpers ───

  private async findSellerProfile(
    storeId: string,
    tenantId: string
  ): Promise<SellerProfile | null> {
    const results = await sellerProfileRepository.query(
      { query: "SELECT * FROM c WHERE c.storeId = @sid AND c.tenantId = @tid", parameters: [
        { name: "@sid", value: storeId },
        { name: "@tid", value: tenantId },
      ] }
    );
    return (results[0] as SellerProfile) || null;
  }

  private async calculateGTINCoverage(tenantId: string): Promise<number> {
    const results = await (
      await import("../repositories/index.js")
    ).productRepository.query(
      { query: "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tid AND c.status = 'active'", parameters: [{ name: "@tid", value: tenantId }] }
    );
    const total = (results[0] as unknown as number) || 0;
    if (total === 0) return 0;

    const gtinCount = await (
      await import("../repositories/index.js")
    ).productRepository.query(
      { query: "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tid AND c.status = 'active' AND IS_DEFINED(c.gtin) AND c.gtin != null", parameters: [{ name: "@tid", value: tenantId }] }
    );

    return (((gtinCount[0] as unknown as number) || 0) / total) * 100;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}

// Singleton
let _instance: UCPSignalService | null = null;
export function getUCPSignalService(): UCPSignalService {
  if (!_instance) _instance = new UCPSignalService();
  return _instance;
}
