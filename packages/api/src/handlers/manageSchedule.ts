import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

interface ShiftBody {
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  position?: string;
  notes?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    const method = event.httpMethod;

    if (method === "GET") {
      const auth = requireRole(event, "staff");
      if (isErrorResult(auth)) return auth;

      const weekStart = event.queryStringParameters?.weekStart;
      const params: any = {
        TableName: TABLES.SCHEDULES,
        IndexName: "storeId-date-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId } as any,
      };

      if (weekStart) {
        const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        params.KeyConditionExpression += " AND #date BETWEEN :start AND :end";
        params.ExpressionAttributeNames = { "#date": "date" };
        params.ExpressionAttributeValues[":start"] = weekStart;
        params.ExpressionAttributeValues[":end"] = weekEnd;
      }

      const result = await docClient.send(new QueryCommand(params));
      return success({ shifts: result.Items || [] });
    }

    if (method === "POST") {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      if (!event.body) return error("Request body is required", 400);
      const body: ShiftBody = JSON.parse(event.body);

      if (!body.staffId || !body.date || !body.startTime || !body.endTime) {
        return error("staffId, date, startTime, and endTime are required", 400);
      }

      const now = new Date().toISOString();
      const shiftId = uuidv4();

      const shift = {
        shiftId,
        storeId,
        staffId: body.staffId,
        staffName: body.staffName || "",
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        position: body.position || null,
        notes: body.notes || null,
        createdBy: auth.claims.email,
        createdAt: now,
      };

      await docClient.send(
        new PutCommand({ TableName: TABLES.SCHEDULES, Item: shift })
      );

      return success(shift, 201);
    }

    if (method === "DELETE") {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      const shiftId = event.pathParameters?.shiftId;
      if (!shiftId) return error("shiftId is required", 400);

      await docClient.send(
        new DeleteCommand({ TableName: TABLES.SCHEDULES, Key: { shiftId } })
      );

      return success({ message: "Shift deleted" });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("ManageSchedule error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
