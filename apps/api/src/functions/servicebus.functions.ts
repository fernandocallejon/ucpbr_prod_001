// ============================================================
// RetailNexus — Service Bus Trigger Functions
// Async processing: scan requests, price calculations,
// Google push, store sync
// ============================================================

import {
  app,
  InvocationContext,
} from "@azure/functions";
import {
  productRepository,
  storeRepository,
  tenantRepository,
  scanJobRepository,
  competitorPriceRepository,
} from "../repositories/index.js";
import { getSerperService } from "../services/serper.service.js";
import { getPriceEngineService } from "../services/price-engine.service.js";
import { getGoogleContentApiService } from "../services/google-content-api.service.js";
import { getGoogleIndexingApiService } from "../services/google-indexing.service.js";
import { getStoreSyncService } from "../services/store-sync.service.js";
import { getUCPSignalService } from "../services/ucp-signal.service.js";
import {
  generateId,
  now,
  SERVICE_BUS_QUEUES,
} from "@retailnexus/shared";
import type { CompetitorPrice, ScanJob } from "@retailnexus/shared";

// ═══════════════════════════════════════════════════════════
// Queue: scan-requests
// Process individual product competitive scans
// ═══════════════════════════════════════════════════════════

interface ScanRequestMessage {
  jobId: string;
  tenantId: string;
  storeId: string;
  productId: string;
}

async function processScanRequest(
  message: ScanRequestMessage,
  context: InvocationContext
): Promise<void> {
  context.log(`Processing scan: job=${message.jobId} product=${message.productId}`);

  try {
    const product = await productRepository.getById(
      message.productId,
      message.tenantId
    );
    if (!product || !product.gtin) {
      context.warn(`Product not found or no GTIN: ${message.productId}`);
      await updateJobProgress(message.jobId, message.tenantId, false);
      return;
    }

    // Search via Serper
    const serper = getSerperService();
    const query = serper.buildQuery({
      ean: product.gtin,
      name: product.name,
      brand: product.brand,
    });

    const results = await serper.searchShopping({ query });
    const analysis = serper.analyzeResults(results);

    // Save competitor prices
    for (const result of results) {
      const competitor: CompetitorPrice = {
        id: generateId(),
        tenantId: message.tenantId,
        productId: product.id,
        ean: product.gtin,
        competitorName: result.source,
        competitorUrl: result.link,
        price: result.price,
        currency: "BRL",
        position: result.position,
        isActive: true,
        lastSeenAt: now(),
        createdAt: now(),
        updatedAt: now(),
      };
      await competitorPriceRepository.create(competitor);
    }

    // Update product competitive data
    if (analysis.winningPrice !== null) {
      await productRepository.updateCompetitiveData(
        product.id,
        message.tenantId,
        {
          winningPrice: analysis.winningPrice,
          winningSource: analysis.winningSource || undefined,
          competitorCount: analysis.competitorCount,
          lastScanAt: now(),
          isWinning: product.price <= analysis.winningPrice,
        }
      );
    }

    // If auto-repricing is enabled, queue price calculation
    const tenant = await tenantRepository.getById(
      message.tenantId,
      message.tenantId
    );
    if (
      tenant?.settings?.autoRepricingEnabled &&
      product.pricingRule &&
      product.pricingRule.strategy !== "manual"
    ) {
      const { sendToQueue } = await import("../lib/service-bus.js");
      await sendToQueue(SERVICE_BUS_QUEUES.PRICE_CALCULATIONS, {
        tenantId: message.tenantId,
        storeId: message.storeId,
        productId: product.id,
      });
    }

    await updateJobProgress(message.jobId, message.tenantId, true);

    context.log(
      `Scan complete: product=${product.id} competitors=${results.length} winning=${analysis.winningPrice}`
    );
  } catch (err: any) {
    context.error(`Scan error: product=${message.productId}: ${err.message}`);
    await updateJobProgress(message.jobId, message.tenantId, false);
  }
}

