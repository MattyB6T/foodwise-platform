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

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    let keyCondition = "storeId = :storeId";
    const exprValues: Record<string, any> = { ":storeId": storeId };
    const exprNames: Record<string, string> = {};

    if (startDate && endDate) {
      keyCondition += " AND #ts BETWEEN :start AND :end";
      exprValues[":start"] = startDate;
      exprValues[":end"] = endDate;
      exprNames["#ts"] = "timestamp";
    } else if (startDate) {
      keyCondition += " AND #ts >= :start";
      exprValues[":start"] = startDate;
      exprNames["#ts"] = "timestamp";
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TRANSACTIONS,
        IndexName: "timestamp-index",
        KeyConditionExpression: keyCondition,
        ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false,
        Limit: 100,
      })
    );

    return success({ transactions: result.Items || [] });
  } catch (err) {
    console.error("ListTransactions error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
