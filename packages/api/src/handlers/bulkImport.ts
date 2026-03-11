import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES, initTables } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { v4 as uuid } from "uuid";

// ─── Fuzzy column detection (reusable pattern from csvImport.ts) ───

function normalize(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function detectColumns(
  headers: string[],
  patterns: Record<string, string[]>
): Record<string, number> {
  const normalized = headers.map(normalize);
  const mapping: Record<string, number> = {};

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

// ─── CSV parsing (quote-aware) ───

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

// ─── Column patterns per data type ───

const COLUMN_PATTERNS: Record<string, Record<string, string[]>> = {
  inventory: {
    name: ["name", "itemname", "item", "product", "productname", "ingredient", "ingredientname", "description"],
    category: ["category", "type", "group", "dept", "department"],
    quantity: ["quantity", "qty", "onhand", "stock", "count", "currentqty", "currentstock"],
    unit: ["unit", "uom", "unitofmeasure", "measure"],
    costPerUnit: ["cost", "unitcost", "costperunit", "price", "unitprice", "costper"],
    lowStockThreshold: ["lowstock", "reorder", "reorderlevel", "threshold", "min", "minimum", "minqty", "parlevel", "par"],
    barcode: ["barcode", "upc", "sku", "ean", "gtin"],
    supplier: ["supplier", "vendor", "suppliername", "vendorname"],
  },
  recipes: {
    name: ["name", "recipename", "recipe", "menuitem", "dish", "item"],
    category: ["category", "type", "group", "menugroup", "menucategory"],
    sellingPrice: ["price", "sellingprice", "menuprice", "saleprice", "retail", "retailprice"],
    prepTime: ["preptime", "prep", "time", "minutes", "prepminutes"],
    ingredients: ["ingredients", "ingredientlist", "items"],
  },
  suppliers: {
    name: ["name", "suppliername", "vendor", "vendorname", "company", "companyname"],
    contactName: ["contact", "contactname", "rep", "representative", "salesperson"],
    contactEmail: ["email", "contactemail", "emailaddress"],
    contactPhone: ["phone", "contactphone", "phonenumber", "tel", "telephone"],
    deliverySchedule: ["schedule", "deliveryschedule", "deliverydays", "days", "deliveryday"],
  },
  staff: {
    name: ["name", "fullname", "staffname", "employeename", "employee"],
    email: ["email", "emailaddress", "workemail"],
    role: ["role", "position", "title", "jobtitle", "jobposition"],
    phone: ["phone", "phonenumber", "mobile", "cell", "tel"],
    hourlyRate: ["rate", "hourlyrate", "wage", "hourlywage", "pay", "payrate", "hourly"],
  },
};

// ─── Required fields per data type ───

const REQUIRED_FIELDS: Record<string, string[]> = {
  inventory: ["name"],
  recipes: ["name"],
  suppliers: ["name"],
  staff: ["name"],
};

// ─── Batch write helper (25 items per DynamoDB batch) ───

async function batchPut(tableName: string, items: Record<string, any>[]): Promise<void> {
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
  }
}

// ─── Process each data type ───

function processInventoryRows(
  rows: string[][],
  columnMap: Record<string, number>,
  storeId: string
): { items: Record<string, any>[]; errors: { row: number; reason: string }[] } {
  const items: Record<string, any>[] = [];
  const errors: { row: number; reason: string }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = columnMap.name !== undefined ? row[columnMap.name]?.trim() : "";

    if (!name) {
      errors.push({ row: i + 2, reason: "Missing item name" });
      continue;
    }

    const item: Record<string, any> = {
      storeId,
      itemId: uuid(),
      name,
      category: columnMap.category !== undefined ? row[columnMap.category]?.trim() || "Uncategorized" : "Uncategorized",
      quantity: columnMap.quantity !== undefined ? parseFloat(row[columnMap.quantity]) || 0 : 0,
      unit: columnMap.unit !== undefined ? row[columnMap.unit]?.trim() || "each" : "each",
      costPerUnit: columnMap.costPerUnit !== undefined ? parseFloat(row[columnMap.costPerUnit]) || 0 : 0,
      lowStockThreshold: columnMap.lowStockThreshold !== undefined ? parseFloat(row[columnMap.lowStockThreshold]) || 5 : 5,
      createdAt: now,
      updatedAt: now,
    };

    if (columnMap.barcode !== undefined && row[columnMap.barcode]?.trim()) {
      item.barcode = row[columnMap.barcode].trim();
    }
    if (columnMap.supplier !== undefined && row[columnMap.supplier]?.trim()) {
      item.supplier = row[columnMap.supplier].trim();
    }

    items.push(item);
  }
  return { items, errors };
}

