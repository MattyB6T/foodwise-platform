import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

const DEFAULTS = {
  maxShiftHours: 12,
  missedClockoutHours: 16,
  minBreakShiftHours: 6,
  flagShortShiftMinutes: 6,
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const method = event.httpMethod;

    // GET /stores/{storeId}/settings
    if (method === "GET") {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      const result = await docClient.send(
        new GetCommand({
          TableName: TABLES.STORES,
          Key: { storeId },
          ProjectionExpression: "timeclockSettings",
        })
      );

      const settings = result.Item?.timeclockSettings || {};
      return success({
        timeclock: { ...DEFAULTS, ...settings },
      });
    }

    // PUT /stores/{storeId}/settings
    if (method === "PUT") {
      const auth = requireRole(event, "owner");
      if (isErrorResult(auth)) return auth;

      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);

      if (body.timeclock) {
        const tc = body.timeclock;
        const settings: Record<string, number> = {};

        if (tc.maxShiftHours != null) {
          const v = Number(tc.maxShiftHours);
          if (v < 1 || v > 24) return error("maxShiftHours must be 1-24", 400);
          settings.maxShiftHours = v;
        }
        if (tc.missedClockoutHours != null) {
          const v = Number(tc.missedClockoutHours);
          if (v < 1 || v > 48) return error("missedClockoutHours must be 1-48", 400);
          settings.missedClockoutHours = v;
        }
        if (tc.minBreakShiftHours != null) {
          const v = Number(tc.minBreakShiftHours);
          if (v < 1 || v > 12) return error("minBreakShiftHours must be 1-12", 400);
          settings.minBreakShiftHours = v;
        }
        if (tc.flagShortShiftMinutes != null) {
          const v = Number(tc.flagShortShiftMinutes);
          if (v < 1 || v > 60) return error("flagShortShiftMinutes must be 1-60", 400);
          settings.flagShortShiftMinutes = v;
        }

        await docClient.send(
          new UpdateCommand({
            TableName: TABLES.STORES,
            Key: { storeId },
            UpdateExpression: "SET timeclockSettings = :tc",
            ExpressionAttributeValues: { ":tc": settings },
          })
        );

        return success({ message: "Settings updated", timeclock: { ...DEFAULTS, ...settings } });
      }

      return error("No recognized settings in request body", 400);
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("StoreSettings error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
