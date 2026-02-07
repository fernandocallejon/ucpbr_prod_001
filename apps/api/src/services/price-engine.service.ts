// ============================================================
// RetailNexus — Price Engine Service
// Core pricing logic: undercutting, margin validation,
// Atomic Flow orchestration
// ============================================================

import { getConfig } from "../config/env.js";
import {
  productRepository,
  ucpSignalRepository,
  priceHistoryRepository,
  googleSyncLogRepository,
} from "../repositories/index.js";
import { getGoogleContentApiService } from "./google-content-api.service.js";
import { getGoogleIndexingApiService } from "./google-indexing.service.js";
import { getApi2CartService } from "./api2cart.service.js";
import { cacheSet, cacheDel } from "../lib/redis.js";
import { CACHE_KEYS, UCP_THRESHOLDS, now } from "@retailnexus/shared";
import type {
  Product,
  Store,
  Tenant,
  ProductPricingRule,
  CompetitorPrice,
  PriceHistory,
  UCPSignal,
} from "@retailnexus/shared";
import { generateId } from "@retailnexus/shared";

export interface PriceCalculationResult {
  productId: string;
  previousPrice: number;
  newPrice: number;
  priceChanged: boolean;
  reason: string;
  strategy: string;
  marginPercent: number;
  competitorWinning: number | null;
  isWinningPrice: boolean;
  atomicFlowCompleted: boolean;
  errors: string[];
}

export class PriceEngineService {
  /**
   * Calculate optimal price for a product based on competitive data.
   * This is the BRAIN of the platform.
   */
  async calculatePrice(
    product: Product,
    competitors: CompetitorPrice[],
    store: Store,
    tenant: Tenant
  ): Promise<PriceCalculationResult> {
    const result: PriceCalculationResult = {
      productId: product.id,
      previousPrice: product.price,
      newPrice: product.price,
      priceChanged: false,
      reason: "no_change",
      strategy: product.pricingRule?.strategy || "manual",
      marginPercent: 0,
      competitorWinning: null,
      isWinningPrice: false,
      atomicFlowCompleted: false,
      errors: [],
    };

    // Skip if no pricing rule or manual strategy
    if (!product.pricingRule || product.pricingRule.strategy === "manual") {
      result.reason = "manual_strategy";
      return result;
    }

    // Skip if no cost (can't calculate margin)
    if (!product.costPrice || product.costPrice <= 0) {
      result.reason = "no_cost_price";
      return result;
    }

    // Find winning competitor price
    const validCompetitors = competitors.filter(
      (c) => c.price > 0 && c.isActive
    );
    const winningCompetitor = validCompetitors.length > 0
      ? validCompetitors.reduce((min, c) => (c.price < min.price ? c : min))
      : null;

    result.competitorWinning = winningCompetitor?.price || null;

    // Calculate new price based on strategy
    const newPrice = this.applyStrategy(
      product,
      product.pricingRule,
      winningCompetitor?.price || null
    );

    // Validate margin
    const margin = ((newPrice - product.costPrice) / newPrice) * 100;
    result.marginPercent = Math.round(margin * 100) / 100;

    const minMargin = product.pricingRule.minMarginPercent || 0;
    if (margin < minMargin) {
      // Enforce minimum margin
      const safePrice = product.costPrice / (1 - minMargin / 100);
      result.newPrice = Math.round(safePrice * 100) / 100;
      result.reason = "margin_floor_enforced";
    } else {
      result.newPrice = Math.round(newPrice * 100) / 100;
    }

    // Check if price actually changed
    if (Math.abs(result.newPrice - product.price) < 0.01) {
      result.reason = "no_change";
      return result;
    }

    result.priceChanged = true;
    result.isWinningPrice =
      result.competitorWinning !== null &&
      result.newPrice <= result.competitorWinning;
    result.reason = this.describeReason(
      product.pricingRule.strategy,
      result.isWinningPrice
    );

    // ═══════════════════════════════════════════════
    // ATOMIC FLOW (5 steps — the core UCP pipeline)
    // ═══════════════════════════════════════════════
    try {
      await this.executeAtomicFlow(
        product,
        store,
        tenant,
        result.newPrice,
        result.previousPrice,
        result.reason
      );
      result.atomicFlowCompleted = true;
    } catch (err: any) {
      result.errors.push(`Atomic Flow failed: ${err.message}`);
    }

    return result;
  }