function processRecipeRows(
  rows: string[][],
  columnMap: Record<string, number>,
  _storeId: string
): { items: Record<string, any>[]; errors: { row: number; reason: string }[] } {
  const items: Record<string, any>[] = [];
  const errors: { row: number; reason: string }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = columnMap.name !== undefined ? row[columnMap.name]?.trim() : "";

    if (!name) {
      errors.push({ row: i + 2, reason: "Missing recipe name" });
      continue;
    }

    items.push({
      recipeId: uuid(),
      name,
      category: columnMap.category !== undefined ? row[columnMap.category]?.trim() || "Main" : "Main",
      sellingPrice: columnMap.sellingPrice !== undefined ? parseFloat(row[columnMap.sellingPrice]) || 0 : 0,
      prepTime: columnMap.prepTime !== undefined ? parseInt(row[columnMap.prepTime]) || 0 : 0,
      ingredients: [],
      createdAt: now,
      updatedAt: now,
    });
  }
  return { items, errors };
}

function processSupplierRows(
  rows: string[][],
  columnMap: Record<string, number>,
  _storeId: string
): { items: Record<string, any>[]; errors: { row: number; reason: string }[] } {
  const items: Record<string, any>[] = [];
  const errors: { row: number; reason: string }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = columnMap.name !== undefined ? row[columnMap.name]?.trim() : "";

    if (!name) {
      errors.push({ row: i + 2, reason: "Missing supplier name" });
      continue;
    }

    items.push({
      supplierId: uuid(),
      name,
      contactName: columnMap.contactName !== undefined ? row[columnMap.contactName]?.trim() || "" : "",
      contactEmail: columnMap.contactEmail !== undefined ? row[columnMap.contactEmail]?.trim() || "" : "",
      contactPhone: columnMap.contactPhone !== undefined ? row[columnMap.contactPhone]?.trim() || "" : "",
      deliverySchedule: columnMap.deliverySchedule !== undefined ? row[columnMap.deliverySchedule]?.trim() || "" : "",
      catalog: [],
      createdAt: now,
      updatedAt: now,
    });
  }
  return { items, errors };
}

