import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    const orderId = event.pathParameters?.orderId;
    if (!orderId) return error("orderId is required", 400);

    // Get the purchase order
    const orderResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.PURCHASE_ORDERS,
        Key: { orderId },
      })
    );

    if (!orderResult.Item) return error("Purchase order not found", 404);
    const order = orderResult.Item;

    // Get the supplier
    const supplierResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.SUPPLIERS,
        Key: { supplierId: order.supplierId },
      })
    );

    const supplier = supplierResult.Item;
    if (!supplier) return error("Supplier not found", 404);

    const supplierEmail = supplier.email || supplier.contactEmail;
    if (!supplierEmail) return error("Supplier has no email address configured", 400);

    // Build email content
    const itemLines = (order.items || [])
      .map((item: any, i: number) => `${i + 1}. ${item.name || item.itemId} - Qty: ${item.quantity} ${item.unit || ""}`)
      .join("\n");

    const emailBody = `Purchase Order: ${orderId}\nDate: ${new Date().toLocaleDateString()}\nStore: ${order.storeId}\n\nItems:\n${itemLines}\n\nTotal: $${order.totalAmount?.toFixed(2) || "TBD"}\n\nPlease confirm receipt of this order.\n\nThank you,\nFoodWise Platform`;

    // In production, this would call SES to send the email
    console.log(`Would send PO email to ${supplierEmail}:\n${emailBody}`);

    return success({
      message: "Purchase order emailed to supplier",
      supplierEmail,
      orderId,
      supplierName: supplier.name,
    });
  } catch (err) {
    console.error("EmailPurchaseOrder error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