async function updateJobProgress(
  jobId: string,
  tenantId: string,
  success: boolean
): Promise<void> {
  try {
    const job = (await scanJobRepository.getById(
      jobId,
      tenantId
    )) as ScanJob | null;
    if (!job) return;

    const update: Partial<ScanJob> = {
      scannedProducts: (job.scannedProducts || 0) + 1,
      errors: success ? job.errors : (job.errors || 0) + 1,
      updatedAt: now(),
    };

    // Check if job is complete
    if ((update.scannedProducts || 0) >= job.totalProducts) {
      update.status = "completed";
      update.completedAt = now();
    } else if (!job.startedAt) {
      update.status = "running";
      update.startedAt = now();
    }

    await scanJobRepository.update(jobId, tenantId, update);
  } catch {
    // Non-critical
  }
}

// ═══════════════════════════════════════════════════════════
// Queue: price-calculations
// Execute Atomic Flow for price changes
// ═══════════════════════════════════════════════════════════

interface PriceCalculationMessage {
  tenantId: string;
  storeId: string;
  productId: string;
}

async function processPriceCalculation(
  message: PriceCalculationMessage,
  context: InvocationContext
): Promise<void> {
  context.log(`Processing price calc: product=${message.productId}`);

  try {
    const [product, store, tenant] = await Promise.all([
      productRepository.getById(message.productId, message.tenantId),
      storeRepository.getById(message.storeId, message.tenantId),
      tenantRepository.getById(message.tenantId, message.tenantId),
    ]);

    if (!product || !store || !tenant) {
      context.warn(`Missing data for price calc: product=${message.productId}`);
      return;
    }

    // Get competitor prices
    let competitors: CompetitorPrice[] = [];
    if (product.gtin) {
      const competitors_results = await competitorPriceRepository.query(
        { query: "SELECT * FROM c WHERE c.ean = @ean AND c.isActive = true ORDER BY c.price ASC", parameters: [{ name: "@ean", value: product.gtin }] }
      );
      competitors = competitors_results as unknown as CompetitorPrice[];
    }

    const engine = getPriceEngineService();
    const result = await engine.calculatePrice(
      product,
      competitors,
      store,
      tenant
    );

    context.log(
      `Price calc result: product=${product.id} changed=${result.priceChanged} ` +
        `${result.previousPrice}→${result.newPrice} atomic=${result.atomicFlowCompleted}`
    );

    if (result.errors.length > 0) {
      context.warn(`Price calc errors: ${result.errors.join(", ")}`);
    }
  } catch (err: any) {
    context.error(
      `Price calc error: product=${message.productId}: ${err.message}`
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Queue: google-push
// Push product updates to Google Merchant Center
// ═══════════════════════════════════════════════════════════

interface GooglePushMessage {
  tenantId: string;
  productId: string;
  action: string;
}

async function processGooglePush(
  message: GooglePushMessage,
  context: InvocationContext
): Promise<void> {
  context.log(
    `Processing Google push: product=${message.productId} action=${message.action}`
  );

  try {
    const product = await productRepository.getById(
      message.productId,
      message.tenantId
    );
    if (!product) return;

    const store = await storeRepository.getById(
      product.storeId,
      message.tenantId
    );
    if (!store) return;

    const tenant = await tenantRepository.getById(
      message.tenantId,
      message.tenantId
    );
    if (!tenant) return;

    const googleApi = getGoogleContentApiService();
    const startTime = Date.now();

    await googleApi.upsertProduct(product, store, tenant);

    // Log the sync
    const { googleSyncLogRepository } = await import(
      "../repositories/index.js"
    );
    await googleSyncLogRepository.create({
      id: generateId(),
      tenantId: message.tenantId,
      storeId: store.id,
      productId: product.id,
      action: "upsert",
      status: "success",
      payload: {
        price: product.price,
        availability: product.availability,
        trigger: message.action,
      },
      responseTime: Date.now() - startTime,
      createdAt: now(),
    });

    // Also notify indexing API if URL available
    if (product.url) {
      const indexingApi = getGoogleIndexingApiService();
      await indexingApi.notifyUrlUpdated(product.url);
    }

    // Update UCP signal
    if (product.gtin) {
      const ucpService = getUCPSignalService();
      await ucpService.buildAndCacheSignal(product, store, tenant);
    }

    context.log(`Google push complete: product=${product.id}`);
  } catch (err: any) {
    context.error(
      `Google push error: product=${message.productId}: ${err.message}`
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Queue: store-sync
// Synchronize products from e-commerce platform
// ═══════════════════════════════════════════════════════════

interface StoreSyncMessage {
  storeId: string;
  tenantId: string;
  action: "full_sync" | "incremental";
  externalId?: string;
}

async function processStoreSync(
  message: StoreSyncMessage,
  context: InvocationContext
): Promise<void> {
  context.log(
    `Processing store sync: store=${message.storeId} action=${message.action}`
  );

  try {
    const store = await storeRepository.getById(
      message.storeId,
      message.tenantId
    );
    if (!store) return;

    const tenant = await tenantRepository.getById(
      message.tenantId,
      message.tenantId
    );
    if (!tenant) return;

    const syncService = getStoreSyncService();

    if (message.action === "full_sync") {
      const result = await syncService.syncStore(store, tenant);

      context.log(
        `Store sync complete: store=${store.id} ` +
          `total=${result.total} created=${result.created} updated=${result.updated} ` +
          `errors=${result.errors} gtin=${result.gtinCoverage.toFixed(1)}% ` +
          `ucp=${result.avgUcpReadiness.toFixed(1)} duration=${result.duration}ms`
      );
    } else if (message.action === "incremental" && message.externalId) {
      const product = await syncService.syncProduct(
        message.externalId,
        store,
        tenant
      );

      if (product) {
        context.log(
          `Product sync complete: product=${product.id} name="${product.name}"`
        );
      }
    }
  } catch (err: any) {
    context.error(
      `Store sync error: store=${message.storeId}: ${err.message}`
    );
  }
}

// ─── Service Bus Trigger Registration ───

app.serviceBusQueue("sb-scan-requests", {
  connection: "SERVICE_BUS_CONNECTION",
  queueName: SERVICE_BUS_QUEUES.SCAN_REQUESTS,
  handler: async (message, context) => {
    const msg =
      typeof message === "string"
        ? JSON.parse(message)
        : (message as ScanRequestMessage);
    await processScanRequest(msg, context);
  },
});

app.serviceBusQueue("sb-price-calculations", {
  connection: "SERVICE_BUS_CONNECTION",
  queueName: SERVICE_BUS_QUEUES.PRICE_CALCULATIONS,
  handler: async (message, context) => {
    const msg =
      typeof message === "string"
        ? JSON.parse(message)
        : (message as PriceCalculationMessage);
    await processPriceCalculation(msg, context);
  },
});

app.serviceBusQueue("sb-google-push", {
  connection: "SERVICE_BUS_CONNECTION",
  queueName: SERVICE_BUS_QUEUES.GOOGLE_PUSH,
  handler: async (message, context) => {
    const msg =
      typeof message === "string"
        ? JSON.parse(message)
        : (message as GooglePushMessage);
    await processGooglePush(msg, context);
  },
});

app.serviceBusQueue("sb-store-sync", {
  connection: "SERVICE_BUS_CONNECTION",
  queueName: SERVICE_BUS_QUEUES.STORE_SYNC,
  handler: async (message, context) => {
    const msg =
      typeof message === "string"
        ? JSON.parse(message)
        : (message as StoreSyncMessage);
    await processStoreSync(msg, context);
  },
});
