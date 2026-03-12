import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface ReceiveLineItem {
  itemId: string;
  itemName: string;
  quantityReceived: number;
  unit: string;
}

interface ReceivePurchaseOrderBody {
  lines: ReceiveLineItem[];
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    // Extract orderId from path: /purchase-orders/{orderId}/receive
    const path = event.path || "";
    const match = path.match(/\/purchase-orders\/([^/]+)\/receive/);
    const orderId = match?.[1];
    if (!orderId) {
      return error("orderId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: ReceivePurchaseOrderBody = JSON.parse(event.body);

    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      return error("lines array is required and must not be empty", 400);
    }

    // Fetch the existing order
    const orderResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        Key: { orderId },
      })
    );

    if (!orderResult.Item) {
      return error("Purchase order not found", 404, "NOT_FOUND");
    }

    const order = orderResult.Item;

    if (order.status !== "submitted" && order.status !== "partial") {
      return error(
        "Only submitted or partially received orders can be received",
        400,
        "INVALID_STATUS"
      );
    }

    const storeId = order.storeId;
    const now = new Date().toISOString();

    // Build received quantities map
    const receivedMap = new Map<string, number>();
    for (const line of body.lines) {
      if (line.quantityReceived > 0) {
        receivedMap.set(line.itemId, line.quantityReceived);
      }
    }

    // Update PO lines with new received quantities
    const updatedLines = order.lines.map((line: any) => {
      const newReceived = receivedMap.get(line.itemId) || 0;
      return {
        ...line,
        quantityReceived: (line.quantityReceived || 0) + newReceived,
      };
    });

    const allReceived = updatedLines.every(
      (l: any) => l.quantityReceived >= l.quantityOrdered
    );
    const anyReceived = updatedLines.some((l: any) => l.quantityReceived > 0);
    const newStatus = allReceived
      ? "received"
      : anyReceived
        ? "partial"
        : order.status;

    // Update purchase order
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        Key: { orderId },
        UpdateExpression:
          "SET #lines = :lines, #s = :status, updatedAt = :now",
        ExpressionAttributeNames: { "#lines": "lines", "#s": "status" },
        ExpressionAttributeValues: {
          ":lines": updatedLines,
          ":status": newStatus,
          ":now": now,
        },
      })
    );

    // Update inventory for received items
    await Promise.all(
      Array.from(receivedMap).map(([itemId, quantity]) =>
        docClient.send(
          new UpdateCommand({
            TableName: TABLES.INVENTORY,
            Key: { storeId, itemId },
            UpdateExpression:
              "SET quantity = if_not_exists(quantity, :zero) + :qty, updatedAt = :now",
            ExpressionAttributeValues: {
              ":qty": quantity,
              ":zero": 0,
              ":now": now,
            },
          })
        )
      )
    );

    // Save receiving log
    const receivingLog = {
      receivingId: uuidv4(),
      storeId,
      orderId,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      receivedBy: user.email,
      itemsScanned: body.lines
        .filter((l) => l.quantityReceived > 0)
        .map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: l.quantityReceived,
          unit: l.unit,
          timestamp: now,
        })),
      discrepancies: [],
      totalItemsReceived: body.lines.reduce(
        (sum, l) => sum + l.quantityReceived,
        0
      ),
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.RECEIVING_LOGS,
        Item: receivingLog,
      })
    );

    return success({
      order: { ...order, lines: updatedLines, status: newStatus },
      receivingLog,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("ReceivePurchaseOrder error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