  /**
   * Atomic Flow — 5-step price propagation.
   *
   * Step 1: Update store (e-commerce platform)
   * Step 2: Push to Google Merchant Center
   * Step 3: Notify Google Indexing API
   * Step 4: Update Cosmos DB
   * Step 5: Update Redis cache (UCP Signal)
   */
  private async executeAtomicFlow(
    product: Product,
    store: Store,
    tenant: Tenant,
    newPrice: number,
    previousPrice: number,
    reason: string
  ): Promise<void> {
    const startTime = Date.now();

    // ──── Step 1: Update e-commerce store ────
    const api2cart = getApi2CartService();
    await api2cart.updateProductPrice(
      store.api2cartStoreKey,
      product.externalId,
      newPrice
    );

    // ──── Step 2: Push to Google Merchant Center ────
    const updatedProduct = { ...product, price: newPrice };
    const googleApi = getGoogleContentApiService();
    const pushResult = await googleApi.upsertProduct(
      updatedProduct,
      store,
      tenant
    );

    // Log Google sync
    await googleSyncLogRepository.create({
      id: generateId(),
      tenantId: tenant.id,
      storeId: store.id,
      productId: product.id,
      action: "upsert",
      status: "success",
      merchantProductId: pushResult.productId,
      payload: {
        price: newPrice,
        previousPrice,
        gtin: product.gtin,
      },
      responseTime: Date.now() - startTime,
      createdAt: now(),
    });

    // ──── Step 3: Notify Google Indexing API ────
    if (product.url) {
      const indexingApi = getGoogleIndexingApiService();
      await indexingApi.notifyUrlUpdated(product.url);
    }

    // ──── Step 4: Update Cosmos DB ────
    await productRepository.updatePrice(product.id, tenant.id, newPrice);

    // Record price history
    const historyEntry: PriceHistory = {
      id: generateId(),
      tenantId: tenant.id,
      productId: product.id,
      oldPrice: previousPrice,
      newPrice,
      reason: reason as any,
      competitorReference: null,
      marginPercent:
        product.costPrice && product.costPrice > 0
          ? ((newPrice - product.costPrice) / newPrice) * 100
          : null,
      createdAt: now(),
    };
    await priceHistoryRepository.create(historyEntry);

    // ──── Step 5: Update Redis cache (UCP Signal) ────
    if (product.gtin) {
      const signal = await this.buildUCPSignal(
        updatedProduct,
        store,
        tenant
      );
      const cacheKey = CACHE_KEYS.UCP_SIGNAL(product.gtin);
      await cacheSet(cacheKey, signal, 900); // 15-min TTL
    }
  }

  /**
   * Build UCP Signal payload for Redis.
   */
  private async buildUCPSignal(
    product: Product,
    store: Store,
    tenant: Tenant
  ): Promise<UCPSignal> {
    return {
      id: generateId(),
      ean: product.gtin!,
      tenantId: tenant.id,
      storeId: store.id,
      productId: product.id,
      payload: {
        price: product.price,
        currency: "BRL",
        availability: product.availability || "in_stock",
        stock: product.stock ?? null,
        url: product.url,
        lastUpdated: now(),
        gtin: product.gtin!,
        brand: product.brand || null,
        shippingCost: product.shipping?.cost ?? null,
        shippingDays: product.shipping?.transitDays ?? null,
        returnDays: product.returnPolicy?.days ?? null,
        sellerName: store.name,
        sellerDomain: new URL(store.url).hostname,
      },
      ucpReadinessScore: product.ucpReadinessScore || 0,
      trustScore: 0,
      isWinningOffer: false,
      lastSyncedAt: now(),
      ttl: Math.floor(Date.now() / 1000) + 900,
      createdAt: now(),
      updatedAt: now(),
    };
  }

  // ─── Strategy Engine ───

