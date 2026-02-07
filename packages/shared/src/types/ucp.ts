// ============================================================
// RetailNexus — UCP Types (Seller Profile, UCP Signal, Google Sync)
// ============================================================

// ─── Seller Profile (Trust Score — Pilar 4 UCP) ───

export interface SellerProfile {
  id: string;
  tenantId: string;
  storeId: string;
  domain: string;
  metrics: SellerMetrics;
  trustScore: number; // 0-100
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerMetrics {
  priceParity: number; // 0-100
  gtinCoverage: number; // 0-100
  uptimeSLA: number; // 0-100
  timeActive: number; // days
  googlePushFrequency: number; // 0-100
  feedbackScore: number; // 0-100
  returnRate: number; // 0-100 (lower is better)
  coreWebVitals: CoreWebVitals;
}

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint (seconds)
  fid: number; // First Input Delay (ms)
  cls: number; // Cumulative Layout Shift
}

// ─── UCP Signal (Cache de dados prontos para UCP) ───

export interface UCPSignal {
  id: string;
  ean: string; // Partition key
  tenantId: string;
  storeId: string;
  productId: string;
  payload: UCPSignalPayload;
  ucpReadinessScore: number;
  trustScore: number;
  isWinningOffer: boolean;
  lastSyncedAt: string;
  ttl: number; // Unix timestamp for TTL
  createdAt: string;
  updatedAt: string;
}

export interface UCPSignalPayload {
  price: number;
  currency: string;
  availability: string;
  stock: number | null;
  url: string;
  lastUpdated: string;
  gtin: string;
  brand: string | null;
  shippingCost: number | null;
  shippingDays: number | null;
  returnDays: number | null;
  sellerName: string;
  sellerDomain: string;
}

// ─── Google Sync Log ───

export interface GoogleSyncLog {
  id: string;
  tenantId: string;
  storeId?: string;
  productId: string;
  action: GoogleSyncAction;
  status: "success" | "error";
  merchantProductId?: string;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  responseTime?: number;
  createdAt: string;
}

export type GoogleSyncAction =
  | "upsert"
  | "delete"
  | "price_update"
  | "availability_update"
  | "full_sync"
  | "indexing_request";

// ─── JSON-LD Types (Schema.org output) ───

export interface SchemaOrgProduct {
  "@context": "https://schema.org/";
  "@type": "Product";
  name: string;
  image?: string;
  description?: string;
  sku: string;
  gtin13?: string;
  brand?: {
    "@type": "Brand";
    name: string;
  };
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: string;
    reviewCount: string;
    bestRating?: string;
  };
  offers: SchemaOrgOffer;
}

export interface SchemaOrgOffer {
  "@type": "Offer";
  url: string;
  priceCurrency: string;
  price: string;
  priceValidUntil?: string;
  availability: string;
  itemCondition?: string;
  shippingDetails?: {
    "@type": "OfferShippingDetails";
    shippingRate: {
      "@type": "MonetaryAmount";
      value: string;
      currency: string;
    };
    deliveryTime?: {
      "@type": "ShippingDeliveryTime";
      transitTime: {
        "@type": "QuantitativeValue";
        minValue: number;
        maxValue: number;
        unitCode: string;
      };
    };
  };
  hasMerchantReturnPolicy?: {
    "@type": "MerchantReturnPolicy";
    applicableCountry: string;
    returnPolicyCategory: string;
    merchantReturnDays: number;
  };
}
