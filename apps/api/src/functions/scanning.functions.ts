// ============================================================
// RetailNexus — Competitive Scanning Functions (HTTP Triggers)
// POST   /api/scanning/start
// GET    /api/scanning/jobs
// GET    /api/scanning/jobs/:jobId
// GET    /api/scanning/competitors/:productId
// POST   /api/scanning/manual
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
  scanJobRepository,
  competitorPriceRepository,
} from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { getSerperService } from "../services/serper.service.js";
import { sendToQueue } from "../lib/service-bus.js";
import {
  generateId,
  now,
  SERVICE_BUS_QUEUES,
  PLAN_LIMITS,
} from "@retailnexus/shared";
import type { ScanJob, CompetitorPrice } from "@retailnexus/shared";
import { z } from "zod";

// ─── Schemas ───

const startScanSchema = z.object({
  storeId: z.string(),
  productIds: z.array(z.string()).optional(),
});

const manualScanSchema = z.object({
  productId: z.string(),
});

// ─── Start Scan Job ───

async function startScan(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, startScanSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    // Verify store belongs to tenant
    const store = await storeRepository.getById(body.storeId, user.tenantId);
    if (!store) return errorResponse("Loja não encontrada", 404);

    // Get products to scan
    let productIds = body.productIds;
    if (!productIds || productIds.length === 0) {
      // Scan all products with GTIN
      const products = await productRepository.listActiveWithGTIN(
        user.tenantId
      );
      productIds = products.map((p) => p.id);
    }

    if (productIds.length === 0) {
      return errorResponse(
        "Nenhum produto com GTIN encontrado para scan",
        400
      );
    }

    // Check plan limits
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const limits = PLAN_LIMITS[tenant.plan];
    if (productIds.length > limits.maxSKUs) {
      productIds = productIds.slice(0, limits.maxSKUs);
    }

    // Create scan job
    const job: ScanJob = {
      id: generateId(),
      tenantId: user.tenantId,
      storeId: body.storeId,
      status: "queued",
      totalProducts: productIds.length,
      scannedProducts: 0,
      errors: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    await scanJobRepository.create(job);

    // Queue scan requests
    for (const productId of productIds) {
      await sendToQueue(SERVICE_BUS_QUEUES.SCAN_REQUESTS, {
        jobId: job.id,
        tenantId: user.tenantId,
        storeId: body.storeId,
        productId,
      });
    }

    return successResponse(job, 201);
  } catch (err: any) {
    context.error("startScan error:", err);
    return errorResponse("Erro ao iniciar scan", 500);
  }
}

// ─── List Scan Jobs ───

async function listJobs(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const results = await scanJobRepository.query(
      { query: "SELECT * FROM c WHERE c.tenantId = @tid ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50", parameters: [{ name: "@tid", value: user.tenantId }] }
    );

    return successResponse(results);
  } catch (err: any) {
    context.error("listJobs error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get Job ───

async function getJob(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const jobId = req.params.jobId;
  if (!jobId) return errorResponse("jobId obrigatório", 400);

  try {
    const job = await scanJobRepository.getById(jobId, user.tenantId);
    if (!job) return errorResponse("Job não encontrado", 404);

    return successResponse(job);
  } catch (err: any) {
    context.error("getJob error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get Competitors for Product ───

async function getCompetitors(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const productId = req.params.productId;
  if (!productId) return errorResponse("productId obrigatório", 400);

  try {
    // Get product to find its EAN
    const product = await productRepository.getById(productId, user.tenantId);
    if (!product) return errorResponse("Produto não encontrado", 404);

    if (!product.gtin) {
      return errorResponse(
        "Produto sem GTIN. Dados competitivos indisponíveis.",
        400
      );
    }

    const results = await competitorPriceRepository.query(
      { query: "SELECT * FROM c WHERE c.ean = @ean ORDER BY c.price ASC", parameters: [{ name: "@ean", value: product.gtin }] }
    );

    return successResponse({
      productId,
      gtin: product.gtin,
      currentPrice: product.price,
      competitors: results,
      isWinning:
        results.length === 0 ||
        product.price <= ((results[0] as any)?.price ?? Infinity),
    });
  } catch (err: any) {
    context.error("getCompetitors error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Manual Single-Product Scan ───

async function manualScan(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, manualScanSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const product = await productRepository.getById(
      body.productId,
      user.tenantId
    );
    if (!product) return errorResponse("Produto não encontrado", 404);

    if (!product.gtin) {
      return errorResponse("Produto sem GTIN para scan", 400);
    }

    // Perform immediate scan via Serper
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
        tenantId: user.tenantId,
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

    return successResponse({
      productId: product.id,
      gtin: product.gtin,
      currentPrice: product.price,
      results: results.length,
      winningPrice: analysis.winningPrice,
      winningSource: analysis.winningSource,
      clientPosition: analysis.clientPosition,
      competitors: results.slice(0, 10),
    });
  } catch (err: any) {
    context.error("manualScan error:", err);
    return errorResponse("Erro no scan", 500);
  }
}

// ─── Route Registration ───

app.http("scanning-start", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "scanning/start",
  handler: startScan,
});

app.http("scanning-jobs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "scanning/jobs",
  handler: listJobs,
});

app.http("scanning-job", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "scanning/jobs/{jobId}",
  handler: getJob,
});

app.http("scanning-competitors", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "scanning/competitors/{productId}",
  handler: getCompetitors,
});

app.http("scanning-manual", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "scanning/manual",
  handler: manualScan,
});
