// ============================================================
// RetailNexus — Health Check Functions
// GET /api/health       — basic liveness
// GET /api/health/ready — readiness (checks Cosmos, Redis, SB)
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getCosmosClient } from "../lib/cosmos.js";
import { getRedis } from "../lib/redis.js";

// ─── Liveness ───

async function healthLiveness(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "healthy",
      version: process.env.npm_package_version || "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  };
}

// ─── Readiness ───

async function healthReadiness(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const checks: Record<string, { ok: boolean; latency?: number; error?: string }> = {};

  // Cosmos DB
  try {
    const start = Date.now();
    const client = getCosmosClient();
    await client.getDatabaseAccount();
    checks.cosmos = { ok: true, latency: Date.now() - start };
  } catch (err: any) {
    checks.cosmos = { ok: false, error: err.message };
  }

  // Redis
  try {
    const start = Date.now();
    const redis = getRedis();
    await redis.ping();
    checks.redis = { ok: true, latency: Date.now() - start };
  } catch (err: any) {
    checks.redis = { ok: false, error: err.message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return {
    status: allOk ? 200 : 503,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: allOk ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    }),
  };
}

// ─── Register ───

app.http("health-liveness", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthLiveness,
});

app.http("health-readiness", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health/ready",
  handler: healthReadiness,
});
