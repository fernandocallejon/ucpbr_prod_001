// ============================================================
// RetailNexus — Webhook Functions (HTTP Triggers)
// POST   /api/webhooks/api2cart
// Receives real-time product change notifications
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { storeRepository } from "../repositories/index.js";
import { sendToQueue } from "../lib/service-bus.js";
import { SERVICE_BUS_QUEUES } from "@retailnexus/shared";

/**
 * API2Cart sends webhook notifications when products change
 * in the connected e-commerce platform.
 * This triggers an incremental sync for the affected product.
 */
async function api2cartWebhook(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as {
      store_key?: string;
      entity?: string;
      action?: string;
      entity_id?: string;
      data?: Record<string, unknown>;
    };

    context.log(
      `API2Cart webhook: entity=${body.entity} action=${body.action} id=${body.entity_id}`
    );

    if (!body.store_key || !body.entity_id) {
      return {
        status: 400,
        body: JSON.stringify({ error: "Missing store_key or entity_id" }),
      };
    }

    // Only process product changes
    if (body.entity !== "product") {
      return { status: 200, body: JSON.stringify({ skipped: true }) };
    }

    // Find store by API2Cart key
    const store = await storeRepository.getByApi2CartKey(body.store_key);
    if (!store) {
      context.warn(`Unknown store_key: ${body.store_key}`);
      return {
        status: 404,
        body: JSON.stringify({ error: "Store not found" }),
      };
    }

    // Queue incremental sync
    await sendToQueue(SERVICE_BUS_QUEUES.STORE_SYNC, {
      storeId: store.id,
      tenantId: store.tenantId,
      action: "incremental",
      externalId: body.entity_id,
    });

    // If price changed, also queue price recalculation
    if (body.action === "update" && body.data && "price" in body.data) {
      await sendToQueue(SERVICE_BUS_QUEUES.PRICE_CALCULATIONS, {
        tenantId: store.tenantId,
        storeId: store.id,
        productId: body.entity_id,
      });
    }

    return {
      status: 200,
      body: JSON.stringify({ received: true, storeId: store.id }),
    };
  } catch (err: any) {
    context.error("api2cartWebhook error:", err);
    return {
      status: 500,
      body: JSON.stringify({ error: "Webhook processing failed" }),
    };
  }
}

// ─── Route Registration ───

app.http("webhook-api2cart", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "webhooks/api2cart",
  handler: api2cartWebhook,
});
