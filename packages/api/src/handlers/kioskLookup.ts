import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { validateKioskAuth } from "../utils/kioskAuth";
import { logSecurityEvent, extractClientInfo } from "../utils/securityEvents";
import { parseBody, storeIdSchema, pinSchema } from "../utils/validate";
import { createHash } from "crypto";

const lookupSchema = z.object({
  storeId: storeIdSchema,
  pin: pinSchema,
});

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const device = await validateKioskAuth(event);
    if (!device) return error("Unauthorized kiosk device", 401);

    const parsed = parseBody(event, lookupSchema);
    if (parsed.error) return parsed.error;
    const { storeId, pin } = parsed.data;

    if (storeId !== device.storeId) {
      return error("Device not authorized for this store", 403);
    }

    // Look up staff by store
    const staffResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STAFF,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    const pinHash = hashPin(pin);
    const employee = (staffResult.Items || []).find(
      (s: any) => s.pinHash === pinHash && s.active
    );

    if (!employee) {
      await logSecurityEvent({
        eventType: "failed_pin_attempt",
        storeId,
        deviceId: device.deviceId,
        ...extractClientInfo(event),
        details: { reason: "No matching active employee for PIN" },
      });
      return success({ found: false });
    }

    // Check current clock status
    const clockResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TIME_CLOCK,
        IndexName: "storeId-clockInTime-index",
        KeyConditionExpression: "storeId = :sid",
        FilterExpression: "staffId = :staffId AND attribute_not_exists(clockOutTime)",
        ExpressionAttributeValues: { ":sid": storeId, ":staffId": employee.staffId },
      })
    );

    const activeEntry = (clockResult.Items || []).find((e: any) => !e.clockOutTime);

    return success({
      found: true,
      staffId: employee.staffId,
      staffName: employee.name,
      role: employee.role,
      clockedIn: !!activeEntry,
      activeEntry: activeEntry ? {
        entryId: activeEntry.entryId,
        clockInTime: activeEntry.clockInTime,
        breakEvents: activeEntry.breakEvents || [],
        onBreak: (activeEntry.breakEvents || []).some((b: any) => !b.endTime),
      } : null,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("KioskLookup error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
