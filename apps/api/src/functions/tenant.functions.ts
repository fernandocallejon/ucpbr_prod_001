// ============================================================
// RetailNexus — Tenant Functions (HTTP Triggers)
// GET    /api/tenant
// PUT    /api/tenant
// PUT    /api/tenant/settings
// GET    /api/tenant/plan
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { tenantRepository } from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { now, PLAN_LIMITS } from "@retailnexus/shared";
import type { TenantSettings } from "@retailnexus/shared";
import { z } from "zod";

// ─── Schemas ───

const updateTenantSchema = z.object({
  companyName: z.string().min(2).max(100).optional(),
  cnpj: z.string().optional(),
});

const updateSettingsSchema = z.object({
  scanIntervalMinutes: z.number().min(5).max(1440).optional(),
  autoRepricingEnabled: z.boolean().optional(),
  defaultPricingStrategy: z
    .enum(["manual", "undercut", "match", "fixed_margin"])
    .optional(),
  notificationsEnabled: z.boolean().optional(),
  timezone: z.string().optional(),
  googleMerchantCenter: z
    .object({
      accountId: z.string().nullable(),
      connected: z.boolean(),
      lastSyncAt: z.string().nullable().default(null),
    })
    .optional(),
});

// ─── Get Tenant ───

async function getTenant(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const { passwordHash, ...safe } = tenant as any;
    return successResponse(safe);
  } catch (err: any) {
    context.error("getTenant error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Update Tenant ───

async function updateTenant(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, updateTenantSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const updated = await tenantRepository.update(
      user.tenantId,
      user.tenantId,
      { ...body, updatedAt: now() }
    );

    if (!updated) return errorResponse("Tenant não encontrado", 404);

    const { passwordHash, ...safe } = updated as any;
    return successResponse(safe);
  } catch (err: any) {
    context.error("updateTenant error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Update Settings ───

async function updateSettings(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const validation = await validateBody(req, updateSettingsSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    // Validate scan interval against plan limits
    const limits = PLAN_LIMITS[tenant.plan];
    if (
      body.scanIntervalMinutes &&
      body.scanIntervalMinutes < limits.scanIntervalMinutes
    ) {
      return errorResponse(
        `Intervalo mínimo para plano ${tenant.plan}: ${limits.scanIntervalMinutes}min`,
        400
      );
    }

    const updatedSettings = { ...tenant.settings, ...body } as TenantSettings;

    const updated = await tenantRepository.update(
      user.tenantId,
      user.tenantId,
      {
        settings: updatedSettings,
        updatedAt: now(),
      }
    );

    return successResponse((updated as any).settings);
  } catch (err: any) {
    context.error("updateSettings error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Get Plan Info ───

async function getPlan(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const limits = PLAN_LIMITS[tenant.plan];

    return successResponse({
      plan: tenant.plan,
      limits,
      usage: {
        stores: tenant.storeCount,
        products: tenant.productCount,
      },
    });
  } catch (err: any) {
    context.error("getPlan error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("tenant-get", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "tenant",
  handler: getTenant,
});

app.http("tenant-update", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "tenant",
  handler: updateTenant,
});

app.http("tenant-settings", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "tenant/settings",
  handler: updateSettings,
});

app.http("tenant-plan", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "tenant/plan",
  handler: getPlan,
});
