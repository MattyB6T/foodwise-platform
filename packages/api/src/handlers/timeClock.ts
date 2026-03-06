import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    const method = event.httpMethod;

    if (method === "GET") {
      const staffId = event.queryStringParameters?.staffId;
      const date = event.queryStringParameters?.date;

      const params: any = {
        TableName: TABLES.TIME_CLOCK,
        IndexName: "storeId-clockIn-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId } as any,
        ScanIndexForward: false,
        Limit: 50,
      };

      if (date) {
        params.KeyConditionExpression += " AND begins_with(clockIn, :date)";
        params.ExpressionAttributeValues[":date"] = date;
      }

      const result = await docClient.send(new QueryCommand(params));
      let entries = result.Items || [];

      if (staffId) {
        entries = entries.filter((e: any) => e.staffId === staffId);
      }

      return success({ entries });
    }

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);
      const action = body.action;

      if (action === "clock-in") {
        const now = new Date().toISOString();
        const entryId = uuidv4();

        const entry = {
          entryId,
          storeId,
          staffId: claims.sub,
          staffEmail: claims.email,
          staffName: body.staffName || claims.email,
          clockIn: now,
          clockOut: null,
          totalHours: null,
          position: body.position || null,
          status: "active",
        };

        await docClient.send(
          new PutCommand({ TableName: TABLES.TIME_CLOCK, Item: entry })
        );

        return success(entry, 201);
      }

      if (action === "clock-out") {
        const entryId = body.entryId;
        if (!entryId) return error("entryId is required for clock-out", 400);

        const now = new Date();
        const nowISO = now.toISOString();

        // We need to calculate hours — get the entry first to find clockIn
        const existing = await docClient.send(
          new QueryCommand({
            TableName: TABLES.TIME_CLOCK,
            IndexName: "storeId-clockIn-index",
            KeyConditionExpression: "storeId = :sid",
            FilterExpression: "entryId = :eid",
            ExpressionAttributeValues: { ":sid": storeId, ":eid": entryId },
          })
        );

        const entry = existing.Items?.[0];
        if (!entry) return error("Time clock entry not found", 404);

        const clockInTime = new Date(entry.clockIn);
        const totalHours = Math.round(((now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)) * 100) / 100;

        await docClient.send(
          new UpdateCommand({
            TableName: TABLES.TIME_CLOCK,
            Key: { entryId },
            UpdateExpression: "SET clockOut = :out, totalHours = :hours, #status = :status",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":out": nowISO,
              ":hours": totalHours,
              ":status": "completed",
            },
          })
        );

        return success({ entryId, clockOut: nowISO, totalHours });
      }

      return error("action must be 'clock-in' or 'clock-out'", 400);
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("TimeClock error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
