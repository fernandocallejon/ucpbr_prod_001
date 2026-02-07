// ============================================================
// RetailNexus — Auth Functions (HTTP Triggers)
// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { tenantRepository } from "../repositories/index.js";
import {
  generateToken,
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { generateId, now, PLAN_LIMITS } from "@retailnexus/shared";
import type { Tenant, CreateTenantInput } from "@retailnexus/shared";
import { z } from "zod";
import * as bcrypt from "bcryptjs";

// ─── Schemas ───

const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  cnpj: z.string().optional(),
  plan: z.enum(["basic", "pro", "enterprise"]).default("basic"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Register ───

async function register(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const validation = await validateBody(req, registerSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    // Check if email already exists
    const existing = await tenantRepository.getByEmail(body.email);
    if (existing) {
      return errorResponse("Email já cadastrado", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create tenant
    const plan = body.plan ?? "basic";
    const tenant: Tenant = {
      id: generateId(),
      companyName: body.companyName,
      email: body.email,
      passwordHash,
      cnpj: body.cnpj,
      plan,
      status: "active",
      settings: {
        scanIntervalMinutes:
          PLAN_LIMITS[plan].scanIntervalMinutes,
        autoRepricingEnabled: false,
        defaultPricingStrategy: "manual",
        notificationsEnabled: true,
        timezone: "America/Sao_Paulo",
      },
      storeCount: 0,
      productCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    await tenantRepository.create(tenant);

    // Generate JWT
    const token = generateToken({
      id: tenant.id,
      tenantId: tenant.id,
      email: tenant.email,
      role: "admin",
    });

    return successResponse(
      {
        token,
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
          email: tenant.email,
          plan: tenant.plan,
        },
      },
      201
    );
  } catch (err: any) {
    context.error("Register error:", err);
    return errorResponse("Erro ao criar conta", 500);
  }
}

// ─── Login ───

async function login(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const validation = await validateBody(req, loginSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const tenant = await tenantRepository.getByEmail(body.email);
    if (!tenant) {
      return errorResponse("Credenciais inválidas", 401);
    }

    if (tenant.status !== "active") {
      return errorResponse("Conta suspensa", 403);
    }

    const isValid = await bcrypt.compare(body.password, tenant.passwordHash);
    if (!isValid) {
      return errorResponse("Credenciais inválidas", 401);
    }

    const token = generateToken({
      id: tenant.id,
      tenantId: tenant.id,
      email: tenant.email,
      role: "admin",
    });

    return successResponse({
      token,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        email: tenant.email,
        plan: tenant.plan,
      },
    });
  } catch (err: any) {
    context.error("Login error:", err);
    return errorResponse("Erro no login", 500);
  }
}

// ─── Me ───

async function me(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    return successResponse({
      id: tenant.id,
      companyName: tenant.companyName,
      email: tenant.email,
      plan: tenant.plan,
      status: tenant.status,
      settings: tenant.settings,
      storeCount: tenant.storeCount,
      productCount: tenant.productCount,
      createdAt: tenant.createdAt,
    });
  } catch (err: any) {
    context.error("Me error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Route Registration ───

app.http("auth-register", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/register",
  handler: register,
});

app.http("auth-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/login",
  handler: login,
});

app.http("auth-me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: me,
});
