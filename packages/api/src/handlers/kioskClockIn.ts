import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { validateKioskAuth } from "../utils/kioskAuth";
import { parseBody, storeIdSchema, staffIdSchema, safeString } from "../utils/validate";
import { logSecurityEvent, extractClientInfo } from "../utils/securityEvents";

const clockInSchema = z.object({
  storeId: storeIdSchema,
  staffId: staffIdSchema,
  staffName: safeString.optional(),
  photoKey: z.string().max(500).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOutsideHours(openTime: string, closeTime: string): boolean {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hhmm < openTime || hhmm > closeTime;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const device = await validateKioskAuth(event);
    if (!device) return error("Unauthorized kiosk device", 401);

    const parsed = parseBody(event, clockInSchema);
    if (parsed.error) return parsed.error;
    const { storeId, staffId, photoKey, location, staffName } = parsed.data;
    if (storeId !== device.storeId) return error("Device not authorized for this store", 403);

    // Check for duplicate: already clocked in
    const existing = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TIME_CLOCK,
        IndexName: "storeId-clockInTime-index",
        KeyConditionExpression: "storeId = :sid",
        FilterExpression: "staffId = :staffId AND attribute_not_exists(clockOutTime)",
        ExpressionAttributeValues: { ":sid": storeId, ":staffId": staffId },
      })
    );

    const alreadyClockedIn = (existing.Items || []).find((e: any) => !e.clockOutTime);
    if (alreadyClockedIn) {
      return error("Employee is already clocked in. Clock out first.", 409);
    }

    const now = new Date().toISOString();
    const entryId = uuidv4();

    // Fraud checks
    let flagged = false;
    let flagReason = "";

    if (isOutsideHours(device.storeHoursOpen, device.storeHoursClose)) {
      flagged = true;
      flagReason = "Clock-in outside store hours";
    }

    if (location && device.storeLat && device.storeLng) {
      const dist = getDistance(location.lat, location.lng, device.storeLat, device.storeLng);
      if (dist > 500) {
        flagged = true;
        flagReason = flagReason ? `${flagReason}; Location ${Math.round(dist)}m from store` : `Location ${Math.round(dist)}m from store`;
      }
    }

    const entry = {
      entryId,
      storeId,
      staffId,
      staffName: staffName || "",
      clockInTime: now,
      clockOutTime: null,
      breakEvents: [],
      totalHours: null,
      totalBreakMinutes: null,
      clockInPhotoKey: photoKey || null,
      clockInLocation: location || null,
      clockOutLocation: null,
      deviceId: device.deviceId,
      flagged,
      flagReason: flagReason || null,
      managerApproved: false,
      notes: null,
    };

    await docClient.send(
      new PutCommand({ TableName: TABLES.TIME_CLOCK, Item: entry })
    );

    // If flagged, log security event and audit trail
    if (flagged) {
      await logSecurityEvent({
        eventType: "suspicious_activity",
        storeId,
        deviceId: device.deviceId,
        ...extractClientInfo(event),
        details: { staffId, flagReason, entryId },
      });
      try {
        await docClient.send(
          new PutCommand({
            TableName: TABLES.AUDIT_TRAIL,
            Item: {
              auditId: uuidv4(),
              storeId,
              action: "FRAUD_FLAG",
              resourceType: "timeclock",
              resourceId: entryId,
              performedBy: staffId,
              details: { flagReason },
              timestamp: now,
            },
          })
        );
      } catch (_) { /* best effort */ }
    }

    return success({
      entryId,
      staffId,
      staffName: entry.staffName,
      clockInTime: now,
      flagged,
      flagReason: flagReason || undefined,
    }, 201);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("KioskClockIn error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
