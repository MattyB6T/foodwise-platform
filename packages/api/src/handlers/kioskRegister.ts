import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { requireRole, isErrorResult } from "../utils/roles";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    if (!event.body) return error("Request body is required", 400);
    const body = JSON.parse(event.body);

    const { storeId, deviceName, storeHoursOpen, storeHoursClose, storeAddress, storeLat, storeLng, managerExitPin } = body;

    if (!storeId || !deviceName) {
      return error("storeId and deviceName are required", 400);
    }
    if (!managerExitPin || managerExitPin.length !== 6) {
      return error("managerExitPin must be 6 digits", 400);
    }

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
