// ============================================================
// RetailNexus — API2Cart Integration Service
// ============================================================

import { getConfig } from "../config/env.js";
import { retryWithBackoff } from "@retailnexus/shared";

export interface Api2CartProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  description?: string;
  weight?: number;
  images?: Array<{ http_path: string }>;
  categories_ids?: string[];
  // EAN/GTIN fields vary by platform
  u_upc?: string;
  u_ean?: string;
  barcode?: string;
  gtin?: string;
  // Cost
  cost_price?: number;
  // Metadata
  created_at?: string;
  modified_at?: string;
}

export interface Api2CartWebhook {
  id: number;
  entity: string;
  action: string;
  url: string;
}

export class Api2CartService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.api2cart.apiKey;
    this.baseUrl = config.api2cart.baseUrl;
  }

  // ─── Store Connection ───

  /**
   * Create a store (cart) connection in API2Cart.
   */
  async createConnection(params: {
    cartType: string;
    storeUrl: string;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
  }): Promise<{ store_key: string }> {
    return this.post("cart.create.json", {
      cart_id: params.cartType,
      store_url: params.storeUrl,
      api_key: params.apiKey,
      api_secret: params.apiSecret,
      access_token: params.accessToken,
    });
  }

  /**
   * Delete a store connection.
   */
  async deleteConnection(storeKey: string): Promise<void> {
    await this.post("cart.delete.json", { store_key: storeKey });
  }

  /**
   * Get a Bridge connection from API2Cart.
   * This creates the connection immediately and returns:
   * - store_key: the connection key for API calls
   * - bridge: URL to download the bridge connector file
   *   (needed for self-hosted platforms like WooCommerce, Magento, OpenCart)
   *
   * For SaaS platforms (Shopify, Nuvemshop), credentials are still needed
   * via cart.create.json for full data access.
   *
   * @see https://docs.api2cart.com/#cart-bridge
   */
  async getBridgeConnection(params: {
    cartType: string;
    storeUrl: string;
    bridgeUrl?: string;
    storeName?: string;
  }): Promise<{ store_key: string; bridge_url: string }> {
    const result = await this.post("cart.bridge.json", {
      cart_id: params.cartType,
      store_url: params.storeUrl,
      bridge_url: params.bridgeUrl,
      store_name: params.storeName,
    });
    return {
      store_key: result?.store_key || "",
      bridge_url: result?.bridge || "",
    };
  }

  /**
   * Validate that a store_key is valid and the connection is active.
   */
  async validateConnection(storeKey: string): Promise<{
    cart_id: string;
    store_url: string;
    store_name?: string;
  }> {
    return this.get("cart.info.json", { store_key: storeKey });
  }

  // ─── Products ───

  /**
   * List all products from a connected store.
   */
  async listProducts(
    storeKey: string,
    params: { start?: number; count?: number } = {}
  ): Promise<{ total_count: number; product: Api2CartProduct[] }> {
    return this.get("product.list.json", {
      store_key: storeKey,
      start: params.start?.toString() || "0",
      count: params.count?.toString() || "250",
      params: "id,name,sku,price,quantity,description,images,categories_ids,u_upc,u_ean,barcode,gtin,cost_price,created_at,modified_at",
    });
  }

  /**
   * Get a single product by ID.
   */
  async getProduct(
    storeKey: string,
    productId: string
  ): Promise<Api2CartProduct> {
    const data = await this.get("product.info.json", {
      store_key: storeKey,
      id: productId,
      params: "id,name,sku,price,quantity,description,images,u_upc,u_ean,barcode,gtin,cost_price",
    });
    return data.result;
  }

  /**
   * Update product price on the store.
   * This is STEP 1 of the Atomic Flow.
   */
  async updateProductPrice(
    storeKey: string,
    productId: string,
    price: number
  ): Promise<void> {
    await retryWithBackoff(
      () =>
        this.put("product.update.json", {
          store_key: storeKey,
          id: productId,
          price: price.toString(),
        }),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }

  /**
   * Update product quantity on the store.
   */
  async updateProductQuantity(
    storeKey: string,
    productId: string,
    quantity: number
  ): Promise<void> {
    await this.put("product.update.json", {
      store_key: storeKey,
      id: productId,
      quantity: quantity.toString(),
    });
  }

  // ─── Webhooks ───

  /**
   * Register a webhook for product updates.
   */
  async registerWebhook(
    storeKey: string,
    callbackUrl: string,
    entity = "product",
    action = "update"
  ): Promise<{ id: number }> {
    return this.post("webhook.create.json", {
      store_key: storeKey,
      entity,
      action,
      callback: callbackUrl,
    });
  }

  /**
   * List registered webhooks.
   */
  async listWebhooks(storeKey: string): Promise<Api2CartWebhook[]> {
    const data = await this.get("webhook.list.json", {
      store_key: storeKey,
    });
    return data.result || [];
  }

  /**
   * Delete a webhook.
   */
  async deleteWebhook(storeKey: string, webhookId: number): Promise<void> {
    await this.post("webhook.delete.json", {
      store_key: storeKey,
      id: webhookId.toString(),
    });
  }

  // ─── HTTP Helpers ───

  private async get(
    path: string,
    params: Record<string, string>
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/${path}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `API2Cart GET ${path} failed: ${response.status} ${response.statusText}`
      );
    }

    const json = (await response.json()) as { return_code: number; return_message?: string; result: any };
    if (json.return_code !== 0) {
      throw new Error(
        `API2Cart error: ${json.return_message || "Unknown error"}`
      );
    }
    return json.result;
  }

  private async post(
    path: string,
    data: Record<string, string | undefined>
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/${path}`);

    const body = new URLSearchParams();
    body.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(data)) {
      if (value) body.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `API2Cart POST ${path} failed: ${response.status} ${response.statusText}`
      );
    }

    const json = (await response.json()) as { return_code: number; return_message?: string; result: any };
    if (json.return_code !== 0) {
      throw new Error(
        `API2Cart error: ${json.return_message || "Unknown error"}`
      );
    }
    return json.result;
  }

  private async put(
    path: string,
    data: Record<string, string | undefined>
  ): Promise<any> {
    return this.post(path, data); // API2Cart uses POST for updates
  }
}

/**
 * Extract GTIN from API2Cart product (varies by platform).
 */
export function extractGTIN(product: Api2CartProduct): string {
  return (
    product.gtin ||
    product.u_ean ||
    product.u_upc ||
    product.barcode ||
    ""
  );
}

/**
 * Map API2Cart cart type to our StorePlatform.
 */
export function mapPlatform(
  cartType: string
): "shopify" | "woocommerce" | "vtex" | "magento" | "custom" {
  const map: Record<string, string> = {
    Shopify: "shopify",
    WooCommerce: "woocommerce",
    VTEX: "vtex",
    Magento: "magento",
    Magento2: "magento",
  };
  return (map[cartType] as any) || "custom";
}

// Singleton
let _instance: Api2CartService | null = null;
export function getApi2CartService(): Api2CartService {
  if (!_instance) _instance = new Api2CartService();
  return _instance;
}
