// ============================================================
// RetailNexus — JSON-LD Generator (Schema.org Product + Offer)
// UCP-Compliant output for Google SGE / Gemini / Shopping Graph
// ============================================================

import type { Product } from "../types/product.js";
import type { Store } from "../types/store.js";
import type { SchemaOrgProduct } from "../types/ucp.js";

/**
 * Generates a Schema.org JSON-LD object for a product.
 * This is the exact format the UCP expects to consume.
 */
export function generateProductJsonLD(
  product: Product,
  store: Store,
  sellerTrustScore: number
): SchemaOrgProduct {
  const availabilityMap: Record<string, string> = {
    in_stock: "https://schema.org/InStock",
    out_of_stock: "https://schema.org/OutOfStock",
    preorder: "https://schema.org/PreOrder",
    backorder: "https://schema.org/BackOrder",
  };

  // Calculate priceValidUntil: tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const priceValidUntil = tomorrow.toISOString().split("T")[0];

  const utmUrl = appendUTM(product, store);

  const jsonLD: SchemaOrgProduct = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    description: product.description,
    sku: product.sku,
    gtin13: product.gtin,
    offers: {
      "@type": "Offer",
      url: utmUrl,
      priceCurrency: "BRL",
      price: product.price.toFixed(2),
      priceValidUntil,
      availability:
        availabilityMap[product.availability ?? "in_stock"] ||
        "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  // Add brand if available
  if (product.brand) {
    jsonLD.brand = {
      "@type": "Brand",
      name: product.brand,
    };
  }

  // Add shipping details if available
  if (product.shipping) {
    jsonLD.offers.shippingDetails = {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: product.shipping.cost.toFixed(2),
        currency: "BRL",
      },
    };
    if (product.shipping.transitDays) {
      jsonLD.offers.shippingDetails.deliveryTime = {
        "@type": "ShippingDeliveryTime",
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: product.shipping.transitDays,
          unitCode: "d",
        },
      };
    }
  } else if (store.shippingDefaults) {
    jsonLD.offers.shippingDetails = {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: store.shippingDefaults.defaultCost.toFixed(2),
        currency: "BRL",
      },
    };
    if (store.shippingDefaults.defaultTransitDays) {
      jsonLD.offers.shippingDetails.deliveryTime = {
        "@type": "ShippingDeliveryTime",
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: store.shippingDefaults.defaultTransitDays,
          unitCode: "d",
        },
      };
    }
  }

  // Add return policy if available
  const returnDays = product.returnPolicy?.days ?? store.returnPolicy?.days;
  if (returnDays && returnDays > 0) {
    jsonLD.offers.hasMerchantReturnPolicy = {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "BR",
      returnPolicyCategory:
        "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: returnDays,
    };
  }

  return jsonLD;
}

/**
 * Generates an embeddable <script> tag with JSON-LD.
 */
export function generateEmbedScript(jsonLD: SchemaOrgProduct): string {
  return `<script type="application/ld+json">\n${JSON.stringify(jsonLD, null, 2)}\n</script>`;
}

function appendUTM(product: Product, store: Store): string {
  const baseUrl = `${store.url}/p/${encodeURIComponent(product.sku)}`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}utm_source=retailnexus-ucp&utm_medium=structured-data&utm_campaign=price-engine`;
}
