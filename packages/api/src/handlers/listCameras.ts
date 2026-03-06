import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.CAMERAS,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :storeId",
        ExpressionAttributeValues: { ":storeId": storeId },
      })
    );

    return success({ cameras: result.Items || [] });
  } catch (err) {
    console.error("ListCameras error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
