import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface PriceEntryBody {
  supplierId: string;
  itemId: string;
  itemName: string;
  price: number;
  unit: string;
  effectiveDate?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const method = event.httpMethod;

    if (method === "GET") {
      const supplierId = event.queryStringParameters?.supplierId;
      const itemId = event.queryStringParameters?.itemId;

      if (!supplierId) return error("supplierId query param is required", 400);

      const params: any = {
        TableName: TABLES.PRICE_HISTORY,
        IndexName: "supplierId-timestamp-index",
        KeyConditionExpression: "supplierId = :sid",
        ExpressionAttributeValues: { ":sid": supplierId } as any,
        ScanIndexForward: false,
      };

      if (itemId) {
        params.FilterExpression = "itemId = :iid";
        params.ExpressionAttributeValues[":iid"] = itemId;
      }

      const result = await docClient.send(new QueryCommand(params));
      const prices = result.Items || [];

      // Calculate price trends per item
      const itemPrices = new Map<string, any[]>();
      for (const p of prices) {
        const key = (p as any).itemId;
        if (!itemPrices.has(key)) itemPrices.set(key, []);
        itemPrices.get(key)!.push(p);
      }

      const trends = Array.from(itemPrices.entries()).map(([iid, entries]) => {
        const sorted = entries.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
        const latest = sorted[sorted.length - 1];
        const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        const changePercent = previous
          ? Math.round(((latest.price - previous.price) / previous.price) * 10000) / 100
          : 0;

        return {
          itemId: iid,
          itemName: latest.itemName,
          currentPrice: latest.price,
          previousPrice: previous?.price || null,
          changePercent,
          unit: latest.unit,
          entryCount: sorted.length,
        };
      });

      return success({ prices, trends });
    }

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body: PriceEntryBody = JSON.parse(event.body);

      if (!body.supplierId || !body.itemId || body.price === undefined) {
        return error("supplierId, itemId, and price are required", 400);
      }

      const now = new Date().toISOString();
      const priceId = uuidv4();

      const entry = {
        priceId,
        supplierId: body.supplierId,
        itemId: body.itemId,
        itemName: body.itemName || body.itemId,
        price: body.price,
        unit: body.unit || "each",
        effectiveDate: body.effectiveDate || now.split("T")[0],
        timestamp: now,
        createdAt: now,
      };

      await docClient.send(
        new PutCommand({ TableName: TABLES.PRICE_HISTORY, Item: entry })
      );

      return success(entry, 201);
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("VendorPriceHistory error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
