import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;
    const supplierId = event.pathParameters?.supplierId;
    if (!supplierId) return error("supplierId is required", 400);

    // Verify supplier exists
    const supplierResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.SUPPLIERS,
        Key: { supplierId },
      })
    );

    if (!supplierResult.Item) return error("Supplier not found", 404);

    if (method === "GET") {
      const path = event.path;

      if (path.endsWith("/orders")) {
        // Get all POs for this supplier
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.PURCHASE_ORDERS,
            IndexName: "storeId-index",
            // Scan all POs and filter by supplierId
            FilterExpression: "supplierId = :sid",
            ExpressionAttributeValues: { ":sid": supplierId },
            // Note: This uses a scan-like approach. In production, add a supplierId GSI
          })
        );

        // Fallback: scan the table filtering by supplierId
        const orders = (result.Items || []).map((o: any) => ({
          orderId: o.orderId,
          storeId: o.storeId,
          status: o.status,
          items: o.items,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          expectedDelivery: o.expectedDelivery,
        }));

        return success({ supplier: supplierResult.Item, orders });
      }

      // Default: get supplier profile
      return success({ supplier: supplierResult.Item });
    }

    if (method === "PUT") {
      // Supplier confirms/updates order
      const orderId = event.pathParameters?.orderId;
      if (!orderId) return error("orderId is required", 400);
      if (!event.body) return error("Request body is required", 400);

      const body = JSON.parse(event.body);
      const order = await docClient.send(
        new GetCommand({
          TableName: TABLES.PURCHASE_ORDERS,
          Key: { orderId },
        })
      );

      if (!order.Item) return error("Order not found", 404);
      if (order.Item.supplierId !== supplierId) return error("Order does not belong to this supplier", 403);

      const updates: string[] = ["updatedAt = :now"];
      const values: Record<string, any> = { ":now": new Date().toISOString() };

      if (body.status) {
        updates.push("#status = :status");
        values[":status"] = body.status;
      }
      if (body.expectedDelivery) {
        updates.push("expectedDelivery = :delivery");
        values[":delivery"] = body.expectedDelivery;
      }
      if (body.supplierNotes) {
        updates.push("supplierNotes = :notes");
        values[":notes"] = body.supplierNotes;
      }

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.PURCHASE_ORDERS,
          Key: { orderId },
          UpdateExpression: `SET ${updates.join(", ")}`,
          ExpressionAttributeNames: body.status ? { "#status": "status" } : undefined,
          ExpressionAttributeValues: values,
        })
      );

      return success({ message: "Order updated", orderId });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("SupplierPortal error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
