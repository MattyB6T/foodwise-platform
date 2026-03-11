import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InventoryItem } from "@leantable/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";

interface InvoiceLineItem {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceScanResult {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: {
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    matchedItemId: string | null;
    matchedItemName: string | null;
    matchConfidence: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  matchedPurchaseOrderId: string | null;
}

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0)
  );
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

function fuzzyMatch(
  name: string,
  inventory: InventoryItem[]
): { itemId: string; itemName: string; confidence: number } | null {
  const normalized = name.toLowerCase().trim();
  let bestMatch: { itemId: string; itemName: string; confidence: number } | null = null;

  for (const item of inventory) {
    const invName = (item.name || item.itemId).toLowerCase().trim();

    // Exact match
    if (invName === normalized) {
      return { itemId: item.itemId, itemName: item.name || item.itemId, confidence: 1 };
    }

    // Contains match
    if (invName.includes(normalized) || normalized.includes(invName)) {
      const confidence = Math.min(invName.length, normalized.length) /
        Math.max(invName.length, normalized.length);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { itemId: item.itemId, itemName: item.name || item.itemId, confidence: Math.max(0.7, confidence) };
      }
      continue;
    }

    // Levenshtein distance
    const dist = levenshtein(invName, normalized);
    const maxLen = Math.max(invName.length, normalized.length);
    const confidence = maxLen > 0 ? 1 - dist / maxLen : 0;

    if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { itemId: item.itemId, itemName: item.name || item.itemId, confidence };
    }
  }

  return bestMatch;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body = JSON.parse(event.body);
    const { imageBase64 } = body as { imageBase64: string };

    if (!imageBase64) {
      return error("imageBase64 is required", 400);
    }

    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    // Call Claude vision to extract invoice data
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: `You are an invoice/delivery ticket parser for a restaurant. Extract all line items from this invoice or delivery ticket image.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "supplierName": "string or empty",
  "invoiceNumber": "string or empty",
  "invoiceDate": "YYYY-MM-DD or empty",
  "lineItems": [
    {
      "itemName": "ingredient name",
      "quantity": number,
      "unit": "each/case/lb/oz/gal/bag/box",
      "unitPrice": number (in dollars),
      "totalPrice": number (in dollars)
    }
  ],
  "subtotal": number,
  "tax": number,
  "total": number
}

Rules:
- Extract every line item you can read, even if partially illegible
- For quantities, use the number as-is from the document
- For prices, convert to dollars (e.g., "4.50" = 4.50)
- If a field is unreadable, use 0 for numbers, empty string for text
- Unit should be normalized: "cs" → "case", "ea" → "each", "lb" → "lb", "#" → "lb"
- Do NOT include delivery fees, tax lines, or totals as line items`,
                },
              ],
            },
          ],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseBody.content?.[0]?.text || "{}";

    // Parse Claude's response — handle potential markdown wrapping
    let parsed: {
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      lineItems: InvoiceLineItem[];
      subtotal: number;
      tax: number;
      total: number;
    };

    try {
      const jsonStr = rawText.includes("```")
        ? rawText.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
        : rawText.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response:", rawText);
      return error("Could not read the invoice. Please try a clearer photo.", 422);
    }

    if (!parsed.lineItems || parsed.lineItems.length === 0) {
      return error("No line items found in the image. Please try a clearer photo.", 422);
    }

    // Fetch store inventory for fuzzy matching
    const inventoryRes = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY,
        KeyConditionExpression: "storeId = :s",
        ExpressionAttributeValues: { ":s": storeId },
      })
    );
    const inventory = (inventoryRes.Items || []) as InventoryItem[];

    // Match each line item to inventory
    const matchedItems = parsed.lineItems.map((line) => {
      const match = fuzzyMatch(line.itemName, inventory);
      return {
        itemName: line.itemName,
        quantity: line.quantity || 0,
        unit: line.unit || "each",
        unitPrice: line.unitPrice || 0,
        totalPrice: line.totalPrice || 0,
        matchedItemId: match?.itemId || null,
        matchedItemName: match?.itemName || null,
        matchConfidence: match?.confidence || 0,
      };
    });

    const result: InvoiceScanResult = {
      supplierName: parsed.supplierName || "",
      invoiceNumber: parsed.invoiceNumber || "",
      invoiceDate: parsed.invoiceDate || "",
      lineItems: matchedItems,
      subtotal: parsed.subtotal || 0,
      tax: parsed.tax || 0,
      total: parsed.total || 0,
      matchedPurchaseOrderId: null,
    };

    return success(result);
  } catch (err: any) {
    if (err.name === "ThrottlingException") {
      return error("AI service is busy. Please try again in a moment.", 429);
    }
    if (err.name === "AccessDeniedException") {
      return error("AI service not available", 503);
    }
    if (err instanceof SyntaxError) {
      return error("Invalid request body", 400);
    }
    console.error("ScanInvoice error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
