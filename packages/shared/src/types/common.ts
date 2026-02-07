// ============================================================
// RetailNexus — Common / API Types
// ============================================================

// ─── API Response Envelope ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

// ─── Pagination ───

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Auth ───

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

export type UserRole = "admin" | "user" | "root";

export interface JwtPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ─── Service Bus Messages ───

export interface ScanRequestMessage {
  tenantId: string;
  productId: string;
  ean: string;
  productName: string;
  brandName: string;
  priority: "high" | "normal" | "low";
}

export interface PriceCalculationMessage {
  tenantId: string;
  productId: string;
  storeId: string;
  currentPrice: number;
  costPrice: number | null;
  winningPrice: number;
  winningSource: string;
  pricingRule: {
    minMarginPercent: number;
    maxPrice: number | null;
    minPrice: number | null;
    strategy: string;
  };
}

export interface GooglePushMessage {
  tenantId: string;
  productId: string;
  storeId: string;
  action: "price_update" | "availability_update" | "full_sync";
  productData: Record<string, unknown>;
}
