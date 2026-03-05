import { APIGatewayProxyEvent } from "aws-lambda";

export interface UserClaims {
  sub: string;
  email: string;
  groups: string[];
}

export function getUserClaims(event: APIGatewayProxyEvent): UserClaims {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    throw new Error("Unauthorized: No claims found");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    groups: claims["cognito:groups"]
      ? (claims["cognito:groups"] as string).split(",")
      : [],
  };
}
