import { describe, it, expect } from "vitest";
import { getUserClaims } from "./auth";
import { APIGatewayProxyEvent } from "aws-lambda";

function mockEvent(claims?: Record<string, any>): APIGatewayProxyEvent {
  return {
    requestContext: {
      authorizer: claims ? { claims } : undefined,
    },
  } as any;
}

describe("getUserClaims()", () => {
  it("extracts sub, email, and groups from claims", () => {
    const event = mockEvent({
      sub: "abc-123",
      email: "test@example.com",
      "cognito:groups": "owner,manager",
    });
    const claims = getUserClaims(event);
    expect(claims.sub).toBe("abc-123");
    expect(claims.email).toBe("test@example.com");
    expect(claims.groups).toEqual(["owner", "manager"]);
  });

  it("returns empty groups when no cognito:groups claim", () => {
    const event = mockEvent({
      sub: "abc-123",
      email: "test@example.com",
    });
    const claims = getUserClaims(event);
    expect(claims.groups).toEqual([]);
  });

  it("throws when no claims present", () => {
    const event = mockEvent();
    expect(() => getUserClaims(event)).toThrow("Unauthorized");
  });

  it("throws when authorizer is missing", () => {
    const event = { requestContext: {} } as any;
    expect(() => getUserClaims(event)).toThrow("Unauthorized");
  });
});
