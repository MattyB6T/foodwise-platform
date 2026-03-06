import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ReceivingLog } from "@foodwise/shared";
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
        TableName: TABLES.RECEIVING_LOGS,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :storeId",
        ExpressionAttributeValues: { ":storeId": storeId },
        ScanIndexForward: false,
      })
    );

    const logs = (result.Items || []) as ReceivingLog[];

    return success({ storeId, receivingLogs: logs });
  } catch (err) {
    console.error("ListReceivingLogs error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
