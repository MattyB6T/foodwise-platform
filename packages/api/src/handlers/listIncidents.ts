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

    const status = event.queryStringParameters?.status;
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    let keyCondition = "storeId = :storeId";
    const exprValues: Record<string, any> = { ":storeId": storeId };

    // Use the GSI with timestamp sort key for date filtering
    if (startDate && endDate) {
      keyCondition += " AND #ts BETWEEN :start AND :end";
      exprValues[":start"] = startDate;
      exprValues[":end"] = endDate;
    } else if (startDate) {
      keyCondition += " AND #ts >= :start";
      exprValues[":start"] = startDate;
    }

    let filterExpression: string | undefined;
    if (status) {
      filterExpression = "#status = :status";
      exprValues[":status"] = status;
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INCIDENTS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: keyCondition,
        ExpressionAttributeNames: {
          "#ts": "timestamp",
          ...(status ? { "#status": "status" } : {}),
        },
        ExpressionAttributeValues: exprValues,
        FilterExpression: filterExpression,
        ScanIndexForward: false,
      })
    );

    return success({ incidents: result.Items || [] });
  } catch (err) {
    console.error("ListIncidents error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
