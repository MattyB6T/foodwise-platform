import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface RegisterTokenBody {
  token: string;
  platform: "ios" | "android" | "web";
  storeId?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    if (!event.body) return error("Request body is required", 400);

    const body: RegisterTokenBody = JSON.parse(event.body);
    if (!body.token) return error("token is required", 400);
    if (!body.platform) return error("platform is required", 400);

    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: TABLES.NOTIFICATIONS,
        Item: {
          userId: claims.sub,
          token: body.token,
          platform: body.platform,
          storeId: body.storeId,
          email: claims.email,
          enabled: true,
          preferences: {
            lowStock: true,
            orderUpdates: true,
            wasteAlerts: true,
            countReminders: true,
            expirationWarnings: true,
            dailySummary: true,
          },
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return success({ message: "Push token registered" }, 201);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("RegisterPushToken error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
