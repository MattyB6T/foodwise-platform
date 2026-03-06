import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  Supplier,
  CatalogItem,
  PurchaseOrder,
  ReceivingLog,
  ScannedItem,
  ReceivingDiscrepancy,
} from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface ReceiveShipmentBody {
  orderId?: string;
  scans: {
    barcode: string;
    quantity: number;
  }[];
}

function normalizeBarcode(barcode: string): string {
  return barcode.replace(/[^0-9A-Za-z]/g, "");
}

async function buildBarcodeIndex(): Promise<
  Map<string, { supplier: Supplier; catalogItem: CatalogItem }>
> {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLES.SUPPLIERS })
  );

  const index = new Map<
    string,
    { supplier: Supplier; catalogItem: CatalogItem }
  >();

  for (const item of result.Items || []) {
    const supplier = item as Supplier;
    for (const cat of supplier.catalog || []) {
      index.set(normalizeBarcode(cat.barcode), { supplier, catalogItem: cat });
    }
  }

  return index;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: ReceiveShipmentBody = JSON.parse(event.body);

    if (!body.scans || !Array.isArray(body.scans) || body.scans.length === 0) {
      return error("scans array is required and must not be empty", 400);
    }

    // Build barcode -> supplier/catalog lookup
    const barcodeIndex = await buildBarcodeIndex();

    // Fetch purchase order if provided
    let order: PurchaseOrder | undefined;
    if (body.orderId) {
      const orderResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.PURCHASE_ORDERS,
          Key: { orderId: body.orderId },
        })
      );
      order = orderResult.Item as PurchaseOrder | undefined;
    }

    // Build PO line lookup: itemId -> order line index
    const poLineMap = new Map<string, number>();
    if (order) {
      order.lines.forEach((line, idx) => poLineMap.set(line.itemId, idx));
    }

    const now = new Date().toISOString();
    const scannedItems: ScannedItem[] = [];
    const discrepancies: ReceivingDiscrepancy[] = [];
    const inventoryUpdates = new Map<
      string,
      { quantity: number; itemId: string }
    >();
    let supplierId = order?.supplierId || "";
    let supplierName = order?.supplierName || "";

    for (const scan of body.scans) {
      const normalized = normalizeBarcode(scan.barcode);
      const match = barcodeIndex.get(normalized);

      if (!match) {
        discrepancies.push({
          type: "unexpected_item",
          itemId: "unknown",
          itemName: `Barcode: ${scan.barcode}`,
          actual: scan.quantity,
          details: `Barcode ${scan.barcode} not found in any supplier catalog`,
        });
        continue;
      }

      const { supplier, catalogItem } = match;
      if (!supplierId) {
        supplierId = supplier.supplierId;
        supplierName = supplier.name;
      }

      scannedItems.push({
        barcode: scan.barcode,
        itemId: catalogItem.itemId,
        itemName: catalogItem.itemName,
        quantity: scan.quantity,
        unit: catalogItem.unit,
        unitCost: catalogItem.unitCost,
        timestamp: now,
      });

      // Accumulate inventory updates
      const existing = inventoryUpdates.get(catalogItem.itemId);
      if (existing) {
        existing.quantity += scan.quantity;
      } else {
        inventoryUpdates.set(catalogItem.itemId, {
          quantity: scan.quantity,
          itemId: catalogItem.itemId,
        });
      }

      // Check against PO if present
      if (order) {
        const poLineIdx = poLineMap.get(catalogItem.itemId);
        if (poLineIdx === undefined) {
          discrepancies.push({
            type: "unexpected_item",
            itemId: catalogItem.itemId,
            itemName: catalogItem.itemName,
            actual: scan.quantity,
            details: `Item not on purchase order ${body.orderId}`,
          });
        }
      }
    }

    // Update inventory for each scanned item
    for (const [itemId, update] of inventoryUpdates) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.INVENTORY,
          Key: { storeId, itemId },
          UpdateExpression:
            "SET quantity = if_not_exists(quantity, :zero) + :qty, updatedAt = :now",
          ExpressionAttributeValues: {
            ":qty": update.quantity,
            ":zero": 0,
            ":now": now,
          },
        })
      );
    }

    // Update PO line quantities and check for discrepancies
    if (order && body.orderId) {
      const receivedByItem = new Map<string, number>();
      for (const item of scannedItems) {
        receivedByItem.set(
          item.itemId,
          (receivedByItem.get(item.itemId) || 0) + item.quantity
        );
      }

      for (const line of order.lines) {
        const received = receivedByItem.get(line.itemId) || 0;
        const newReceived = line.quantityReceived + received;

        if (received > 0 && newReceived !== line.quantityOrdered) {
          discrepancies.push({
            type: "quantity_mismatch",
            itemId: line.itemId,
            itemName: line.itemName,
            expected: line.quantityOrdered,
            actual: newReceived,
            details: `Ordered ${line.quantityOrdered}, total received ${newReceived}`,
          });
        }
      }

      // Update PO with received quantities and status
      const updatedLines = order.lines.map((line) => ({
        ...line,
        quantityReceived:
          line.quantityReceived + (receivedByItem.get(line.itemId) || 0),
      }));

      const allReceived = updatedLines.every(
        (l) => l.quantityReceived >= l.quantityOrdered
      );
      const anyReceived = updatedLines.some((l) => l.quantityReceived > 0);
      const newStatus = allReceived
        ? "received"
        : anyReceived
          ? "partial"
          : order.status;

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.PURCHASE_ORDERS,
          Key: { orderId: body.orderId },
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
    }

    // Save receiving log
    const receivingLog: ReceivingLog = {
      receivingId: uuidv4(),
      storeId,
      orderId: body.orderId,
      supplierId,
      supplierName,
      receivedBy: user.email,
      itemsScanned: scannedItems,
      discrepancies,
      totalItemsReceived: scannedItems.reduce((s, i) => s + i.quantity, 0),
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.RECEIVING_LOGS,
        Item: receivingLog,
      })
    );

    return success(receivingLog, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("ReceiveShipment error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
