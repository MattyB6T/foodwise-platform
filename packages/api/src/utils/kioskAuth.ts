import { APIGatewayProxyEvent } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "./dynamo";
import { logSecurityEvent, extractClientInfo } from "./securityEvents";

export interface KioskDevice {
  deviceId: string;
  storeId: string;
  apiKey: string;
  storeHoursOpen: string;
  storeHoursClose: string;
  storeAddress: string | null;
  storeLat: number | null;
  storeLng: number | null;
  managerExitPin: string;
  active: boolean;
}

// Validates kiosk API key from x-kiosk-api-key header
// Returns the device record or null
export async function validateKioskAuth(event: APIGatewayProxyEvent): Promise<KioskDevice | null> {
  const apiKey = event.headers["x-kiosk-api-key"] || event.headers["X-Kiosk-Api-Key"];
  const deviceId = event.headers["x-kiosk-device-id"] || event.headers["X-Kiosk-Device-Id"];

  if (!apiKey || !deviceId) return null;

  // Look up the device by scanning (small table)
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.KIOSK_DEVICES,
      KeyConditionExpression: "deviceId = :did",
      ExpressionAttributeValues: { ":did": deviceId },
    })
  );

  const device = result.Items?.[0] as KioskDevice | undefined;
  if (!device || device.apiKey !== apiKey || !device.active) {
    await logSecurityEvent({
      eventType: "invalid_token",
      deviceId,
      ...extractClientInfo(event),
      details: {
        reason: !device ? "Unknown device" : !device.active ? "Inactive device" : "Invalid API key",
      },
    });
    return null;
  }

  return device;
}
