// ============================================================
// RetailNexus — Store Repository
// ============================================================

import type { Store } from "@retailnexus/shared";
import { containers } from "../lib/cosmos.js";
import { BaseRepository } from "./base.repository.js";

class StoreRepository extends BaseRepository<Store> {
  constructor() {
    super(containers.stores, "tenantId");
  }

  async listByTenant(tenantId: string): Promise<Store[]> {
    return this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = 'store' ORDER BY c.createdAt DESC",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
  }

  async getByApi2CartKey(storeKey: string): Promise<Store | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.api2cartStoreKey = @key AND c.type = 'store'",
      parameters: [{ name: "@key", value: storeKey }],
    });
    return results[0] || null;
  }

  async getByUrl(tenantId: string, url: string): Promise<Store | null> {
    const results = await this.query({
      query:
        "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.url = @url AND c.type = 'store'",
      parameters: [
        { name: "@tenantId", value: tenantId },
        { name: "@url", value: url },
      ],
    });
    return results[0] || null;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const results = await this.query({
      query:
        "SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @tenantId AND c.type = 'store'",
      parameters: [{ name: "@tenantId", value: tenantId }],
    });
    return (results[0] as unknown as number) || 0;
  }

  async updateSyncStatus(
    id: string,
    tenantId: string,
    status: Store["syncStatus"],
    productCount?: number
  ): Promise<Store | null> {
    const updates: Partial<Store> = { syncStatus: status };
    if (status === "active") {
      updates.lastSyncAt = new Date().toISOString();
      if (productCount !== undefined) {
        updates.productCount = productCount;
      }
    }
    return this.update(id, tenantId, updates);
  }
}

export const storeRepository = new StoreRepository();
