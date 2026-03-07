import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { createHmac } from "crypto";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { processTransaction } from "./posProcessor";

function verifyHmacSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

async function getToastConnection(storeId: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_CONNECTIONS,
      KeyConditionExpression: "storeId = :sid",
      FilterExpression: "posSystem = :ps AND #s = :active",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":sid": storeId,
        ":ps": "toast",
        ":active": "active",
      },
    })
  );
  return result.Items?.[0];
}

function normalizeToastOrder(storeId: string, toastOrder: any) {
  const lineItems = (toastOrder.checks || []).flatMap((check: any) =>
    (check.selections || []).map((sel: any) => ({
      posItemId: sel.itemGuid || sel.guid || "",
      posItemName: sel.displayName || sel.name || "",
      quantity: sel.quantity || 1,
      unitPrice: (sel.price || 0) / 100,
      modifiers: (sel.modifiers || []).map((m: any) => m.displayName || m.name),
    }))
  );

  return {
    storeId,
    posTransactionId: toastOrder.guid || toastOrder.entityGuid || "",
    posSystem: "toast" as const,
    timestamp: toastOrder.closedDate || toastOrder.modifiedDate || new Date().toISOString(),
    lineItems,
    subtotal: (toastOrder.amount || 0) / 100,
    tax: (toastOrder.taxAmount || 0) / 100,
    total: (toastOrder.totalAmount || 0) / 100,
    paymentMethod: toastOrder.payments?.[0]?.type || "unknown",
  };
}

async function updateSyncStats(storeId: string, connectionId: string, count: number, lastError: string | null) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POS_CONNECTIONS,
      Key: { storeId, connectionId },
      UpdateExpression: "SET lastSyncAt = :now, syncStats.totalTransactions = syncStats.totalTransactions + :cnt, syncStats.lastError = :err",
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
        ":cnt": count,
        ":err": lastError,
      },
    })
  );
}

// POST /webhooks/toast/{storeId}
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId || event.pathParameters?.proxy;
    if (!storeId) return error("Missing storeId", 400);

    const connection = await getToastConnection(storeId);
    if (!connection) return error("No active Toast connection for this store", 404, "NOT_FOUND");

    // HMAC signature validation
    const signature = event.headers["Toast-Signature"] || event.headers["toast-signature"] || "";
    const webhookSecret = connection.config?.webhookSecret;

    if (webhookSecret && signature) {
      if (!verifyHmacSignature(event.body || "", signature, webhookSecret)) {
        return error("Invalid webhook signature", 401, "INVALID_SIGNATURE");
      }
    }

    const payload = JSON.parse(event.body || "{}");

    // Toast sends different event types
    const eventType = payload.eventType || payload.type || "ORDER_PAID";

    if (!["ORDER_PAID", "ORDER_CLOSED", "PAYMENT_APPLIED"].includes(eventType)) {
      return success({ message: "Event type ignored", eventType });
    }

    const orders = Array.isArray(payload.orders) ? payload.orders : payload.order ? [payload.order] : [payload];

    let processed = 0;
    let duplicated = 0;

    for (const order of orders) {
      const normalized = normalizeToastOrder(storeId, order);
      if (!normalized.posTransactionId) continue;

      const result = await processTransaction(normalized);
      if (result.processed) processed++;
      if (result.duplicated) duplicated++;
    }

    await updateSyncStats(storeId, connection.connectionId, processed, null);

    return success({ message: "Webhook processed", processed, duplicated });
  } catch (err: any) {
    console.error("Toast webhook error:", err);
    return error(err.message || "Webhook processing failed", 500, "INTERNAL_ERROR");
  }
};

// POST /webhooks/toast/{storeId}/import — historical bulk import
export const importHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId || event.pathParameters?.proxy?.split("/")[0];
    if (!storeId) return error("Missing storeId", 400);

    const body = JSON.parse(event.body || "{}");
    const orders = body.orders || [];

    if (!Array.isArray(orders) || orders.length === 0) {
      return error("No orders provided for import", 400);
    }

    let processed = 0;
    let duplicated = 0;
    let errors: string[] = [];

    for (const order of orders) {
      try {
        const normalized = normalizeToastOrder(storeId, order);
        if (!normalized.posTransactionId) continue;
        const result = await processTransaction(normalized);
        if (result.processed) processed++;
        if (result.duplicated) duplicated++;
      } catch (err: any) {
        errors.push(`Order ${order.guid}: ${err.message}`);
      }
    }

    return success({
      message: "Historical import complete",
      total: orders.length,
      processed,
      duplicated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return error(err.message || "Import failed", 500, "INTERNAL_ERROR");
  }
};
