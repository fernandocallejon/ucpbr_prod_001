// ============================================================
// RetailNexus — Store (Loja conectada)
// ============================================================

export interface Store {
  id: string;
  tenantId: string;
  platform: StorePlatform;
  name: string;
  url: string;
  api2cartStoreKey: string;
  syncStatus: StoreSyncStatus;
  lastSyncAt: string | null;
  productCount: number;
  // UCP: Shipping & Return defaults
  shippingDefaults?: StoreShippingDefaults;
  returnPolicy?: StoreReturnPolicy;
  createdAt: string;
  updatedAt: string;
}

export type StorePlatform =
  | "shopify"
  | "woocommerce"
  | "vtex"
  | "magento"
  | "nuvemshop"
  | "tray"
  | "loja_integrada"
  | "opencart"
  | "other";

export type StoreSyncStatus =
  | "pending"
  | "syncing"
  | "active"
  | "error";

export interface StoreShippingDefaults {
  defaultCost: number;
  defaultMethod: string;
  freeShippingThreshold?: number;
  defaultTransitDays?: number;
}

export interface StoreReturnPolicy {
  days: number;
  freeReturn: boolean;
  policyUrl?: string;
}

// ============================================================
// Input DTOs
// ============================================================

export interface ConnectStoreInput {
  platform: StorePlatform;
  name: string;
  url: string;
  api2cartStoreKey: string;
  shippingDefaults?: StoreShippingDefaults;
  returnPolicy?: StoreReturnPolicy;
}

export interface UpdateStoreShippingInput {
  defaultCost?: number;
  defaultMethod?: string;
  freeShippingThreshold?: number;
  defaultTransitDays?: number;
}

export interface UpdateStoreReturnPolicyInput {
  days?: number;
  freeReturn?: boolean;
  policyUrl?: string;
}
