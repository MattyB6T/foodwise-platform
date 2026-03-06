import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { PurchaseOrder, PurchaseOrderLine, Supplier } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreatePurchaseOrderBody {
  storeId: string;
  supplierId: string;
  expectedDeliveryDate: string;
  forecastId?: string;
  lines: {
    itemId: string;
    itemName: string;
    unit: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: CreatePurchaseOrderBody = JSON.parse(event.body);

    if (!body.storeId || !body.supplierId || !body.lines?.length) {
      return error("storeId, supplierId, and lines are required", 400);
    }

    // Fetch supplier name
    const supplierResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.SUPPLIERS,
        Key: { supplierId: body.supplierId },
      })
    );

    if (!supplierResult.Item) {
      return error("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
    }

    const supplier = supplierResult.Item as Supplier;

    const lines: PurchaseOrderLine[] = body.lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      unit: line.unit,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: 0,
      unitCost: line.unitCost,
    }));

    const totalCost = lines.reduce(
      (sum, l) => sum + l.quantityOrdered * l.unitCost,
      0
    );

    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      orderId: uuidv4(),
      storeId: body.storeId,
      supplierId: body.supplierId,
      supplierName: supplier.name,
      status: "draft",
      lines,
      expectedDeliveryDate: body.expectedDeliveryDate,
      forecastId: body.forecastId,
      totalCost: Math.round(totalCost * 100) / 100,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        Item: order,
      })
    );

    return success(order, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("CreatePurchaseOrder error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