function processStaffRows(
  rows: string[][],
  columnMap: Record<string, number>,
  storeId: string
): { items: Record<string, any>[]; errors: { row: number; reason: string }[] } {
  const items: Record<string, any>[] = [];
  const errors: { row: number; reason: string }[] = [];
  const now = new Date().toISOString();
  const validRoles = ["owner", "manager", "staff"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = columnMap.name !== undefined ? row[columnMap.name]?.trim() : "";

    if (!name) {
      errors.push({ row: i + 2, reason: "Missing staff name" });
      continue;
    }

    let role = columnMap.role !== undefined ? row[columnMap.role]?.trim().toLowerCase() || "staff" : "staff";
    if (!validRoles.includes(role)) role = "staff";

    items.push({
      staffId: uuid(),
      storeId,
      name,
      email: columnMap.email !== undefined ? row[columnMap.email]?.trim() || "" : "",
      role,
      phone: columnMap.phone !== undefined ? row[columnMap.phone]?.trim() || "" : "",
      hourlyRate: columnMap.hourlyRate !== undefined ? parseFloat(row[columnMap.hourlyRate]) || 0 : 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return { items, errors };
}

// ─── Preview endpoint: POST /stores/{storeId}/import/preview ───

async function handlePreview(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || "{}");
  const { dataType, csvContent } = body;

  if (!dataType || !csvContent) {
    return error("Missing dataType or csvContent", 400);
  }

  const patterns = COLUMN_PATTERNS[dataType];
  if (!patterns) {
    return error(`Invalid dataType: ${dataType}. Must be one of: ${Object.keys(COLUMN_PATTERNS).join(", ")}`, 400);
  }

  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    return error("File must have at least a header row and one data row", 400);
  }

  const headers = rows[0];
  const columnMap = detectColumns(headers, patterns);
  const required = REQUIRED_FIELDS[dataType] || [];
  const missingRequired = required.filter((f) => columnMap[f] === undefined);

  // Build preview rows (first 5 data rows)
  const previewRows = rows.slice(1, 6).map((row) => {
    const mapped: Record<string, string> = {};
    for (const [field, idx] of Object.entries(columnMap)) {
      mapped[field] = row[idx] || "";
    }
    return mapped;
  });

  return success({
    totalRows: rows.length - 1,
    headers,
    columnsDetected: columnMap,
    availableFields: Object.keys(patterns),
    missingRequired,
    previewRows,
  });
}

// ─── Import endpoint: POST /stores/{storeId}/import ───

async function handleImport(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || "{}");
  const { dataType, csvContent, columnOverrides } = body;

  if (!dataType || !csvContent) {
    return error("Missing dataType or csvContent", 400);
  }

  const patterns = COLUMN_PATTERNS[dataType];
  if (!patterns) {
    return error(`Invalid dataType: ${dataType}`, 400);
  }

  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    return error("File must have at least a header row and one data row", 400);
  }

  const headers = rows[0];
  let columnMap = detectColumns(headers, patterns);

  // Allow user to override auto-detected column mappings
  if (columnOverrides && typeof columnOverrides === "object") {
    columnMap = { ...columnMap, ...columnOverrides };
  }

  const required = REQUIRED_FIELDS[dataType] || [];
  const missingRequired = required.filter((f) => columnMap[f] === undefined);
  if (missingRequired.length > 0) {
    return error(`Missing required columns: ${missingRequired.join(", ")}. Please map them and try again.`, 400);
  }

  const dataRows = rows.slice(1);

  let result: { items: Record<string, any>[]; errors: { row: number; reason: string }[] };

  switch (dataType) {
    case "inventory":
      result = processInventoryRows(dataRows, columnMap, storeId);
      if (result.items.length > 0) await batchPut(TABLES.INVENTORY, result.items);
      break;
    case "recipes":
      result = processRecipeRows(dataRows, columnMap, storeId);
      if (result.items.length > 0) await batchPut(TABLES.RECIPES, result.items);
      break;
    case "suppliers":
      result = processSupplierRows(dataRows, columnMap, storeId);
      if (result.items.length > 0) await batchPut(TABLES.SUPPLIERS, result.items);
      break;
    case "staff":
      result = processStaffRows(dataRows, columnMap, storeId);
      if (result.items.length > 0) await batchPut(TABLES.STAFF, result.items);
      break;
    default:
      return error(`Unsupported data type: ${dataType}`, 400);
  }

  // Audit trail entry
  try {
    const claims = getUserClaims(event);
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUDIT_TRAIL,
        Item: {
          auditId: uuid(),
          storeId,
          userId: claims?.sub || "unknown",
          action: "BULK_IMPORT",
          resourceType: dataType,
          details: {
            imported: result.items.length,
            errors: result.errors.length,
            totalRows: dataRows.length,
          },
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch (_) {
    // Don't fail the import if audit logging fails
  }

  return success({
    message: `${dataType} import complete`,
    imported: result.items.length,
    skipped: result.errors.length,
    totalRows: dataRows.length,
    errors: result.errors.slice(0, 20), // Return first 20 errors max
    columnsUsed: Object.keys(columnMap),
  });
}

// ─── Template endpoint: GET /stores/{storeId}/import/template?type=inventory ───

function handleTemplate(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  const dataType = event.queryStringParameters?.type || "inventory";

  const templates: Record<string, string> = {
    inventory: "Name,Category,Quantity,Unit,Cost Per Unit,Low Stock Threshold,Barcode,Supplier\nChicken Breast,Protein,50,lb,3.49,10,012345678901,Sysco\nRomaine Lettuce,Produce,24,head,1.89,8,,US Foods\nCheddar Cheese,Dairy,15,lb,4.99,5,012345678902,Sysco",
    recipes: "Name,Category,Selling Price,Prep Time (min)\nClassic Burger,Entree,12.99,15\nCaesar Salad,Salad,9.99,10\nChicken Wings,Appetizer,11.99,20",
    suppliers: "Name,Contact Name,Email,Phone,Delivery Schedule\nSysco,John Smith,john@sysco.com,555-0101,Mon Wed Fri\nUS Foods,Jane Doe,jane@usfoods.com,555-0102,Tue Thu\nLocal Farms Co,Bob Green,bob@localfarms.com,555-0103,Mon",
    staff: "Name,Email,Role,Phone,Hourly Rate\nSarah Johnson,sarah@email.com,manager,555-0201,22.00\nMike Chen,mike@email.com,staff,555-0202,16.50\nEmily Davis,emily@email.com,staff,555-0203,16.50",
  };

  const csv = templates[dataType];
  if (!csv) return error(`No template for type: ${dataType}`, 400);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${dataType}-template.csv"`,
    },
    body: csv,
  };
}

// ─── Main router ───

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  await initTables();
  const path = event.path || "";
  const method = event.httpMethod;
  const storeId = event.pathParameters?.storeId;

  if (!storeId) return error("Missing storeId", 400);

  try {
    // GET /stores/{storeId}/import/template?type=inventory
    if (path.includes("/import/template") && method === "GET") {
      return handleTemplate(event);
    }

    // POST /stores/{storeId}/import/preview
    if (path.includes("/import/preview") && method === "POST") {
      return handlePreview(event, storeId);
    }

    // POST /stores/{storeId}/import
    if (method === "POST") {
      return handleImport(event, storeId);
    }

    return error("Import route not found", 404, "NOT_FOUND");
  } catch (err: any) {
    console.error("Bulk import error:", err);
    return error(err.message || "Import failed", 500, "INTERNAL_ERROR");
  }
};
