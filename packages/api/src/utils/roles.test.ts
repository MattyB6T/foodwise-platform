import { describe, it, expect } from "vitest";
import { getUserRole, hasMinRole, requireRole, isErrorResult } from "./roles";
import { UserClaims } from "./auth";
import { APIGatewayProxyEvent } from "aws-lambda";

function makeClaims(groups: string[]): UserClaims {
  return { sub: "test-sub", email: "test@test.com", groups };
}

function mockEvent(groups: string[]): APIGatewayProxyEvent {
  return {
    requestContext: {
      authorizer: {
        claims: {
          sub: "test-sub",
          email: "test@test.com",
          "cognito:groups": groups.join(","),
        },
      },
    },
  } as any;
}

describe("getUserRole()", () => {
  it("returns owner for owner group", () => {
    expect(getUserRole(makeClaims(["owner"]))).toBe("owner");
  });

  it("returns manager for manager group", () => {
    expect(getUserRole(makeClaims(["manager"]))).toBe("manager");
  });

  it("returns staff for staff group", () => {
    expect(getUserRole(makeClaims(["staff"]))).toBe("staff");
  });

  it("returns readonly when no groups", () => {
    expect(getUserRole(makeClaims([]))).toBe("readonly");
  });

  it("returns highest role when multiple groups", () => {
    expect(getUserRole(makeClaims(["staff", "owner"]))).toBe("owner");
  });
});

describe("hasMinRole()", () => {
  it("owner has all roles", () => {
    const claims = makeClaims(["owner"]);
    expect(hasMinRole(claims, "readonly")).toBe(true);
    expect(hasMinRole(claims, "staff")).toBe(true);
    expect(hasMinRole(claims, "manager")).toBe(true);
    expect(hasMinRole(claims, "owner")).toBe(true);
  });

  it("staff cannot access manager features", () => {
    const claims = makeClaims(["staff"]);
    expect(hasMinRole(claims, "staff")).toBe(true);
    expect(hasMinRole(claims, "readonly")).toBe(true);
    expect(hasMinRole(claims, "manager")).toBe(false);
    expect(hasMinRole(claims, "owner")).toBe(false);
  });

  it("readonly only has readonly access", () => {
    const claims = makeClaims([]);
    expect(hasMinRole(claims, "readonly")).toBe(true);
    expect(hasMinRole(claims, "staff")).toBe(false);
  });
});

describe("requireRole()", () => {
  it("returns claims and role when authorized", () => {
    const event = mockEvent(["manager"]);
    const result = requireRole(event, "staff");
    expect(isErrorResult(result)).toBe(false);
    if (!isErrorResult(result)) {
      expect(result.role).toBe("manager");
      expect(result.claims.email).toBe("test@test.com");
    }
  });

  it("returns 403 error when insufficient role", () => {
    const event = mockEvent(["staff"]);
    const result = requireRole(event, "owner");
    expect(isErrorResult(result)).toBe(true);
    if (isErrorResult(result)) {
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body).code).toBe("FORBIDDEN");
    }
  });
});

describe("isErrorResult()", () => {
  it("identifies API Gateway error results", () => {
    expect(isErrorResult({ statusCode: 400, body: '{"message":"fail"}', headers: {} })).toBe(true);
  });

  it("rejects non-error objects", () => {
    expect(isErrorResult({ claims: {}, role: "owner" })).toBe(false);
    expect(isErrorResult(null)).toBeFalsy();
    expect(isErrorResult(undefined)).toBeFalsy();
  });
});
