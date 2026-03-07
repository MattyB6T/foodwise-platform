import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { processTransaction } from "./posProcessor";

interface SquareOrder {
  id: string;
  state: string;
  created_at: string;
  closed_at?: string;
  line_items?: Array<{
    uid: string;
    catalog_object_id?: string;
    name: string;
    quantity: string;
    base_price_money?: { amount: number; currency: string };
    total_money?: { amount: number; currency: string };
    modifiers?: Array<{ name: string }>;
  }>;
  total_money?: { amount: number; currency: string };
  total_tax_money?: { amount: number; currency: string };
  tenders?: Array<{ type: string }>;
}

function normalizeSquareOrder(storeId: string, order: SquareOrder) {
  const lineItems = (order.line_items || []).map((item) => ({
    posItemId: item.catalog_object_id || item.uid,
    posItemName: item.name,
    quantity: parseInt(item.quantity) || 1,
    unitPrice: (item.base_price_money?.amount || 0) / 100,
    modifiers: (item.modifiers || []).map((m) => m.name),
  }));

  const total = (order.total_money?.amount || 0) / 100;
  const tax = (order.total_tax_money?.amount || 0) / 100;

  return {
    storeId,
    posTransactionId: order.id,
    posSystem: "square" as const,
    timestamp: order.closed_at || order.created_at,
    lineItems,
    subtotal: total - tax,
    tax,
    total,
    paymentMethod: order.tenders?.[0]?.type || "unknown",
  };
}

async function getSquareConnections() {
  // Scan for all active Square connections (poll runs for all stores)
  const allConnections: any[] = [];
  const storeIds = new Set<string>();

  // Get all stores first
  const stores = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_CONNECTIONS,
      IndexName: "posSystem-status-index",
      KeyConditionExpression: "posSystem = :ps AND #s = :active",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":ps": "square",
        ":active": "active",
      },
    })
  ).catch(() => null);

  return (stores as any)?.Items ?? [];
}

