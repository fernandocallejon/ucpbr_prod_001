// ============================================================
// RetailNexus — Google Indexing API Service
// (URL_UPDATED push for price/stock changes)
// ============================================================

import { getConfig } from "../config/env.js";
import { retryWithBackoff, sleep } from "@retailnexus/shared";

export type IndexingAction = "URL_UPDATED" | "URL_DELETED";

export interface IndexingResult {
  url: string;
  action: IndexingAction;
  success: boolean;
  error?: string;
  latestUpdate?: {
    url: string;
    type: string;
    notifyTime: string;
  };
}

export class GoogleIndexingApiService {
  private clientEmail: string;
  private privateKey: string;
  private tokenEndpoint = "https://oauth2.googleapis.com/token";
  private baseUrl = "https://indexing.googleapis.com/v3";
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;

  // Daily quota: Google allows ~200 indexing requests/day
  private dailyQuota: number;
  private requestsToday = 0;
  private quotaResetTime = 0;

  constructor() {
    const config = getConfig();
    this.clientEmail = config.google.clientEmail;
    this.privateKey = config.google.privateKey;
    this.dailyQuota = config.google.indexingQuotaPerDay;
  }

  /**
   * Notify Google that a URL has been updated.
   * Used after Atomic Flow Step 2 (Google push).
   */
  async notifyUrlUpdated(url: string): Promise<IndexingResult> {
    return this.notify(url, "URL_UPDATED");
  }

  /**
   * Notify Google that a URL has been deleted.
   */
  async notifyUrlDeleted(url: string): Promise<IndexingResult> {
    return this.notify(url, "URL_DELETED");
  }

  /**
   * Batch notify multiple URLs. Respects daily quota.
   * Prioritizes by priceDelta (bigger delta = higher priority).
   */
  async batchNotify(
    items: Array<{ url: string; priceDelta?: number }>,
    action: IndexingAction = "URL_UPDATED"
  ): Promise<{
    results: IndexingResult[];
    skipped: number;
    quotaRemaining: number;
  }> {
    this.resetQuotaIfNeeded();

    // Sort by price delta descending (biggest changes first)
    const sorted = [...items].sort(
      (a, b) => Math.abs(b.priceDelta || 0) - Math.abs(a.priceDelta || 0)
    );

    const remaining = this.dailyQuota - this.requestsToday;
    const toProcess = sorted.slice(0, remaining);
    const skipped = sorted.length - toProcess.length;

    const results: IndexingResult[] = [];

    for (const item of toProcess) {
      const result = await this.notify(item.url, action);
      results.push(result);

      // Rate limiting: ~5 requests per second
      await sleep(200);
    }

    return {
      results,
      skipped,
      quotaRemaining: this.dailyQuota - this.requestsToday,
    };
  }

  /**
   * Get the indexing status of a URL.
   */
  async getUrlStatus(url: string): Promise<{
    url: string;
    latestUpdate?: { type: string; notifyTime: string };
    latestRemove?: { type: string; notifyTime: string };
  } | null> {
    const token = await this.getAccessToken();

    try {
      const response = await fetch(
        `${this.baseUrl}/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) return null;
      return response.json() as any;
    } catch {
      return null;
    }
  }

  /**
   * Check remaining quota for today.
   */
  getQuotaStatus(): { used: number; remaining: number; total: number } {
    this.resetQuotaIfNeeded();
    return {
      used: this.requestsToday,
      remaining: this.dailyQuota - this.requestsToday,
      total: this.dailyQuota,
    };
  }

  // ─── Internal ───

  private async notify(
    url: string,
    action: IndexingAction
  ): Promise<IndexingResult> {
    this.resetQuotaIfNeeded();

    if (this.requestsToday >= this.dailyQuota) {
      return {
        url,
        action,
        success: false,
        error: "Daily quota exceeded",
      };
    }

    const token = await this.getAccessToken();

    try {
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(
            `${this.baseUrl}/urlNotifications:publish`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ url, type: action }),
            }
          );

          if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`Indexing API failed: ${res.status} ${errorBody}`);
          }

          return res.json();
        },
        { maxRetries: 2, baseDelayMs: 1000 }
      );

      this.requestsToday++;

      return {
        url,
        action,
        success: true,
        latestUpdate: (response as any)?.urlNotificationMetadata?.latestUpdate,
      };
    } catch (err: any) {
      return {
        url,
        action,
        success: false,
        error: err.message,
      };
    }
  }

  private resetQuotaIfNeeded(): void {
    const now = Date.now();
    if (now > this.quotaResetTime) {
      this.requestsToday = 0;
      // Reset at midnight UTC
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      this.quotaResetTime = tomorrow.getTime();
    }
  }

  // ─── Auth (same as Content API — Service Account JWT) ───

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
      scope: "https://www.googleapis.com/auth/indexing",
      aud: this.tokenEndpoint,
      exp: now + 3600,
      iat: now,
    };

    const { createSign } = await import("crypto");

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const signingInput = `${headerB64}.${payloadB64}`;

    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(
      this.privateKey.replace(/\\n/g, "\n"),
      "base64url"
    );

    return `${signingInput}.${signature}`;
  }
}

// Singleton
let _instance: GoogleIndexingApiService | null = null;
export function getGoogleIndexingApiService(): GoogleIndexingApiService {
  if (!_instance) _instance = new GoogleIndexingApiService();
  return _instance;
}
