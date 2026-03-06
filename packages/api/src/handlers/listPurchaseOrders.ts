import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { PurchaseOrder } from "@foodwise/shared";
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

    const status = event.queryStringParameters?.status;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :storeId",
        ...(status && {
          FilterExpression: "#s = :status",
          ExpressionAttributeNames: { "#s": "status" },
        }),
        ExpressionAttributeValues: {
          ":storeId": storeId,
          ...(status && { ":status": status }),
        },
      })
    );

    const orders = (result.Items || []) as PurchaseOrder[];

    return success({ storeId, orders });
  } catch (err) {
    console.error("ListPurchaseOrders error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
