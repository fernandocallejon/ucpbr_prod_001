// ============================================================
// RetailNexus — Shared Constants
// ============================================================

// ─── Cosmos DB Container Names ───
export const COSMOS_CONTAINERS = {
  TENANTS: "tenants",
  STORES: "stores",
  PRODUCTS: "products",
  PRICE_HISTORY: "price-history",
  COMPETITOR_PRICES: "competitor-prices",
  SCAN_JOBS: "scan-jobs",
  PRICING_RULES: "pricing-rules",
  AUDIT_LOG: "audit-log",
  SYSTEM_CONFIG: "system-config",
  SELLER_PROFILES: "seller-profiles",
  UCP_SIGNALS: "ucp-signals",
  GOOGLE_SYNC_LOG: "google-sync-log",
} as const;

// ─── Service Bus Queue Names ───
export const SERVICE_BUS_QUEUES = {
  SCAN_REQUESTS: "scan-requests",
  PRICE_CALCULATIONS: "price-calculations",
  GOOGLE_PUSH: "google-push",
  STORE_SYNC: "store-sync",
} as const;

// ─── Cache Keys ───
export const CACHE_KEYS = {
  UCP_SIGNAL: (ean: string) => `ucp:signal:${ean}`,
  PRODUCT_PRICE: (productId: string) => `product:price:${productId}`,
  SELLER_SCORE: (tenantId: string) => `seller:score:${tenantId}`,
  SCAN_RESULT: (ean: string) => `scan:result:${ean}`,
  TENANT_CONFIG: (tenantId: string) => `tenant:config:${tenantId}`,
} as const;

// ─── API Routes ───
export const API_ROUTES = {
  // Auth
  AUTH_REGISTER: "/api/auth/register",
  AUTH_LOGIN: "/api/auth/login",
  AUTH_CALLBACK: "/api/auth/callback/:provider",

  // Stores
  STORES_CONNECT: "/api/stores/connect",
  STORES_LIST: "/api/stores",
  STORES_DISCONNECT: "/api/stores/:storeId",
  STORES_SYNC: "/api/stores/:storeId/sync",
  STORES_SHIPPING: "/api/stores/:storeId/shipping",
  STORES_RETURN_POLICY: "/api/stores/:storeId/return-policy",
  WEBHOOK_API2CART: "/api/webhooks/api2cart",

  // Products
  PRODUCTS_LIST: "/api/products",
  PRODUCTS_GET: "/api/products/:productId",
  PRODUCTS_UPDATE_COST: "/api/products/:productId/cost",
  PRODUCTS_UPLOAD_COSTS_CSV: "/api/products/costs/csv",
  PRODUCTS_PRICING_RULE: "/api/products/:productId/pricing-rule",
  PRODUCTS_GTIN_VALIDATE: "/api/products/:productId/gtin",
  PRODUCTS_GTIN_BULK: "/api/products/gtin/csv",
  PRODUCTS_UCP_SCORE: "/api/products/:productId/ucp-score",

  // Scanning
  SCAN_TRIGGER: "/api/scan/trigger",

  // Pricing
  PRICE_HISTORY: "/api/products/:productId/price-history",

  // Google
  GOOGLE_MERCHANT_CONNECT: "/api/google/merchant/connect",
  GOOGLE_MERCHANT_CALLBACK: "/api/google/merchant/callback",
  GOOGLE_SYNC_STATUS: "/api/google/sync-status",
  GOOGLE_SYNC_LOG: "/api/google/sync-log",

  // UCP
  UCP_OFFERS: "/api/ucp/offers/:ean",
  UCP_JSONLD: "/api/ucp/jsonld/:ean",
  UCP_EMBED: "/api/ucp/embed/:storeId/:ean",
  UCP_MCP: "/api/ucp/mcp",
  UCP_SELLER_SCORE: "/api/ucp/seller/:tenantId/score",
  UCP_HEALTH: "/api/ucp/health/:tenantId",

  // Admin
  ADMIN_TENANTS: "/api/admin/tenants",
  ADMIN_HEALTH: "/api/admin/health",
  ADMIN_GLOBAL_RULES: "/api/admin/global-rules",
  ADMIN_QUOTAS: "/api/admin/quotas",
  ADMIN_GOOGLE_OVERVIEW: "/api/admin/google/overview",
  ADMIN_UCP_COMPLIANCE: "/api/admin/ucp/compliance",

  // Billing
  BILLING_WEBHOOK: "/api/billing/webhook",
  BILLING_CHECKOUT: "/api/billing/checkout",
  BILLING_PORTAL: "/api/billing/portal",
} as const;

// ─── UCP Thresholds ───
export const UCP_THRESHOLDS = {
  READINESS_READY: 90,
  READINESS_ALMOST: 60,
  PARITY_BAN_THRESHOLD: 0.99, // Below 99% parity = risk
  TRUST_SCORE_EXCELLENT: 85,
  TRUST_SCORE_GOOD: 70,
  TRUST_SCORE_FAIR: 50,
  MIN_DESCRIPTION_LENGTH: 50,
  MAX_PRICE_DROP_PERCENT: 50, // Circuit breaker
} as const;
