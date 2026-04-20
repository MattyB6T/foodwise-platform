import { describe, it, expect } from "vitest";
import {
  storeIdSchema,
  emailSchema,
  safeString,
  safeLongString,
  dateString,
  pinSchema,
  dateRangeSchema,
  parseBody,
  parseQuery,
  parsePathParam,
  validateRequestTimestamp,
  validateBodySize,
  positiveNumber,
  quantity,
  price,
  percentage,
} from "./validate";
import { z } from "zod";
import { APIGatewayProxyEvent } from "aws-lambda";

function mockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    queryStringParameters: null,
    pathParameters: null,
    requestContext: { authorizer: { claims: { sub: "x", email: "x@x.com" } } },
    ...overrides,
  } as any;
}

describe("field schemas", () => {
  it("storeIdSchema accepts valid UUIDs", () => {
    expect(storeIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("storeIdSchema rejects non-UUIDs", () => {
    expect(storeIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(storeIdSchema.safeParse("").success).toBe(false);
  });

  it("emailSchema validates emails", () => {
    expect(emailSchema.safeParse("test@example.com").success).toBe(true);
    expect(emailSchema.safeParse("invalid").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("positiveNumber rejects zero and negatives", () => {
    expect(positiveNumber.safeParse(5).success).toBe(true);
    expect(positiveNumber.safeParse(0).success).toBe(false);
    expect(positiveNumber.safeParse(-1).success).toBe(false);
  });

  it("quantity allows zero but not negatives", () => {
    expect(quantity.safeParse(0).success).toBe(true);
    expect(quantity.safeParse(10).success).toBe(true);
    expect(quantity.safeParse(-1).success).toBe(false);
  });

  it("price allows zero but not negatives", () => {
    expect(price.safeParse(0).success).toBe(true);
    expect(price.safeParse(9.99).success).toBe(true);
    expect(price.safeParse(-0.01).success).toBe(false);
  });

  it("percentage must be 0-100", () => {
    expect(percentage.safeParse(0).success).toBe(true);
    expect(percentage.safeParse(100).success).toBe(true);
    expect(percentage.safeParse(101).success).toBe(false);
    expect(percentage.safeParse(-1).success).toBe(false);
  });

  it("pinSchema requires 4-6 digits", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("123456").success).toBe(true);
    expect(pinSchema.safeParse("123").success).toBe(false);
    expect(pinSchema.safeParse("abcd").success).toBe(false);
  });

  it("dateString validates parseable dates", () => {
    expect(dateString.safeParse("2026-03-13").success).toBe(true);
    expect(dateString.safeParse("2026-03-13T12:00:00Z").success).toBe(true);
    expect(dateString.safeParse("not-a-date").success).toBe(false);
  });
});

describe("safeString", () => {
  it("strips HTML tags", () => {
    const result = safeString.parse('<b>hello</b> <script>alert("xss")</script>');
    expect(result).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(safeString.parse("  hello  ")).toBe("hello");
  });

  it("rejects strings over 1000 chars", () => {
    expect(safeString.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

describe("safeLongString", () => {
  it("allows up to 5000 chars", () => {
    expect(safeLongString.safeParse("a".repeat(5000)).success).toBe(true);
    expect(safeLongString.safeParse("a".repeat(5001)).success).toBe(false);
  });
});

describe("dateRangeSchema", () => {
  it("accepts valid date range", () => {
    const result = dateRangeSchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects start after end", () => {
    const result = dateRangeSchema.safeParse({
      startDate: "2026-03-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects range over 1 year", () => {
    const result = dateRangeSchema.safeParse({
      startDate: "2024-01-01",
      endDate: "2026-01-02",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseBody()", () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it("parses valid body", () => {
    const event = mockEvent({ body: JSON.stringify({ name: "Joe", age: 30 }) });
    const result = parseBody(event, schema);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: "Joe", age: 30 });
  });

  it("returns error for invalid JSON", () => {
    const event = mockEvent({ body: "not json{" });
    const result = parseBody(event, schema);
    expect(result.error).toBeDefined();
    expect(result.error!.statusCode).toBe(400);
  });

  it("returns error for schema mismatch", () => {
    const event = mockEvent({ body: JSON.stringify({ name: 123 }) });
    const result = parseBody(event, schema);
    expect(result.error).toBeDefined();
    expect(JSON.parse(result.error!.body).code).toBe("VALIDATION_ERROR");
  });

  it("defaults to empty object when no body", () => {
    const event = mockEvent({ body: null });
    const optionalSchema = z.object({ name: z.string().optional() });
    const result = parseBody(event, optionalSchema);
    expect(result.data).toEqual({});
  });
});

describe("parseQuery()", () => {
  const schema = z.object({ page: z.string().optional(), limit: z.string().optional() });

  it("parses valid query params", () => {
    const event = mockEvent({ queryStringParameters: { page: "1", limit: "25" } });
    const result = parseQuery(event, schema);
    expect(result.data).toEqual({ page: "1", limit: "25" });
  });

  it("handles missing query params", () => {
    const event = mockEvent({ queryStringParameters: null });
    const result = parseQuery(event, schema);
    expect(result.data).toEqual({});
  });
});

describe("parsePathParam()", () => {
  it("extracts valid UUID path param", () => {
    const event = mockEvent({ pathParameters: { storeId: "550e8400-e29b-41d4-a716-446655440000" } });
    const result = parsePathParam(event, "storeId");
    expect(result.value).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns error for missing param", () => {
    const event = mockEvent({ pathParameters: null });
    const result = parsePathParam(event, "storeId");
    expect(result.error).toBeDefined();
    expect(result.error!.statusCode).toBe(400);
  });

  it("returns error for invalid UUID", () => {
    const event = mockEvent({ pathParameters: { storeId: "not-valid" } });
    const result = parsePathParam(event, "storeId");
    expect(result.error).toBeDefined();
  });
});

describe("validateRequestTimestamp()", () => {
  it("allows requests without timestamp (backward compat)", () => {
    const event = mockEvent({ headers: {} });
    expect(validateRequestTimestamp(event)).toBeNull();
  });

  it("allows recent timestamps", () => {
    const event = mockEvent({ headers: { "X-Request-Timestamp": new Date().toISOString() } });
    expect(validateRequestTimestamp(event)).toBeNull();
  });

  it("rejects old timestamps", () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const event = mockEvent({ headers: { "X-Request-Timestamp": old } });
    const result = validateRequestTimestamp(event);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("rejects invalid timestamp format", () => {
    const event = mockEvent({ headers: { "X-Request-Timestamp": "not-a-date" } });
    const result = validateRequestTimestamp(event);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });
});

describe("validateBodySize()", () => {
  it("allows small bodies", () => {
    const event = mockEvent({ body: "small" });
    expect(validateBodySize(event)).toBeNull();
  });

  it("rejects oversized bodies", () => {
    const event = mockEvent({ body: "x".repeat(2 * 1024 * 1024) });
    const result = validateBodySize(event);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(413);
  });

  it("allows null body", () => {
    const event = mockEvent({ body: null });
    expect(validateBodySize(event)).toBeNull();
  });
});
