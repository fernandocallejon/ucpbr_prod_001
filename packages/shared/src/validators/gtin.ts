// ============================================================
// RetailNexus — GTIN/EAN-13 Validator
// ============================================================

/**
 * Validates a GTIN-13 (EAN-13) barcode using the check digit algorithm.
 * The UCP requires valid GTIN-13 for product identity.
 */
export function isValidGTIN13(gtin: string): boolean {
  if (!gtin || typeof gtin !== "string") return false;

  // Clean: remove spaces and leading zeros formatting
  const cleaned = gtin.trim();

  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleaned)) return false;

  // Calculate check digit
  const digits = cleaned.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === digits[12];
}

/**
 * Validates a GTIN of any length (8, 12, 13, 14).
 * Normalizes to GTIN-13 by left-padding with zeros.
 */
export function normalizeToGTIN13(gtin: string): string | null {
  if (!gtin || typeof gtin !== "string") return null;

  const cleaned = gtin.trim().replace(/\s/g, "");

  // Accept GTIN-8, GTIN-12 (UPC-A), GTIN-13, GTIN-14
  if (!/^\d{8,14}$/.test(cleaned)) return null;

  // Pad to 13 digits (or 14 for GTIN-14, take last 13)
  let normalized: string;
  if (cleaned.length === 14) {
    // GTIN-14: extract inner GTIN-13
    normalized = cleaned.substring(1);
  } else {
    normalized = cleaned.padStart(13, "0");
  }

  return isValidGTIN13(normalized) ? normalized : null;
}

/**
 * Calculate the check digit for a 12-digit GTIN prefix.
 */
export function calculateGTIN13CheckDigit(prefix12: string): number | null {
  if (!/^\d{12}$/.test(prefix12)) return null;

  const digits = prefix12.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}