async function fetchSquareOrders(accessToken: string, locationId: string, beginTime: string): Promise<SquareOrder[]> {
  const url = "https://connect.squareup.com/v2/orders/search";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      location_ids: [locationId],
      query: {
        filter: {
          state_filter: { states: ["COMPLETED"] },
          date_time_filter: {
            closed_at: { start_at: beginTime },
          },
        },
        sort: { sort_field: "CLOSED_AT", sort_order: "ASC" },
      },
      limit: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`Square API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data as any).orders || [];
}

// EventBridge scheduled handler — polls all active Square connections
export const handler = async (): Promise<void> => {
  console.log("Square polling started");

  let connections: any[];
  try {
    connections = await getSquareConnections();
  } catch {
    // If the GSI doesn't exist yet, scan instead
    connections = [];
  }

  if (connections.length === 0) {
    console.log("No active Square connections found");
    return;
  }

  for (const connection of connections) {
    const { storeId, connectionId, config } = connection;
    const accessToken = config?.accessToken;
    const locationId = config?.locationId;

    if (!accessToken || !locationId) {
      console.warn(`Square connection ${connectionId} missing accessToken or locationId`);
      continue;
    }

    // Poll from last sync time or 15 minutes ago
    const beginTime = connection.lastSyncAt || new Date(Date.now() - 15 * 60 * 1000).toISOString();

    try {
      const orders = await fetchSquareOrders(accessToken, locationId, beginTime);
      let processed = 0;
      let duplicated = 0;

      for (const order of orders) {
        const normalized = normalizeSquareOrder(storeId, order);
        const result = await processTransaction(normalized);
        if (result.processed) processed++;
        if (result.duplicated) duplicated++;
      }

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.POS_CONNECTIONS,
          Key: { storeId, connectionId },
          UpdateExpression: "SET lastSyncAt = :now, syncStats.totalTransactions = syncStats.totalTransactions + :cnt, syncStats.lastError = :err",
          ExpressionAttributeValues: {
            ":now": new Date().toISOString(),
            ":cnt": processed,
            ":err": null,
          },
        })
      );

      console.log(`Square poll for store ${storeId}: ${processed} processed, ${duplicated} duplicated`);
    } catch (err: any) {
      console.error(`Square poll error for store ${storeId}:`, err);
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.POS_CONNECTIONS,
          Key: { storeId, connectionId },
          UpdateExpression: "SET syncStats.lastError = :err",
          ExpressionAttributeValues: { ":err": err.message },
        })
      );
    }
  }
};

// OAuth callback — POST /pos/square/oauth
export const oauthHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { code, storeId } = body;

    if (!code || !storeId) return error("Missing code or storeId", 400);

    const clientId = process.env.SQUARE_CLIENT_ID;
    const clientSecret = process.env.SQUARE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return error("Square OAuth not configured", 500, "CONFIG_ERROR");
    }

    const tokenResponse = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return error("Failed to exchange OAuth code", 400, "OAUTH_ERROR");
    }

    const tokenData: any = await tokenResponse.json();

    return success({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      merchantId: tokenData.merchant_id,
    });
  } catch (err: any) {
    return error(err.message || "OAuth failed", 500, "INTERNAL_ERROR");
  }
};

// Catalog sync — POST /stores/{storeId}/pos/square/catalog-sync
export const catalogSyncHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("Missing storeId", 400);

    const body = JSON.parse(event.body || "{}");
    const { accessToken } = body;
    if (!accessToken) return error("Missing accessToken", 400);

    // Fetch catalog
    const catalogResponse = await fetch("https://connect.squareup.com/v2/catalog/list?types=ITEM", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2024-01-18",
      },
    });

    if (!catalogResponse.ok) {
      return error("Failed to fetch Square catalog", 400);
    }

    const catalogData: any = await catalogResponse.json();
    const items = catalogData.objects || [];

    // Get existing recipes for fuzzy matching
    const recipesRes = await docClient.send(
      new QueryCommand({
        TableName: TABLES.RECIPES,
        IndexName: undefined,
        Limit: 500,
      })
    ).catch(() => ({ Items: [] as any[] }));
    const recipeList: any[] = recipesRes.Items || [];

    let autoMapped = 0;
    let needsReview = 0;

    for (const item of items) {
      const itemData = item.item_data;
      if (!itemData) continue;

      const posItemId = item.id;
      const posItemName = itemData.name || "";
      const posItemKey = `square#${posItemId}`;

      // Fuzzy match against recipe names
      let bestMatch: { recipeId: string; confidence: number } | null = null;
      for (const recipe of recipeList) {
        const confidence = fuzzyMatch(posItemName, recipe.name || "");
        if (confidence > (bestMatch?.confidence || 0)) {
          bestMatch = { recipeId: recipe.recipeId, confidence };
        }
      }

      const mapping: any = {
        storeId,
        posItemKey,
        posSystem: "square",
        posItemId,
        posItemName,
        quantityPerUnit: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (bestMatch && bestMatch.confidence >= 0.85) {
        mapping.recipeId = bestMatch.recipeId;
        mapping.confidence = bestMatch.confidence;
        mapping.mappingSource = "auto-high";
        autoMapped++;
      } else if (bestMatch && bestMatch.confidence >= 0.6) {
        mapping.recipeId = bestMatch.recipeId;
        mapping.confidence = bestMatch.confidence;
        mapping.mappingSource = "auto-low";
        needsReview++;
      } else {
        mapping.recipeId = null;
        mapping.confidence = bestMatch?.confidence || 0;
        mapping.mappingSource = "unmatched";
        needsReview++;
      }

      await docClient.send(new PutCommand({ TableName: TABLES.INGREDIENT_MAPPINGS, Item: mapping }));
    }

    return success({
      message: "Catalog sync complete",
      totalItems: items.length,
      autoMapped,
      needsReview,
    });
  } catch (err: any) {
    return error(err.message || "Catalog sync failed", 500, "INTERNAL_ERROR");
  }
};

function fuzzyMatch(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Levenshtein-based similarity
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshtein(na, nb);
  return 1 - distance / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
