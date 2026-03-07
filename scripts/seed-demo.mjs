/**
 * FoodWise Demo Seed Script — Subway Store Model
 *
 * Creates a realistic 30-day dataset for 2 Subway franchise locations.
 * All data follows the exact shared type schemas so the app flows work end-to-end:
 *   Orders → Receiving → Inventory → Sales → Waste → Analytics → Health Score
 *
 * Run: node scripts/seed-demo.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "foodwise" }),
});
const doc = DynamoDBDocumentClient.from(client);

// ── Table Names (from CDK deploy output) ──
const P = "FoodwiseStack-CoreStackNestedStackCoreStackNestedStackResource06DFB247-ME86T0DHUM3I";
const T = {
  STORES: `${P}-StoresTableE2108BD4-EK9NVR11MBRF`,
  INVENTORY: `${P}-InventoryTableFD135387-VIU7DCR1LFX1`,
  TRANSACTIONS: `${P}-TransactionsTable0A011FCB-98K5KU5NV0EH`,
  RECIPES: `${P}-RecipesTable058A1F33-K5YZ74IQTK02`,
  SUPPLIERS: `${P}-SuppliersTableF9BC2E6D-1273XLCCW4GPY`,
  PURCHASE_ORDERS: `${P}-PurchaseOrdersTable491A23F2-6BM6GNY3UWTE`,
  WASTE_LOGS: `${P}-WasteLogsTable99DF3E91-EWPGQTOKSEP1`,
  RECEIVING_LOGS: `${P}-ReceivingLogsTable3AC8C0B1-1F70MJDRT0QBN`,
  STAFF: `${P}-StaffTable11B9C6C0-8K6Q6SA5SSY8`,
  SCHEDULES: `${P}-SchedulesTableFBEB0188-1GOWBUDVKHLFZ`,
  TIME_CLOCK: `${P}-TimeClockTable3A097BD6-1T3JECZRQNBFW`,
  CAMERAS: `${P}-CamerasTable183C7F3A-5RF2XYCU9L25`,
  TEMP_LOGS: `${P}-TempLogsTable8E4B3D0B-1B9H6NPTB1A4O`,
  FORECASTS: `${P}-ForecastsTable40A833D2-N0WBS9RRLSID`,
  INCIDENTS: `${P}-IncidentsTable307EBBA6-1MPTP9ZRCS4LD`,
  PREP_LISTS: `${P}-PrepListsTable449FCF89-FKHXRE44KL24`,
  AUDIT_TRAIL: `${P}-AuditTrailTable4CEE68C7-1HROZ6Y00ZMFF`,
  PRICE_HISTORY: `${P}-PriceHistoryTable5AD3E5A9-UMN2PN0ITSMI`,
  NOTIFICATIONS: `${P}-NotificationsTable76DCFC6C-1VIBTP9OJE5J6`,
  INVENTORY_COUNTS: `${P}-InventoryCountsTable27D2854D-14YKODS08NQ4V`,
  KIOSK_DEVICES: `${P}-KioskDevicesTable4E61EA47-1D1LG2WRQI45I`,
};

// ── Helpers ──
async function put(table, item) {
  await doc.send(new PutCommand({ TableName: table, Item: item }));
}
async function batchWrite(table, items) {
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map((item) => ({ PutRequest: { Item: item } }));
    await doc.send(new BatchWriteCommand({ RequestItems: { [table]: batch } }));
  }
}
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function tsAt(date, hour, min = 0) {
  return `${date}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`;
}
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function r2(n) { return Math.round(n * 100) / 100; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function uuid() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); }); }

const NOW = new Date().toISOString();

// ══════════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ══════════════════════════════════════════════════════════════

const STORE1 = "store-001";
const STORE2 = "store-002";

// ── Inventory Items (Subway ingredients) ──
const INV = {
  // Proteins
  turkey:      { itemId: "inv-001", name: "Turkey Breast",      category: "Protein",   unit: "lb",  costPerUnit: 5.20,  lowStockThreshold: 10 },
  ham:         { itemId: "inv-002", name: "Black Forest Ham",    category: "Protein",   unit: "lb",  costPerUnit: 4.80,  lowStockThreshold: 10 },
  roastBeef:   { itemId: "inv-003", name: "Roast Beef",         category: "Protein",   unit: "lb",  costPerUnit: 7.50,  lowStockThreshold: 8 },
  chicken:     { itemId: "inv-004", name: "Rotisserie Chicken",  category: "Protein",   unit: "lb",  costPerUnit: 5.50,  lowStockThreshold: 10 },
  tuna:        { itemId: "inv-005", name: "Tuna Salad",          category: "Protein",   unit: "lb",  costPerUnit: 6.00,  lowStockThreshold: 6 },
  steak:       { itemId: "inv-006", name: "Steak Strips",        category: "Protein",   unit: "lb",  costPerUnit: 8.25,  lowStockThreshold: 6 },
  italianBMT:  { itemId: "inv-007", name: "Italian BMT Meats",   category: "Protein",   unit: "lb",  costPerUnit: 6.50,  lowStockThreshold: 10 },
  // Cheese
  american:    { itemId: "inv-010", name: "American Cheese",     category: "Dairy",     unit: "lb",  costPerUnit: 3.50,  lowStockThreshold: 8 },
  provolone:   { itemId: "inv-011", name: "Provolone",           category: "Dairy",     unit: "lb",  costPerUnit: 4.00,  lowStockThreshold: 8 },
  pepperjack:  { itemId: "inv-012", name: "Pepper Jack",         category: "Dairy",     unit: "lb",  costPerUnit: 4.20,  lowStockThreshold: 6 },
  // Bread
  italian:     { itemId: "inv-020", name: "Italian Bread",       category: "Bakery",    unit: "each", costPerUnit: 0.35, lowStockThreshold: 40 },
  wheat:       { itemId: "inv-021", name: "9-Grain Wheat Bread", category: "Bakery",    unit: "each", costPerUnit: 0.38, lowStockThreshold: 40 },
  herbs:       { itemId: "inv-022", name: "Herbs & Cheese Bread",category: "Bakery",    unit: "each", costPerUnit: 0.40, lowStockThreshold: 30 },
  flatbread:   { itemId: "inv-023", name: "Flatbread",           category: "Bakery",    unit: "each", costPerUnit: 0.42, lowStockThreshold: 25 },
  // Produce
  lettuce:     { itemId: "inv-030", name: "Lettuce (Shredded)",  category: "Produce",   unit: "lb",  costPerUnit: 1.80,  lowStockThreshold: 8 },
  tomatoes:    { itemId: "inv-031", name: "Tomatoes (Sliced)",   category: "Produce",   unit: "lb",  costPerUnit: 2.20,  lowStockThreshold: 8 },
  onions:      { itemId: "inv-032", name: "Red Onions",          category: "Produce",   unit: "lb",  costPerUnit: 1.50,  lowStockThreshold: 5 },
  peppers:     { itemId: "inv-033", name: "Green Peppers",       category: "Produce",   unit: "lb",  costPerUnit: 2.00,  lowStockThreshold: 5 },
  cucumbers:   { itemId: "inv-034", name: "Cucumbers",           category: "Produce",   unit: "lb",  costPerUnit: 1.60,  lowStockThreshold: 5 },
  jalapenos:   { itemId: "inv-035", name: "Jalapenos",           category: "Produce",   unit: "lb",  costPerUnit: 2.50,  lowStockThreshold: 3 },
  avocado:     { itemId: "inv-036", name: "Avocado (Guac)",      category: "Produce",   unit: "lb",  costPerUnit: 5.00,  lowStockThreshold: 4 },
  // Sauces & Pantry
  mayo:        { itemId: "inv-040", name: "Mayonnaise",          category: "Pantry",    unit: "gal", costPerUnit: 8.00,  lowStockThreshold: 2 },
  mustard:     { itemId: "inv-041", name: "Yellow Mustard",      category: "Pantry",    unit: "gal", costPerUnit: 5.50,  lowStockThreshold: 2 },
  chipotle:    { itemId: "inv-042", name: "Chipotle Southwest",  category: "Pantry",    unit: "gal", costPerUnit: 12.00, lowStockThreshold: 1 },
  ranch:       { itemId: "inv-043", name: "Ranch Dressing",      category: "Pantry",    unit: "gal", costPerUnit: 9.00,  lowStockThreshold: 1 },
  // Cookies & Drinks
  cookies:     { itemId: "inv-050", name: "Cookies (Assorted)",  category: "Bakery",    unit: "dozen", costPerUnit: 3.60, lowStockThreshold: 5 },
  chips:       { itemId: "inv-051", name: "Chips (Assorted)",    category: "Pantry",    unit: "cases", costPerUnit: 18.00,lowStockThreshold: 2 },
  fountain:    { itemId: "inv-052", name: "Fountain Syrup",      category: "Beverages", unit: "gal", costPerUnit: 15.00, lowStockThreshold: 2 },
};
const invList = Object.values(INV);

// ── Recipes (Subway subs) ──
const RECIPES = [
  {
    recipeId: "rec-001", name: "Turkey Breast Sub (Footlong)", category: "Footlong", sellingPrice: 9.49,
    ingredients: [
      { itemId: INV.turkey.itemId, quantity: 0.375, unit: "lb" },
      { itemId: INV.italian.itemId, quantity: 1, unit: "each" },
      { itemId: INV.american.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.tomatoes.itemId, quantity: 0.1, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-002", name: "Italian BMT (Footlong)", category: "Footlong", sellingPrice: 10.49,
    ingredients: [
      { itemId: INV.italianBMT.itemId, quantity: 0.375, unit: "lb" },
      { itemId: INV.herbs.itemId, quantity: 1, unit: "each" },
      { itemId: INV.provolone.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.tomatoes.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.onions.itemId, quantity: 0.05, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-003", name: "Steak & Cheese (Footlong)", category: "Footlong", sellingPrice: 11.49,
    ingredients: [
      { itemId: INV.steak.itemId, quantity: 0.375, unit: "lb" },
      { itemId: INV.herbs.itemId, quantity: 1, unit: "each" },
      { itemId: INV.pepperjack.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.peppers.itemId, quantity: 0.08, unit: "lb" },
      { itemId: INV.onions.itemId, quantity: 0.05, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-004", name: "Tuna Sub (Footlong)", category: "Footlong", sellingPrice: 9.99,
    ingredients: [
      { itemId: INV.tuna.itemId, quantity: 0.33, unit: "lb" },
      { itemId: INV.wheat.itemId, quantity: 1, unit: "each" },
      { itemId: INV.american.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.cucumbers.itemId, quantity: 0.05, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-005", name: "Chicken Teriyaki (Footlong)", category: "Footlong", sellingPrice: 10.99,
    ingredients: [
      { itemId: INV.chicken.itemId, quantity: 0.375, unit: "lb" },
      { itemId: INV.wheat.itemId, quantity: 1, unit: "each" },
      { itemId: INV.provolone.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.tomatoes.itemId, quantity: 0.08, unit: "lb" },
      { itemId: INV.onions.itemId, quantity: 0.05, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-006", name: "Black Forest Ham (6-inch)", category: "6-inch", sellingPrice: 5.99,
    ingredients: [
      { itemId: INV.ham.itemId, quantity: 0.19, unit: "lb" },
      { itemId: INV.italian.itemId, quantity: 0.5, unit: "each" },
      { itemId: INV.american.itemId, quantity: 0.0625, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.05, unit: "lb" },
      { itemId: INV.tomatoes.itemId, quantity: 0.05, unit: "lb" },
    ],
  },
  {
    recipeId: "rec-007", name: "Roast Beef Sub (Footlong)", category: "Footlong", sellingPrice: 11.99,
    ingredients: [
      { itemId: INV.roastBeef.itemId, quantity: 0.375, unit: "lb" },
      { itemId: INV.italian.itemId, quantity: 1, unit: "each" },
      { itemId: INV.provolone.itemId, quantity: 0.125, unit: "lb" },
      { itemId: INV.lettuce.itemId, quantity: 0.1, unit: "lb" },
      { itemId: INV.tomatoes.itemId, quantity: 0.08, unit: "lb" },
    ],
  },
];

// ── Suppliers ──
const SUPPLIERS = [
  {
    supplierId: "sup-001", name: "Sysco Foods", contactName: "Sarah Chen",
    contactEmail: "sarah@sysco.example.com", contactPhone: "512-555-9000",
    deliverySchedule: "Monday, Wednesday, Friday",
    catalog: [
      { barcode: "100100100101", barcodeFormat: "UPC-A", itemId: INV.turkey.itemId, itemName: INV.turkey.name, unit: "lb", unitCost: 5.20, casePack: 10 },
      { barcode: "100100100102", barcodeFormat: "UPC-A", itemId: INV.ham.itemId, itemName: INV.ham.name, unit: "lb", unitCost: 4.80, casePack: 10 },
      { barcode: "100100100103", barcodeFormat: "UPC-A", itemId: INV.roastBeef.itemId, itemName: INV.roastBeef.name, unit: "lb", unitCost: 7.50, casePack: 8 },
      { barcode: "100100100104", barcodeFormat: "UPC-A", itemId: INV.chicken.itemId, itemName: INV.chicken.name, unit: "lb", unitCost: 5.50, casePack: 10 },
      { barcode: "100100100105", barcodeFormat: "UPC-A", itemId: INV.italianBMT.itemId, itemName: INV.italianBMT.name, unit: "lb", unitCost: 6.50, casePack: 10 },
      { barcode: "100100100106", barcodeFormat: "UPC-A", itemId: INV.steak.itemId, itemName: INV.steak.name, unit: "lb", unitCost: 8.25, casePack: 8 },
      { barcode: "100100100110", barcodeFormat: "UPC-A", itemId: INV.american.itemId, itemName: INV.american.name, unit: "lb", unitCost: 3.50, casePack: 5 },
      { barcode: "100100100111", barcodeFormat: "UPC-A", itemId: INV.provolone.itemId, itemName: INV.provolone.name, unit: "lb", unitCost: 4.00, casePack: 5 },
      { barcode: "100100100112", barcodeFormat: "UPC-A", itemId: INV.pepperjack.itemId, itemName: INV.pepperjack.name, unit: "lb", unitCost: 4.20, casePack: 5 },
      { barcode: "100100100140", barcodeFormat: "UPC-A", itemId: INV.mayo.itemId, itemName: INV.mayo.name, unit: "gal", unitCost: 8.00 },
      { barcode: "100100100141", barcodeFormat: "UPC-A", itemId: INV.mustard.itemId, itemName: INV.mustard.name, unit: "gal", unitCost: 5.50 },
      { barcode: "100100100142", barcodeFormat: "UPC-A", itemId: INV.chipotle.itemId, itemName: INV.chipotle.name, unit: "gal", unitCost: 12.00 },
      { barcode: "100100100143", barcodeFormat: "UPC-A", itemId: INV.ranch.itemId, itemName: INV.ranch.name, unit: "gal", unitCost: 9.00 },
      { barcode: "100100100150", barcodeFormat: "UPC-A", itemId: INV.cookies.itemId, itemName: INV.cookies.name, unit: "dozen", unitCost: 3.60 },
      { barcode: "100100100151", barcodeFormat: "UPC-A", itemId: INV.chips.itemId, itemName: INV.chips.name, unit: "cases", unitCost: 18.00 },
      { barcode: "100100100152", barcodeFormat: "UPC-A", itemId: INV.fountain.itemId, itemName: INV.fountain.name, unit: "gal", unitCost: 15.00 },
    ],
  },
  {
    supplierId: "sup-002", name: "Fresh Harvest Produce", contactName: "Jake Miller",
    contactEmail: "jake@freshproduce.example.com", contactPhone: "512-555-9100",
    deliverySchedule: "Tuesday, Thursday, Saturday",
    catalog: [
      { barcode: "200200200130", barcodeFormat: "UPC-A", itemId: INV.lettuce.itemId, itemName: INV.lettuce.name, unit: "lb", unitCost: 1.80, casePack: 10 },
      { barcode: "200200200131", barcodeFormat: "UPC-A", itemId: INV.tomatoes.itemId, itemName: INV.tomatoes.name, unit: "lb", unitCost: 2.20, casePack: 10 },
      { barcode: "200200200132", barcodeFormat: "UPC-A", itemId: INV.onions.itemId, itemName: INV.onions.name, unit: "lb", unitCost: 1.50, casePack: 10 },
      { barcode: "200200200133", barcodeFormat: "UPC-A", itemId: INV.peppers.itemId, itemName: INV.peppers.name, unit: "lb", unitCost: 2.00, casePack: 8 },
      { barcode: "200200200134", barcodeFormat: "UPC-A", itemId: INV.cucumbers.itemId, itemName: INV.cucumbers.name, unit: "lb", unitCost: 1.60, casePack: 8 },
      { barcode: "200200200135", barcodeFormat: "UPC-A", itemId: INV.jalapenos.itemId, itemName: INV.jalapenos.name, unit: "lb", unitCost: 2.50, casePack: 5 },
      { barcode: "200200200136", barcodeFormat: "UPC-A", itemId: INV.avocado.itemId, itemName: INV.avocado.name, unit: "lb", unitCost: 5.00, casePack: 5 },
    ],
  },
  {
    supplierId: "sup-003", name: "Austin Bakery Supply", contactName: "Maria Santos",
    contactEmail: "maria@austinbakery.example.com", contactPhone: "512-555-9200",
    deliverySchedule: "Monday, Wednesday, Friday",
    catalog: [
      { barcode: "300300300120", barcodeFormat: "UPC-A", itemId: INV.italian.itemId, itemName: INV.italian.name, unit: "each", unitCost: 0.35, casePack: 48 },
      { barcode: "300300300121", barcodeFormat: "UPC-A", itemId: INV.wheat.itemId, itemName: INV.wheat.name, unit: "each", unitCost: 0.38, casePack: 48 },
      { barcode: "300300300122", barcodeFormat: "UPC-A", itemId: INV.herbs.itemId, itemName: INV.herbs.name, unit: "each", unitCost: 0.40, casePack: 36 },
      { barcode: "300300300123", barcodeFormat: "UPC-A", itemId: INV.flatbread.itemId, itemName: INV.flatbread.name, unit: "each", unitCost: 0.42, casePack: 30 },
      { barcode: "300300300150", barcodeFormat: "UPC-A", itemId: INV.tuna.itemId, itemName: INV.tuna.name, unit: "lb", unitCost: 6.00, casePack: 5 },
    ],
  },
];

// ── Staff ──
const STAFF = [
  { storeId: STORE1, staffId: "staff-001", name: "Maria Garcia",   email: "maria@subway.example.com", role: "manager", phone: "512-555-1001", active: true, hourlyRate: 22.00 },
  { storeId: STORE1, staffId: "staff-002", name: "James Wilson",   email: "james@subway.example.com", role: "sandwich-artist", phone: "512-555-1002", active: true, hourlyRate: 14.50 },
  { storeId: STORE1, staffId: "staff-003", name: "Sarah Kim",      email: "sarah@subway.example.com", role: "sandwich-artist", phone: "512-555-1003", active: true, hourlyRate: 14.50 },
  { storeId: STORE1, staffId: "staff-004", name: "Mike Johnson",   email: "mike@subway.example.com",  role: "shift-lead", phone: "512-555-1004", active: true, hourlyRate: 17.00 },
  { storeId: STORE2, staffId: "staff-005", name: "Alex Rivera",    email: "alex@subway.example.com",  role: "manager", phone: "512-555-2001", active: true, hourlyRate: 22.00 },
  { storeId: STORE2, staffId: "staff-006", name: "Emma Davis",     email: "emma@subway.example.com",  role: "sandwich-artist", phone: "512-555-2002", active: true, hourlyRate: 14.50 },
  { storeId: STORE2, staffId: "staff-007", name: "Chris Taylor",   email: "chris@subway.example.com", role: "sandwich-artist", phone: "512-555-2003", active: true, hourlyRate: 14.50 },
];

// ══════════════════════════════════════════════════════════════
// SEED FUNCTION
// ══════════════════════════════════════════════════════════════
async function seed() {
  // ── 1. STORES ──
  console.log("=== Stores ===");
  await put(T.STORES, {
    storeId: STORE1, ownerId: "a4c8f448-1031-70dc-991e-a60bc878349d", name: "Subway - Downtown Austin",
    address: "123 Congress Ave, Austin TX 78701", createdAt: NOW, updatedAt: NOW,
  });
  await put(T.STORES, {
    storeId: STORE2, ownerId: "a4c8f448-1031-70dc-991e-a60bc878349d", name: "Subway - Lakeline Mall",
    address: "11200 Lakeline Mall Dr, Austin TX 78717", createdAt: NOW, updatedAt: NOW,
  });

  // ── 2. INVENTORY ──
  // Store 1 gets all items; Store 2 gets all items with slightly different quantities
  console.log("=== Inventory ===");
  for (const inv of invList) {
    const baseQty = rand(15, 60);
    await put(T.INVENTORY, { storeId: STORE1, ...inv, quantity: baseQty, updatedAt: NOW });
    await put(T.INVENTORY, { storeId: STORE2, ...inv, quantity: rand(12, 55), updatedAt: NOW });
  }

  // ── 3. RECIPES ──
  console.log("=== Recipes ===");
  for (const r of RECIPES) {
    // Calculate food cost
    const foodCost = r2(r.ingredients.reduce((sum, ing) => {
      const item = invList.find((i) => i.itemId === ing.itemId);
      return sum + (item ? item.costPerUnit * ing.quantity : 0);
    }, 0));
    await put(T.RECIPES, { ...r, createdAt: NOW, updatedAt: NOW });
  }

  // ── 4. SUPPLIERS ──
  console.log("=== Suppliers ===");
  for (const s of SUPPLIERS) {
    await put(T.SUPPLIERS, { ...s, createdAt: NOW, updatedAt: NOW });
  }

  // ── 5. PURCHASE ORDERS (proper schema: lines with quantityOrdered/quantityReceived) ──
  console.log("=== Purchase Orders ===");
  const purchaseOrders = [];

  // Weekly orders from Sysco (proteins + cheese + sauces) — past 4 weeks
  for (let week = 0; week < 4; week++) {
    const orderDay = 7 * week + 1; // Mondays
    const deliverDay = 7 * week; // day after
    for (const sid of [STORE1, STORE2]) {
      const poId = `po-sysco-w${week}-${sid}`;
      const lines = [
        { itemId: INV.turkey.itemId, itemName: INV.turkey.name, unit: "lb", quantityOrdered: 30, quantityReceived: week > 0 ? 30 : 0, unitCost: 5.20 },
        { itemId: INV.ham.itemId, itemName: INV.ham.name, unit: "lb", quantityOrdered: 20, quantityReceived: week > 0 ? 20 : 0, unitCost: 4.80 },
        { itemId: INV.chicken.itemId, itemName: INV.chicken.name, unit: "lb", quantityOrdered: 25, quantityReceived: week > 0 ? 25 : 0, unitCost: 5.50 },
        { itemId: INV.italianBMT.itemId, itemName: INV.italianBMT.name, unit: "lb", quantityOrdered: 20, quantityReceived: week > 0 ? 20 : 0, unitCost: 6.50 },
        { itemId: INV.steak.itemId, itemName: INV.steak.name, unit: "lb", quantityOrdered: 15, quantityReceived: week > 0 ? 15 : 0, unitCost: 8.25 },
        { itemId: INV.american.itemId, itemName: INV.american.name, unit: "lb", quantityOrdered: 12, quantityReceived: week > 0 ? 12 : 0, unitCost: 3.50 },
        { itemId: INV.provolone.itemId, itemName: INV.provolone.name, unit: "lb", quantityOrdered: 10, quantityReceived: week > 0 ? 10 : 0, unitCost: 4.00 },
      ];
      const totalCost = r2(lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
      const status = week === 0 ? "submitted" : "received";
      const po = {
        orderId: poId, storeId: sid, supplierId: "sup-001", supplierName: "Sysco Foods",
        status, lines, totalCost,
        expectedDeliveryDate: daysAgo(deliverDay),
        createdAt: tsAt(daysAgo(orderDay), 8), updatedAt: tsAt(daysAgo(deliverDay), 9),
      };
      await put(T.PURCHASE_ORDERS, po);
      purchaseOrders.push(po);
    }
  }

  // Produce orders (2x/week from Fresh Harvest) — past 4 weeks
  for (let week = 0; week < 4; week++) {
    for (const dayOffset of [2, 5]) { // Tue, Fri
      const orderDay = 7 * week + dayOffset;
      if (orderDay > 29) continue;
      for (const sid of [STORE1, STORE2]) {
        const poId = `po-produce-w${week}d${dayOffset}-${sid}`;
        const lines = [
          { itemId: INV.lettuce.itemId, itemName: INV.lettuce.name, unit: "lb", quantityOrdered: 15, quantityReceived: week > 0 ? 15 : 0, unitCost: 1.80 },
          { itemId: INV.tomatoes.itemId, itemName: INV.tomatoes.name, unit: "lb", quantityOrdered: 15, quantityReceived: week > 0 ? 15 : 0, unitCost: 2.20 },
          { itemId: INV.onions.itemId, itemName: INV.onions.name, unit: "lb", quantityOrdered: 8, quantityReceived: week > 0 ? 8 : 0, unitCost: 1.50 },
          { itemId: INV.peppers.itemId, itemName: INV.peppers.name, unit: "lb", quantityOrdered: 6, quantityReceived: week > 0 ? 6 : 0, unitCost: 2.00 },
          { itemId: INV.cucumbers.itemId, itemName: INV.cucumbers.name, unit: "lb", quantityOrdered: 6, quantityReceived: week > 0 ? 6 : 0, unitCost: 1.60 },
          { itemId: INV.avocado.itemId, itemName: INV.avocado.name, unit: "lb", quantityOrdered: 5, quantityReceived: week > 0 ? 5 : 0, unitCost: 5.00 },
        ];
        const totalCost = r2(lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
        const status = (week === 0 && dayOffset === 5) ? "draft" : week === 0 ? "submitted" : "received";
        await put(T.PURCHASE_ORDERS, {
          orderId: poId, storeId: sid, supplierId: "sup-002", supplierName: "Fresh Harvest Produce",
          status, lines, totalCost,
          expectedDeliveryDate: daysAgo(orderDay - 1),
          createdAt: tsAt(daysAgo(orderDay), 7), updatedAt: tsAt(daysAgo(orderDay - 1), 8),
        });
      }
    }
  }

  // Bread orders (3x/week from Austin Bakery) — past 2 weeks
  for (let week = 0; week < 2; week++) {
    for (const dayOff of [1, 3, 5]) {
      const orderDay = 7 * week + dayOff;
      if (orderDay > 14) continue;
      for (const sid of [STORE1, STORE2]) {
        const lines = [
          { itemId: INV.italian.itemId, itemName: INV.italian.name, unit: "each", quantityOrdered: 48, quantityReceived: week > 0 ? 48 : 0, unitCost: 0.35 },
          { itemId: INV.wheat.itemId, itemName: INV.wheat.name, unit: "each", quantityOrdered: 48, quantityReceived: week > 0 ? 48 : 0, unitCost: 0.38 },
          { itemId: INV.herbs.itemId, itemName: INV.herbs.name, unit: "each", quantityOrdered: 36, quantityReceived: week > 0 ? 36 : 0, unitCost: 0.40 },
        ];
        const totalCost = r2(lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
        await put(T.PURCHASE_ORDERS, {
          orderId: `po-bread-w${week}d${dayOff}-${sid}`, storeId: sid,
          supplierId: "sup-003", supplierName: "Austin Bakery Supply",
          status: week > 0 ? "received" : "submitted", lines, totalCost,
          expectedDeliveryDate: daysAgo(orderDay - 1),
          createdAt: tsAt(daysAgo(orderDay), 6), updatedAt: tsAt(daysAgo(orderDay - 1), 7),
        });
      }
    }
  }

  // ── 6. RECEIVING LOGS (matching received POs) ──
  console.log("=== Receiving Logs ===");
  const receivedPOs = purchaseOrders.filter((po) => po.status === "received");
  for (const po of receivedPOs) {
    const itemsScanned = po.lines.map((l) => ({
      barcode: SUPPLIERS[0].catalog.find((c) => c.itemId === l.itemId)?.barcode || "000000000000",
      itemId: l.itemId, itemName: l.itemName, quantity: l.quantityReceived,
      unit: l.unit, unitCost: l.unitCost,
      timestamp: po.updatedAt,
    }));
    await put(T.RECEIVING_LOGS, {
      receivingId: `recv-${po.orderId}`, storeId: po.storeId,
      orderId: po.orderId, supplierId: po.supplierId, supplierName: po.supplierName,
      receivedBy: po.storeId === STORE1 ? "maria@subway.example.com" : "alex@subway.example.com",
      itemsScanned, discrepancies: [],
      totalItemsReceived: itemsScanned.reduce((s, i) => s + i.quantity, 0),
      createdAt: po.updatedAt,
    });
  }

  // ── 7. TRANSACTIONS (30 days of sub sales) ──
  console.log("=== Transactions (30 days) ===");
  const txnBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const dow = new Date(date).getDay();
    const isWeekend = dow === 0 || dow === 6;
    // Lunch rush + dinner — Downtown does more weekday, Lakeline more weekend
    const s1Count = isWeekend ? rand(35, 50) : rand(50, 75);
    const s2Count = isWeekend ? rand(45, 65) : rand(35, 55);

    for (const [sid, count] of [[STORE1, s1Count], [STORE2, s2Count]]) {
      for (let t = 0; t < count; t++) {
        const recipe = pick(RECIPES);
        const qty = rand(1, 2);
        // Add cookie/chips ~40% of time
        const addOns = [];
        if (Math.random() < 0.4) addOns.push({ recipeId: "addon-cookie", recipeName: "Cookie", quantity: rand(1, 2), price: 1.29 });
        if (Math.random() < 0.3) addOns.push({ recipeId: "addon-chips", recipeName: "Chips", quantity: 1, price: 1.79 });
        if (Math.random() < 0.5) addOns.push({ recipeId: "addon-drink", recipeName: "Fountain Drink", quantity: 1, price: 2.19 });

        const lineItems = [
          { recipeId: recipe.recipeId, recipeName: recipe.name, quantity: qty, price: recipe.sellingPrice },
          ...addOns,
        ];
        const totalAmount = r2(lineItems.reduce((s, li) => s + li.price * li.quantity, 0));
        const foodCost = r2(recipe.ingredients.reduce((s, ing) => {
          const item = invList.find((i) => i.itemId === ing.itemId);
          return s + (item ? item.costPerUnit * ing.quantity * qty : 0);
        }, 0) + addOns.length * 0.40);
        const hour = rand(10, 21);

        txnBatch.push({
          storeId: sid, transactionId: `txn-${sid}-d${day}-${t}`,
          timestamp: tsAt(date, hour, rand(0, 59)),
          lineItems, totalAmount,
          foodCost, foodCostPercentage: r2((foodCost / totalAmount) * 100),
          ingredientDeductions: recipe.ingredients.map((ing) => {
            const item = invList.find((i) => i.itemId === ing.itemId);
            return {
              itemId: ing.itemId, itemName: item?.name || "Unknown",
              quantityDeducted: r2(ing.quantity * qty), unit: ing.unit,
              costPerUnit: item?.costPerUnit || 0,
              totalCost: r2((item?.costPerUnit || 0) * ing.quantity * qty),
            };
          }),
          createdAt: tsAt(date, hour, rand(0, 59)),
        });
      }
    }
  }
  await batchWrite(T.TRANSACTIONS, txnBatch);
  console.log(`  → ${txnBatch.length} transactions`);

  // ── 8. WASTE LOGS (30 days — tells the money-saving story) ──
  // Store 1: High waste on produce (expired lettuce, tomatoes) + over-prep on tuna
  // Store 2: Lower waste overall, good operations
  console.log("=== Waste Logs (30 days) ===");
  const wasteBatch = [];

  // Waste patterns for Store 1 (the "problem" store for demo)
  const s1WastePatterns = [
    // Lettuce expires frequently — ordering too much, not rotating
    { inv: INV.lettuce, reason: "expired", minQty: 1.5, maxQty: 4, freq: 0.7, notes: "Wilted, past use-by date" },
    // Tomatoes expire — same issue
    { inv: INV.tomatoes, reason: "expired", minQty: 1, maxQty: 3, freq: 0.5, notes: "Soft, starting to mold" },
    // Tuna over-prepped — making too much tuna salad
    { inv: INV.tuna, reason: "over-prep", minQty: 0.5, maxQty: 2, freq: 0.6, notes: "Excess tuna salad end of shift" },
    // Avocado — high cost, expires fast
    { inv: INV.avocado, reason: "expired", minQty: 0.5, maxQty: 1.5, freq: 0.4, notes: "Browned, not usable" },
    // Bread — over-proofed or stale
    { inv: INV.herbs, reason: "over-prep", minQty: 2, maxQty: 6, freq: 0.3, notes: "Proofed too long, too hard to serve" },
    // Occasional damage
    { inv: INV.american, reason: "damaged", minQty: 0.25, maxQty: 0.5, freq: 0.15, notes: "Package torn during delivery" },
    // Occasional drops
    { inv: INV.chicken, reason: "dropped", minQty: 0.25, maxQty: 0.5, freq: 0.1, notes: "Dropped on floor during prep" },
  ];

  // Waste patterns for Store 2 (the "well-run" store)
  const s2WastePatterns = [
    { inv: INV.lettuce, reason: "expired", minQty: 0.5, maxQty: 1.5, freq: 0.3, notes: "Minor waste, good rotation" },
    { inv: INV.tomatoes, reason: "expired", minQty: 0.5, maxQty: 1, freq: 0.25, notes: "Slight spoilage" },
    { inv: INV.tuna, reason: "over-prep", minQty: 0.25, maxQty: 0.75, freq: 0.2, notes: "Small excess" },
    { inv: INV.avocado, reason: "expired", minQty: 0.25, maxQty: 0.5, freq: 0.2, notes: "Browned" },
  ];

  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    // Store 1 waste
    for (const wp of s1WastePatterns) {
      if (Math.random() < wp.freq) {
        const qty = r2(wp.minQty + Math.random() * (wp.maxQty - wp.minQty));
        wasteBatch.push({
          storeId: STORE1, wasteId: `w-${STORE1}-d${day}-${wp.inv.itemId}`,
          ingredientId: wp.inv.itemId, ingredientName: wp.inv.name,
          quantity: qty, unit: wp.inv.unit,
          costPerUnit: wp.inv.costPerUnit,
          totalCost: r2(qty * wp.inv.costPerUnit),
          reason: wp.reason, notes: wp.notes,
          loggedBy: pick(["maria@subway.example.com", "james@subway.example.com", "mike@subway.example.com"]),
          timestamp: tsAt(date, rand(14, 21), rand(0, 59)),
          createdAt: tsAt(date, rand(14, 21), rand(0, 59)),
        });
      }
    }
    // Store 2 waste (much less)
    for (const wp of s2WastePatterns) {
      if (Math.random() < wp.freq) {
        const qty = r2(wp.minQty + Math.random() * (wp.maxQty - wp.minQty));
        wasteBatch.push({
          storeId: STORE2, wasteId: `w-${STORE2}-d${day}-${wp.inv.itemId}`,
          ingredientId: wp.inv.itemId, ingredientName: wp.inv.name,
          quantity: qty, unit: wp.inv.unit,
          costPerUnit: wp.inv.costPerUnit,
          totalCost: r2(qty * wp.inv.costPerUnit),
          reason: wp.reason, notes: wp.notes,
          loggedBy: pick(["alex@subway.example.com", "emma@subway.example.com"]),
          timestamp: tsAt(date, rand(14, 21), rand(0, 59)),
          createdAt: tsAt(date, rand(14, 21), rand(0, 59)),
        });
      }
    }
  }
  await batchWrite(T.WASTE_LOGS, wasteBatch);
  const s1Waste = wasteBatch.filter((w) => w.storeId === STORE1);
  const s2Waste = wasteBatch.filter((w) => w.storeId === STORE2);
  console.log(`  → ${wasteBatch.length} waste logs (Store 1: ${s1Waste.length}, $${r2(s1Waste.reduce((s, w) => s + w.totalCost, 0))} | Store 2: ${s2Waste.length}, $${r2(s2Waste.reduce((s, w) => s + w.totalCost, 0))})`);

  // ── 9. STAFF ──
  console.log("=== Staff ===");
  for (const s of STAFF) {
    await put(T.STAFF, { ...s, createdAt: NOW });
  }

  // ── 10. SCHEDULES (upcoming 7 days) ──
  console.log("=== Schedules ===");
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(-day);
    for (const s of STAFF) {
      await put(T.SCHEDULES, {
        shiftId: `shift-${s.staffId}-d${day}`, storeId: s.storeId,
        staffId: s.staffId, staffName: s.name, date,
        startTime: s.role === "manager" ? "07:00" : "10:00",
        endTime: s.role === "manager" ? "15:00" : "18:00",
        position: s.role,
      });
    }
  }

  // ── 11. TIME CLOCK (30 days) ──
  console.log("=== Time Clock ===");
  const clockBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const s of STAFF) {
      if (rand(0, 6) === 0) continue; // ~14% days off
      const clockInH = s.role === "manager" ? rand(6, 8) : rand(9, 11);
      const hours = r2(rand(6, 9) + Math.random());
      const clockInTime = tsAt(date, clockInH, rand(0, 15));
      const clockOutTime = tsAt(date, clockInH + Math.floor(hours), rand(0, 59));
      clockBatch.push({
        storeId: s.storeId, entryId: `clock-${s.staffId}-d${day}`,
        staffId: s.staffId, staffName: s.name,
        clockIn: clockInTime, clockOut: clockOutTime,
        clockInTime, clockOutTime,
        totalHours: hours, status: "completed", date, approved: day > 0,
      });
    }
  }
  await batchWrite(T.TIME_CLOCK, clockBatch);
  console.log(`  → ${clockBatch.length} time entries`);

  // ── 12. CAMERAS ──
  console.log("=== Cameras ===");
  await put(T.CAMERAS, { storeId: STORE1, cameraId: "cam-001", name: "Prep Line", location: "prep-area", wyzeDeviceId: "WD001", wyzeDeviceMac: "AA:BB:CC:DD:01:01", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: STORE1, cameraId: "cam-002", name: "Walk-in Cooler", location: "storage", wyzeDeviceId: "WD002", wyzeDeviceMac: "AA:BB:CC:DD:01:02", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: STORE1, cameraId: "cam-003", name: "Register", location: "register", wyzeDeviceId: "WD003", wyzeDeviceMac: "AA:BB:CC:DD:01:03", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: STORE2, cameraId: "cam-004", name: "Counter", location: "register", wyzeDeviceId: "WD004", wyzeDeviceMac: "AA:BB:CC:DD:02:01", isOnline: true, createdAt: NOW, updatedAt: NOW });

  // ── 13. TEMP LOGS (30 days) ──
  console.log("=== Temp Logs ===");
  const tempBatch = [];
  const tempZones = [
    { loc: "Walk-in Cooler", min: 35, max: 41, store: STORE1 },
    { loc: "Freezer", min: -5, max: 2, store: STORE1 },
    { loc: "Prep Counter", min: 38, max: 42, store: STORE1 },
    { loc: "Walk-in Cooler", min: 34, max: 40, store: STORE2 },
    { loc: "Freezer", min: -5, max: 1, store: STORE2 },
  ];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const tz of tempZones) {
      for (const hour of [7, 12, 17]) {
        tempBatch.push({
          storeId: tz.store,
          logId: `temp-${tz.store}-${tz.loc.replace(/\s/g, "")}-d${day}-h${hour}`,
          location: tz.loc, temperature: rand(tz.min, tz.max),
          unit: "F", notes: null,
          loggedBy: "System", timestamp: tsAt(date, hour),
        });
      }
    }
  }
  await batchWrite(T.TEMP_LOGS, tempBatch);
  console.log(`  → ${tempBatch.length} temp logs`);

  // ── 14. FORECASTS (with predicted vs actual for accuracy scoring) ──
  console.log("=== Forecasts ===");
  // Health score handler queries: forecastId = 'latest-${storeId}', checks f.predicted & f.actual
  const forecastItems = [
    { item: INV.turkey, avgDaily: 14, variance: 2 },
    { item: INV.lettuce, avgDaily: 9, variance: 3 },
    { item: INV.italian, avgDaily: 40, variance: 8 },
    { item: INV.chicken, avgDaily: 12, variance: 3 },
    { item: INV.ham, avgDaily: 10, variance: 2 },
    { item: INV.tuna, avgDaily: 6, variance: 2 },
    { item: INV.tomatoes, avgDaily: 7, variance: 2 },
    { item: INV.wheat, avgDaily: 25, variance: 5 },
  ];

  // Store 1 forecasts — good accuracy (~82%)
  for (const fi of forecastItems) {
    const predicted = fi.avgDaily + rand(-fi.variance, fi.variance);
    // Actual deviates somewhat from predicted — Store 1 has moderate accuracy
    const errorPct = 0.10 + Math.random() * 0.15; // 10-25% error
    const actual = Math.max(1, Math.round(predicted * (1 + (Math.random() > 0.5 ? errorPct : -errorPct))));
    await put(T.FORECASTS, {
      forecastId: `latest-${STORE1}`,
      storeRecipeKey: `${fi.item.itemId}-${daysAgo(0)}`,
      storeId: STORE1,
      itemId: fi.item.itemId,
      itemName: fi.item.name,
      predicted,
      actual,
      unit: fi.item.unit,
      date: daysAgo(0),
      createdAt: NOW,
    });
  }

  // Store 2 forecasts — better accuracy (~90%)
  for (const fi of forecastItems) {
    const predicted = Math.round(fi.avgDaily * 0.7) + rand(-1, 1); // smaller store
    const errorPct = 0.05 + Math.random() * 0.10; // 5-15% error
    const actual = Math.max(1, Math.round(predicted * (1 + (Math.random() > 0.5 ? errorPct : -errorPct))));
    await put(T.FORECASTS, {
      forecastId: `latest-${STORE2}`,
      storeRecipeKey: `${fi.item.itemId}-${daysAgo(0)}`,
      storeId: STORE2,
      itemId: fi.item.itemId,
      itemName: fi.item.name,
      predicted,
      actual,
      unit: fi.item.unit,
      date: daysAgo(0),
      createdAt: NOW,
    });
  }

  // Also keep demand forecasts for the forecast screen (7 days ahead)
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(-day);
    await put(T.FORECASTS, {
      forecastId: `fc-${date}`, storeRecipeKey: `${STORE1}#${date}`, storeId: STORE1, date,
      type: "demand",
      predictions: [
        { itemId: INV.turkey.itemId, name: INV.turkey.name, predictedUsage: rand(10, 18), unit: "lb", confidence: r2(0.80 + Math.random() * 0.15) },
        { itemId: INV.lettuce.itemId, name: INV.lettuce.name, predictedUsage: rand(6, 12), unit: "lb", confidence: r2(0.75 + Math.random() * 0.15) },
        { itemId: INV.italian.itemId, name: INV.italian.name, predictedUsage: rand(30, 50), unit: "each", confidence: r2(0.85 + Math.random() * 0.10) },
        { itemId: INV.chicken.itemId, name: INV.chicken.name, predictedUsage: rand(8, 15), unit: "lb", confidence: r2(0.78 + Math.random() * 0.15) },
      ],
      createdAt: NOW,
    });
  }

  // ── 15. INCIDENTS ──
  console.log("=== Incidents ===");
  await put(T.INCIDENTS, {
    storeId: STORE1, incidentId: "inc-001", cameraId: "cam-002",
    type: "safety", status: "resolved",
    title: "Walk-in cooler temp spike to 45°F",
    notes: "Cooler door left open during delivery. Fixed within 20 minutes. No product loss.",
    timestamp: tsAt(daysAgo(3), 14, 30),
    footageStartTime: tsAt(daysAgo(3), 14, 20), footageEndTime: tsAt(daysAgo(3), 14, 50),
    createdBy: "maria@subway.example.com", createdAt: tsAt(daysAgo(3), 14, 35), updatedAt: tsAt(daysAgo(3), 15, 0),
  });
  await put(T.INCIDENTS, {
    storeId: STORE1, incidentId: "inc-002", cameraId: "cam-003",
    type: "discrepancy", status: "investigating",
    title: "Register short $23.50 on evening shift",
    notes: "End-of-day count shows register short. Reviewing camera footage.",
    timestamp: tsAt(daysAgo(1), 21, 0),
    footageStartTime: tsAt(daysAgo(1), 18, 0), footageEndTime: tsAt(daysAgo(1), 21, 30),
    createdBy: "maria@subway.example.com", createdAt: tsAt(daysAgo(1), 21, 10), updatedAt: tsAt(daysAgo(1), 21, 10),
  });
  await put(T.INCIDENTS, {
    storeId: STORE2, incidentId: "inc-003",
    type: "waste-verification", status: "resolved",
    title: "Excess bread waste flagged by system",
    notes: "AI flagged 15 bread units wasted in one day. Manager verified — special event prep leftover. No action needed.",
    timestamp: tsAt(daysAgo(5), 17, 0),
    footageStartTime: tsAt(daysAgo(5), 16, 0), footageEndTime: tsAt(daysAgo(5), 18, 0),
    createdBy: "alex@subway.example.com", createdAt: tsAt(daysAgo(5), 17, 5), updatedAt: tsAt(daysAgo(5), 17, 30),
  });

  // ── 16. PRICE HISTORY (weekly for 4 weeks) ──
  console.log("=== Price History ===");
  const priceItems = [
    { sup: "sup-001", supName: "Sysco Foods", item: INV.turkey, base: 5.20, variance: 0.30 },
    { sup: "sup-001", supName: "Sysco Foods", item: INV.steak, base: 8.25, variance: 0.50 },
    { sup: "sup-002", supName: "Fresh Harvest Produce", item: INV.lettuce, base: 1.80, variance: 0.25 },
    { sup: "sup-002", supName: "Fresh Harvest Produce", item: INV.tomatoes, base: 2.20, variance: 0.40 },
    { sup: "sup-002", supName: "Fresh Harvest Produce", item: INV.avocado, base: 5.00, variance: 0.75 },
  ];
  for (let week = 3; week >= 0; week--) {
    const date = daysAgo(week * 7);
    for (const pi of priceItems) {
      await put(T.PRICE_HISTORY, {
        priceId: `ph-${pi.item.itemId}-w${week}`,
        supplierId: pi.sup, supplierName: pi.supName,
        itemId: pi.item.itemId, itemName: pi.item.name,
        price: r2(pi.base + (Math.random() - 0.3) * pi.variance),
        unit: pi.item.unit, timestamp: date,
      });
    }
  }

  // ── 17. NOTIFICATIONS ──
  console.log("=== Notifications ===");
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-001", type: "waste-alert",
    title: "High Waste Alert - Downtown", storeId: STORE1,
    message: "Lettuce waste at Downtown Austin is 3x higher than Lakeline Mall this week. Check produce rotation procedures.",
    read: false, timestamp: tsAt(daysAgo(0), 9),
  });
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-002", type: "order-delivered",
    title: "Sysco Delivery Received", storeId: STORE1,
    message: "Weekly protein order from Sysco Foods received at Downtown Austin. All items accounted for.",
    read: true, timestamp: tsAt(daysAgo(7), 9, 15),
  });
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-003", type: "low-stock",
    title: "Low Stock - Avocado", storeId: STORE1,
    message: "Avocado (Guac) at Downtown Austin is below threshold: 3 lb remaining (min: 4 lb). Next delivery: Tuesday.",
    read: false, timestamp: tsAt(daysAgo(0), 10),
  });

  // ── 18. INVENTORY COUNTS ──
  console.log("=== Inventory Counts ===");
  await put(T.INVENTORY_COUNTS, {
    storeId: STORE1, countId: "count-001",
    status: "completed", createdBy: "maria@subway.example.com", completedBy: "maria@subway.example.com",
    createdAt: tsAt(daysAgo(2), 20), updatedAt: tsAt(daysAgo(2), 21),
    totalItems: 5, completedItems: 5, discrepancyCount: 2, notes: "Weekly count",
    items: [
      { itemId: INV.turkey.itemId, itemName: INV.turkey.name, category: "Protein", unit: "lb", expectedQuantity: 28, actualQuantity: 26, variance: -2, variancePercent: -7.1 },
      { itemId: INV.lettuce.itemId, itemName: INV.lettuce.name, category: "Produce", unit: "lb", expectedQuantity: 12, actualQuantity: 8, variance: -4, variancePercent: -33.3 },
      { itemId: INV.italian.itemId, itemName: INV.italian.name, category: "Bakery", unit: "each", expectedQuantity: 40, actualQuantity: 38, variance: -2, variancePercent: -5.0 },
      { itemId: INV.tuna.itemId, itemName: INV.tuna.name, category: "Protein", unit: "lb", expectedQuantity: 8, actualQuantity: 5, variance: -3, variancePercent: -37.5 },
      { itemId: INV.american.itemId, itemName: INV.american.name, category: "Dairy", unit: "lb", expectedQuantity: 10, actualQuantity: 10, variance: 0, variancePercent: 0 },
    ],
  });

  // ── 19. AUDIT TRAIL ──
  console.log("=== Audit Trail ===");
  await put(T.AUDIT_TRAIL, {
    storeId: STORE1, auditId: "audit-001", action: "inventory-received", resourceType: "purchase-order",
    resourceId: "po-sysco-w1-store-001", userId: "maria@subway.example.com",
    timestamp: tsAt(daysAgo(7), 9), details: { supplier: "Sysco Foods", itemCount: 7 },
  });
  await put(T.AUDIT_TRAIL, {
    storeId: STORE1, auditId: "audit-002", action: "waste-logged", resourceType: "waste-log",
    resourceId: "w-store-001-d0-inv-030", userId: "james@subway.example.com",
    timestamp: tsAt(daysAgo(0), 20), details: { item: "Lettuce (Shredded)", quantity: 3, reason: "expired" },
  });
  await put(T.AUDIT_TRAIL, {
    storeId: STORE1, auditId: "audit-003", action: "count-completed", resourceType: "inventory-count",
    resourceId: "count-001", userId: "maria@subway.example.com",
    timestamp: tsAt(daysAgo(2), 21), details: { discrepancies: 2, totalItems: 5 },
  });

  // ── SUMMARY ──
  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE — Subway Demo Data");
  console.log("═══════════════════════════════════════");
  console.log(`  Stores:           2 (Downtown Austin + Lakeline Mall)`);
  console.log(`  Inventory items:  ${invList.length} per store (${invList.length * 2} total)`);
  console.log(`  Recipes:          ${RECIPES.length} Subway subs`);
  console.log(`  Suppliers:        ${SUPPLIERS.length}`);
  console.log(`  Purchase Orders:  ~40+ (weekly protein, 2x/week produce, 3x/week bread)`);
  console.log(`  Receiving Logs:   ${receivedPOs.length} (matched to received POs)`);
  console.log(`  Transactions:     ${txnBatch.length} (30 days)`);
  console.log(`  Waste Logs:       ${wasteBatch.length} (Store 1 high waste, Store 2 well-run)`);
  console.log(`  Staff:            ${STAFF.length}`);
  console.log(`  Time Clock:       ${clockBatch.length} entries`);
  console.log(`  Cameras:          4`);
  console.log(`  Temp Logs:        ${tempBatch.length}`);
  console.log(`  Forecasts:        ${forecastItems.length * 2} accuracy records + 7 demand days`);
  console.log(`  Incidents:        3`);
  console.log(`  Price History:    ${priceItems.length * 4} entries`);
  console.log("");
  console.log("  DEMO STORY:");
  console.log("  Store 1 (Downtown) has a waste problem:");
  console.log("    - Lettuce & tomatoes expiring (ordering too much, bad FIFO)");
  console.log("    - Tuna over-prepped daily (making too much tuna salad)");
  console.log("    - Avocado going brown (expensive waste)");
  console.log("  Store 2 (Lakeline) runs tighter operations");
  console.log("  → Compare the two to show how FoodWise identifies savings");
  console.log("═══════════════════════════════════════\n");
}

seed().catch(console.error);
