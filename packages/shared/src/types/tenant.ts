// ============================================================
// RetailNexus — Tenant (Cliente)
// ============================================================

export interface Tenant {
  id: string;
  companyName: string;
  email: string;
  passwordHash: string;
  cnpj?: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  billing?: TenantBilling;
  storeCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TenantPlan = "basic" | "pro" | "enterprise";
export type TenantStatus = "active" | "suspended" | "trial";

export interface TenantSettings {
  scanIntervalMinutes: number;
  autoRepricingEnabled: boolean;
  defaultPricingStrategy: string;
  notificationsEnabled: boolean;
  timezone: string; // "America/Sao_Paulo"
  googleMerchantCenter?: GoogleMerchantCenterConfig;
}

export interface GoogleMerchantCenterConfig {
  accountId: string | null;
  connected: boolean;
  lastSyncAt: string | null;
}

export interface TenantBilling {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  status?: string;
}

// ============================================================
// Input DTOs
// ============================================================

export interface CreateTenantInput {
  companyName: string;
  email: string;
  password: string;
  cnpj?: string;
  plan: TenantPlan;
}

export interface UpdateTenantInput {
  companyName?: string;
  plan?: TenantPlan;
  status?: TenantStatus;
  settings?: Partial<TenantSettings>;
}
