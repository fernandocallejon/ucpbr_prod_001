// ============================================================
// RetailNexus — Product Repository
// ============================================================

import type { Product, PaginationParams, PaginatedResult } from "@retailnexus/shared";
import { containers } from "../lib/cosmos.js";
import { BaseRepository } from "./base.repository.js";

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(containers.products, "tenantId");
  }

  async listByTenant(
    tenantId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<Product>> {
    return this.queryPaginated(
      {
        query:
          "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'product' ORDER BY c.updatedAt DESC",
        parameters: [{ name: "@tenantId", value: tenantId }],
      },
      params
    );
  }

  async listByStore(
    tenantId: string,
    storeId: string
  ): Promise<Product[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId AND c.type = 'product'",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@storeId", value: storeId },
      ],
    });
  }

  async getByExternalId(
    tenantId: string,
    storeId: string,
    externalId: string
  ): Promise<Product | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId AND c.externalId = @externalId AND c.type = 'product'",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@storeId", value: storeId },
        { name: "@externalId", value: externalId },
      ],
    });
    return results[0] || null;
  }

  async getByGTIN(tenantId: string, gtin13: string): Promise<Product | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.gtin13 = @gtin13 AND c.type = 'product'",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@gtin13", value: gtin13 },
      ],
    });
    return results[0] || null;
  }

  async listActiveWithGTIN(tenantId: string): Promise<Product[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'product' AND c.status = 'active' AND c.gtin13 != '' AND c.pricingRule.enabled = true",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }

  async listWithoutGTIN(tenantId: string): Promise<Product[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'product' AND (c.gtin13 = '' OR NOT IS_DEFINED(c.gtin13))",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    const results = await this.query({
      query:
        "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId AND c.type = 'product'",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
    return (results[0] as unknown as number) || 0;
  }

  async getGTINCoverage(tenantId: string): Promise<{
    total: number;
    withGTIN: number;
    coverage: number;
  }> {
    const total = await this.countByTenant(tenantId);
    const withGTINResults = await this.query({
      query:
        "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId AND c.type = 'product' AND c.gtin13 != '' AND IS_DEFINED(c.gtin13)",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
    const withGTIN = (withGTINResults[0] as unknown as number) || 0;
    return {
      total,
      withGTIN,
      coverage: total > 0 ? withGTIN / total : 0,
    };
  }

  async updatePrice(
    id: string,
    tenantId: string,
    newPrice: number
  ): Promise<Product | null> {
    return this.update(id, tenantId, {
      currentPrice: newPrice,
      priceLastUpdatedAt: new Date().toISOString(),
      priceValidUntil: getTomorrowISO(),
    } as Partial<Product>);
  }

  async updateCompetitiveData(
    id: string,
    tenantId: string,
    data: Product["competitiveData"]
  ): Promise<Product | null> {
    return this.update(id, tenantId, {
      competitiveData: data,
    } as Partial<Product>);
  }
}

function getTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export const productRepository = new ProductRepository();
