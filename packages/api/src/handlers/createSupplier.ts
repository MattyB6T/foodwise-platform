import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Supplier, CatalogItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreateSupplierBody {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliverySchedule: string;
  catalog: {
    barcode: string;
    barcodeFormat?: "GS1-128" | "UPC-A" | "EAN-13";
    itemId: string;
    itemName: string;
    unit: string;
    unitCost: number;
    casePack?: number;
  }[];
}

function detectBarcodeFormat(barcode: string): "GS1-128" | "UPC-A" | "EAN-13" {
  const digits = barcode.replace(/[^0-9]/g, "");
  if (barcode.startsWith("(") || barcode.length > 14) return "GS1-128";
  if (digits.length === 13) return "EAN-13";
  return "UPC-A";
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: CreateSupplierBody = JSON.parse(event.body);

    if (!body.name || !body.contactName || !body.contactEmail) {
      return error("name, contactName, and contactEmail are required", 400);
    }

    const catalog: CatalogItem[] = (body.catalog || []).map((item) => ({
      barcode: item.barcode,
      barcodeFormat: item.barcodeFormat || detectBarcodeFormat(item.barcode),
      itemId: item.itemId,
      itemName: item.itemName,
      unit: item.unit,
      unitCost: item.unitCost,
      casePack: item.casePack,
    }));

    const now = new Date().toISOString();
    const supplier: Supplier = {
      supplierId: uuidv4(),
      name: body.name,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone || "",
      deliverySchedule: body.deliverySchedule || "",
      catalog,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.SUPPLIERS,
        Item: supplier,
      })
    );

    return success(supplier, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("CreateSupplier error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
