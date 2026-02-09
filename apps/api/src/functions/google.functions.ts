// ============================================================
// RetailNexus — Google Integration Functions (HTTP Triggers)
// POST   /api/google/push/:productId
// POST   /api/google/push/batch
// GET    /api/google/sync-log
// GET    /api/google/product-status/:productId
// POST   /api/google/indexing/notify
// GET    /api/google/indexing/quota
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  productRepository,
  storeRepository,
  tenantRepository,
  googleSyncLogRepository,
} from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { getGoogleContentApiService } from "../services/google-content-api.service.js";
import { getGoogleIndexingApiService } from "../services/google-indexing.service.js";
import { generateId, now } from "@retailnexus/shared";
import { z } from "zod";
import { rateLimit } from "../middleware/rate-limit.js";

// ─── Schemas ───

const batchPushSchema = z.object({
  storeId: z.string(),
  productIds: z.array(z.string()).optional(),
});

const indexingNotifySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(200),
  action: z.enum(["URL_UPDATED", "URL_DELETED"]).default("URL_UPDATED"),
});

// ─── Push Single Product to Google Merchant ───

async function pushProduct(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  const productId = req.params.productId;
  if (!productId) return errorResponse("productId obrigatório", 400);

  try {
    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    const store = await storeRepository.getById(product.storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const googleApi = getGoogleContentApiService();
    const startTime = Date.now();
    const result = await googleApi.upsertProduct(product, store, tenant);

    // Log sync
    await googleSyncLogRepository.create({
      id: generateId(),
      tenantId: user.tenantId,
      storeId: store.id,
      productId: product.id,
      action: "upsert",
      status: "success",
      merchantProductId: result.productId,
      payload: {
        price: product.price,
        gtin: product.gtin,
        availability: product.availability,
      },
      responseTime: Date.now() - startTime,
      createdAt: now(),
    });

    return successResponse({
      productId: product.id,
      merchantProductId: result.productId,
      status: result.status,
    });
  } catch (err: any) {
    context.error("pushProduct error:", err);
    return errorResponse("Erro ao enviar para Google", 500);
  }
}

// ─── Batch Push Products ───

async function batchPush(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const validation = await validateBody(req, batchPushSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const store = await storeRepository.getById(body.storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    // Get products
    let products;
    if (body.productIds && body.productIds.length > 0) {
      const results = [];
      for (const pid of body.productIds) {
        const p = await productRepository.getById(pid, user.tenantId);
        if (p) results.push(p);
      }
      products = results;
    } else {
      products = await productRepository.listActiveWithGTIN(
        user.tenantId
      );
    }

    const googleApi = getGoogleContentApiService();
    const result = await googleApi.batchUpsert(
      products.map((p) => ({ product: p, store, tenant }))
    );

    return successResponse({
      message: "Batch push concluído",
      total: products.length,
      inserted: result.inserted,
      errors: result.errors,
    });
  } catch (err: any) {
    context.error("batchPush error:", err);
    return errorResponse("Erro no batch push", 500);
  }
}

// ─── Sync Log ───

async function getSyncLog(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const limit = parseInt(req.query.get("limit") || "50");
    const storeId = req.query.get("storeId");

    let query =
      "SELECT * FROM c WHERE c.tenantId = @tid ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit";
    const params: { name: string; value: string | number | boolean | null }[] = [
      { name: "@tid", value: user.tenantId },
      { name: "@limit", value: limit },
    ];

    if (storeId) {
      query =
        "SELECT * FROM c WHERE c.tenantId = @tid AND c.storeId = @sid ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit";
      params.push({ name: "@sid", value: storeId });
    }

    const results = await googleSyncLogRepository.query(
      { query: query, parameters: params }
    );

    const successRate = await googleSyncLogRepository.getSuccessRate(
      user.tenantId,
      storeId || undefined
    );

    return successResponse({
      logs: results,
      successRate,
    });
  } catch (err: any) {
    context.error("getSyncLog error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Product Status in Merchant Center ───

async function getProductStatus(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  const productId = req.params.productId;
  if (!productId) return errorResponse("productId obrigatório", 400);

  try {
    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    const googleApi = getGoogleContentApiService();
    const status = await googleApi.getProductStatus(product.externalId);

    return successResponse({
      productId: product.id,
      externalId: product.externalId,
      merchantStatus: status,
    });
  } catch (err: any) {
    context.error("getProductStatus error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Indexing API: Notify URLs ───

async function notifyIndexing(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const validation = await validateBody(req, indexingNotifySchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const indexingApi = getGoogleIndexingApiService();
    const result = await indexingApi.batchNotify(
      body.urls.map((url: string) => ({ url })),
      body.action as any
    );

    return successResponse({
      processed: result.results.length,
      successful: result.results.filter((r) => r.success).length,
      failed: result.results.filter((r) => !r.success).length,
      skipped: result.skipped,
      quotaRemaining: result.quotaRemaining,
    });
  } catch (err: any) {
    context.error("notifyIndexing error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Indexing Quota ───

async function getIndexingQuota(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const indexingApi = getGoogleIndexingApiService();
    return successResponse(indexingApi.getQuotaStatus());
  } catch (err: any) {
    context.error("getIndexingQuota error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("google-push-product", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "google/push/{productId}",
  handler: pushProduct,
});

app.http("google-push-batch", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "google/push/batch",
  handler: batchPush,
});

app.http("google-sync-log", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/sync-log",
  handler: getSyncLog,
});

app.http("google-product-status", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/product-status/{productId}",
  handler: getProductStatus,
});

app.http("google-indexing-notify", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "google/indexing/notify",
  handler: notifyIndexing,
});

app.http("google-indexing-quota", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/indexing/quota",
  handler: getIndexingQuota,
});

// ─── Frontend Compatibility Alias Routes ───

// GET /api/google/status → returns GMC connection status
async function getGoogleStatus(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const gmc = tenant.settings?.googleMerchantCenter;
    const connected = !!(gmc && gmc.connected && gmc.accountId);

    // Get product counts from sync log
    let totalProducts = 0;
    let approvedProducts = 0;
    let disapprovedProducts = 0;
    let pendingProducts = 0;
    let lastFeedSync: string | null = null;

    if (connected) {
      const logs = await googleSyncLogRepository.query({
        query: "SELECT * FROM c WHERE c.tenantId = @tid ORDER BY c.createdAt DESC OFFSET 0 LIMIT 1",
        parameters: [{ name: "@tid", value: user.tenantId }],
      });
      if (logs.length > 0) {
        lastFeedSync = (logs[0] as any).createdAt;
      }

      // Count products
      const products = await productRepository.listActiveWithGTIN(user.tenantId);
      totalProducts = products.length;
      approvedProducts = products.filter((p: any) => p.googleStatus === "approved").length;
      disapprovedProducts = products.filter((p: any) => p.googleStatus === "disapproved").length;
      pendingProducts = totalProducts - approvedProducts - disapprovedProducts;
    }

    // Get indexing quota
    let indexingQuota = { used: 0, total: 200 };
    try {
      const indexingApi = getGoogleIndexingApiService();
      indexingQuota = indexingApi.getQuotaStatus();
    } catch {}

    return successResponse({
      connected,
      merchantId: gmc?.accountId || undefined,
      email: tenant.email,
      totalProducts,
      approvedProducts,
      disapprovedProducts,
      pendingProducts,
      lastFeedSync,
      indexingQuota,
    });
  } catch (err: any) {
    context.error("getGoogleStatus error:", err);
    return successResponse({
      connected: false,
      totalProducts: 0,
      approvedProducts: 0,
      disapprovedProducts: 0,
      pendingProducts: 0,
      lastFeedSync: null,
      indexingQuota: { used: 0, total: 200 },
    });
  }
}

app.http("google-status", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/status",
  handler: getGoogleStatus,
});

// GET /api/google/indexing/logs → returns indexing log entries
async function getIndexingLogs(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const logs = await googleSyncLogRepository.query({
      query: "SELECT * FROM c WHERE c.tenantId = @tid ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50",
      parameters: [{ name: "@tid", value: user.tenantId }],
    });

    return successResponse(
      logs.map((l: any) => ({
        id: l.id,
        url: l.payload?.url || `product:${l.productId}`,
        type: l.action === "delete" ? "URL_DELETED" : "URL_UPDATED",
        status: l.status || "success",
        timestamp: l.createdAt,
      }))
    );
  } catch (err: any) {
    context.error("getIndexingLogs error:", err);
    return successResponse([]);
  }
}

app.http("google-indexing-logs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/indexing/logs",
  handler: getIndexingLogs,
});

// POST /api/google/feed/sync → alias for google/push/batch
app.http("google-feed-sync", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "google/feed/sync",
  handler: batchPush,
});

// GET /api/google/auth/url → returns Google OAuth URL
async function getGoogleAuthUrl(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;

  try {
    // Return a placeholder OAuth URL — actual OAuth requires Google Cloud credentials
    const origin = req.headers.get("origin") || "https://icy-beach-03da2f70f.4.azurestaticapps.net";
    return successResponse({
      url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=pending&redirect_uri=${encodeURIComponent(origin + "/google/callback")}&response_type=code&scope=content+indexing&access_type=offline`,
      message: "Configure GOOGLE_CLIENT_ID nas variáveis de ambiente para ativar OAuth",
    });
  } catch (err: any) {
    context.error("getGoogleAuthUrl error:", err);
    return errorResponse("Erro ao gerar URL de autenticação", 500);
  }
}

app.http("google-auth-url", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "google/auth/url",
  handler: getGoogleAuthUrl,
});
