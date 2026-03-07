import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new DynamoDBClient({ region: "us-east-1", credentials: fromIni({ profile: "foodwise" }) });
const doc = DynamoDBDocumentClient.from(client);
const P = "FoodwiseStack-CoreStackNestedStackCoreStackNestedStackResource06DFB247-ME86T0DHUM3I";
const T = {
  TRANSACTIONS: `${P}-TransactionsTable0A011FCB-98K5KU5NV0EH`,
  WASTE_LOGS: `${P}-WasteLogsTable99DF3E91-EWPGQTOKSEP1`,
  PURCHASE_ORDERS: `${P}-PurchaseOrdersTable491A23F2-6BM6GNY3UWTE`,
  RECEIVING_LOGS: `${P}-ReceivingLogsTable3AC8C0B1-1F70MJDRT0QBN`,
};

async function deleteOldTxns(storeId) {
  let count = 0;
  let lastKey;
  do {
    const res = await doc.send(new QueryCommand({
      TableName: T.TRANSACTIONS,
      KeyConditionExpression: "storeId = :s",
      ExpressionAttributeValues: { ":s": storeId },
      ExclusiveStartKey: lastKey,
    }));
    for (const item of res.Items || []) {
      if (!item.totalAmount) {
        await doc.send(new DeleteCommand({ TableName: T.TRANSACTIONS, Key: { storeId: item.storeId, transactionId: item.transactionId } }));
        count++;
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

async function deleteOldWaste() {
  let count = 0;
  let lastKey;
  do {
    const res = await doc.send(new ScanCommand({ TableName: T.WASTE_LOGS, ExclusiveStartKey: lastKey }));
    for (const item of res.Items || []) {
      if (!item.ingredientId) {
        await doc.send(new DeleteCommand({ TableName: T.WASTE_LOGS, Key: { wasteId: item.wasteId } }));
        count++;
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

async function deleteOldPOs() {
  let count = 0;
  let lastKey;
  do {
    const res = await doc.send(new ScanCommand({ TableName: T.PURCHASE_ORDERS, ExclusiveStartKey: lastKey }));
    for (const item of res.Items || []) {
      if (item.items && !item.lines) {
        await doc.send(new DeleteCommand({ TableName: T.PURCHASE_ORDERS, Key: { orderId: item.orderId } }));
        count++;
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

async function deleteOldReceiving() {
  let count = 0;
  let lastKey;
  do {
    const res = await doc.send(new ScanCommand({ TableName: T.RECEIVING_LOGS, ExclusiveStartKey: lastKey }));
    for (const item of res.Items || []) {
      if ((item.items && !item.itemsScanned) || item.receivingId === "recv-001") {
        await doc.send(new DeleteCommand({ TableName: T.RECEIVING_LOGS, Key: { receivingId: item.receivingId } }));
        count++;
      }
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

console.log("Cleaning old seed data...");
const t1 = await deleteOldTxns("store-001");
const t2 = await deleteOldTxns("store-002");
console.log(`  Deleted ${t1 + t2} old transactions`);
const w = await deleteOldWaste();
console.log(`  Deleted ${w} old waste logs`);
const po = await deleteOldPOs();
console.log(`  Deleted ${po} old purchase orders`);
const rv = await deleteOldReceiving();
console.log(`  Deleted ${rv} old receiving logs`);
console.log("Done! Now re-run: node scripts/seed-demo.mjs");
