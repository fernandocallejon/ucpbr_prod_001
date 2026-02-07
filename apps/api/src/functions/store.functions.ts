// ============================================================
// RetailNexus — Store Functions (HTTP Triggers)
// GET    /api/stores
// POST   /api/stores/connect
// GET    /api/stores/:storeId
// DELETE /api/stores/:storeId
// POST   /api/stores/:storeId/sync
// GET    /api/stores/:storeId/status
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  storeRepository,
  tenantRepository,
} from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { getApi2CartService } from "../services/api2cart.service.js";
import { getStoreSyncService } from "../services/store-sync.service.js";
import { sendToQueue } from "../lib/service-bus.js";
import { generateId, now, PLAN_LIMITS, SERVICE_BUS_QUEUES } from "@retailnexus/shared";
import type { Store, ConnectStoreInput } from "@retailnexus/shared";
import { z } from "zod";

// ─── Schemas ───

const connectStoreSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  platform: z.enum([
    "shopify",
    "woocommerce",
    "magento",
    "vtex",
    "nuvemshop",
    "tray",
    "loja_integrada",
    "other",
  ]),
  api2cartStoreKey: z.string().min(10),
  shippingDefaults: z
    .object({
      defaultCost: z.number().min(0),
      defaultMethod: z.string(),
      freeShippingThreshold: z.number().optional(),
      defaultTransitDays: z.number().int().min(1).optional(),
    })
    .optional(),
  returnPolicy: z
    .object({
      days: z.number().int().min(0),
      freeReturn: z.boolean(),
      policyUrl: z.string().url().optional(),
    })
    .optional(),
});

// ─── List Stores ───

async function listStores(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const stores = await storeRepository.listByTenant(user.tenantId);
    return successResponse(stores);
  } catch (err: any) {
    context.error("listStores error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Connect Store ───

async function connectStore(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, connectStoreSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    // Check plan limits
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const limits = PLAN_LIMITS[tenant.plan];
    const currentCount = await storeRepository.countByTenant(user.tenantId);
    if (currentCount >= limits.maxStores) {
      return errorResponse(
        `Limite de lojas atingido para o plano ${tenant.plan} (${limits.maxStores})`,
        400
      );
    }

    // Verify API2Cart connection
    const api2cart = getApi2CartService();
    // Try to list products as a connectivity test
    try {
      await api2cart.listProducts(body.api2cartStoreKey, { count: 1 });
    } catch {
      return errorResponse(
        "Não foi possível conectar à loja. Verifique a chave API2Cart.",
        400
      );
    }

    const store: Store = {
      id: generateId(),
      tenantId: user.tenantId,
      name: body.name,
      url: body.url,
      platform: body.platform,
      api2cartStoreKey: body.api2cartStoreKey,
      syncStatus: "pending",
      lastSyncAt: null,
      productCount: 0,
      shippingDefaults: body.shippingDefaults,
      returnPolicy: body.returnPolicy,
      createdAt: now(),
      updatedAt: now(),
    };

    await storeRepository.create(store);

    // Update tenant store count
    await tenantRepository.update(user.tenantId, user.tenantId, {
      storeCount: currentCount + 1,
      updatedAt: now(),
    });

    // Trigger initial sync via Service Bus
    await sendToQueue(SERVICE_BUS_QUEUES.STORE_SYNC, {
      storeId: store.id,
      tenantId: user.tenantId,
      action: "full_sync",
    });

    return successResponse(store, 201);
  } catch (err: any) {
    context.error("connectStore error:", err);
    return errorResponse("Erro ao conectar loja", 500);
  }
}

// ─── Get Store ───

async function getStore(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const storeId = req.params.storeId;
  if (!storeId) return errorResponse("storeId obrigatório", 400);

  try {
    const store = await storeRepository.getById(storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    return successResponse(store);
  } catch (err: any) {
    context.error("getStore error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Delete Store ───

async function deleteStore(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const storeId = req.params.storeId;
  if (!storeId) return errorResponse("storeId obrigatório", 400);

  try {
    const store = await storeRepository.getById(storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    // Disconnect from API2Cart
    try {
      const api2cart = getApi2CartService();
      await api2cart.deleteConnection(store.api2cartStoreKey);
    } catch {
      // Non-critical: proceed even if API2Cart disconnect fails
    }

    await storeRepository.delete(storeId, user.tenantId);

    // Update tenant store count
    const currentCount = await storeRepository.countByTenant(user.tenantId);
    await tenantRepository.update(user.tenantId, user.tenantId, {
      storeCount: currentCount,
      updatedAt: now(),
    });

    return successResponse({ deleted: true });
  } catch (err: any) {
    context.error("deleteStore error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Trigger Sync ───

async function triggerSync(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const storeId = req.params.storeId;
  if (!storeId) return errorResponse("storeId obrigatório", 400);

  try {
    const store = await storeRepository.getById(storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    if (store.syncStatus === "syncing") {
      return errorResponse("Sincronização já em andamento", 409);
    }

    // Queue sync job
    await sendToQueue(SERVICE_BUS_QUEUES.STORE_SYNC, {
      storeId: store.id,
      tenantId: user.tenantId,
      action: "full_sync",
    });

    await storeRepository.updateSyncStatus(storeId, user.tenantId, "syncing");

    return successResponse({ message: "Sincronização iniciada", storeId });
  } catch (err: any) {
    context.error("triggerSync error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Store Status ───

async function getStoreStatus(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const storeId = req.params.storeId;
  if (!storeId) return errorResponse("storeId obrigatório", 400);

  try {
    const store = await storeRepository.getById(storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    return successResponse({
      storeId: store.id,
      syncStatus: store.syncStatus,
      lastSyncAt: store.lastSyncAt,
      productCount: store.productCount,
      platform: store.platform,
    });
  } catch (err: any) {
    context.error("getStoreStatus error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("stores-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stores",
  handler: listStores,
});

app.http("stores-connect", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "stores/connect",
  handler: connectStore,
});

app.http("stores-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stores/{storeId}",
  handler: getStore,
});

app.http("stores-delete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "stores/{storeId}",
  handler: deleteStore,
});

app.http("stores-sync", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "stores/{storeId}/sync",
  handler: triggerSync,
});

app.http("stores-status", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stores/{storeId}/status",
  handler: getStoreStatus,
});
