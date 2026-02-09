// ============================================================
// RetailNexus — UCP Functions (HTTP Triggers)
// GET    /api/ucp/signal/:ean
// GET    /api/ucp/offers/:ean
// GET    /api/ucp/dashboard
// GET    /api/ucp/readiness/:productId
// POST   /api/ucp/parity-check
// GET    /api/ucp/seller-profile
// GET    /api/ucp/jsonld/:productId
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
  isErr,
} from "../middleware/auth.js";
import { getUCPSignalService } from "../services/ucp-signal.service.js";
import {
  calculateUCPReadinessScore,
  generateProductJsonLD,
  generateEmbedScript,
} from "@retailnexus/shared";
import { rateLimit } from "../middleware/rate-limit.js";

// ─── Get UCP Signal ───

async function getSignal(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  const ean = req.params.ean;
  if (!ean) return errorResponse("EAN obrigatório", 400);

  try {
    const ucpService = getUCPSignalService();
    const signal = await ucpService.getSignal(ean);

    if (!signal) return errorResponse("Signal não encontrado", 404);

    return successResponse(signal);
  } catch (err: any) {
    context.error("getSignal error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get All Offers for EAN ───

async function getOffers(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  const ean = req.params.ean;
  if (!ean) return errorResponse("EAN obrigatório", 400);

  try {
    const ucpService = getUCPSignalService();
    const offers = await ucpService.getOffersForEAN(ean);

    return successResponse({
      ean,
      offers,
      totalOffers: offers.length,
      bestPrice: offers[0]?.payload.price || null,
    });
  } catch (err: any) {
    context.error("getOffers error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── UCP Dashboard ───

async function getDashboard(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const ucpService = getUCPSignalService();
    const metrics = await ucpService.getDashboardMetrics(user.tenantId);

    return successResponse(metrics);
  } catch (err: any) {
    context.error("getDashboard error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── UCP Readiness for Product ───

async function getReadiness(
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

    const score = calculateUCPReadinessScore(product).score;

    // Build breakdown
    const breakdown = {
      gtin13: {
        weight: 25,
        score: product.gtin ? 25 : 0,
        status: product.gtin ? "ok" : "missing",
      },
      price: {
        weight: 20,
        score: product.price > 0 ? 20 : 0,
        status: product.price > 0 ? "ok" : "missing",
      },
      availability: {
        weight: 15,
        score: product.availability ? 15 : 0,
        status: product.availability ? "ok" : "missing",
      },
      shipping: {
        weight: 15,
        score: product.shipping ? 15 : 0,
        status: product.shipping ? "ok" : "missing",
      },
      returnPolicy: {
        weight: 10,
        score: product.returnPolicy ? 10 : 0,
        status: product.returnPolicy ? "ok" : "missing",
      },
      brand: {
        weight: 5,
        score: product.brand ? 5 : 0,
        status: product.brand ? "ok" : "missing",
      },
      description: {
        weight: 5,
        score: product.description && product.description.length > 50 ? 5 : 0,
        status:
          product.description && product.description.length > 50
            ? "ok"
            : "incomplete",
      },
      rating: {
        weight: 5,
        score: product.aggregateRating ? 5 : 0,
        status: product.aggregateRating ? "ok" : "missing",
      },
    };

    return successResponse({
      productId,
      score,
      maxScore: 100,
      breakdown,
      isUCPReady: score >= 70,
    });
  } catch (err: any) {
    context.error("getReadiness error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Parity Check ───

async function parityCheck(
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

    const storeId = body.storeId;
    let products;

    if (storeId) {
      products = await productRepository.listActiveWithGTIN(
        user.tenantId
      );
      products = products.filter((p) => p.storeId === storeId);
    } else {
      products = await productRepository.listActiveWithGTIN(
        user.tenantId
      );
    }

    const ucpService = getUCPSignalService();
    const results = [];

    for (const product of products) {
      if (!product.gtin) continue;

      const signal = await ucpService.getSignal(product.gtin);
      const googlePrice = signal?.payload.price || null;

      const check = await ucpService.checkParity(product, googlePrice);
      if (!check.isParity) {
        results.push(check);
      }
    }

    return successResponse({
      totalChecked: products.length,
      mismatches: results.length,
      parityRate:
        products.length > 0
          ? Math.round(
              ((products.length - results.length) / products.length) * 10000
            ) / 100
          : 100,
      issues: results,
    });
  } catch (err: any) {
    context.error("parityCheck error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Seller Profile ───

async function getSellerProfile(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const storeId = req.query.get("storeId");
    if (!storeId) return errorResponse("storeId obrigatório", 400);

    const store = await storeRepository.getById(storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const ucpService = getUCPSignalService();
    const profile = await ucpService.getOrCreateSellerProfile(store, tenant);

    return successResponse(profile);
  } catch (err: any) {
    context.error("getSellerProfile error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── JSON-LD for Product ───

async function getJsonLD(
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

    const jsonld = generateProductJsonLD(product, store, 0);
    const embed = generateEmbedScript(jsonld);

    const format = req.query.get("format");

    if (format === "script") {
      return {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: embed,
      };
    }

    return successResponse(jsonld);
  } catch (err: any) {
    context.error("getJsonLD error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("ucp-signal", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/signal/{ean}",
  handler: getSignal,
});

app.http("ucp-offers", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/offers/{ean}",
  handler: getOffers,
});

app.http("ucp-dashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/dashboard",
  handler: getDashboard,
});

app.http("ucp-readiness", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/readiness/{productId}",
  handler: getReadiness,
});

app.http("ucp-parity-check", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "ucp/parity-check",
  handler: parityCheck,
});

app.http("ucp-seller-profile", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/seller-profile",
  handler: getSellerProfile,
});

app.http("ucp-jsonld", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ucp/jsonld/{productId}",
  handler: getJsonLD,
});

// ─── Dashboard Stats (frontend compat) ───

async function getDashboardStats(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const products = await productRepository.listActiveWithGTIN(user.tenantId);
    const allProducts = await productRepository.query({
      query: "SELECT * FROM c WHERE c.tenantId = @tid",
      parameters: [{ name: "@tid", value: user.tenantId }],
    });
    const stores = await storeRepository.listByTenant(user.tenantId);

    // Calculate UCP scores
    let totalScore = 0;
    let eligible = 0;
    let almost = 0;
    let notEligible = 0;

    for (const product of allProducts) {
      const score = (product as any).ucpReadinessScore || 0;
      totalScore += score;
      if (score >= 80) eligible++;
      else if (score >= 50) almost++;
      else notEligible++;
    }

    const avgScore = allProducts.length > 0 ? Math.round(totalScore / allProducts.length) : 0;

    return successResponse({
      totalProducts: allProducts.length,
      totalStores: stores.length,
      avgUcpScore: avgScore,
      productsEligible: eligible,
      productsAlmost: almost,
      productsNotEligible: notEligible,
      recentPriceChanges: 0,
      avgPriceParity: 0,
    });
  } catch (err: any) {
    context.error("getDashboardStats error:", err);
    return successResponse({
      totalProducts: 0,
      totalStores: 0,
      avgUcpScore: 0,
      productsEligible: 0,
      productsAlmost: 0,
      productsNotEligible: 0,
      recentPriceChanges: 0,
      avgPriceParity: 0,
    });
  }
}

app.http("dashboard-stats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboard/stats",
  handler: getDashboardStats,
});
