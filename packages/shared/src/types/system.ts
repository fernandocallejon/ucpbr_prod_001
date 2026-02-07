// ============================================================
// RetailNexus — System & Admin Types
// ============================================================

export interface SystemConfig {
  id: string;
  configType: string; // Partition key
  type: "system-config";
  key: string;
  value: unknown;
  description: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  type: "audit-log";
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Pricing Rules (Global) ───

export interface GlobalPricingRule {
  id: string;
  configType: "global-pricing-rule";
  type: "system-config";
  rule: {
    minMarginFloor: number; // Emergency: minimum margin % system-wide
    maxPriceDropPercent: number; // Max single-step price drop
    circuitBreakerThreshold: number; // Anomaly detection threshold
    enabled: boolean;
  };
  updatedBy: string;
  updatedAt: string;
}

// ─── Plan Limits ───

export interface PlanLimits {
  maxSKUs: number;
  maxStores: number;
  scanIntervalMinutes: number;
  maxScansPerDay: number;
  serperCreditsPerMonth: number;
  cacheTTLSeconds: number;
  googlePushEnabled: boolean;
  apiRateLimitPerMin: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  basic: {
    maxSKUs: 500,
    maxStores: 2,
    scanIntervalMinutes: 1440, // 24h
    maxScansPerDay: 500,
    serperCreditsPerMonth: 15000,
    cacheTTLSeconds: 86400,
    googlePushEnabled: false,
    apiRateLimitPerMin: 100,
  },
  pro: {
    maxSKUs: 5000,
    maxStores: 10,
    scanIntervalMinutes: 360, // 6h
    maxScansPerDay: 20000,
    serperCreditsPerMonth: 60000,
    cacheTTLSeconds: 21600,
    googlePushEnabled: true,
    apiRateLimitPerMin: 500,
  },
  enterprise: {
    maxSKUs: Infinity,
    maxStores: Infinity,
    scanIntervalMinutes: 30,
    maxScansPerDay: Infinity,
    serperCreditsPerMonth: Infinity,
    cacheTTLSeconds: 300,
    googlePushEnabled: true,
    apiRateLimitPerMin: 1000,
  },
};
