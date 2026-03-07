import { z, ZodSchema, ZodError } from "zod";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { error } from "./response";

// --- Common field schemas ---

export const storeIdSchema = z.string().uuid("storeId must be a valid UUID");
export const itemIdSchema = z.string().uuid("itemId must be a valid UUID");
export const staffIdSchema = z.string().uuid("staffId must be a valid UUID");
export const recipeIdSchema = z.string().uuid("recipeId must be a valid UUID");
export const deviceIdSchema = z.string().min(1).max(128);

export const emailSchema = z.string().email("Invalid email address").max(255);
export const positiveNumber = z.number().positive("Must be a positive number").max(999999, "Value exceeds maximum");
export const nonNegativeNumber = z.number().min(0).max(999999);
export const quantity = z.number().min(0, "Quantity cannot be negative").max(999999, "Quantity exceeds maximum");
export const price = z.number().min(0, "Price cannot be negative").max(999999, "Price exceeds maximum");
export const percentage = z.number().min(0).max(100);

export const safeString = z.string().max(1000).transform((val) =>
  val.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim()
);

export const safeLongString = z.string().max(5000).transform((val) =>
  val.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim()
);

export const dateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid date format" }
);

export const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits");

export const csvSafeString = z.string().transform((val) => {
  // Strip leading formula characters to prevent CSV injection
  return val.replace(/^[=+\-@\t\r]/, "'$&");
});

// --- Date range validation ---

export const dateRangeSchema = z.object({
  startDate: dateString,
  endDate: dateString,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: "startDate must be before endDate" }
).refine(
  (data) => {
    const diffMs = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    return diffMs <= oneYear;
  },
  { message: "Date range cannot exceed 1 year" }
);

// --- Request validation helpers ---

export function parseBody<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>):
  { data: T; error?: never } | { data?: never; error: APIGatewayProxyResult } {
  let raw: unknown;
  try {
    raw = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { error: error("Invalid JSON in request body", 400, "INVALID_JSON") };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = (result.error as any).issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return { error: error(`Validation failed: ${messages}`, 400, "VALIDATION_ERROR") };
  }

  return { data: result.data };
}

export function parseQuery<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>):
  { data: T; error?: never } | { data?: never; error: APIGatewayProxyResult } {
  const raw = event.queryStringParameters || {};
  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = (result.error as any).issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return { error: error(`Invalid query parameters: ${messages}`, 400, "VALIDATION_ERROR") };
  }
  return { data: result.data };
}

export function parsePathParam(event: APIGatewayProxyEvent, name: string, schema: ZodSchema<string> = storeIdSchema):
  { value: string; error?: never } | { value?: never; error: APIGatewayProxyResult } {
  const raw = event.pathParameters?.[name];
  if (!raw) {
    return { error: error(`Missing path parameter: ${name}`, 400, "MISSING_PARAM") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: error(`Invalid ${name}: ${(result.error as any).issues[0]?.message}`, 400, "VALIDATION_ERROR") };
  }
  return { value: result.data };
}

// --- Request timestamp validation (replay attack prevention) ---

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function validateRequestTimestamp(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const timestamp = event.headers["X-Request-Timestamp"] || event.headers["x-request-timestamp"];
  if (!timestamp) {
    // Allow requests without timestamp for backward compatibility during rollout
    return null;
  }

  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) {
    return error("Invalid X-Request-Timestamp header", 400, "INVALID_TIMESTAMP");
  }

  const now = Date.now();
  if (Math.abs(now - requestTime) > MAX_REQUEST_AGE_MS) {
    return error("Request timestamp too old or too far in the future", 403, "REPLAY_REJECTED");
  }

  return null;
}

// --- Request size limit ---

const MAX_BODY_SIZE = 1024 * 1024; // 1MB default
const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB for CSV

export function validateBodySize(event: APIGatewayProxyEvent, maxSize = MAX_BODY_SIZE): APIGatewayProxyResult | null {
  if (event.body && event.body.length > maxSize) {
    return error(`Request body exceeds maximum size of ${Math.round(maxSize / 1024)}KB`, 413, "PAYLOAD_TOO_LARGE");
  }
  return null;
}
