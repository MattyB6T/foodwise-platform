import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STAFF,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    return success({ staff: result.Items || [] });
  } catch (err) {
    console.error("ListStaff error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
