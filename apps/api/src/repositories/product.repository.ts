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
          "SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.updatedAt DESC",
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
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId",
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
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.storeId = @storeId AND c.externalId = @externalId",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@storeId", value: storeId },
        { name: "@externalId", value: externalId },
      ],
    });
    return results[0] || null;
  }

  async getByGTIN(tenantId: string, gtin: string): Promise<Product | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.gtin = @gtin",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@gtin", value: gtin },
      ],
    });
    return results[0] || null;
  }

  async listActiveWithGTIN(tenantId: string): Promise<Product[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.status = 'active' AND IS_DEFINED(c.gtin) AND c.gtin != ''",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }

  async listWithoutGTIN(tenantId: string): Promise<Product[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND (NOT IS_DEFINED(c.gtin) OR c.gtin = '')",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    const results = await this.query({
      query:
        "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId",
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
        "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId AND IS_DEFINED(c.gtin) AND c.gtin != ''",
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
      price: newPrice,
      updatedAt: new Date().toISOString(),
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

export const productRepository = new ProductRepository();
