// ============================================================
// RetailNexus — Admin Functions (HTTP Triggers)
// GET    /api/admin/tenants
// GET    /api/admin/tenants/:tenantId
// PUT    /api/admin/tenants/:tenantId/status
// GET    /api/admin/stats
// POST   /api/admin/database/init
// GET    /api/health
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { tenantRepository } from "../repositories/index.js";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { initializeDatabase } from "../lib/cosmos.js";
import { redisHealthCheck } from "../lib/redis.js";
import { now } from "@retailnexus/shared";
import { z } from "zod";

// ─── Schemas ───

const updateStatusSchema = z.object({
  status: z.enum(["active", "suspended", "trial"]),
});

// ─── List All Tenants (Admin) ───

async function listTenants(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAdmin(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenants = await tenantRepository.listAll();
    const safe = tenants.map((t: any) => {
      const { passwordHash, ...rest } = t;
      return rest;
    });

    return successResponse(safe);
  } catch (err: any) {
    context.error("listTenants error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get Tenant (Admin) ───

async function getTenantAdmin(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAdmin(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const tenantId = req.params.tenantId;
  if (!tenantId) return errorResponse("tenantId obrigatório", 400);

  try {
    const tenant = await tenantRepository.getById(tenantId, tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const { passwordHash, ...safe } = tenant as any;
    return successResponse(safe);
  } catch (err: any) {
    context.error("getTenantAdmin error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Update Tenant Status (Admin) ───

async function updateTenantStatus(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAdmin(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const tenantId = req.params.tenantId;
  if (!tenantId) return errorResponse("tenantId obrigatório", 400);

  try {
    const validation = await validateBody(req, updateStatusSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const updated = await tenantRepository.update(tenantId, tenantId, {
      status: body.status,
      updatedAt: now(),
    });

    if (!updated) return errorResponse("Tenant não encontrado", 404);

    return successResponse({ tenantId, status: body.status });
  } catch (err: any) {
    context.error("updateTenantStatus error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Platform Stats (Admin) ───

async function getStats(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAdmin(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const planCounts = await tenantRepository.countByPlan();
    const basic = planCounts["basic"] || 0;
    const pro = planCounts["pro"] || 0;
    const enterprise = planCounts["enterprise"] || 0;

    return successResponse({
      tenants: {
        total: basic + pro + enterprise,
        basic,
        pro,
        enterprise,
      },
      timestamp: now(),
    });
  } catch (err: any) {
    context.error("getStats error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Initialize Database (Admin) ───

async function initDb(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAdmin(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    await initializeDatabase();
    return successResponse({ message: "Database inicializado com sucesso" });
  } catch (err: any) {
    context.error("initDb error:", err);
    return errorResponse("Erro ao inicializar database", 500);
  }
}

// ─── Health Check (Public) ───

async function health(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const checks: Record<string, string> = {
    api: "ok",
    redis: "unknown",
  };

  try {
    const redisOk = await redisHealthCheck();
    checks.redis = redisOk ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return {
    status: allOk ? 200 : 503,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: now(),
      version: "1.0.0",
    }),
  };
}

// ─── Route Registration ───

app.http("admin-tenants-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/tenants",
  handler: listTenants,
});

app.http("admin-tenants-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/tenants/{tenantId}",
  handler: getTenantAdmin,
});

app.http("admin-tenants-status", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "admin/tenants/{tenantId}/status",
  handler: updateTenantStatus,
});

app.http("admin-stats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/stats",
  handler: getStats,
});

app.http("admin-db-init", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin/database/init",
  handler: initDb,
});

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: health,
});
