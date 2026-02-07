// ============================================================
// RetailNexus — Cosmos DB Client (Singleton)
// ============================================================

import { CosmosClient, Database, Container } from "@azure/cosmos";
import { getConfig } from "../config/env.js";
import { COSMOS_CONTAINERS } from "@retailnexus/shared";

let _client: CosmosClient | null = null;
let _database: Database | null = null;

export function getCosmosClient(): CosmosClient {
  if (!_client) {
    const config = getConfig();
    _client = new CosmosClient({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key,
    });
  }
  return _client;
}

export function getDatabase(): Database {
  if (!_database) {
    const config = getConfig();
    _database = getCosmosClient().database(config.cosmos.database);
  }
  return _database;
}

export function getContainer(name: string): Container {
  return getDatabase().container(name);
}

// ─── Typed container accessors ───

export const containers = {
  tenants: () => getContainer(COSMOS_CONTAINERS.TENANTS),
  stores: () => getContainer(COSMOS_CONTAINERS.STORES),
  products: () => getContainer(COSMOS_CONTAINERS.PRODUCTS),
  priceHistory: () => getContainer(COSMOS_CONTAINERS.PRICE_HISTORY),
  competitorPrices: () => getContainer(COSMOS_CONTAINERS.COMPETITOR_PRICES),
  scanJobs: () => getContainer(COSMOS_CONTAINERS.SCAN_JOBS),
  pricingRules: () => getContainer(COSMOS_CONTAINERS.PRICING_RULES),
  auditLog: () => getContainer(COSMOS_CONTAINERS.AUDIT_LOG),
  systemConfig: () => getContainer(COSMOS_CONTAINERS.SYSTEM_CONFIG),
  sellerProfiles: () => getContainer(COSMOS_CONTAINERS.SELLER_PROFILES),
  ucpSignals: () => getContainer(COSMOS_CONTAINERS.UCP_SIGNALS),
  googleSyncLog: () => getContainer(COSMOS_CONTAINERS.GOOGLE_SYNC_LOG),
};

// ─── Database initialization ───

export async function initializeDatabase(): Promise<void> {
  const config = getConfig();
  const client = getCosmosClient();

  // Create database if not exists
  const { database } = await client.databases.createIfNotExists({
    id: config.cosmos.database,
  });

  // Create containers with partition keys
  const containerDefs: Array<{
    id: string;
    partitionKey: string;
    ttl?: number;
  }> = [
    { id: COSMOS_CONTAINERS.TENANTS, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.STORES, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.PRODUCTS, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.PRICE_HISTORY, partitionKey: "/productId" },
    { id: COSMOS_CONTAINERS.COMPETITOR_PRICES, partitionKey: "/ean" },
    { id: COSMOS_CONTAINERS.SCAN_JOBS, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.PRICING_RULES, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.AUDIT_LOG, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.SYSTEM_CONFIG, partitionKey: "/configType" },
    { id: COSMOS_CONTAINERS.SELLER_PROFILES, partitionKey: "/tenantId" },
    { id: COSMOS_CONTAINERS.UCP_SIGNALS, partitionKey: "/ean", ttl: -1 },
    { id: COSMOS_CONTAINERS.GOOGLE_SYNC_LOG, partitionKey: "/tenantId" },
  ];

  for (const def of containerDefs) {
    await database.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey] },
      defaultTtl: def.ttl,
    });
  }
}
