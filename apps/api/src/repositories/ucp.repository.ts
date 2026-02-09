// ============================================================
// RetailNexus — UCP Signal / Price History / Google Sync Repositories
// ============================================================

import type {
  UCPSignal,
  PriceHistory,
  GoogleSyncLog,
  CompetitorPrice,
  ScanJob,
  SellerProfile,
} from "@retailnexus/shared";
import { containers } from "../lib/cosmos.js";
import { BaseRepository } from "./base.repository.js";

// ─── UCP Signal Repository ───

class UCPSignalRepository extends BaseRepository<UCPSignal> {
  constructor() {
    super(containers.ucpSignals, "ean" as keyof UCPSignal);
  }

  async getByEAN(ean: string): Promise<UCPSignal | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.ean = @ean AND c.type = 'ucp-signal' ORDER BY c.updatedAt DESC",
      parameters: [{ name: "@ean", value: ean }],
    });
    return results[0] || null;
  }

  async getBestOfferByEAN(ean: string): Promise<UCPSignal | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.ean = @ean AND c.type = 'ucp-signal' AND c.parityVerified = true ORDER BY c.payload.price ASC",
      parameters: [{ name: "@ean", value: ean }],
    });
    return results[0] || null;
  }

  async listByTenant(tenantId: string): Promise<UCPSignal[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'ucp-signal'",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }
}

// ─── Price History Repository ───

class PriceHistoryRepository extends BaseRepository<PriceHistory> {
  constructor() {
    super(containers.priceHistory, "productId" as keyof PriceHistory);
  }

  async listByProduct(
    productId: string,
    limit = 50
  ): Promise<PriceHistory[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.productId = @productId AND c.type = 'price-history' ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit",
      parameters: [
        { name: "@productId", value: productId },
        { name: "@limit", value: limit },
      ],
    });
  }
}

// ─── Google Sync Log Repository ───

class GoogleSyncLogRepository extends BaseRepository<GoogleSyncLog> {
  constructor() {
    super(containers.googleSyncLog, "tenantId" as keyof GoogleSyncLog);
  }

  async listByTenant(
    tenantId: string,
    limit = 100
  ): Promise<GoogleSyncLog[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'google-sync-log' ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@limit", value: limit },
      ],
    });
  }

  async getSuccessRate(tenantId: string, storeId?: string): Promise<number> {
    const q = storeId
      ? "SELECT VALUE AVG(c.success ? 1 : 0) FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId AND c.type = 'google-sync-log'"
      : "SELECT VALUE AVG(c.success ? 1 : 0) FROM c WHERE c.tenantId = @tenantId AND c.type = 'google-sync-log'";
    const params: Array<{ name: string; value: string }> = [{ name: "@tenantId", value: tenantId }];
    if (storeId) params.push({ name: "@storeId", value: storeId });
    const results = await this.query({ query: q, parameters: params });
    return (results[0] as unknown as number) || 0;
  }
}

// ─── Competitor Price Repository ───

class CompetitorPriceRepository extends BaseRepository<CompetitorPrice> {
  constructor() {
    super(containers.competitorPrices, "ean" as keyof CompetitorPrice);
  }

  async listByEAN(ean: string): Promise<CompetitorPrice[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.ean = @ean AND c.type = 'competitor-price' ORDER BY c.price ASC",
      parameters: [{ name: "@ean", value: ean }],
    });
  }

  async getLatestByEAN(ean: string): Promise<CompetitorPrice[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.ean = @ean AND c.type = 'competitor-price' ORDER BY c.scannedAt DESC OFFSET 0 LIMIT 20",
      parameters: [{ name: "@ean", value: ean }],
    });
  }
}

// ─── Scan Job Repository ───

class ScanJobRepository extends BaseRepository<ScanJob> {
  constructor() {
    super(containers.scanJobs, "tenantId" as keyof ScanJob);
  }

  async listByTenant(tenantId: string, limit = 50): Promise<ScanJob[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'scan-job' ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@limit", value: limit },
      ],
    });
  }

  async listPending(tenantId: string): Promise<ScanJob[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'scan-job' AND c.status = 'queued'",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }
}

// ─── Seller Profile Repository ───

class SellerProfileRepository extends BaseRepository<SellerProfile> {
  constructor() {
    super(containers.sellerProfiles, "tenantId" as keyof SellerProfile);
  }

  async getByStore(
    tenantId: string,
    storeId: string
  ): Promise<SellerProfile | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId AND c.type = 'seller-profile'",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@storeId", value: storeId },
      ],
    });
    return results[0] || null;
  }
}

// ─── Pricing Rule Repository ───

class PricingRuleRepository extends BaseRepository<any> {
  constructor() {
    super(containers.pricingRules, "tenantId" as any);
  }

  async listByTenant(tenantId: string): Promise<any[]> {
    return this.query({
      query: "SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }
}

// ─── Exports (singletons) ───

export const ucpSignalRepository = new UCPSignalRepository();
export const priceHistoryRepository = new PriceHistoryRepository();
export const googleSyncLogRepository = new GoogleSyncLogRepository();
export const competitorPriceRepository = new CompetitorPriceRepository();
export const scanJobRepository = new ScanJobRepository();
export const sellerProfileRepository = new SellerProfileRepository();
export const pricingRuleRepository = new PricingRuleRepository();
