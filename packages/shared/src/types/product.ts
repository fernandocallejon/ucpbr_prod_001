// ============================================================
// RetailNexus — Product (Produto normalizado — UCP Compliant)
// ============================================================

export interface Product {
  id: string;
  tenantId: string;
  storeId: string;
  externalId: string; // ID na plataforma original

  // ═══ PILAR 1 UCP: IDENTIDADE INEQUÍVOCA ═══
  name: string;
  description?: string;
  sku: string;
  gtin?: string; // GTIN/EAN-13 — essencial para UCP
  brand?: string;
  imageUrl?: string;
  category?: string;
  condition?: ProductCondition;

  // ═══ PILAR 2 UCP: DISPONIBILIDADE REAL ═══
  price: number;
  costPrice?: number;
  compareAtPrice?: number;
  stock: number;
  availability?: ProductAvailability;

  // ═══ PILAR 3 UCP: COMPETITIVIDADE (FRESHNESS) ═══
  pricingRule?: ProductPricingRule;
  competitiveData?: ProductCompetitiveData;

  // ═══ PILAR 4 UCP: EXPERIÊNCIA (SELLER METRICS) ═══
  shipping?: ProductShippingDetails;
  returnPolicy?: ProductReturnPolicy;
  aggregateRating?: ProductAggregateRating;

  // URLs
  url: string;

  // Weight (for shipping calc)
  weight?: number;

  // UCP Readiness
  ucpReadinessScore: number; // 0-100, calculated
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProductCondition = "new" | "used" | "refurbished";

export type ProductAvailability =
  | "in_stock"
  | "out_of_stock"
  | "preorder"
  | "backorder";

export type ProductStatus =
  | "active"
  | "inactive"
  | "paused"
  | "out_of_stock"
  | "no_gtin"
  | "pending_enrichment";

export interface ProductPricingRule {
  strategy: PricingStrategy;
  undercutAmount?: number;
  undercutType?: "absolute" | "percentage";
  minMarginPercent?: number;
  targetMarginPercent?: number;
  maxPrice?: number;
  minPrice?: number;
  enabled?: boolean;
}

export type PricingStrategy =
  | "undercut"
  | "match"
  | "fixed_margin"
  | "manual";

export interface ProductCompetitiveData {
  winningPrice: number | null;
  winningSource?: string;
  competitorCount: number;
  lastScanAt?: string;
  isWinning?: boolean;
}

export interface ProductShippingDetails {
  cost: number; // 0.00 = frete grátis
  currency?: string;
  method?: string;
  transitDays?: number;
  handlingDays?: number;
}

export interface ProductReturnPolicy {
  days: number;
  freeReturn?: boolean;
  method?: "by_mail" | "in_store" | "both";
  policyUrl?: string;
}

export interface ProductAggregateRating {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
}

// ============================================================
// Input DTOs
// ============================================================

export interface UpdatePricingRuleInput {
  strategy?: PricingStrategy;
  undercutAmount?: number;
  undercutType?: "absolute" | "percentage";
  minMarginPercent?: number;
  targetMarginPercent?: number;
  maxPrice?: number;
  minPrice?: number;
  enabled?: boolean;
}

export interface BulkCostCSVRow {
  sku: string;
  costPrice: number;
}

export interface BulkGTINCSVRow {
  sku: string;
  gtin: string;
}
