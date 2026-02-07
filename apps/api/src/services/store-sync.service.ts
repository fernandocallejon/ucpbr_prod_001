// ============================================================
// RetailNexus — Store Sync Service
// Product normalization from API2Cart → Cosmos DB
// GTIN extraction/validation, UCP readiness scoring
// ============================================================

import { getApi2CartService } from "./api2cart.service.js";
import {
  productRepository,
  storeRepository,
} from "../repositories/index.js";
import {
  generateId,
  now,
  isValidGTIN13,
  normalizeToGTIN13,
  calculateUCPReadinessScore,
} from "@retailnexus/shared";
import type {
  Product,
  Store,
  Tenant,
  ProductStatus,
} from "@retailnexus/shared";

export interface SyncResult {
  storeId: string;
  tenantId: string;
  total: number;
  created: number;
  updated: number;
  errors: number;
  gtinCoverage: number;
  avgUcpReadiness: number;
  duration: number;
}

export class StoreSyncService {
  /**
   * Full sync: fetch all products from API2Cart and upsert to Cosmos.
   */
  async syncStore(store: Store, tenant: Tenant): Promise<SyncResult> {
    const startTime = Date.now();
    const api2cart = getApi2CartService();

    const result: SyncResult = {
      storeId: store.id,
      tenantId: tenant.id,
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      gtinCoverage: 0,
      avgUcpReadiness: 0,
      duration: 0,
    };

    let page = 0;
    let hasMore = true;
    const allUcpScores: number[] = [];
    let gtinCount = 0;

    try {
      // Update store sync status
      await storeRepository.updateSyncStatus(store.id, tenant.id, "syncing");

      while (hasMore) {
        const api2cartResult = await api2cart.listProducts(
          store.api2cartStoreKey,
          {
            start: page * 250,
            count: 250,
          }
        );
        const api2cartProducts = api2cartResult?.product || [];

        if (!api2cartProducts || api2cartProducts.length === 0) {
          hasMore = false;
          break;
        }

        for (const rawProduct of api2cartProducts) {
          result.total++;
          try {
            const normalized = this.normalizeProduct(
              rawProduct,
              store,
              tenant
            );

            // Calculate UCP readiness
            normalized.ucpReadinessScore =
              calculateUCPReadinessScore(normalized).score;

            allUcpScores.push(normalized.ucpReadinessScore);
            if (normalized.gtin) gtinCount++;

            // Check if product already exists
            const existing = await productRepository.getByExternalId(
              tenant.id,
              store.id,
              normalized.externalId
            );

            if (existing) {
              // Update existing product
              await productRepository.update(existing.id, tenant.id, {
                name: normalized.name,
                description: normalized.description,
                price: normalized.price,
                stock: normalized.stock,
                availability: normalized.availability,
                imageUrl: normalized.imageUrl,
                url: normalized.url,
                brand: normalized.brand,
                gtin: normalized.gtin || existing.gtin,
                sku: normalized.sku,
                condition: normalized.condition,
                weight: normalized.weight,
                ucpReadinessScore: normalized.ucpReadinessScore,
                updatedAt: now(),
              });
              result.updated++;
            } else {
              // Create new product
              await productRepository.create(normalized);
              result.created++;
            }
          } catch {
            result.errors++;
          }
        }

        page++;
        if (api2cartProducts.length < 250) hasMore = false;
      }

      // Calculate metrics
      result.gtinCoverage =
        result.total > 0 ? (gtinCount / result.total) * 100 : 0;
      result.avgUcpReadiness =
        allUcpScores.length > 0
          ? allUcpScores.reduce((a, b) => a + b, 0) / allUcpScores.length
          : 0;
      result.duration = Date.now() - startTime;

      // Update store sync status
      await storeRepository.updateSyncStatus(store.id, tenant.id, "active");
      await storeRepository.update(store.id, tenant.id, {
        lastSyncAt: now(),
        productCount:
          (await productRepository.listByStore(tenant.id, store.id))
            .length || result.total,
      });
    } catch (err: any) {
      await storeRepository.updateSyncStatus(store.id, tenant.id, "error");
      throw err;
    }

    return result;
  }

