// ============================================================
// RetailNexus — Google Content API for Shopping Service
// (Merchant Center product push)
// ============================================================

import { getConfig } from "../config/env.js";
import { retryWithBackoff, resolveAvailability } from "@retailnexus/shared";
import type { Product, Store, Tenant } from "@retailnexus/shared";

interface GoogleAuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface MerchantProduct {
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  contentLanguage: string;
  targetCountry: string;
  channel: string;
  availability: string;
  condition: string;
  price: { value: string; currency: string };
  brand?: string;
  gtin?: string;
  mpn?: string;
  shippingLabel?: string;
  shipping?: Array<{
    country: string;
    service: string;
    price: { value: string; currency: string };
  }>;
  customAttributes?: Array<{
    name: string;
    value: string;
  }>;
}

export interface MerchantProductStatus {
  productId: string;
  title: string;
  dataQualityIssues?: Array<{
    id: string;
    severity: string;
    detail: string;
  }>;
  destinationStatuses?: Array<{
    destination: string;
    status: string;
    approvedCountries: string[];
    disapprovedCountries: string[];
  }>;
}

export class GoogleContentApiService {
  private merchantId: string;
  private clientEmail: string;
  private privateKey: string;
  private tokenEndpoint = "https://oauth2.googleapis.com/token";
  private baseUrl = "https://shoppingcontent.googleapis.com/content/v2.1";
  private tokenCache: GoogleAuthToken | null = null;

  constructor() {
    const config = getConfig();
    this.merchantId = config.google.merchantId;
    this.clientEmail = config.google.clientEmail;
    this.privateKey = config.google.privateKey;
  }

  // ─── Product Operations ───

  /**
   * Insert or update a product in Merchant Center.
   * Atomic Flow Step 2: Push to Google AFTER store updated.
   */
  async upsertProduct(
    product: Product,
    store: Store,
    tenant: Tenant
  ): Promise<{ productId: string; status: string }> {
    const merchantProduct = this.mapToMerchantProduct(product, store, tenant);
    const token = await this.getAccessToken();

    const response = await retryWithBackoff(
      () =>
        this.request(
          "POST",
          `/${this.merchantId}/products`,
          merchantProduct,
          token
        ),
      { maxRetries: 2, baseDelayMs: 1000 }
    );

    return {
      productId: response.id || `online:pt:BR:${product.externalId}`,
      status: "submitted",
    };
  }

  /**
   * Delete a product from Merchant Center.
   */
  async deleteProduct(offerId: string): Promise<void> {
    const productId = `online:pt:BR:${offerId}`;
    const token = await this.getAccessToken();

    await this.request(
      "DELETE",
      `/${this.merchantId}/products/${encodeURIComponent(productId)}`,
      undefined,
      token
    );
  }

  /**
   * Get product status to check for disapprovals.
   */
  async getProductStatus(
    offerId: string
  ): Promise<MerchantProductStatus | null> {
    const productId = `online:pt:BR:${offerId}`;
    const token = await this.getAccessToken();

    try {
      return await this.request(
        "GET",
        `/${this.merchantId}/productstatuses/${encodeURIComponent(productId)}`,
        undefined,
        token
      );
    } catch {
      return null;
    }
  }

  /**
   * Batch insert/update multiple products (max 10000/batch).
   * Used during store sync.
   */
  async batchUpsert(
    entries: Array<{ product: Product; store: Store; tenant: Tenant }>
  ): Promise<{ inserted: number; errors: number }> {
    const token = await this.getAccessToken();
    let inserted = 0;
    let errors = 0;

    // Google Custom Batch max is 10,000 entries
    const batchSize = 1000;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      const batchBody = {
        entries: batch.map((entry, index) => ({
          batchId: i + index,
          merchantId: this.merchantId,
          method: "insert",
          product: this.mapToMerchantProduct(
            entry.product,
            entry.store,
            entry.tenant
          ),
        })),
      };

      try {
        const result = await retryWithBackoff(
          () =>
            this.request(
              "POST",
              `/products/batch`,
              batchBody,
              token
            ),
          { maxRetries: 1, baseDelayMs: 2000 }
        );

        const batchResponses = (result as any)?.entries || [];
        for (const resp of batchResponses) {
          if (resp.errors && resp.errors.errors?.length > 0) {
            errors++;
          } else {
            inserted++;
          }
        }
      } catch {
        errors += batch.length;
      }
    }

    return { inserted, errors };
  }

  /**
   * List products in Merchant Center for auditing.
   */
  async listProducts(params?: {
    maxResults?: number;
    pageToken?: string;
  }): Promise<{
    products: MerchantProduct[];
    nextPageToken?: string;
  }> {
    const token = await this.getAccessToken();
    const qs = new URLSearchParams();
    if (params?.maxResults) qs.set("maxResults", String(params.maxResults));
    if (params?.pageToken) qs.set("pageToken", params.pageToken);

    const queryStr = qs.toString();
    const path = `/${this.merchantId}/products${queryStr ? `?${queryStr}` : ""}`;

    const result = await this.request("GET", path, undefined, token);
    return {
      products: (result as any)?.resources || [],
      nextPageToken: (result as any)?.nextPageToken,
    };
  }

  // ─── Mapping ───

  private mapToMerchantProduct(
    product: Product,
    store: Store,
    _tenant: Tenant
  ): MerchantProduct {
    const mp: MerchantProduct = {
      offerId: product.externalId,
      title: product.name,
      description: product.description || product.name,
      link: product.url,
      imageLink: product.imageUrl || "",
      contentLanguage: "pt",
      targetCountry: "BR",
      channel: "online",
      availability: resolveAvailability(product.stock),
      condition: product.condition || "new",
      price: {
        value: String(product.price.toFixed(2)),
        currency: "BRL",
      },
    };

    // UCP Trust Pillar: Identity
    if (product.brand) mp.brand = product.brand;
    if (product.gtin) mp.gtin = product.gtin;
    if (product.sku && !product.gtin) mp.mpn = product.sku;

    // UCP Trust Pillar: Fulfillment
    if (product.shipping) {
      mp.shipping = [
        {
          country: "BR",
          service: product.shipping.method || "Standard",
          price: {
            value: String((product.shipping.cost || 0).toFixed(2)),
            currency: "BRL",
          },
        },
      ];
    } else if (store.shippingDefaults) {
      mp.shipping = [
        {
          country: "BR",
          service: store.shippingDefaults.defaultMethod,
          price: {
            value: String(store.shippingDefaults.defaultCost.toFixed(2)),
            currency: "BRL",
          },
        },
      ];
    }

    return mp;
  }

  // ─── Auth ───

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const jwt = await this.createServiceAccountJwt();
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Auth failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  private async createServiceAccountJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: this.clientEmail,
      scope: "https://www.googleapis.com/auth/content",
      aud: this.tokenEndpoint,
      exp: now + 3600,
      iat: now,
    };

    // Use Node's native crypto for JWT signing
    const { createSign } = await import("crypto");

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const signingInput = `${headerB64}.${payloadB64}`;

    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign
      .sign(this.privateKey.replace(/\\n/g, "\n"), "base64url");

    return `${signingInput}.${signature}`;
  }

  // ─── HTTP ───

  private async request(
    method: string,
    path: string,
    body?: unknown,
    token?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return {};

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Content API ${method} ${path} failed: ${response.status} ${errorBody}`
      );
    }

    return response.json();
  }
}

// Singleton
let _instance: GoogleContentApiService | null = null;
export function getGoogleContentApiService(): GoogleContentApiService {
  if (!_instance) _instance = new GoogleContentApiService();
  return _instance;
}
