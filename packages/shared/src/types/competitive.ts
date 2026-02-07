// ============================================================
// RetailNexus — Competitive Intelligence Types
// ============================================================

export interface CompetitorPrice {
  id: string;
  ean: string;
  productId: string;
  tenantId: string;
  competitorName: string;
  competitorUrl: string;
  price: number;
  currency: string;
  position: number;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  productId: string;
  tenantId: string;
  oldPrice: number;
  newPrice: number;
  reason: PriceChangeReason;
  competitorReference: string | null;
  marginPercent: number | null;
  createdAt: string;
}

export type PriceChangeReason =
  | "competitive_adjustment"
  | "manual"
  | "rule_change"
  | "margin_floor"
  | "stock_change"
  | "strategy_undercut_winning"
  | "strategy_undercut_applied"
  | "strategy_match_winning"
  | "strategy_match_applied"
  | "strategy_fixed_margin_winning"
  | "strategy_fixed_margin_applied"
  | "margin_floor_enforced"
  | "no_change";

// ============================================================
// Scan Job
// ============================================================

export interface ScanJob {
  id: string;
  tenantId: string;
  storeId: string;
  status: ScanJobStatus;
  totalProducts: number;
  scannedProducts: number;
  errors: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScanJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface ScanResult {
  position: number;
  title: string;
  source: string;
  price: number;
  currency: string;
  link: string;
  thumbnail?: string;
}
