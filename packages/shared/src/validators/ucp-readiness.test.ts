// ============================================================
// RetailNexus — UCP Readiness Score Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { calculateUCPReadinessScore } from "../validators/ucp-readiness.js";
import type { Product } from "../types/product.js";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    tenantId: "t-1",
    storeId: "s-1",
    externalId: "ext-1",
    name: "iPhone 15 Pro Max 256GB - Preto",
    description: "Apple iPhone 15 Pro Max com 256GB de armazenamento. Câmera 48MP, chip A17 Pro.",
    gtin: "0194253938897",
    sku: "IPHONE15PM-256-BLK",
    brand: "Apple",
    price: 8999.00,
    costPrice: 7200.00,
    availability: "in_stock",
    stock: 42,
    url: "https://loja.com/iphone-15-pro-max",
    imageUrl: "https://loja.com/images/iphone15pm.jpg",
    shipping: {
      cost: 0,
      method: "PAC",
      transitDays: 5,
    },
    returnPolicy: {
      days: 30,
      freeReturn: true,
    },
    status: "active",
    ucpReadinessScore: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-02-07T00:00:00Z",
    ...overrides,
  };
}

describe("calculateUCPReadinessScore", () => {
  it("returns score=100 for a fully complete product", () => {
    const product = makeProduct();
    const result = calculateUCPReadinessScore(product);

    expect(result.score).toBe(100);
    expect(result.level).toBe("ready");
    expect(result.missingFields).toHaveLength(0);
    expect(result.factors.every((f) => f.passed)).toBe(true);
  });

  it("returns 0 GTIN points when gtin is missing", () => {
    const product = makeProduct({ gtin: undefined });
    const result = calculateUCPReadinessScore(product);

    expect(result.score).toBeLessThan(100);
    expect(result.missingFields).toContain("gtin");
    const gtinFactor = result.factors.find((f) => f.name === "gtin");
    expect(gtinFactor?.earned).toBe(0);
    expect(gtinFactor?.passed).toBe(false);
  });

  it("returns 0 price points when price is 0", () => {
    const product = makeProduct({ price: 0 });
    const result = calculateUCPReadinessScore(product);

    expect(result.missingFields).toContain("price");
    const priceFactor = result.factors.find((f) => f.name === "price");
    expect(priceFactor?.earned).toBe(0);
  });

  it("returns 0 shipping points when shipping is missing", () => {
    const product = makeProduct({ shipping: undefined });
    const result = calculateUCPReadinessScore(product);

    expect(result.missingFields).toContain("shipping");
  });

  it("returns 0 return policy points when returnPolicy is missing", () => {
    const product = makeProduct({ returnPolicy: undefined });
    const result = calculateUCPReadinessScore(product);

    expect(result.missingFields).toContain("returnPolicy");
  });

  it("returns 'not_eligible' when score < 50", () => {
    const product = makeProduct({
      gtin: undefined,
      price: 0,
      availability: "out_of_stock",
      shipping: undefined,
      returnPolicy: undefined,
      brand: undefined,
      description: "short",
      stock: 0,
    });
    const result = calculateUCPReadinessScore(product);

    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe("not_eligible");
  });

  it("returns 'almost' when score is between 50-89", () => {
    // Has GTIN + price + availability but missing shipping and return
    const product = makeProduct({
      shipping: undefined,
      returnPolicy: undefined,
      brand: undefined,
      description: "x",
    });
    const result = calculateUCPReadinessScore(product);

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(90);
    expect(result.level).toBe("almost");
  });
});
