// ============================================================
// RetailNexus — Product Functions (HTTP Triggers)
// GET    /api/products
// GET    /api/products/:productId
// PUT    /api/products/:productId/pricing
// POST   /api/products/import/gtin
// POST   /api/products/import/costs
// GET    /api/products/coverage/gtin
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
} from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  paginatedResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody, validateQuery, paginationSchema } from "../middleware/validation.js";
import { getStoreSyncService } from "../services/store-sync.service.js";
import { now } from "@retailnexus/shared";
import { calculateUCPReadinessScore } from "@retailnexus/shared";
import type { Product, UpdatePricingRuleInput } from "@retailnexus/shared";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { rateLimit } from "../middleware/rate-limit.js";

// ─── Schemas ───

const pricingRuleSchema = z.object({
  strategy: z.enum(["manual", "undercut", "match", "fixed_margin"]),
  undercutAmount: z.number().min(0).optional(),
  undercutType: z.enum(["absolute", "percentage"]).optional(),
  minMarginPercent: z.number().min(0).max(100).optional(),
  targetMarginPercent: z.number().min(0).max(100).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
});

// ─── List Products ───

async function listProducts(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const page = parseInt(req.query.get("page") || "1");
    const limit = parseInt(req.query.get("pageSize") || req.query.get("limit") || "50");
    const storeId = req.query.get("storeId");
    const search = req.query.get("search") || "";
    const readiness = req.query.get("readiness") || "";

    let result;
    if (storeId) {
      const products = await productRepository.listByStore(
        user.tenantId,
        storeId
      );
      result = {
        items: products,
        total: products.length,
        page,
        pageSize: limit,
        hasMore: false,
      };
    } else {
      result = await productRepository.listByTenant(user.tenantId, {
        page,
        pageSize: limit,
      });
    }

    return paginatedResponse(result);
  } catch (err: any) {
    context.error("listProducts error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get Product ───

async function getProduct(
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

    return successResponse(product);
  } catch (err: any) {
    context.error("getProduct error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Update Pricing Rule ───

async function updatePricingRule(
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
    const validation = await validateBody(req, pricingRuleSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    const updated = await productRepository.update(productId, user.tenantId, {
      pricingRule: body,
      updatedAt: now(),
    });

    return successResponse(updated);
  } catch (err: any) {
    context.error("updatePricingRule error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Import GTINs from CSV ───

async function importGTINs(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const body = await req.text();
    if (!body) return errorResponse("CSV body obrigatório", 400);

    const records = parse(body, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{ sku: string; gtin: string }>;

    if (records.length === 0) {
      return errorResponse("CSV vazio ou formato inválido. Esperado: sku,gtin", 400);
    }

    const syncService = getStoreSyncService();
    const result = await syncService.importGTINsFromCSV(records, user.tenantId);

    return successResponse({
      message: "Importação concluída",
      ...result,
      total: records.length,
    });
  } catch (err: any) {
    context.error("importGTINs error:", err);
    return errorResponse("Erro ao processar CSV", 500);
  }
}

// ─── Import Costs from CSV ───

async function importCosts(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const body = await req.text();
    if (!body) return errorResponse("CSV body obrigatório", 400);

    const records = parse(body, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{ sku: string; cost: string }>;

    if (records.length === 0) {
      return errorResponse("CSV vazio ou formato inválido. Esperado: sku,cost", 400);
    }

    const syncService = getStoreSyncService();
    const result = await syncService.importCostsFromCSV(
      records.map((r) => ({ sku: r.sku, cost: parseFloat(r.cost) })),
      user.tenantId
    );

    return successResponse({
      message: "Importação concluída",
      ...result,
      total: records.length,
    });
  } catch (err: any) {
    context.error("importCosts error:", err);
    return errorResponse("Erro ao processar CSV", 500);
  }
}

// ─── GTIN Coverage ───

async function getGTINCoverage(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const coverage = await productRepository.getGTINCoverage(user.tenantId);

    return successResponse({
      ...coverage,
      coveragePercent:
        coverage.total > 0
          ? Math.round((coverage.withGTIN / coverage.total) * 10000) / 100
          : 0,
    });
  } catch (err: any) {
    context.error("getGTINCoverage error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("products-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "products",
  handler: listProducts,
});

app.http("products-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "products/{productId}",
  handler: getProduct,
});

app.http("products-pricing", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "products/{productId}/pricing",
  handler: updatePricingRule,
});

app.http("products-import-gtin", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "products/import/gtin",
  handler: importGTINs,
});

app.http("products-import-costs", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "products/import/costs",
  handler: importCosts,
});

app.http("products-coverage-gtin", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "products/coverage/gtin",
  handler: getGTINCoverage,
});