  /**
   * Incremental sync: update only products changed since last sync.
   * Uses API2Cart webhook data.
   */
  async syncProduct(
    externalId: string,
    store: Store,
    tenant: Tenant
  ): Promise<Product | null> {
    const api2cart = getApi2CartService();

    const rawProduct = await api2cart.getProduct(
      store.api2cartStoreKey,
      externalId
    );

    if (!rawProduct) return null;

    const normalized = this.normalizeProduct(rawProduct, store, tenant);
    normalized.ucpReadinessScore = calculateUCPReadinessScore(normalized).score;

    const existing = await productRepository.getByExternalId(
      tenant.id,
      store.id,
      externalId
    );

    if (existing) {
      const updated = await productRepository.update(existing.id, tenant.id, {
        name: normalized.name,
        description: normalized.description,
        price: normalized.price,
        stock: normalized.stock,
        availability: normalized.availability,
        imageUrl: normalized.imageUrl,
        url: normalized.url,
        brand: normalized.brand,
        gtin: normalized.gtin || existing.gtin,
        sku: normalized.sku,
        ucpReadinessScore: normalized.ucpReadinessScore,
        updatedAt: now(),
      });
      return updated as Product;
    }

    const created = await productRepository.create(normalized);
    return created as Product;
  }

  /**
   * Normalize raw API2Cart product data to our Product schema.
   */
  private normalizeProduct(
    raw: any,
    store: Store,
    tenant: Tenant
  ): Product {
    // Extract GTIN from various fields
    let gtin: string | undefined;
    const rawGtin = raw.u_barcode || raw.u_upc || raw.u_ean || raw.barcode || raw.upc || raw.ean;
    if (rawGtin) {
      const normalized = normalizeToGTIN13(String(rawGtin));
      if (normalized && isValidGTIN13(normalized)) {
        gtin = normalized;
      }
    }

    // Determine availability
    const quantity = raw.quantity ?? raw.in_stock ?? 0;
    const availability =
      quantity > 0 ? "in_stock" : "out_of_stock";

    // Build product URL
    const url =
      raw.u_url || raw.url || `${store.url}/produto/${raw.id}`;

    // Status mapping
    let status: ProductStatus = "active";
    if (raw.status === "disabled" || raw.status === "0") {
      status = "inactive";
    }

    const product: Product = {
      id: generateId(),
      tenantId: tenant.id,
      storeId: store.id,
      externalId: String(raw.id),
      name: raw.name || raw.title || "Sem nome",
      description: raw.description || raw.short_description || "",
      sku: raw.sku || raw.model || "",
      gtin: gtin,
      brand: raw.manufacturer || raw.brand || undefined,
      price: parseFloat(raw.price) || 0,
      costPrice: parseFloat(raw.cost_price || raw.wholesale_price) || undefined,
      compareAtPrice: parseFloat(raw.special_price || raw.old_price) || undefined,
      stock: parseInt(String(quantity)) || 0,
      availability: availability as any,
      condition: "new",
      url,
      imageUrl: raw.images?.[0]?.http_path || raw.main_image || undefined,
      weight: parseFloat(raw.weight) || undefined,
      status,
      ucpReadinessScore: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    return product;
  }

  /**
   * Import GTIN data from CSV for products without EAN.
   */
  async importGTINsFromCSV(
    rows: Array<{ sku: string; gtin: string }>,
    tenantId: string
  ): Promise<{ updated: number; notFound: number; invalid: number }> {
    let updated = 0;
    let notFound = 0;
    let invalid = 0;

    for (const row of rows) {
      const normalized = normalizeToGTIN13(row.gtin);
      if (!normalized || !isValidGTIN13(normalized)) {
        invalid++;
        continue;
      }

      // Find product by SKU
      const results = await productRepository.query(
        { query: "SELECT * FROM c WHERE c.sku = @sku AND c.tenantId = @tenantId", parameters: [
          { name: "@sku", value: row.sku },
          { name: "@tenantId", value: tenantId },
        ] }
      );

      if (results.length === 0) {
        notFound++;
        continue;
      }

      const product = results[0] as Product;
      await productRepository.update(product.id, tenantId, {
        gtin: normalized,
        ucpReadinessScore: calculateUCPReadinessScore({
          ...product,
          gtin: normalized,
        }).score,
        updatedAt: now(),
      });
      updated++;
    }

    return { updated, notFound, invalid };
  }

  /**
   * Import cost prices from CSV.
   */
  async importCostsFromCSV(
    rows: Array<{ sku: string; cost: number }>,
    tenantId: string
  ): Promise<{ updated: number; notFound: number }> {
    let updated = 0;
    let notFound = 0;

    for (const row of rows) {
      const results = await productRepository.query(
        { query: "SELECT * FROM c WHERE c.sku = @sku AND c.tenantId = @tenantId", parameters: [
          { name: "@sku", value: row.sku },
          { name: "@tenantId", value: tenantId },
        ] }
      );

      if (results.length === 0) {
        notFound++;
        continue;
      }

      const product = results[0] as Product;
      await productRepository.update(product.id, tenantId, {
        costPrice: row.cost,
        updatedAt: now(),
      });
      updated++;
    }

    return { updated, notFound };
  }
}

// Singleton
let _instance: StoreSyncService | null = null;
export function getStoreSyncService(): StoreSyncService {
  if (!_instance) _instance = new StoreSyncService();
  return _instance;
}
