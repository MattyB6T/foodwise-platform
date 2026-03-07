import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";
import { v4 as uuid } from "uuid";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.SECURITY_EVENTS_TABLE || "";

export type SecurityEventType =
  | "failed_login"
  | "kiosk_lockout"
  | "invalid_token"
  | "rate_limit_hit"
  | "suspicious_activity"
  | "data_export_requested"
  | "account_deletion_requested"
  | "failed_pin_attempt"
  | "failed_exit_pin"
  | "kiosk_unlocked"
  | "brute_force_detected";

export interface SecurityEvent {
  eventType: SecurityEventType;
  userId?: string;
  deviceId?: string;
  storeId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export function extractClientInfo(event: APIGatewayProxyEvent) {
  return {
    ipAddress: event.requestContext.identity?.sourceIp || "unknown",
    userAgent: event.headers["User-Agent"] || event.headers["user-agent"] || "unknown",
  };
}

export async function logSecurityEvent(secEvent: SecurityEvent): Promise<void> {
  if (!TABLE) return; // Skip if table not configured

  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        eventId: uuid(),
        eventType: secEvent.eventType,
        userId: secEvent.userId || null,
        deviceId: secEvent.deviceId || null,
        storeId: secEvent.storeId || null,
        ipAddress: secEvent.ipAddress || null,
        userAgent: secEvent.userAgent || null,
        timestamp: new Date().toISOString(),
        details: secEvent.details || {},
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year retention
      },
    }));
  } catch (err) {
    // Never let security logging failure break the request
    console.error("Failed to log security event:", (err as Error).message);
  }
}
