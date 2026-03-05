import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InventoryItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event); // ensure authenticated

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    const category = event.queryStringParameters?.category;

    const params: {
      TableName: string;
      KeyConditionExpression: string;
      FilterExpression?: string;
      ExpressionAttributeValues: Record<string, string>;
    } = {
      TableName: TABLES.INVENTORY,
      KeyConditionExpression: "storeId = :storeId",
      ExpressionAttributeValues: {
        ":storeId": storeId,
      },
    };

    if (category) {
      params.FilterExpression = "category = :category";
      params.ExpressionAttributeValues[":category"] = category;
    }

    const result = await docClient.send(new QueryCommand(params));
    const items = (result.Items || []) as InventoryItem[];

    return success({ storeId, items });
  } catch (err) {
    console.error("GetInventory error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
