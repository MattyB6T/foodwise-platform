import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getUserClaims, UserClaims } from "./auth";
import { error } from "./response";

export type Role = "owner" | "manager" | "staff" | "readonly";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  manager: 3,
  staff: 2,
  readonly: 1,
};

export function getUserRole(claims: UserClaims): Role {
  const groups = claims.groups;
  if (groups.includes("owner")) return "owner";
  if (groups.includes("manager")) return "manager";
  if (groups.includes("staff")) return "staff";
  return "readonly";
}

export function hasMinRole(claims: UserClaims, minRole: Role): boolean {
  const userRole = getUserRole(claims);
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function requireRole(
  event: APIGatewayProxyEvent,
  minRole: Role
): { claims: UserClaims; role: Role } | APIGatewayProxyResult {
  const claims = getUserClaims(event);
  const role = getUserRole(claims);

  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
    return error(
      `Insufficient permissions. Required: ${minRole}, Current: ${role}`,
      403,
      "FORBIDDEN"
    );
  }

  return { claims, role };
}

export function isErrorResult(result: any): result is APIGatewayProxyResult {
  return result && typeof result.statusCode === "number" && typeof result.body === "string";
}
