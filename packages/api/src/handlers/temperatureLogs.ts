import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface TempLogBody {
  location: string;
  temperature: number;
  unit: "F" | "C";
  equipmentId?: string;
  equipmentName?: string;
  notes?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    const method = event.httpMethod;

    if (method === "GET") {
      const startDate = event.queryStringParameters?.startDate;
      const params: any = {
        TableName: TABLES.TEMP_LOGS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId } as any,
        ScanIndexForward: false,
        Limit: 100,
      };

      if (startDate) {
        params.KeyConditionExpression += " AND #ts >= :start";
        params.ExpressionAttributeNames = { "#ts": "timestamp" };
        params.ExpressionAttributeValues[":start"] = startDate;
      }

      const result = await docClient.send(new QueryCommand(params));
      const logs = result.Items || [];

      // Check for out-of-range temps
      const alerts = logs.filter((log: any) => {
        if (log.location?.toLowerCase().includes("freezer")) {
          return log.temperature > 0 || log.temperature < -25;
        }
        if (log.location?.toLowerCase().includes("cooler") || log.location?.toLowerCase().includes("fridge")) {
          return log.temperature > 41 || log.temperature < 33;
        }
        return false;
      });

      return success({ logs, alerts, totalLogs: logs.length, alertCount: alerts.length });
    }

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body: TempLogBody = JSON.parse(event.body);

      if (!body.location || body.temperature === undefined) {
        return error("location and temperature are required", 400);
      }

      const now = new Date().toISOString();
      const logId = uuidv4();

      // Determine if out of range
      let inRange = true;
      let rangeNote = "";
      const temp = body.temperature;
      const loc = body.location.toLowerCase();

      if (loc.includes("freezer")) {
        inRange = temp >= -25 && temp <= 0;
        rangeNote = inRange ? "" : `Freezer temp ${temp}°${body.unit || "F"} is out of range (-25 to 0)`;
      } else if (loc.includes("cooler") || loc.includes("fridge")) {
        inRange = temp >= 33 && temp <= 41;
        rangeNote = inRange ? "" : `Cooler temp ${temp}°${body.unit || "F"} is out of range (33-41°F)`;
      }

      const logEntry = {
        logId,
        storeId,
        location: body.location,
        temperature: body.temperature,
        unit: body.unit || "F",
        equipmentId: body.equipmentId || null,
        equipmentName: body.equipmentName || null,
        inRange,
        rangeNote,
        notes: body.notes || null,
        recordedBy: claims.email,
        timestamp: now,
        createdAt: now,
      };

      await docClient.send(
        new PutCommand({ TableName: TABLES.TEMP_LOGS, Item: logEntry })
      );

      return success(logEntry, 201);
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("TemperatureLogs error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
