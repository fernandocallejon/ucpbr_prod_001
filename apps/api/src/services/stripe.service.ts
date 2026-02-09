// ============================================================
// RetailNexus — Stripe Billing Service
// Subscription management, usage metering, webhooks
// ============================================================

import { getConfig } from "../config/env.js";
import { retryWithBackoff } from "@retailnexus/shared";

export interface CreateCheckoutParams {
  tenantId: string;
  email: string;
  plan: "basic" | "pro" | "enterprise";
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  status: string;
  plan: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export class StripeService {
  private apiKey: string;
  private webhookSecret: string;
  private baseUrl = "https://api.stripe.com/v1";

  // Price IDs — read from env or Stripe Dashboard
  private priceIds: Record<string, string>;

  constructor() {
    const config = getConfig();
    this.apiKey = config.stripe.secretKey;
    this.webhookSecret = config.stripe.webhookSecret;
    this.priceIds = {
      basic: config.stripe.priceIdBasic || "",
      pro: config.stripe.priceIdPro || "",
      enterprise: config.stripe.priceIdEnterprise || "",
    };
  }

  /**
   * Create a Stripe Checkout Session for subscription.
   */
  async createCheckoutSession(
    params: CreateCheckoutParams
  ): Promise<{ sessionId: string; url: string }> {
    const priceId = this.priceIds[params.plan];
    if (!priceId) throw new Error(`Unknown plan: ${params.plan}`);

    const body = new URLSearchParams({
      "mode": "subscription",
      "customer_email": params.email,
      "success_url": params.successUrl,
      "cancel_url": params.cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[tenantId]": params.tenantId,
      "metadata[plan]": params.plan,
      "subscription_data[metadata][tenantId]": params.tenantId,
      "subscription_data[metadata][plan]": params.plan,
    });

    const result = await this.request("POST", "/checkout/sessions", body);

    return {
      sessionId: result.id,
      url: result.url,
    };
  }

  /**
   * Get subscription details for a customer.
   */
  async getSubscription(
    subscriptionId: string
  ): Promise<SubscriptionInfo | null> {
    try {
      const result = await this.request(
        "GET",
        `/subscriptions/${subscriptionId}`
      );

      return {
        subscriptionId: result.id,
        status: result.status,
        plan: result.metadata?.plan || "unknown",
        currentPeriodEnd: new Date(
          result.current_period_end * 1000
        ).toISOString(),
        cancelAtPeriodEnd: result.cancel_at_period_end,
      };
    } catch {
      return null;
    }
  }

  /**
   * Cancel a subscription at period end.
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(
      "POST",
      `/subscriptions/${subscriptionId}`,
      new URLSearchParams({ cancel_at_period_end: "true" })
    );
  }

  /**
   * Resume a cancelled subscription.
   */
  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.request(
      "POST",
      `/subscriptions/${subscriptionId}`,
      new URLSearchParams({ cancel_at_period_end: "false" })
    );
  }

  /**
   * Create a billing portal session for self-serve management.
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    const body = new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    });

    const result = await this.request(
      "POST",
      "/billing_portal/sessions",
      body
    );

    return { url: result.url };
  }

  /**
   * List invoices for a customer.
   */
  async listInvoices(customerId: string): Promise<any[]> {
    try {
      const result = await this.request(
        "GET",
        `/invoices?customer=${encodeURIComponent(customerId)}&limit=20`
      );

      return (result.data || []).map((inv: any) => ({
        id: inv.id,
        number: inv.number || inv.id,
        amount: (inv.amount_paid || inv.total || 0) / 100,
        status: inv.status === "paid" ? "paid" : inv.status === "void" ? "void" : "open",
        date: new Date((inv.created || 0) * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create or get Stripe Customer for a tenant.
   */
  async getOrCreateCustomer(
    email: string,
    name: string,
    metadata: Record<string, string>
  ): Promise<{ customerId: string }> {
    // Search for existing customer
    const search = await this.request(
      "GET",
      `/customers?email=${encodeURIComponent(email)}&limit=1`
    );

    if (search.data?.length > 0) {
      return { customerId: search.data[0].id };
    }

    // Create new customer
    const body = new URLSearchParams({
      email,
      name,
      ...Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])
      ),
    });

    const customer = await this.request("POST", "/customers", body);
    return { customerId: customer.id };
  }

  /**
   * Verify Stripe webhook signature.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): { valid: boolean; event?: any } {
    try {
      // Stripe signature verification using timing-safe comparison
      const { createHmac, timingSafeEqual } = require("crypto");

      const parts = signature.split(",").reduce(
        (acc: Record<string, string>, part: string) => {
          const [key, value] = part.split("=");
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      );

      const timestamp = parts["t"];
      const expectedSig = parts["v1"];

      if (!timestamp || !expectedSig) {
        return { valid: false };
      }

      // Check tolerance (5 min)
      const tolerance = 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > tolerance) {
        return { valid: false };
      }

      const signedPayload = `${timestamp}.${payload}`;
      const hmac = createHmac("sha256", this.webhookSecret)
        .update(signedPayload)
        .digest("hex");

      const isValid = timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(expectedSig)
      );

      if (!isValid) return { valid: false };

      return { valid: true, event: JSON.parse(payload) };
    } catch {
      return { valid: false };
    }
  }

  // ─── HTTP ───

  private async request(
    method: string,
    path: string,
    body?: URLSearchParams
  ): Promise<any> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body?.toString(),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(
            `Stripe ${method} ${path} failed: ${res.status} ${errorBody}`
          );
        }

        return res.json();
      },
      { maxRetries: 2, baseDelayMs: 1000 }
    );

    return response;
  }
}

// Singleton
let _instance: StripeService | null = null;
export function getStripeService(): StripeService {
  if (!_instance) _instance = new StripeService();
  return _instance;
}
