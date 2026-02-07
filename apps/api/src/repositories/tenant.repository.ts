// ============================================================
// RetailNexus — Tenant Repository
// ============================================================

import type { Tenant } from "@retailnexus/shared";
import { containers } from "../lib/cosmos.js";
import { BaseRepository } from "./base.repository.js";

class TenantRepository extends BaseRepository<Tenant> {
  constructor() {
    super(containers.tenants, "id");
  }

  async getByEmail(email: string): Promise<Tenant | null> {
    const results = await this.query({
      query: "SELECT * FROM c WHERE c.email = @email AND c.type = 'tenant'",
      parameters: [{ name: "@email", value: email }],
    });
    return results[0] || null;
  }

  async listAll(page = 1, pageSize = 50): Promise<Tenant[]> {
    const results = await this.query({
      query: `SELECT * FROM c WHERE c.type = 'tenant' ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit`,
      parameters: [
        { name: "@offset", value: (page - 1) * pageSize },
        { name: "@limit", value: pageSize },
      ],
    });
    return results;
  }

  async countByPlan(): Promise<Record<string, number>> {
    const results = await this.query({
      query:
        "SELECT c.plan, COUNT(1) as count FROM c WHERE c.type = 'tenant' GROUP BY c.plan",
      parameters: [],
    });
    const counts: Record<string, number> = {};
    for (const r of results as unknown as Array<{
      plan: string;
      count: number;
    }>) {
      counts[r.plan] = r.count;
    }
    return counts;
  }
}

export const tenantRepository = new TenantRepository();
