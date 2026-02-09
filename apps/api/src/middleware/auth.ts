// ============================================================
// RetailNexus — Auth Middleware (JWT + Multi-Tenant)
// ============================================================

import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import jwt from "jsonwebtoken";
import { getConfig } from "../config/env.js";
import type { AuthUser, JwtPayload, ApiResponse } from "@retailnexus/shared";

/**
 * Extract and verify JWT from Authorization header.
 * Returns the authenticated user or null.
 */
export function extractUser(req: HttpRequest): AuthUser | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return {
      id: decoded.sub,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user: AuthUser): string {
  const config = getConfig();
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  } as jwt.SignOptions);
}

/**
 * Auth guard — requires valid JWT. Returns 401 if not authenticated.
 */
export function requireAuth(
  req: HttpRequest
): AuthUser | HttpResponseInit {
  const user = extractUser(req);
  if (!user) {
    return errorResponse("Authentication required", 401);
  }
  return user;
}

/**
 * Admin guard — requires root role. Returns 403 if not admin.
 */
export function requireAdmin(
  req: HttpRequest
): AuthUser | HttpResponseInit {
  const result = requireAuth(req);
  if (isErr(result)) return result;

  if (result.role !== "root") {
    return errorResponse("Admin access required", 403);
  }
  return result;
}

/**
 * Tenant guard — ensures user can only access their own tenant data.
 * Admin can access any tenant.
 */
export function requireTenantAccess(
  req: HttpRequest,
  targetTenantId: string
): AuthUser | HttpResponseInit {
  const result = requireAuth(req);
  if (isErr(result)) return result;

  if (result.role !== "root" && result.tenantId !== targetTenantId) {
    return errorResponse("Cannot access another tenant's data", 403);
  }
  return result;
}

// ─── Response Helpers ───

/**
 * Generic type guard — checks if a value is an HttpResponseInit (error response).
 * Works for any union T | HttpResponseInit.
 */
export function isErr(result: unknown): result is HttpResponseInit {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    typeof (result as Record<string, unknown>).status === "number"
  );
}

export function successResponse<T>(
  data: T,
  status = 200
): HttpResponseInit {
  const body: ApiResponse<T> = { success: true, data };
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  message: string,
  status = 500,
  details?: Record<string, unknown>
): HttpResponseInit {
  const body: ApiResponse = {
    success: false,
    error: { code: `ERR_${status}`, message, details },
  };
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function paginatedResponse<T>(
  data: { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean }
): HttpResponseInit {
  const body: ApiResponse<{ data: T[]; total: number; page: number; pageSize: number; hasMore: boolean }> = {
    success: true,
    data: {
      data: data.items,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      hasMore: data.hasMore,
    },
  };
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