  private applyStrategy(
    product: Product,
    rule: ProductPricingRule,
    winningPrice: number | null
  ): number {
    switch (rule.strategy) {
      case "undercut":
        return this.strategyUndercut(product, rule, winningPrice);
      case "match":
        return this.strategyMatch(product, rule, winningPrice);
      case "fixed_margin":
        return this.strategyFixedMargin(product, rule);
      default:
        return product.price;
    }
  }

  /**
   * Undercut strategy: price below the lowest competitor.
   * Amount can be absolute (R$) or percentage-based.
   */
  private strategyUndercut(
    product: Product,
    rule: ProductPricingRule,
    winningPrice: number | null
  ): number {
    if (!winningPrice) return product.price;

    const undercutValue = rule.undercutAmount || 0.01;
    let newPrice: number;

    if (rule.undercutType === "percentage") {
      newPrice = winningPrice * (1 - undercutValue / 100);
    } else {
      newPrice = winningPrice - undercutValue;
    }

    // Enforce max/min price bounds
    if (rule.maxPrice && newPrice > rule.maxPrice) newPrice = rule.maxPrice;
    if (rule.minPrice && newPrice < rule.minPrice) newPrice = rule.minPrice;

    return Math.max(newPrice, 0.01);
  }

  /**
   * Match strategy: match the lowest competitor price exactly.
   */
  private strategyMatch(
    product: Product,
    rule: ProductPricingRule,
    winningPrice: number | null
  ): number {
    if (!winningPrice) return product.price;

    let newPrice = winningPrice;

    if (rule.maxPrice && newPrice > rule.maxPrice) newPrice = rule.maxPrice;
    if (rule.minPrice && newPrice < rule.minPrice) newPrice = rule.minPrice;

    return Math.max(newPrice, 0.01);
  }

  /**
   * Fixed margin strategy: apply a fixed margin over cost.
   */
  private strategyFixedMargin(
    product: Product,
    rule: ProductPricingRule
  ): number {
    if (!product.costPrice || product.costPrice <= 0) return product.price;

    const targetMargin = rule.targetMarginPercent || rule.minMarginPercent || 10;
    const newPrice = product.costPrice / (1 - targetMargin / 100);

    if (rule.maxPrice && newPrice > rule.maxPrice) return rule.maxPrice;
    if (rule.minPrice && newPrice < rule.minPrice) return rule.minPrice;

    return Math.max(newPrice, 0.01);
  }

  private describeReason(
    strategy: string,
    isWinning: boolean
  ): string {
    const base = `strategy_${strategy}`;
    return isWinning ? `${base}_winning` : `${base}_applied`;
  }

  // ─── Bulk Operations ───

  /**
   * Recalculate prices for all products of a tenant.
   */
  async recalculateAll(
    tenantId: string,
    store: Store,
    tenant: Tenant
  ): Promise<{
    total: number;
    changed: number;
    errors: number;
  }> {
    let total = 0;
    let changed = 0;
    let errors = 0;
    let continuationToken: string | undefined;

    do {
      const page = await productRepository.listByTenant(tenantId, {
        page: 1,
        pageSize: 50,
      });

      for (const product of page.items) {
        total++;
        try {
          // Get competitor prices for this product
          const competitors: CompetitorPrice[] = product.gtin
            ? await this.getCompetitorPrices(product.gtin, tenantId)
            : [];

          const result = await this.calculatePrice(
            product,
            competitors,
            store,
            tenant
          );

          if (result.priceChanged) changed++;
          if (result.errors.length > 0) errors++;
        } catch {
          errors++;
        }
      }

      continuationToken = undefined; // For now, single page
    } while (continuationToken);

    return { total, changed, errors };
  }

  private async getCompetitorPrices(
    gtin: string,
    tenantId: string
  ): Promise<CompetitorPrice[]> {
    const results = await (
      await import("../repositories/index.js")
    ).competitorPriceRepository.query(
      { query: `SELECT * FROM c WHERE c.ean = @ean AND c.isActive = true ORDER BY c.price ASC`, parameters: [{ name: "@ean", value: gtin }] }
    );
    return results as unknown as CompetitorPrice[];
  }
}

// Singleton
let _instance: PriceEngineService | null = null;
export function getPriceEngineService(): PriceEngineService {
  if (!_instance) _instance = new PriceEngineService();
  return _instance;
}
