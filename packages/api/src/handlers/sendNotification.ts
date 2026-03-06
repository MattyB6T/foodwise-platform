import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface SendNotificationBody {
  storeId: string;
  title: string;
  body: string;
  type: "lowStock" | "orderUpdates" | "wasteAlerts" | "countReminders" | "expirationWarnings" | "dailySummary";
  data?: Record<string, string>;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    // Only owners/managers can send notifications
    if (!claims.groups.includes("owner") && !claims.groups.includes("manager")) {
      return error("Insufficient permissions", 403);
    }

    if (!event.body) return error("Request body is required", 400);
    const body: SendNotificationBody = JSON.parse(event.body);

    if (!body.storeId || !body.title || !body.body || !body.type) {
      return error("storeId, title, body, and type are required", 400);
    }

    // Get all registered tokens for this store
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.NOTIFICATIONS,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": body.storeId },
      })
    );

    const tokens = (result.Items || []).filter(
      (item: any) => item.enabled && item.preferences?.[body.type] !== false
    );

    // In production, this would call Expo Push API or FCM/APNs
    // For now, we log the notification targets
    console.log(`Notification: "${body.title}" to ${tokens.length} recipients for store ${body.storeId}`);

    return success({
      message: "Notification queued",
      recipientCount: tokens.length,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("SendNotification error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
