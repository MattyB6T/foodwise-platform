import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Store } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.STORES,
        FilterExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: {
          ":ownerId": user.sub,
        },
      })
    );

    const stores = (result.Items || []) as Store[];

    return success({ stores });
  } catch (err) {
    console.error("ListStores error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
