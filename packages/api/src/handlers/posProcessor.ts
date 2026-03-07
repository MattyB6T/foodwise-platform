import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";

interface PosLineItem {
  posItemId: string;
  posItemName: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
}

interface NormalizedTransaction {
  storeId: string;
  posTransactionId: string;
  posSystem: string;
  timestamp: string;
  lineItems: PosLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  rawPayloadId?: string;
}

// Dedup check: look for existing transaction with same posTransactionId + posSystem
async function isDuplicate(storeId: string, posTransactionId: string, posSystem: string): Promise<boolean> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POS_TRANSACTIONS_RAW,
      IndexName: "storeId-posTransactionId-index",
      KeyConditionExpression: "storeId = :sid AND posTransactionId = :ptid",
      FilterExpression: "posSystem = :ps",
      ExpressionAttributeValues: {
        ":sid": storeId,
        ":ptid": posTransactionId,
        ":ps": posSystem,
      },
      Limit: 1,
    })
  );
  return (result.Count ?? 0) > 0;
}

// Look up ingredient mappings for a POS item
async function getMappings(storeId: string, posItemId: string, posSystem: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.INGREDIENT_MAPPINGS,
      KeyConditionExpression: "storeId = :sid AND posItemKey = :pik",
      ExpressionAttributeValues: {
        ":sid": storeId,
        ":pik": `${posSystem}#${posItemId}`,
      },
    })
  );
  return result.Items ?? [];
}

// Deduct inventory based on mapped ingredients
async function deductInventory(storeId: string, mappings: any[], quantity: number) {
  for (const mapping of mappings) {
    if (!mapping.recipeId && !mapping.ingredientId) continue;

    const deductionQty = (mapping.quantityPerUnit || 1) * quantity;
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.INVENTORY,
          Key: { storeId, itemId: mapping.ingredientId || mapping.recipeId },
          UpdateExpression: "SET quantity = quantity - :qty, lastUpdated = :now",
          ExpressionAttributeValues: {
            ":qty": deductionQty,
            ":now": new Date().toISOString(),
          },
        })
      );
    } catch {
      // Item may not exist in inventory yet — skip
    }
  }
}

export async function processTransaction(transaction: NormalizedTransaction): Promise<{ processed: boolean; duplicated: boolean }> {
  // Dedup
  if (await isDuplicate(transaction.storeId, transaction.posTransactionId, transaction.posSystem)) {
    return { processed: false, duplicated: true };
  }

  const rawId = uuidv4();
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  // Store raw transaction
  await docClient.send(
    new PutCommand({
      TableName: TABLES.POS_TRANSACTIONS_RAW,
      Item: {
        rawTransactionId: rawId,
        storeId: transaction.storeId,
        posTransactionId: transaction.posTransactionId,
        posSystem: transaction.posSystem,
        timestamp: transaction.timestamp,
        lineItems: transaction.lineItems,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        total: transaction.total,
        paymentMethod: transaction.paymentMethod,
        processedAt: now,
        ttl,
      },
    })
  );

  // Record in main transactions table
  await docClient.send(
    new PutCommand({
      TableName: TABLES.TRANSACTIONS,
      Item: {
        storeId: transaction.storeId,
        transactionId: `pos-${rawId}`,
        type: "pos-sale",
        posSystem: transaction.posSystem,
        posTransactionId: transaction.posTransactionId,
        timestamp: transaction.timestamp,
        total: transaction.total,
        tax: transaction.tax,
        subtotal: transaction.subtotal,
        lineItems: transaction.lineItems,
        paymentMethod: transaction.paymentMethod,
        source: "pos-integration",
      },
    })
  );

  // Deduct inventory for each line item with mappings
  for (const item of transaction.lineItems) {
    const mappings = await getMappings(transaction.storeId, item.posItemId, transaction.posSystem);
    if (mappings.length > 0) {
      await deductInventory(transaction.storeId, mappings, item.quantity);
    }
  }

  // Audit trail entry
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUDIT_TRAIL,
        Item: {
          auditId: uuidv4(),
          storeId: transaction.storeId,
          action: "pos-transaction-processed",
          resourceType: "pos-transaction",
          resourceId: `pos-${rawId}`,
          timestamp: now,
          details: {
            posSystem: transaction.posSystem,
            posTransactionId: transaction.posTransactionId,
            total: transaction.total,
            itemCount: transaction.lineItems.length,
          },
          source: "pos-integration",
        },
      })
    );
  } catch {
    // Non-critical — don't fail the transaction for audit
  }

  return { processed: true, duplicated: false };
}

// Lambda handler for direct invocation (e.g., from SQS or step function)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { transaction } = body;

    if (!transaction || !transaction.storeId || !transaction.posTransactionId) {
      return error("Missing required transaction fields", 400);
    }

    const result = await processTransaction(transaction);

    if (result.duplicated) {
      return success({ message: "Duplicate transaction skipped", ...result });
    }

    return success({ message: "Transaction processed", ...result });
  } catch (err: any) {
    return error(err.message || "Failed to process transaction", 500, "INTERNAL_ERROR");
  }
};
