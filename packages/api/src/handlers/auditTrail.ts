import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface AuditLogBody {
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  previousValue?: any;
  newValue?: any;
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
      const resourceType = event.queryStringParameters?.resourceType;
      const startDate = event.queryStringParameters?.startDate;
      const limit = parseInt(event.queryStringParameters?.limit || "50", 10);

      const params: any = {
        TableName: TABLES.AUDIT_TRAIL,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId } as any,
        ScanIndexForward: false,
        Limit: Math.min(limit, 200),
      };

      if (startDate) {
        params.KeyConditionExpression += " AND #ts >= :start";
        params.ExpressionAttributeNames = { "#ts": "timestamp" };
        params.ExpressionAttributeValues[":start"] = startDate;
      }

      if (resourceType) {
        params.FilterExpression = "resourceType = :rt";
        params.ExpressionAttributeValues[":rt"] = resourceType;
      }

      const result = await docClient.send(new QueryCommand(params));
      return success({ auditLogs: result.Items || [] });
    }

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body: AuditLogBody = JSON.parse(event.body);

      if (!body.action || !body.resourceType || !body.resourceId) {
        return error("action, resourceType, and resourceId are required", 400);
      }

      const now = new Date().toISOString();
      const auditId = uuidv4();

      const auditLog = {
        auditId,
        storeId,
        action: body.action,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        details: body.details || null,
        previousValue: body.previousValue || null,
        newValue: body.newValue || null,
        performedBy: claims.email,
        userId: claims.sub,
        timestamp: now,
        createdAt: now,
      };

      await docClient.send(
        new PutCommand({ TableName: TABLES.AUDIT_TRAIL, Item: auditLog })
      );

      return success(auditLog, 201);
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("AuditTrail error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
