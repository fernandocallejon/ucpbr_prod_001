// ============================================================
// RetailNexus — UCP Readiness Score Calculator
// ============================================================

import type { Product } from "../types/product.js";

export interface UCPReadinessBreakdown {
  score: number; // 0-100
  level: "ready" | "almost" | "not_eligible";
  factors: UCPReadinessFactor[];
  missingFields: string[];
}

export interface UCPReadinessFactor {
  name: string;
  weight: number;
  earned: number;
  passed: boolean;
  message: string;
}

/**
 * Calculates the UCP Readiness Score for a product.
 * Score is 0-100, based on completeness of data required by the UCP.
 *
 * Scoring weights:
 *   gtin valid              = 25
 *   price > 0               = 20
 *   availability synced     = 15
 *   shipping details        = 15
 *   returnPolicy            = 10
 *   brand structured        = 5
 *   description (>50 chars) = 5
 *   stock info              = 5
 */
export function calculateUCPReadinessScore(
  product: Product
): UCPReadinessBreakdown {
  const factors: UCPReadinessFactor[] = [];
  const missingFields: string[] = [];

  // 1. GTIN (25 points)
  const hasGTIN = !!product.gtin && product.gtin.length >= 8;
  factors.push({
    name: "gtin",
    weight: 25,
    earned: hasGTIN ? 25 : 0,
    passed: hasGTIN,
    message: hasGTIN
      ? "GTIN válido"
      : "GTIN ausente ou inválido — produto invisível para UCP",
  });
  if (!hasGTIN) missingFields.push("gtin");

  // 2. Price (20 points)
  const hasPrice = product.price > 0;
  factors.push({
    name: "price",
    weight: 20,
    earned: hasPrice ? 20 : 0,
    passed: hasPrice,
    message: hasPrice
      ? `Preço R$${product.price.toFixed(2)}`
      : "Preço zerado ou inválido",
  });
  if (!hasPrice) missingFields.push("price");

  // 3. Availability (15 points)
  const hasAvailability =
    !!product.availability && product.availability !== "out_of_stock";
  factors.push({
    name: "availability",
    weight: 15,
    earned: hasAvailability ? 15 : 0,
    passed: hasAvailability,
    message: hasAvailability
      ? `Disponibilidade: ${product.availability}`
      : "Produto fora de estoque ou sem info de disponibilidade",
  });
  if (!hasAvailability) missingFields.push("availability");

  // 4. Shipping Details (15 points)
  const hasShipping = !!product.shipping && product.shipping.cost >= 0;
  factors.push({
    name: "shipping",
    weight: 15,
    earned: hasShipping ? 15 : 0,
    passed: hasShipping,
    message: hasShipping
      ? `Frete: R$${product.shipping!.cost.toFixed(2)}, entrega ${product.shipping!.transitDays ?? "?"}d`
      : "Dados de frete ausentes",
  });
  if (!hasShipping) missingFields.push("shipping");

  // 5. Return Policy (10 points)
  const hasReturn = !!product.returnPolicy && product.returnPolicy.days > 0;
  factors.push({
    name: "returnPolicy",
    weight: 10,
    earned: hasReturn ? 10 : 0,
    passed: hasReturn,
    message: hasReturn
      ? `Devolução: ${product.returnPolicy!.days} dias`
      : "Política de devolução não configurada",
  });
  if (!hasReturn) missingFields.push("returnPolicy");

  // 6. Brand (5 points)
  const hasBrand = !!product.brand?.trim();
  factors.push({
    name: "brand",
    weight: 5,
    earned: hasBrand ? 5 : 0,
    passed: hasBrand,
    message: hasBrand ? `Marca: ${product.brand}` : "Marca ausente",
  });
  if (!hasBrand) missingFields.push("brand");

  // 7. Description (5 points)
  const desc = product.description ?? "";
  const hasDescription = desc.length >= 50;
  factors.push({
    name: "description",
    weight: 5,
    earned: hasDescription ? 5 : 0,
    passed: hasDescription,
    message: hasDescription
      ? `Descrição: ${desc.length} chars`
      : "Descrição ausente ou muito curta (<50 chars)",
  });
  if (!hasDescription) missingFields.push("description");

  // 8. Stock Info (5 points)
  const hasStock = product.stock !== null && product.stock !== undefined && product.stock > 0;
  factors.push({
    name: "stock",
    weight: 5,
    earned: hasStock ? 5 : 0,
    passed: hasStock,
    message: hasStock
      ? `Estoque: ${product.stock} unidades`
      : "Sem informação de estoque",
  });
  if (!hasStock) missingFields.push("stock");

  // Calculate totals
  const score = factors.reduce((sum, f) => sum + f.earned, 0);
  const level: UCPReadinessBreakdown["level"] =
    score >= 90 ? "ready" : score >= 60 ? "almost" : "not_eligible";

  return { score, level, factors, missingFields };
}
