import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { validateKioskAuth } from "../utils/kioskAuth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const device = await validateKioskAuth(event);
    if (!device) return error("Unauthorized kiosk device", 401);

    const storeId = event.queryStringParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    if (storeId !== device.storeId) return error("Device not authorized for this store", 403);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TIME_CLOCK,
        IndexName: "storeId-clockInTime-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    const activeCount = (result.Items || []).filter((e: any) => !e.clockOutTime).length;

    return success({ activeCount });
  } catch (err) {
    console.error("KioskActive error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
