import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PurchaseOrderLine } from "@leantable/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface UpdatePurchaseOrderBody {
  status?: "draft" | "submitted";
  lines?: {
    itemId: string;
    itemName: string;
    unit: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
  expectedDeliveryDate?: string;
  notes?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const orderId = event.pathParameters?.orderId || event.pathParameters?.proxy;
    if (!orderId) {
      return error("orderId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: UpdatePurchaseOrderBody = JSON.parse(event.body);

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

    const existing = orderResult.Item;

    // Only draft orders can be edited
    if (existing.status !== "draft" && body.lines) {
      return error("Only draft orders can have lines edited", 400, "NOT_EDITABLE");
    }

    // Only draft orders can be submitted
    if (body.status === "submitted" && existing.status !== "draft") {
      return error("Only draft orders can be submitted", 400, "INVALID_STATUS");
    }

    const now = new Date().toISOString();
    const updateExprParts: string[] = ["#updatedAt = :updatedAt"];
    const exprNames: Record<string, string> = { "#updatedAt": "updatedAt" };
    const exprValues: Record<string, any> = { ":updatedAt": now };

    if (body.status) {
      updateExprParts.push("#status = :status");
      exprNames["#status"] = "status";
      exprValues[":status"] = body.status;
    }

    if (body.lines) {
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

      updateExprParts.push("#lines = :lines");
      updateExprParts.push("totalCost = :totalCost");
      exprNames["#lines"] = "lines";
      exprValues[":lines"] = lines;
      exprValues[":totalCost"] = Math.round(totalCost * 100) / 100;
    }

    if (body.expectedDeliveryDate) {
      updateExprParts.push("expectedDeliveryDate = :edd");
      exprValues[":edd"] = body.expectedDeliveryDate;
    }

    if (body.notes !== undefined) {
      updateExprParts.push("notes = :notes");
      exprValues[":notes"] = body.notes;
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        Key: { orderId },
        UpdateExpression: "SET " + updateExprParts.join(", "),
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return success(result.Attributes);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("UpdatePurchaseOrder error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
