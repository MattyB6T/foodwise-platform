import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { parseBody, safeString } from "../utils/validate";

const DEFAULT_RANGES: Record<string, { min: number; max: number }> = {
  freezer: { min: -25, max: 0 },
  cooler: { min: 33, max: 41 },
  fridge: { min: 33, max: 41 },
  "display case": { min: 33, max: 41 },
};

function findRange(location: string, customRanges?: Record<string, { min: number; max: number }>): { min: number; max: number } | null {
  const loc = location.toLowerCase();
  const ranges = customRanges || DEFAULT_RANGES;
  for (const [key, range] of Object.entries(ranges)) {
    if (loc.includes(key.toLowerCase())) return range;
  }
  return null;
}

const tempLogSchema = z.object({
  location: safeString.pipe(z.string().min(1, "location is required")),
  temperature: z.number().min(-100).max(500),
  unit: z.enum(["F", "C"]).optional().default("F"),
  equipmentId: z.string().max(128).optional(),
  equipmentName: safeString.optional(),
  notes: safeString.optional(),
});

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

      // Load custom temp ranges from store settings
      const storeResult = await docClient.send(
        new GetCommand({ TableName: TABLES.STORES, Key: { storeId }, ProjectionExpression: "tempRanges" })
      );
      const customRanges = storeResult.Item?.tempRanges;

      const result = await docClient.send(new QueryCommand(params));
      const logs = result.Items || [];

      // Check for out-of-range temps using custom or default ranges
      const alerts = logs.filter((log: any) => {
        const range = findRange(log.location || "", customRanges);
        if (!range) return false;
        return log.temperature < range.min || log.temperature > range.max;
      });

      return success({ logs, alerts, totalLogs: logs.length, alertCount: alerts.length });
    }

    if (method === "POST") {
      const parsed = parseBody(event, tempLogSchema);
      if (parsed.error) return parsed.error;
      const body = parsed.data;

      const now = new Date().toISOString();
      const logId = uuidv4();

      // Load custom temp ranges from store settings
      const storeResult = await docClient.send(
        new GetCommand({ TableName: TABLES.STORES, Key: { storeId }, ProjectionExpression: "tempRanges" })
      );
      const customRanges = storeResult.Item?.tempRanges;

      // Determine if out of range
      let inRange = true;
      let rangeNote = "";
      const temp = body.temperature;
      const range = findRange(body.location, customRanges);

      if (range) {
        inRange = temp >= range.min && temp <= range.max;
        rangeNote = inRange ? "" : `${body.location} temp ${temp}°${body.unit || "F"} is out of range (${range.min} to ${range.max})`;
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
