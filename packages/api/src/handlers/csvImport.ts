import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Event } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { processTransaction } from "./posProcessor";
import { success, error } from "../utils/response";

const s3 = new S3Client({});

interface CsvColumn {
  name: string;
  index: number;
}

function detectColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
  const mapping: Record<string, number> = {};

  const patterns: Record<string, string[]> = {
    transactionId: ["transactionid", "orderid", "ordernumber", "id", "txnid", "receiptno", "receipt"],
    timestamp: ["timestamp", "date", "datetime", "time", "createdat", "closedat", "orderdate"],
    itemName: ["itemname", "item", "product", "productname", "name", "description", "menuitem"],
    quantity: ["quantity", "qty", "count", "amount"],
    unitPrice: ["unitprice", "price", "itemprice", "amount", "cost", "saleprice"],
    total: ["total", "ordertotal", "grandtotal", "subtotal", "linetotal"],
    tax: ["tax", "taxamount", "salestax"],
    paymentMethod: ["paymentmethod", "payment", "paytype", "tender", "paymenttype"],
  };

  for (const [field, candidates] of Object.entries(patterns)) {
    for (const candidate of candidates) {
      const idx = normalized.indexOf(candidate);
      if (idx >= 0) {
        mapping[field] = idx;
        break;
      }
    }
  }

  return mapping;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

// S3 event handler — triggered when CSV is uploaded
export const s3Handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Key format: pos-imports/{storeId}/{filename}.csv
    const parts = key.split("/");
    if (parts.length < 3 || !key.endsWith(".csv")) {
      console.log(`Skipping non-CSV file: ${key}`);
      continue;
    }

    const storeId = parts[1];

    const obj = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const content = await obj.Body!.transformToString();

    const rows = parseCsv(content);
    if (rows.length < 2) {
      console.log("CSV too short, skipping");
      continue;
    }

    const headers = rows[0];
    const columnMap = detectColumns(headers);

    if (!columnMap.itemName && !columnMap.total) {
      console.error("Could not detect required columns. Headers:", headers);
      continue;
    }

    // Group rows by transaction ID
    const transactionGroups = new Map<string, string[][]>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const txnId =
        columnMap.transactionId !== undefined
          ? row[columnMap.transactionId] || `row-${i}`
          : `row-${i}`;

      if (!transactionGroups.has(txnId)) {
        transactionGroups.set(txnId, []);
      }
      transactionGroups.get(txnId)!.push(row);
    }

    let processed = 0;
    let duplicated = 0;

    for (const [txnId, txnRows] of transactionGroups) {
      const lineItems = txnRows.map((row) => ({
        posItemId: `csv-${row[columnMap.itemName] || "unknown"}`.replace(/\s+/g, "-").toLowerCase(),
        posItemName: columnMap.itemName !== undefined ? row[columnMap.itemName] : "Unknown Item",
        quantity: columnMap.quantity !== undefined ? parseInt(row[columnMap.quantity]) || 1 : 1,
        unitPrice: columnMap.unitPrice !== undefined ? parseFloat(row[columnMap.unitPrice]) || 0 : 0,
      }));

      const firstRow = txnRows[0];
      const total =
        columnMap.total !== undefined ? parseFloat(firstRow[columnMap.total]) || 0 : lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
      const tax = columnMap.tax !== undefined ? parseFloat(firstRow[columnMap.tax]) || 0 : 0;
      const timestamp =
        columnMap.timestamp !== undefined ? firstRow[columnMap.timestamp] || new Date().toISOString() : new Date().toISOString();

      const normalized = {
        storeId,
        posTransactionId: `csv-${txnId}`,
        posSystem: "csv" as const,
        timestamp,
        lineItems,
        subtotal: total - tax,
        tax,
        total,
        paymentMethod:
          columnMap.paymentMethod !== undefined ? firstRow[columnMap.paymentMethod] : "unknown",
      };

      const result = await processTransaction(normalized);
      if (result.processed) processed++;
      if (result.duplicated) duplicated++;
    }

    console.log(`CSV import for store ${storeId}: ${processed} processed, ${duplicated} duplicated from ${key}`);
  }
};

