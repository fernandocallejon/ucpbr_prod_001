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
  pricingRuleRepository,
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
import { rateLimit } from "../middleware/rate-limit.js";

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

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

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

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

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

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

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

// ─── Pricing Rules CRUD (frontend compat) ───

import { generateId as genId } from "@retailnexus/shared";

// GET /api/pricing/rules → list all pricing rules for tenant
async function listPricingRules(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const rules = await pricingRuleRepository.listByTenant(user.tenantId);
    return successResponse(rules);
  } catch (err: any) {
    context.error("listPricingRules error:", err);
    return successResponse([]);
  }
}

app.http("pricing-rules-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "pricing/rules",
  handler: listPricingRules,
});

// POST /api/pricing/rules → create a new pricing rule
async function createPricingRule(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const body = (await req.json().catch(() => ({}))) as any;
    
    const rule = {
      id: genId(),
      tenantId: user.tenantId,
      name: body.name || "Nova Regra",
      strategy: body.strategy || "manual",
      margin: body.margin,
      minMargin: body.minMargin,
      maxDiscount: body.maxDiscount,
      targetPosition: body.targetPosition,
      isActive: body.isActive !== false,
      appliedProducts: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    await pricingRuleRepository.create(rule);
    return successResponse(rule, 201);
  } catch (err: any) {
    context.error("createPricingRule error:", err);
    return errorResponse("Erro ao criar regra", 500);
  }
}

app.http("pricing-rules-create", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "pricing/rules",
  handler: createPricingRule,
});

// PUT /api/pricing/rules/{ruleId} → update a pricing rule
async function updatePricingRule(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const ruleId = req.params.ruleId;
  if (!ruleId) return errorResponse("ruleId obrigatório", 400);

  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const updates: Record<string, any> = { updatedAt: now() };
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.strategy !== undefined) updates.strategy = body.strategy;
    if (body.margin !== undefined) updates.margin = body.margin;
    if (body.minMargin !== undefined) updates.minMargin = body.minMargin;
    if (body.maxDiscount !== undefined) updates.maxDiscount = body.maxDiscount;
    if (body.targetPosition !== undefined) updates.targetPosition = body.targetPosition;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const updated = await pricingRuleRepository.update(ruleId, user.tenantId, updates);
    if (!updated) return errorResponse("Regra não encontrada", 404);

    return successResponse(updated);
  } catch (err: any) {
    context.error("updatePricingRule error:", err);
    return errorResponse("Erro ao atualizar regra", 500);
  }
}

app.http("pricing-rules-update", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "pricing/rules/{ruleId}",
  handler: updatePricingRule,
});

// DELETE /api/pricing/rules/{ruleId} → delete a pricing rule
async function deletePricingRule(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const ruleId = req.params.ruleId;
  if (!ruleId) return errorResponse("ruleId obrigatório", 400);

  try {
    const deleted = await pricingRuleRepository.delete(ruleId, user.tenantId);
    if (!deleted) return errorResponse("Regra não encontrada", 404);
    return successResponse({ message: "Regra removida" });
  } catch (err: any) {
    context.error("deletePricingRule error:", err);
    return errorResponse("Erro ao remover regra", 500);
  }
}

app.http("pricing-rules-delete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "pricing/rules/{ruleId}",
  handler: deletePricingRule,
});
