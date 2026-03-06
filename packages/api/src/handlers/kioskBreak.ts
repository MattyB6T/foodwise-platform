import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { validateKioskAuth } from "../utils/kioskAuth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const device = await validateKioskAuth(event);
    if (!device) return error("Unauthorized kiosk device", 401);

    if (!event.body) return error("Request body is required", 400);
    const body = JSON.parse(event.body);

    const { storeId, staffId } = body;
    if (!storeId || !staffId) return error("storeId and staffId are required", 400);
    if (storeId !== device.storeId) return error("Device not authorized for this store", 403);

    const action = event.pathParameters?.action;
    if (action !== "start" && action !== "end") {
      return error("Break action must be 'start' or 'end'", 400);
    }

    // Find active entry
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TIME_CLOCK,
        IndexName: "storeId-clockInTime-index",
        KeyConditionExpression: "storeId = :sid",
        FilterExpression: "staffId = :staffId AND attribute_not_exists(clockOutTime)",
        ExpressionAttributeValues: { ":sid": storeId, ":staffId": staffId },
      })
    );

    const activeEntry = (result.Items || []).find((e: any) => !e.clockOutTime);
    if (!activeEntry) return error("No active clock-in found", 404);

    const breaks = activeEntry.breakEvents || [];
    const now = new Date().toISOString();
    const onBreak = breaks.some((b: any) => !b.endTime);

    if (action === "start") {
      if (onBreak) return error("Already on break", 409);
      breaks.push({ startTime: now, endTime: null });
    } else {
      if (!onBreak) return error("Not currently on break", 409);
      const idx = breaks.findIndex((b: any) => !b.endTime);
      breaks[idx].endTime = now;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.TIME_CLOCK,
        Key: { entryId: activeEntry.entryId },
        UpdateExpression: "SET breakEvents = :breaks",
        ExpressionAttributeValues: { ":breaks": breaks },
      })
    );

    return success({
      entryId: activeEntry.entryId,
      action: action === "start" ? "break_started" : "break_ended",
      breakEvents: breaks,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("KioskBreak error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