// API handler for direct CSV upload — POST /stores/{storeId}/pos/csv-import
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("Missing storeId", 400);

    const body = event.body || "";
    const isBase64 = event.isBase64Encoded;
    const csvContent = isBase64 ? Buffer.from(body, "base64").toString("utf-8") : body;

    const rows = parseCsv(csvContent);
    if (rows.length < 2) return error("CSV must have at least a header and one data row", 400);

    const headers = rows[0];
    const columnMap = detectColumns(headers);

    if (!columnMap.itemName && !columnMap.total) {
      return error("Could not detect required columns (need at least item name or total)", 400);
    }

    // Group rows by transaction ID
    const transactionGroups = new Map<string, string[][]>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const txnId =
        columnMap.transactionId !== undefined
          ? row[columnMap.transactionId] || `row-${i}`
          : `row-${i}`;

      if (!transactionGroups.has(txnId)) {
        transactionGroups.set(txnId, []);
      }
      transactionGroups.get(txnId)!.push(row);
    }

    let processed = 0;
    let duplicated = 0;

    for (const [txnId, txnRows] of transactionGroups) {
      const lineItems = txnRows.map((row) => ({
        posItemId: `csv-${row[columnMap.itemName] || "unknown"}`.replace(/\s+/g, "-").toLowerCase(),
        posItemName: columnMap.itemName !== undefined ? row[columnMap.itemName] : "Unknown Item",
        quantity: columnMap.quantity !== undefined ? parseInt(row[columnMap.quantity]) || 1 : 1,
        unitPrice: columnMap.unitPrice !== undefined ? parseFloat(row[columnMap.unitPrice]) || 0 : 0,
      }));

      const firstRow = txnRows[0];
      const total =
        columnMap.total !== undefined ? parseFloat(firstRow[columnMap.total]) || 0 : lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
      const tax = columnMap.tax !== undefined ? parseFloat(firstRow[columnMap.tax]) || 0 : 0;

      const normalized = {
        storeId,
        posTransactionId: `csv-${txnId}`,
        posSystem: "csv" as const,
        timestamp: columnMap.timestamp !== undefined ? firstRow[columnMap.timestamp] || new Date().toISOString() : new Date().toISOString(),
        lineItems,
        subtotal: total - tax,
        tax,
        total,
        paymentMethod: columnMap.paymentMethod !== undefined ? firstRow[columnMap.paymentMethod] : "unknown",
      };

      const result = await processTransaction(normalized);
      if (result.processed) processed++;
      if (result.duplicated) duplicated++;
    }

    return success({
      message: "CSV import complete",
      totalRows: rows.length - 1,
      transactionsProcessed: processed,
      duplicatesSkipped: duplicated,
      columnsDetected: Object.keys(columnMap),
    });
  } catch (err: any) {
    return error(err.message || "CSV import failed", 500, "INTERNAL_ERROR");
  }
};

// SES email handler — processes forwarded POS report emails
export const sesHandler = async (event: any): Promise<void> => {
  console.log("SES email received for POS import");

  for (const record of event.Records) {
    const ses = record.ses;
    const messageId = ses.mail.messageId;
    const recipients = ses.mail.destination || [];

    // Extract storeId from recipient email: pos-{storeId}@import.foodwise.io
    for (const recipient of recipients) {
      const match = recipient.match(/^pos-([^@]+)@/);
      if (!match) continue;

      const storeId = match[1];

      // Fetch email from S3 (SES stores emails in S3)
      const bucket = process.env.SES_BUCKET || process.env.REPORTS_BUCKET;
      if (!bucket) continue;

      try {
        const obj = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: `ses-emails/${messageId}`,
          })
        );

        const emailContent = await obj.Body!.transformToString();

        // Extract CSV attachments (simplified — looks for CSV content)
        const csvMatch = emailContent.match(
          /Content-Type:.*text\/csv[\s\S]*?\n\n([\s\S]*?)(?:\n--|\n\n)/
        );

        if (csvMatch) {
          const csvContent = Buffer.from(csvMatch[1], "base64").toString("utf-8");
          const rows = parseCsv(csvContent);

          if (rows.length >= 2) {
            const columnMap = detectColumns(rows[0]);
            console.log(`Processing CSV attachment for store ${storeId}: ${rows.length - 1} rows`);
            // Process similar to s3Handler
          }
        }
      } catch (err) {
        console.error(`Failed to process SES email for store ${storeId}:`, err);
      }
    }
  }
};
