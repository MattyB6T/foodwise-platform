import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { handler as csvImportHandler } from "./csvImport";
import { catalogSyncHandler } from "./squarePoller";

// GET /stores/{storeId}/pos/connections
async function listConnections(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_CONNECTIONS,
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
    })
  );

  return success({ connections: result.Items ?? [] });
}

// POST /stores/{storeId}/pos/connections
async function createConnection(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const body = JSON.parse(event.body || "{}");
  const { posSystem, config } = body;

  if (!posSystem) return error("Missing posSystem", 400);

  const connectionId = uuidv4();
  const now = new Date().toISOString();

  const item = {
    storeId,
    connectionId,
    posSystem,
    status: "active",
    config: config || {},
    createdAt: now,
    updatedAt: now,
    lastSyncAt: null,
    syncStats: { totalTransactions: 0, lastError: null },
  };

  await docClient.send(new PutCommand({ TableName: TABLES.POS_CONNECTIONS, Item: item }));

  return success({ connection: item }, 201);
}

// PUT /stores/{storeId}/pos/connections/{connectionId}
async function updateConnection(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  const connectionId = event.pathParameters?.connectionId || event.pathParameters?.proxy?.split("/").pop();
  if (!storeId || !connectionId) return error("Missing storeId or connectionId", 400);

  const body = JSON.parse(event.body || "{}");
  const now = new Date().toISOString();

  const updateExpressions: string[] = ["updatedAt = :now"];
  const expressionValues: Record<string, any> = { ":now": now };

  if (body.status) {
    updateExpressions.push("status = :status");
    expressionValues[":status"] = body.status;
  }
  if (body.config) {
    updateExpressions.push("config = :config");
    expressionValues[":config"] = body.config;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POS_CONNECTIONS,
      Key: { storeId, connectionId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionValues,
    })
  );

  return success({ message: "Connection updated" });
}

// DELETE /stores/{storeId}/pos/connections/{connectionId}
async function deleteConnection(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  const connectionId = event.pathParameters?.connectionId || event.pathParameters?.proxy?.split("/").pop();
  if (!storeId || !connectionId) return error("Missing storeId or connectionId", 400);

  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.POS_CONNECTIONS,
      Key: { storeId, connectionId },
    })
  );

  return success({ message: "Connection deleted" });
}

// GET /stores/{storeId}/pos/mappings
async function listMappings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.INGREDIENT_MAPPINGS,
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
    })
  );

  return success({ mappings: result.Items ?? [] });
}

// POST /stores/{storeId}/pos/mappings
async function createMapping(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const body = JSON.parse(event.body || "{}");
  const { posSystem, posItemId, posItemName, recipeId, ingredientId, quantityPerUnit, confidence } = body;

  if (!posSystem || !posItemId) return error("Missing posSystem or posItemId", 400);

  const posItemKey = `${posSystem}#${posItemId}`;
  const now = new Date().toISOString();

  const item = {
    storeId,
    posItemKey,
    posSystem,
    posItemId,
    posItemName: posItemName || "",
    recipeId: recipeId || null,
    ingredientId: ingredientId || null,
    quantityPerUnit: quantityPerUnit || 1,
    confidence: confidence || 1.0,
    mappingSource: "manual",
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLES.INGREDIENT_MAPPINGS, Item: item }));

  return success({ mapping: item }, 201);
}

// PUT /stores/{storeId}/pos/mappings/{posItemKey}
async function updateMapping(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const body = JSON.parse(event.body || "{}");
  const { posItemKey, recipeId, ingredientId, quantityPerUnit, confidence } = body;

  if (!posItemKey) return error("Missing posItemKey", 400);

  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.INGREDIENT_MAPPINGS,
      Key: { storeId, posItemKey },
      UpdateExpression:
        "SET recipeId = :rid, ingredientId = :iid, quantityPerUnit = :qpu, confidence = :conf, updatedAt = :now, mappingSource = :src",
      ExpressionAttributeValues: {
        ":rid": recipeId || null,
        ":iid": ingredientId || null,
        ":qpu": quantityPerUnit || 1,
        ":conf": confidence || 1.0,
        ":now": now,
        ":src": "manual",
      },
    })
  );

  return success({ message: "Mapping updated" });
}

// GET /stores/{storeId}/pos/transactions
async function listPosTransactions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const limit = parseInt(event.queryStringParameters?.limit || "50");

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_TRANSACTIONS_RAW,
      IndexName: "storeId-timestamp-index",
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return success({ transactions: result.Items ?? [] });
}

// GET /stores/{storeId}/pos/sync-status
async function getSyncStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const storeId = event.pathParameters?.storeId;
  if (!storeId) return error("Missing storeId", 400);

  const connections = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_CONNECTIONS,
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
    })
  );

  const statuses = (connections.Items ?? []).map((c: any) => ({
    connectionId: c.connectionId,
    posSystem: c.posSystem,
    status: c.status,
    lastSyncAt: c.lastSyncAt,
    syncStats: c.syncStats,
  }));

  return success({ integrations: statuses });
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const path = event.path || "";
    const method = event.httpMethod || "";

    if (path.includes("/pos/sync-status") && method === "GET") return getSyncStatus(event);
    if (path.includes("/pos/transactions") && method === "GET") return listPosTransactions(event);
    if (path.includes("/pos/csv-import") && method === "POST") return csvImportHandler(event);
    if (path.includes("/pos/square/catalog-sync") && method === "POST") return catalogSyncHandler(event);

    // Connections CRUD
    if (path.includes("/pos/connections")) {
      if (method === "GET") return listConnections(event);
      if (method === "POST") return createConnection(event);
      if (method === "PUT") return updateConnection(event);
      if (method === "DELETE") return deleteConnection(event);
    }

    // Mappings CRUD
    if (path.includes("/pos/mappings")) {
      if (method === "GET") return listMappings(event);
      if (method === "POST") return createMapping(event);
      if (method === "PUT") return updateMapping(event);
    }

    return error("POS route not found", 404, "NOT_FOUND");
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return error(err.message, 401, "UNAUTHORIZED");
    }
    return error(err.message || "Internal error", 500, "INTERNAL_ERROR");
  }
};
