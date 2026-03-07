import { APIGatewayProxyResult } from "aws-lambda";

const SECURITY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Request-Timestamp,X-Api-Key,X-Device-Id",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json",
};

export function success(body: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify(body),
  };
}

export function error(message: string, statusCode = 400, code = "BAD_REQUEST"): APIGatewayProxyResult {
  return {
    statusCode,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({ message, code }),
  };
}
