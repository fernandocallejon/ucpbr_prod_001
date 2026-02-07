// ============================================================
// RetailNexus — Pricing Functions (HTTP Triggers)
// POST   /api/pricing/calculate/:productId
// POST   /api/pricing/recalculate-all
// GET    /api/pricing/history/:productId
// POST   /api/pricing/bulk-rules
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
  competitorPriceRepository,
  priceHistoryRepository,
} from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { getPriceEngineService } from "../services/price-engine.service.js";
import { sendToQueue } from "../lib/service-bus.js";
import { SERVICE_BUS_QUEUES, now } from "@retailnexus/shared";
import type { CompetitorPrice } from "@retailnexus/shared";
import { z } from "zod";

// ─── Schemas ───

const bulkRulesSchema = z.object({
  storeId: z.string(),
  strategy: z.enum(["manual", "undercut", "match", "fixed_margin"]),
  undercutAmount: z.number().min(0).optional(),
  undercutType: z.enum(["absolute", "percentage"]).optional(),
  minMarginPercent: z.number().min(0).max(100).optional(),
  targetMarginPercent: z.number().min(0).max(100).optional(),
  productIds: z.array(z.string()).optional(), // if empty, apply to all
});

// ─── Calculate Price for Single Product ───

async function calculatePrice(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const productId = req.params.productId;
  if (!productId) return errorResponse("productId obrigatório", 400);

  try {
    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    const store = await storeRepository.getById(product.storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

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

    return successResponse(result);
  } catch (err: any) {
    context.error("calculatePrice error:", err);
    return errorResponse("Erro no cálculo de preço", 500);
  }
}

// ─── Recalculate All Prices ───

async function recalculateAll(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      storeId?: string;
    };

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    // Queue recalculation jobs (async processing)
    const stores = body.storeId
      ? [await storeRepository.getById(body.storeId, user.tenantId)]
      : await storeRepository.listByTenant(user.tenantId);

    let totalQueued = 0;
    for (const store of stores) {
      if (!store) continue;

      const products = await productRepository.listActiveWithGTIN(
        user.tenantId
      );

      for (const product of products) {
        if (product.pricingRule && product.pricingRule.strategy !== "manual") {
          await sendToQueue(SERVICE_BUS_QUEUES.PRICE_CALCULATIONS, {
            tenantId: user.tenantId,
            storeId: store.id,
            productId: product.id,
          });
          totalQueued++;
        }
      }
    }

    return successResponse({
      message: "Recálculo de preços enfileirado",
      totalQueued,
    });
  } catch (err: any) {
    context.error("recalculateAll error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Price History ───

async function getPriceHistory(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const productId = req.params.productId;
  if (!productId) return errorResponse("productId obrigatório", 400);

  try {
    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    const history_results = await priceHistoryRepository.query(
      { query: "SELECT * FROM c WHERE c.productId = @pid AND c.tenantId = @tid ORDER BY c.createdAt DESC OFFSET 0 LIMIT 100", parameters: [
        { name: "@pid", value: productId },
        { name: "@tid", value: user.tenantId },
      ] }
    );

    return successResponse({
      productId,
      currentPrice: product.price,
      history: history_results,
    });
  } catch (err: any) {
    context.error("getPriceHistory error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Bulk Set Pricing Rules ───

async function bulkSetRules(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, bulkRulesSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    // Get products to update
    let products;
    if (body.productIds && body.productIds.length > 0) {
      const results = [];
      for (const pid of body.productIds) {
        const p = await productRepository.getById(pid, user.tenantId);
        if (p) results.push(p);
      }
      products = results;
    } else {
      products = await productRepository.listByStore(
        user.tenantId,
        body.storeId
      );
    }

    let updated = 0;
    for (const product of products) {
      await productRepository.update(product.id, user.tenantId, {
        pricingRule: {
          strategy: body.strategy,
          undercutAmount: body.undercutAmount,
          undercutType: body.undercutType,
          minMarginPercent: body.minMarginPercent,
          targetMarginPercent: body.targetMarginPercent,
        },
        updatedAt: now(),
      });
      updated++;
    }

    return successResponse({
      message: `Regras de preço aplicadas a ${updated} produtos`,
      updated,
    });
  } catch (err: any) {
    context.error("bulkSetRules error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("pricing-calculate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "pricing/calculate/{productId}",
  handler: calculatePrice,
});

app.http("pricing-recalculate-all", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "pricing/recalculate-all",
  handler: recalculateAll,
});

app.http("pricing-history", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "pricing/history/{productId}",
  handler: getPriceHistory,
});

app.http("pricing-bulk-rules", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "pricing/bulk-rules",
  handler: bulkSetRules,
});
