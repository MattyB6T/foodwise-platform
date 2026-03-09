import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { getUserClaims } from "../utils/auth";
import { success, error } from "../utils/response";
import { v4 as uuid } from "uuid";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path || "";
  const storeId = event.pathParameters?.storeId || event.pathParameters?.proxy?.split("/")[0] || "";

  // Route: /stores/{storeId}/revenue-sources
  if (path.includes("/revenue-sources")) {
    // PATCH /revenue-sources/{sourceId}
    if (method === "PATCH" && /\/revenue-sources\/[^/]+$/.test(path)) {
      return patchRevenueSource(event, storeId);
    }
    if (method === "POST") return createRevenueSource(event, storeId);
    if (method === "GET") return listRevenueSources(event, storeId);
  }

  // Route: /stores/{storeId}/revenue-entries
  if (path.includes("/revenue-entries")) {
    // DELETE /revenue-entries/{entryId}
    if (method === "DELETE" && /\/revenue-entries\/[^/]+$/.test(path)) {
      return deleteRevenueEntry(event, storeId);
    }
    if (method === "POST") return createRevenueEntry(event, storeId);
    if (method === "GET") return listRevenueEntries(event, storeId);
  }

  return error("Revenue route not found", 404, "NOT_FOUND");
};

// ── GET /revenue-sources ──
async function listRevenueSources(
  _event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.REVENUE_SOURCES,
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
    })
  );
  const sources = (result.Items || []).filter((s: any) => s.isActive !== false);
  return success({ sources });
}

// ── POST /revenue-sources ──
async function createRevenueSource(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || "{}");
  if (!body.name || !body.type) {
    return error("name and type are required", 400);
  }

  const source = {
    storeId,
    sourceId: uuid(),
    name: body.name,
    type: body.type,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({ TableName: TABLES.REVENUE_SOURCES, Item: source })
  );
  return success(source, 201);
}

// ── PATCH /revenue-sources/{sourceId} ──
async function patchRevenueSource(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split("/");
  const sourceId = pathParts[pathParts.length - 1];
  const body = JSON.parse(event.body || "{}");

  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};

  if (body.name !== undefined) {
    updates.push("#n = :n");
    names["#n"] = "name";
    values[":n"] = body.name;
  }
  if (body.isActive !== undefined) {
    updates.push("isActive = :a");
    values[":a"] = body.isActive;
  }

  if (updates.length === 0) return error("Nothing to update", 400);

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLES.REVENUE_SOURCES,
      Key: { storeId, sourceId },
      UpdateExpression: "SET " + updates.join(", "),
      ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  return success(result.Attributes);
}

// ── GET /revenue-entries ──
async function listRevenueEntries(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const startDate = qs.startDate;
  const endDate = qs.endDate;
  const sourceId = qs.sourceId;

  // Use the date GSI for date-range queries
  if (startDate || endDate) {
    let keyExpr = "storeId = :sid";
    const values: Record<string, any> = { ":sid": storeId };

    if (startDate && endDate) {
      keyExpr += " AND #d BETWEEN :start AND :end";
      values[":start"] = startDate;
      values[":end"] = endDate;
    } else if (startDate) {
      keyExpr += " AND #d >= :start";
      values[":start"] = startDate;
    } else if (endDate) {
      keyExpr += " AND #d <= :end";
      values[":end"] = endDate;
    }

    let filterExpr: string | undefined;
    if (sourceId) {
      filterExpr = "sourceId = :src";
      values[":src"] = sourceId;
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.REVENUE_ENTRIES,
        IndexName: "storeId-date-index",
        KeyConditionExpression: keyExpr,
        ExpressionAttributeNames: { "#d": "date" },
        ...(filterExpr && { FilterExpression: filterExpr }),
        ExpressionAttributeValues: values,
        ScanIndexForward: false,
      })
    );
    return success({ entries: result.Items || [] });
  }

  // Default: query by storeId (PK), return most recent
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.REVENUE_ENTRIES,
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
      ScanIndexForward: false,
      Limit: 100,
    })
  );
  return success({ entries: result.Items || [] });
}

// ── POST /revenue-entries ──
async function createRevenueEntry(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const user = getUserClaims(event);
  const body = JSON.parse(event.body || "{}");

  if (!body.sourceId || body.amount === undefined || !body.date) {
    return error("sourceId, amount, and date are required", 400);
  }
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return error("amount must be a positive number", 400);
  }

  const entry = {
    storeId,
    entryId: uuid(),
    sourceId: body.sourceId,
    amount: body.amount,
    date: body.date,
    note: body.note || undefined,
    createdBy: user.email,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({ TableName: TABLES.REVENUE_ENTRIES, Item: entry })
  );
  return success(entry, 201);
}

// ── DELETE /revenue-entries/{entryId} ──
async function deleteRevenueEntry(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const pathParts = event.path.split("/");
  const entryId = pathParts[pathParts.length - 1];

  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.REVENUE_ENTRIES,
      Key: { storeId, entryId },
    })
  );
  return success({ deleted: true });
}
