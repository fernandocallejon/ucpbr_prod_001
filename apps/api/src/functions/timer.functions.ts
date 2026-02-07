// ============================================================
// RetailNexus — Timer Trigger Functions
// Scheduled tasks: competitive scans, parity checks,
// trust score recalculation, signal refresh
// ============================================================

import {
  app,
  Timer,
  InvocationContext,
} from "@azure/functions";
import {
  tenantRepository,
  storeRepository,
  productRepository,
  scanJobRepository,
} from "../repositories/index.js";
import { sendToQueue } from "../lib/service-bus.js";
import { getUCPSignalService } from "../services/ucp-signal.service.js";
import {
  generateId,
  now,
  SERVICE_BUS_QUEUES,
  PLAN_LIMITS,
} from "@retailnexus/shared";
import type { ScanJob, Tenant } from "@retailnexus/shared";

// Timer: Competitive Scan Scheduler
// Runs every 15 minutes. Checks each tenant's scan interval
// and queues scan jobs if it's time.
// CRON: 0 [star]/15 * * * *
async function scheduledScan(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("⏰ Scheduled scan trigger fired");

  try {
    const tenants = await tenantRepository.listAll();

    for (const tenant of tenants as Tenant[]) {
      if (tenant.status !== "active") continue;

      const stores = await storeRepository.listByTenant(tenant.id);

      for (const store of stores) {
        if (store.syncStatus !== "active") continue;

        // Check if scan interval has elapsed
        const interval = tenant.settings?.scanIntervalMinutes || 60;
        const lastScan = store.lastSyncAt
          ? new Date(store.lastSyncAt).getTime()
          : 0;
        const nextScan = lastScan + interval * 60 * 1000;

        if (Date.now() < nextScan) continue;

        // Get products with GTIN for scanning
        const products = await productRepository.listActiveWithGTIN(
          tenant.id
        );

        if (products.length === 0) continue;

        // Create scan job
        const job: ScanJob = {
          id: generateId(),
          tenantId: tenant.id,
          storeId: store.id,
          status: "queued",
          totalProducts: products.length,
          scannedProducts: 0,
          errors: 0,
          createdAt: now(),
          updatedAt: now(),
        };

        await scanJobRepository.create(job);

        // Queue individual scan requests
        for (const product of products) {
          await sendToQueue(SERVICE_BUS_QUEUES.SCAN_REQUESTS, {
            jobId: job.id,
            tenantId: tenant.id,
            storeId: store.id,
            productId: product.id,
          });
        }

        context.log(
          `Queued scan for tenant=${tenant.id} store=${store.id} products=${products.length}`
        );
      }
    }
  } catch (err: any) {
    context.error("scheduledScan error:", err);
  }
}

// Timer: Price Parity Check
// Runs every 15 minutes (offset). Verifies store prices match Google Merchant.
async function parityCheckTimer(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("⏰ Parity check trigger fired");

  try {
    const tenants = await tenantRepository.listAll();
    const ucpService = getUCPSignalService();

    for (const tenant of tenants as Tenant[]) {
      if (tenant.status !== "active") continue;

      const products = await productRepository.listActiveWithGTIN(
        tenant.id
      );

      let mismatches = 0;
      for (const product of products) {
        if (!product.gtin) continue;

        const signal = await ucpService.getSignal(product.gtin);
        const googlePrice = signal?.payload.price || null;
        const check = await ucpService.checkParity(product, googlePrice);

        if (!check.isParity) {
          mismatches++;
          // Queue Google push to fix parity
          await sendToQueue(SERVICE_BUS_QUEUES.GOOGLE_PUSH, {
            tenantId: tenant.id,
            productId: product.id,
            action: "price_parity_fix",
          });
        }
      }

      if (mismatches > 0) {
        context.log(
          `Parity issues: tenant=${tenant.id} mismatches=${mismatches}`
        );
      }
    }
  } catch (err: any) {
    context.error("parityCheckTimer error:", err);
  }
}

/**
 * Timer: Trust Score Recalculation
 * Runs daily at 3:00 AM UTC.
 * CRON: 0 0 3 * * *
 */
async function trustScoreTimer(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("⏰ Trust score recalculation trigger fired");

  try {
    const tenants = await tenantRepository.listAll();
    const ucpService = getUCPSignalService();

    for (const tenant of tenants as Tenant[]) {
      if (tenant.status !== "active") continue;

      const stores = await storeRepository.listByTenant(tenant.id);

      for (const store of stores) {
        try {
          await ucpService.recalculateTrustScore(store.id, tenant.id);
          context.log(
            `Trust score updated: tenant=${tenant.id} store=${store.id}`
          );
        } catch (err: any) {
          context.error(
            `Trust score error: tenant=${tenant.id} store=${store.id}: ${err.message}`
          );
        }
      }
    }
  } catch (err: any) {
    context.error("trustScoreTimer error:", err);
  }
}

// Timer: UCP Signal Refresh
// Runs every 10 minutes. Refreshes Redis cache for top products.
async function signalRefreshTimer(
  timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("⏰ Signal refresh trigger fired");

  try {
    const tenants = await tenantRepository.listAll();
    const ucpService = getUCPSignalService();

    for (const tenant of tenants as Tenant[]) {
      if (tenant.status !== "active") continue;

      const stores = await storeRepository.listByTenant(tenant.id);

      for (const store of stores) {
        const products = await productRepository.listActiveWithGTIN(
          tenant.id
        );

        for (const product of products) {
          try {
            await ucpService.buildAndCacheSignal(product, store, tenant);
          } catch {
            // Non-critical: skip failed signals
          }
        }
      }
    }
  } catch (err: any) {
    context.error("signalRefreshTimer error:", err);
  }
}

// ─── Timer Registration ───

app.timer("timer-scheduled-scan", {
  schedule: "0 */15 * * * *",
  handler: scheduledScan,
});

app.timer("timer-parity-check", {
  schedule: "0 5,20,35,50 * * * *", // Offset from scan
  handler: parityCheckTimer,
});

app.timer("timer-trust-score", {
  schedule: "0 0 3 * * *", // Daily at 3 AM UTC
  handler: trustScoreTimer,
});

app.timer("timer-signal-refresh", {
  schedule: "0 */10 * * * *",
  handler: signalRefreshTimer,
});
