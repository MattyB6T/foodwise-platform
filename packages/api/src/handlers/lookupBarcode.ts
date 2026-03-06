import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Supplier, CatalogItem, PurchaseOrder } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

function normalizeBarcode(barcode: string): string {
  return barcode.replace(/[^0-9A-Za-z]/g, "");
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const code = event.pathParameters?.code;
    if (!code) {
      return error("Barcode is required", 400);
    }

    const normalized = normalizeBarcode(code);

    // Scan suppliers to find matching barcode
    const suppliersResult = await docClient.send(
      new ScanCommand({ TableName: TABLES.SUPPLIERS })
    );

    let matchedSupplier: Supplier | undefined;
    let matchedItem: CatalogItem | undefined;

    for (const item of suppliersResult.Items || []) {
      const supplier = item as Supplier;
      const found = (supplier.catalog || []).find(
        (c) => normalizeBarcode(c.barcode) === normalized
      );
      if (found) {
        matchedSupplier = supplier;
        matchedItem = found;
        break;
      }
    }

    if (!matchedSupplier || !matchedItem) {
      return error("Barcode not found in any supplier catalog", 404, "BARCODE_NOT_FOUND");
    }

    // Find open POs expecting this item
    const storeId = event.queryStringParameters?.storeId;
    let openOrders: { orderId: string; quantityOrdered: number; quantityReceived: number; expectedDeliveryDate: string }[] = [];

    if (storeId) {
      const poResult = await docClient.send(
        new QueryCommand({
          TableName: TABLES.PURCHASE_ORDERS,
          IndexName: "storeId-index",
          KeyConditionExpression: "storeId = :storeId",
          FilterExpression: "#s IN (:draft, :submitted, :partial)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":storeId": storeId,
            ":draft": "draft",
            ":submitted": "submitted",
            ":partial": "partial",
          },
        })
      );

      for (const po of poResult.Items || []) {
        const order = po as PurchaseOrder;
        const line = order.lines.find((l) => l.itemId === matchedItem!.itemId);
        if (line) {
          openOrders.push({
            orderId: order.orderId,
            quantityOrdered: line.quantityOrdered,
            quantityReceived: line.quantityReceived,
            expectedDeliveryDate: order.expectedDeliveryDate,
          });
        }
      }
    }

    return success({
      barcode: code,
      barcodeFormat: matchedItem.barcodeFormat,
      ingredient: {
        itemId: matchedItem.itemId,
        itemName: matchedItem.itemName,
        unit: matchedItem.unit,
      },
      supplier: {
        supplierId: matchedSupplier.supplierId,
        name: matchedSupplier.name,
      },
      expectedPrice: matchedItem.unitCost,
      casePack: matchedItem.casePack,
      openPurchaseOrders: openOrders,
    });
  } catch (err) {
    console.error("LookupBarcode error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
