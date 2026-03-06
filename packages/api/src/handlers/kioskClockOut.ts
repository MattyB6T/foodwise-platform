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

    const { storeId, staffId, location } = body;
    if (!storeId || !staffId) return error("storeId and staffId are required", 400);
    if (storeId !== device.storeId) return error("Device not authorized for this store", 403);

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

    const now = new Date();
    const clockIn = new Date(activeEntry.clockInTime);
    const totalMs = now.getTime() - clockIn.getTime();

    // Calculate total break minutes
    const breaks = activeEntry.breakEvents || [];
    let totalBreakMs = 0;
    for (const b of breaks) {
      const start = new Date(b.startTime);
      const end = b.endTime ? new Date(b.endTime) : now;
      totalBreakMs += end.getTime() - start.getTime();
    }

    // End any open break
    const updatedBreaks = breaks.map((b: any) => {
      if (!b.endTime) return { ...b, endTime: now.toISOString() };
      return b;
    });

    const totalBreakMinutes = Math.round(totalBreakMs / 60000);
    const totalHours = Math.round(((totalMs - totalBreakMs) / (1000 * 60 * 60)) * 100) / 100;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.TIME_CLOCK,
        Key: { entryId: activeEntry.entryId },
        UpdateExpression: "SET clockOutTime = :out, totalHours = :hours, totalBreakMinutes = :breakMins, clockOutLocation = :loc, breakEvents = :breaks",
        ExpressionAttributeValues: {
          ":out": now.toISOString(),
          ":hours": totalHours,
          ":breakMins": totalBreakMinutes,
          ":loc": location || null,
          ":breaks": updatedBreaks,
        },
      })
    );

    return success({
      entryId: activeEntry.entryId,
      clockInTime: activeEntry.clockInTime,
      clockOutTime: now.toISOString(),
      totalHours,
      totalBreakMinutes,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("KioskClockOut error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
