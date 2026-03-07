import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { requireRole, isErrorResult } from "../utils/roles";
import { parseBody, storeIdSchema, safeString } from "../utils/validate";

const registerSchema = z.object({
  storeId: storeIdSchema,
  deviceName: safeString,
  storeHoursOpen: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  storeHoursClose: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  storeAddress: safeString.optional(),
  storeLat: z.number().min(-90).max(90).optional(),
  storeLng: z.number().min(-180).max(180).optional(),
  managerExitPin: z.string().regex(/^\d{6}$/, "managerExitPin must be exactly 6 digits"),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    const parsed = parseBody(event, registerSchema);
    if (parsed.error) return parsed.error;
    const { storeId, deviceName, storeHoursOpen, storeHoursClose, storeAddress, storeLat, storeLng, managerExitPin } = parsed.data;

    const deviceId = uuidv4();
    const apiKey = randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    const device = {
      deviceId,
      storeId,
      deviceName,
      enabledAt: now,
      enabledBy: auth.claims.email,
      storeHoursOpen: storeHoursOpen || "06:00",
      storeHoursClose: storeHoursClose || "23:00",
      storeAddress: storeAddress || null,
      storeLat: storeLat || null,
      storeLng: storeLng || null,
      managerExitPin,
      apiKey,
      active: true,
    };

    await docClient.send(
      new PutCommand({ TableName: TABLES.KIOSK_DEVICES, Item: device })
    );

    return success({ deviceId, apiKey, storeId, deviceName }, 201);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("KioskRegister error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
