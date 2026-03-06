import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    const staffId = event.pathParameters?.staffId;
    if (!storeId || !staffId) return error("storeId and staffId are required", 400);

    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    if (!event.body) return error("Request body is required", 400);
    const body = JSON.parse(event.body);
    const { pin } = body;

    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return error("PIN must be 4-6 digits", 400);
    }

    // Check if staff exists
    const staffResult = await docClient.send(
      new GetCommand({ TableName: TABLES.STAFF, Key: { staffId } })
    );
    if (!staffResult.Item || staffResult.Item.storeId !== storeId) {
      return error("Staff member not found", 404);
    }

    // Check PIN uniqueness within store
    const allStaff = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STAFF,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    const pinHash = hashPin(pin);
    const duplicate = (allStaff.Items || []).find(
      (s: any) => s.pinHash === pinHash && s.staffId !== staffId
    );
    if (duplicate) {
      return error("This PIN is already used by another employee at this store", 409);
    }

    // Set the PIN
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.STAFF,
        Key: { staffId },
        UpdateExpression: "SET pinHash = :ph, pinSet = :ps, updatedAt = :now",
        ExpressionAttributeValues: {
          ":ph": pinHash,
          ":ps": true,
          ":now": new Date().toISOString(),
        },
      })
    );

    return success({ message: "PIN set successfully", staffId });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("StaffPin error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
