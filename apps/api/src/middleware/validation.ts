// ============================================================
// RetailNexus — Request Validation (Zod-based)
// ============================================================

import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { z, ZodSchema, ZodError } from "zod";
import { errorResponse } from "./auth.js";

/**
 * Parse and validate the JSON body of an HTTP request.
 * Returns the parsed data or an error response.
 */
export async function validateBody<T>(
  req: HttpRequest,
  schema: ZodSchema<T>
): Promise<T | HttpResponseInit> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return errorResponse(
        "Invalid request body",
        400,
        { errors: formatZodErrors(result.error) }
      );
    }

    return result.data;
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }
}

/**
 * Parse query parameters with validation.
 */
export function validateQuery<T>(
  req: HttpRequest,
  schema: ZodSchema<T>
): T | HttpResponseInit {
  const params: Record<string, string> = {};
  req.query.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);
  if (!result.success) {
    return errorResponse(
      "Invalid query parameters",
      400,
      { errors: formatZodErrors(result.error) }
    );
  }
  return result.data;
}

/**
 * Check if a value is an error response.
 */
export function isValidationError(value: unknown): value is HttpResponseInit {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as HttpResponseInit).status === "number"
  );
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!formatted[path]) formatted[path] = [];
    formatted[path].push(issue.message);
  }
  return formatted;
}

// ─── Common Validation Schemas ───

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
