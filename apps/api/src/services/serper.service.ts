// ============================================================
// RetailNexus — Serper API Integration Service
// (Google Shopping Intelligence)
// ============================================================

import { getConfig } from "../config/env.js";
import { retryWithBackoff } from "@retailnexus/shared";
import type { ScanResult } from "@retailnexus/shared";

export interface SerperShoppingResult {
  title: string;
  source: string;
  link: string;
  price: string;
  delivery?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  position: number;
}

export interface SerperResponse {
  searchParameters: {
    q: string;
    type: string;
    engine: string;
  };
  shopping?: SerperShoppingResult[];
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
  credits: number;
}

export class SerperService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.serper.apiKey;
    this.baseUrl = config.serper.baseUrl;
  }

  /**
   * Search Google Shopping for competitive prices.
   * Uses EAN for exact product matching when available.
   */
  async searchShopping(params: {
    query: string;
    country?: string;
    language?: string;
    numResults?: number;
  }): Promise<ScanResult[]> {
    const { query, country = "br", language = "pt-br", numResults = 20 } = params;

    const response = await retryWithBackoff(
      () =>
        this.request("/shopping", {
          q: query,
          gl: country,
          hl: language,
          num: numResults,
        }),
      { maxRetries: 2, baseDelayMs: 2000 }
    );

    if (!response.shopping) return [];

    return response.shopping.map((item) => ({
      position: item.position,
      title: item.title,
      source: item.source,
      price: parsePrice(item.price),
      currency: "BRL",
      link: item.link,
      thumbnail: item.imageUrl,
    }));
  }

  /**
   * Build optimized query for a product.
   * Priority: EAN search > Name + Brand search
   */
  buildQuery(params: {
    ean?: string;
    name: string;
    brand?: string;
  }): string {
    const { ean, name, brand } = params;

    // If EAN is available, use it for exact matching
    if (ean && ean.length === 13) {
      return `comprar ${ean}`;
    }

    // Fallback: name + brand
    const parts = ["comprar"];
    if (brand) parts.push(brand);
    parts.push(name);
    return parts.join(" ");
  }

  /**
   * Analyze scan results and find the winning price.
   */
  analyzeResults(
    results: ScanResult[],
    clientStoreUrl?: string
  ): {
    winningPrice: number | null;
    winningSource: string | null;
    clientPosition: number | null;
    competitorCount: number;
  } {
    if (results.length === 0) {
      return {
        winningPrice: null,
        winningSource: null,
        clientPosition: null,
        competitorCount: 0,
      };
    }

    // Sort by price ascending
    const sortedByPrice = [...results]
      .filter((r) => r.price > 0)
      .sort((a, b) => a.price - b.price);

    const winningPrice = sortedByPrice[0]?.price || null;
    const winningSource = sortedByPrice[0]?.source || null;

    // Find client position if store URL is provided
    let clientPosition: number | null = null;
    if (clientStoreUrl) {
      const clientResult = results.find((r) =>
        r.link.includes(clientStoreUrl.replace(/^https?:\/\//, ""))
      );
      clientPosition = clientResult?.position || null;
    }

    return {
      winningPrice,
      winningSource,
      clientPosition,
      competitorCount: results.length,
    };
  }

  // ─── HTTP ───

  private async request(
    path: string,
    body: Record<string, unknown>
  ): Promise<SerperResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Serper API ${path} failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<SerperResponse>;
  }
}

/**
 * Parse price string (e.g., "R$ 4.899,00") to number.
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;

  // Remove currency symbol and spaces
  let cleaned = priceStr
    .replace(/[^\d.,]/g, "")
    .trim();

  // Handle Brazilian format: 4.899,00 -> 4899.00
  if (cleaned.includes(",")) {
    // Remove thousand separators (dots before comma)
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

// Singleton
let _instance: SerperService | null = null;
export function getSerperService(): SerperService {
  if (!_instance) _instance = new SerperService();
  return _instance;
}
