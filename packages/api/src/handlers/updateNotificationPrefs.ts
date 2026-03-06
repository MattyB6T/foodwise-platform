import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface UpdatePrefsBody {
  preferences: {
    lowStock?: boolean;
    orderUpdates?: boolean;
    wasteAlerts?: boolean;
    countReminders?: boolean;
    expirationWarnings?: boolean;
    dailySummary?: boolean;
  };
  enabled?: boolean;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    if (!event.body) return error("Request body is required", 400);

    const body: UpdatePrefsBody = JSON.parse(event.body);
    const now = new Date().toISOString();

    // Get current record
    const existing = await docClient.send(
      new GetCommand({
        TableName: TABLES.NOTIFICATIONS,
        Key: { userId: claims.sub },
      })
    );

    if (!existing.Item) return error("No push token registered", 404);

    const updates: string[] = ["updatedAt = :now"];
    const values: Record<string, any> = { ":now": now };

    if (body.preferences) {
      const merged = { ...existing.Item.preferences, ...body.preferences };
      updates.push("preferences = :prefs");
      values[":prefs"] = merged;
    }

    if (body.enabled !== undefined) {
      updates.push("enabled = :enabled");
      values[":enabled"] = body.enabled;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.NOTIFICATIONS,
        Key: { userId: claims.sub },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeValues: values,
      })
    );

    return success({ message: "Preferences updated" });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("UpdateNotificationPrefs error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
