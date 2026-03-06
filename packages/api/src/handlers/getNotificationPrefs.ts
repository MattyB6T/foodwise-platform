import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.NOTIFICATIONS,
        Key: { userId: claims.sub },
      })
    );

    if (!result.Item) {
      return success({
        registered: false,
        enabled: false,
        preferences: {
          lowStock: true,
          orderUpdates: true,
          wasteAlerts: true,
          countReminders: true,
          expirationWarnings: true,
          dailySummary: true,
        },
      });
    }

    return success({
      registered: true,
      enabled: result.Item.enabled,
      platform: result.Item.platform,
      preferences: result.Item.preferences,
      updatedAt: result.Item.updatedAt,
    });
  } catch (err) {
    console.error("GetNotificationPrefs error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
