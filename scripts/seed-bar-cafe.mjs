/**
 * LeanTable Demo Seed Script — Bar & Cafe Stores
 *
 * Adds a bar ("The Copper Rail") and a cafe ("Maple Street Coffee") to the
 * same owner (matt@foodwise.io) so the account shows: 2 Subways + 1 bar + 1 cafe.
 *
 * Run: node scripts/seed-bar-cafe.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "foodwise" }),
});
const doc = DynamoDBDocumentClient.from(client);

// ── Table Names (same as seed-demo.mjs) ──
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
  TEMP_LOGS: `${P}-TempLogsTable8E4B3D0B-1B9H6NPTB1A4O`,
  FORECASTS: `${P}-ForecastsTable40A833D2-N0WBS9RRLSID`,
  PRICE_HISTORY: `${P}-PriceHistoryTable5AD3E5A9-UMN2PN0ITSMI`,
  NOTIFICATIONS: `${P}-NotificationsTable76DCFC6C-1VIBTP9OJE5J6`,
  INVENTORY_COUNTS: `${P}-InventoryCountsTable27D2854D-14YKODS08NQ4V`,
  CAMERAS: `${P}-CamerasTable183C7F3A-5RF2XYCU9L25`,
  INCIDENTS: `${P}-IncidentsTable307EBBA6-1MPTP9ZRCS4LD`,
  REVENUE_SOURCES: `${P}-RevenueSourcesTable1F5217F0-9WGYGXPP0BGO`,
  REVENUE_ENTRIES: `${P}-RevenueEntriesTableF3F0AD31-IZNWJD59IOKV`,
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

const NOW = new Date().toISOString();
const OWNER_ID = "a4c8f448-1031-70dc-991e-a60bc878349d";

// ══════════════════════════════════════════════════════════════
// STORE 3 — BAR: "The Copper Rail"
// ══════════════════════════════════════════════════════════════
const BAR = "store-003";

const BAR_INV = {
  // Spirits
  vodka:       { itemId: "bar-001", name: "Tito's Vodka (1.75L)",       category: "Spirits",   unit: "bottle", costPerUnit: 24.00, lowStockThreshold: 3 },
  whiskey:     { itemId: "bar-002", name: "Jack Daniel's Whiskey (1L)",  category: "Spirits",   unit: "bottle", costPerUnit: 22.00, lowStockThreshold: 3 },
  rum:         { itemId: "bar-003", name: "Bacardi White Rum (1L)",      category: "Spirits",   unit: "bottle", costPerUnit: 16.00, lowStockThreshold: 3 },
  tequila:     { itemId: "bar-004", name: "Patron Silver Tequila (750ml)", category: "Spirits", unit: "bottle", costPerUnit: 32.00, lowStockThreshold: 2 },
  gin:         { itemId: "bar-005", name: "Tanqueray Gin (1L)",          category: "Spirits",   unit: "bottle", costPerUnit: 20.00, lowStockThreshold: 2 },
  bourbon:     { itemId: "bar-006", name: "Maker's Mark Bourbon (1L)",   category: "Spirits",   unit: "bottle", costPerUnit: 26.00, lowStockThreshold: 2 },
  tripleSec:   { itemId: "bar-007", name: "Cointreau (750ml)",           category: "Spirits",   unit: "bottle", costPerUnit: 28.00, lowStockThreshold: 1 },
  // Beer
  beerDraft:   { itemId: "bar-010", name: "Keg - IPA (1/2 BBL)",        category: "Beer",      unit: "keg",    costPerUnit: 165.00, lowStockThreshold: 1 },
  beerLager:   { itemId: "bar-011", name: "Keg - Lager (1/2 BBL)",      category: "Beer",      unit: "keg",    costPerUnit: 140.00, lowStockThreshold: 1 },
  beerBottle:  { itemId: "bar-012", name: "Bottled Beer (24pk Assorted)", category: "Beer",     unit: "case",   costPerUnit: 28.00,  lowStockThreshold: 3 },
  // Wine
  houseRed:    { itemId: "bar-015", name: "House Red Wine (750ml)",      category: "Wine",      unit: "bottle", costPerUnit: 8.00,   lowStockThreshold: 4 },
  houseWhite:  { itemId: "bar-016", name: "House White Wine (750ml)",    category: "Wine",      unit: "bottle", costPerUnit: 7.50,   lowStockThreshold: 4 },
  prosecco:    { itemId: "bar-017", name: "Prosecco (750ml)",            category: "Wine",      unit: "bottle", costPerUnit: 10.00,  lowStockThreshold: 2 },
  // Mixers & Garnishes
  sodaWater:   { itemId: "bar-020", name: "Soda Water (12pk)",           category: "Mixers",    unit: "case",   costPerUnit: 6.00,   lowStockThreshold: 3 },
  tonicWater:  { itemId: "bar-021", name: "Tonic Water (12pk)",          category: "Mixers",    unit: "case",   costPerUnit: 7.00,   lowStockThreshold: 2 },
  cranberry:   { itemId: "bar-022", name: "Cranberry Juice (1gal)",      category: "Mixers",    unit: "gal",    costPerUnit: 5.50,   lowStockThreshold: 2 },
  oj:          { itemId: "bar-023", name: "Orange Juice (1gal)",         category: "Mixers",    unit: "gal",    costPerUnit: 5.00,   lowStockThreshold: 2 },
  simpleSyrup: { itemId: "bar-024", name: "Simple Syrup (750ml)",        category: "Mixers",    unit: "bottle", costPerUnit: 4.50,   lowStockThreshold: 2 },
  limes:       { itemId: "bar-025", name: "Limes (bag of 25)",           category: "Garnish",   unit: "bag",    costPerUnit: 6.00,   lowStockThreshold: 3 },
  lemons:      { itemId: "bar-026", name: "Lemons (bag of 15)",          category: "Garnish",   unit: "bag",    costPerUnit: 4.00,   lowStockThreshold: 2 },
  olives:      { itemId: "bar-027", name: "Cocktail Olives (32oz)",      category: "Garnish",   unit: "jar",    costPerUnit: 8.00,   lowStockThreshold: 1 },
  // Bar Food
  wings:       { itemId: "bar-030", name: "Chicken Wings (10lb)",        category: "Food",      unit: "case",   costPerUnit: 32.00,  lowStockThreshold: 2 },
  fries:       { itemId: "bar-031", name: "French Fries (30lb)",         category: "Food",      unit: "case",   costPerUnit: 18.00,  lowStockThreshold: 1 },
  nachoChips:  { itemId: "bar-032", name: "Tortilla Chips (bulk 5lb)",   category: "Food",      unit: "bag",    costPerUnit: 8.00,   lowStockThreshold: 2 },
  cheese:      { itemId: "bar-033", name: "Nacho Cheese Sauce (1gal)",   category: "Food",      unit: "gal",    costPerUnit: 12.00,  lowStockThreshold: 1 },
  sliders:     { itemId: "bar-034", name: "Beef Slider Patties (5lb)",   category: "Food",      unit: "case",   costPerUnit: 22.00,  lowStockThreshold: 2 },
  buns:        { itemId: "bar-035", name: "Slider Buns (24pk)",          category: "Food",      unit: "pack",   costPerUnit: 5.00,   lowStockThreshold: 2 },
};
const barInvList = Object.values(BAR_INV);

const BAR_RECIPES = [
  {
    recipeId: "bar-rec-001", name: "Margarita", category: "Cocktails", sellingPrice: 12.00,
    ingredients: [
      { itemId: BAR_INV.tequila.itemId, quantity: 0.067, unit: "bottle" }, // 2oz pour from 750ml
      { itemId: BAR_INV.tripleSec.itemId, quantity: 0.033, unit: "bottle" },
      { itemId: BAR_INV.limes.itemId, quantity: 0.04, unit: "bag" }, // 1 lime
      { itemId: BAR_INV.simpleSyrup.itemId, quantity: 0.033, unit: "bottle" },
    ],
  },
  {
    recipeId: "bar-rec-002", name: "Old Fashioned", category: "Cocktails", sellingPrice: 13.00,
    ingredients: [
      { itemId: BAR_INV.bourbon.itemId, quantity: 0.067, unit: "bottle" },
      { itemId: BAR_INV.simpleSyrup.itemId, quantity: 0.02, unit: "bottle" },
    ],
  },
  {
    recipeId: "bar-rec-003", name: "Moscow Mule", category: "Cocktails", sellingPrice: 11.00,
    ingredients: [
      { itemId: BAR_INV.vodka.itemId, quantity: 0.04, unit: "bottle" },
      { itemId: BAR_INV.limes.itemId, quantity: 0.04, unit: "bag" },
      { itemId: BAR_INV.simpleSyrup.itemId, quantity: 0.02, unit: "bottle" },
    ],
  },
  {
    recipeId: "bar-rec-004", name: "Gin & Tonic", category: "Cocktails", sellingPrice: 10.00,
    ingredients: [
      { itemId: BAR_INV.gin.itemId, quantity: 0.05, unit: "bottle" },
      { itemId: BAR_INV.tonicWater.itemId, quantity: 0.083, unit: "case" }, // 1 can
      { itemId: BAR_INV.limes.itemId, quantity: 0.04, unit: "bag" },
    ],
  },
  {
    recipeId: "bar-rec-005", name: "Jack & Coke", category: "Cocktails", sellingPrice: 9.00,
    ingredients: [
      { itemId: BAR_INV.whiskey.itemId, quantity: 0.05, unit: "bottle" },
    ],
  },
  {
    recipeId: "bar-rec-006", name: "Draft IPA (Pint)", category: "Draft Beer", sellingPrice: 7.50,
    ingredients: [
      { itemId: BAR_INV.beerDraft.itemId, quantity: 0.008, unit: "keg" }, // ~124 pints/keg
    ],
  },
  {
    recipeId: "bar-rec-007", name: "Draft Lager (Pint)", category: "Draft Beer", sellingPrice: 6.50,
    ingredients: [
      { itemId: BAR_INV.beerLager.itemId, quantity: 0.008, unit: "keg" },
    ],
  },
  {
    recipeId: "bar-rec-008", name: "Bottled Beer", category: "Bottled Beer", sellingPrice: 5.50,
    ingredients: [
      { itemId: BAR_INV.beerBottle.itemId, quantity: 0.042, unit: "case" }, // 1/24
    ],
  },
  {
    recipeId: "bar-rec-009", name: "Glass of House Red", category: "Wine", sellingPrice: 9.00,
    ingredients: [
      { itemId: BAR_INV.houseRed.itemId, quantity: 0.2, unit: "bottle" }, // 5 glasses per bottle
    ],
  },
  {
    recipeId: "bar-rec-010", name: "Glass of House White", category: "Wine", sellingPrice: 9.00,
    ingredients: [
      { itemId: BAR_INV.houseWhite.itemId, quantity: 0.2, unit: "bottle" },
    ],
  },
  {
    recipeId: "bar-rec-011", name: "Wings (10pc)", category: "Bar Food", sellingPrice: 14.00,
    ingredients: [
      { itemId: BAR_INV.wings.itemId, quantity: 0.1, unit: "case" }, // 1lb
    ],
  },
  {
    recipeId: "bar-rec-012", name: "Loaded Nachos", category: "Bar Food", sellingPrice: 12.00,
    ingredients: [
      { itemId: BAR_INV.nachoChips.itemId, quantity: 0.1, unit: "bag" },
      { itemId: BAR_INV.cheese.itemId, quantity: 0.06, unit: "gal" },
    ],
  },
  {
    recipeId: "bar-rec-013", name: "Sliders (3pc)", category: "Bar Food", sellingPrice: 13.00,
    ingredients: [
      { itemId: BAR_INV.sliders.itemId, quantity: 0.15, unit: "case" },
      { itemId: BAR_INV.buns.itemId, quantity: 0.125, unit: "pack" }, // 3 buns
      { itemId: BAR_INV.fries.itemId, quantity: 0.01, unit: "case" },
    ],
  },
  {
    recipeId: "bar-rec-014", name: "Basket of Fries", category: "Bar Food", sellingPrice: 7.00,
    ingredients: [
      { itemId: BAR_INV.fries.itemId, quantity: 0.02, unit: "case" },
    ],
  },
];

const BAR_SUPPLIERS = [
  {
    supplierId: "sup-bar-001", name: "Republic National Distributing", contactName: "Tom Harris",
    contactEmail: "tom@rndc.example.com", contactPhone: "512-555-7001",
    deliverySchedule: "Monday, Thursday",
    catalog: [
      { barcode: "400400400001", barcodeFormat: "UPC-A", itemId: BAR_INV.vodka.itemId, itemName: BAR_INV.vodka.name, unit: "bottle", unitCost: 24.00, casePack: 6 },
      { barcode: "400400400002", barcodeFormat: "UPC-A", itemId: BAR_INV.whiskey.itemId, itemName: BAR_INV.whiskey.name, unit: "bottle", unitCost: 22.00, casePack: 12 },
      { barcode: "400400400003", barcodeFormat: "UPC-A", itemId: BAR_INV.rum.itemId, itemName: BAR_INV.rum.name, unit: "bottle", unitCost: 16.00, casePack: 12 },
      { barcode: "400400400004", barcodeFormat: "UPC-A", itemId: BAR_INV.tequila.itemId, itemName: BAR_INV.tequila.name, unit: "bottle", unitCost: 32.00, casePack: 6 },
      { barcode: "400400400005", barcodeFormat: "UPC-A", itemId: BAR_INV.gin.itemId, itemName: BAR_INV.gin.name, unit: "bottle", unitCost: 20.00, casePack: 12 },
      { barcode: "400400400006", barcodeFormat: "UPC-A", itemId: BAR_INV.bourbon.itemId, itemName: BAR_INV.bourbon.name, unit: "bottle", unitCost: 26.00, casePack: 12 },
      { barcode: "400400400007", barcodeFormat: "UPC-A", itemId: BAR_INV.tripleSec.itemId, itemName: BAR_INV.tripleSec.name, unit: "bottle", unitCost: 28.00, casePack: 6 },
      { barcode: "400400400015", barcodeFormat: "UPC-A", itemId: BAR_INV.houseRed.itemId, itemName: BAR_INV.houseRed.name, unit: "bottle", unitCost: 8.00, casePack: 12 },
      { barcode: "400400400016", barcodeFormat: "UPC-A", itemId: BAR_INV.houseWhite.itemId, itemName: BAR_INV.houseWhite.name, unit: "bottle", unitCost: 7.50, casePack: 12 },
      { barcode: "400400400017", barcodeFormat: "UPC-A", itemId: BAR_INV.prosecco.itemId, itemName: BAR_INV.prosecco.name, unit: "bottle", unitCost: 10.00, casePack: 6 },
    ],
  },
  {
    supplierId: "sup-bar-002", name: "Austin Beer Works Dist.", contactName: "Dave Collins",
    contactEmail: "dave@abwdist.example.com", contactPhone: "512-555-7002",
    deliverySchedule: "Tuesday, Friday",
    catalog: [
      { barcode: "400400400010", barcodeFormat: "UPC-A", itemId: BAR_INV.beerDraft.itemId, itemName: BAR_INV.beerDraft.name, unit: "keg", unitCost: 165.00 },
      { barcode: "400400400011", barcodeFormat: "UPC-A", itemId: BAR_INV.beerLager.itemId, itemName: BAR_INV.beerLager.name, unit: "keg", unitCost: 140.00 },
      { barcode: "400400400012", barcodeFormat: "UPC-A", itemId: BAR_INV.beerBottle.itemId, itemName: BAR_INV.beerBottle.name, unit: "case", unitCost: 28.00, casePack: 1 },
    ],
  },
  {
    supplierId: "sup-bar-003", name: "BarSupply Co.", contactName: "Angie West",
    contactEmail: "angie@barsupply.example.com", contactPhone: "512-555-7003",
    deliverySchedule: "Wednesday",
    catalog: [
      { barcode: "400400400020", barcodeFormat: "UPC-A", itemId: BAR_INV.sodaWater.itemId, itemName: BAR_INV.sodaWater.name, unit: "case", unitCost: 6.00 },
      { barcode: "400400400021", barcodeFormat: "UPC-A", itemId: BAR_INV.tonicWater.itemId, itemName: BAR_INV.tonicWater.name, unit: "case", unitCost: 7.00 },
      { barcode: "400400400022", barcodeFormat: "UPC-A", itemId: BAR_INV.cranberry.itemId, itemName: BAR_INV.cranberry.name, unit: "gal", unitCost: 5.50 },
      { barcode: "400400400023", barcodeFormat: "UPC-A", itemId: BAR_INV.oj.itemId, itemName: BAR_INV.oj.name, unit: "gal", unitCost: 5.00 },
      { barcode: "400400400024", barcodeFormat: "UPC-A", itemId: BAR_INV.simpleSyrup.itemId, itemName: BAR_INV.simpleSyrup.name, unit: "bottle", unitCost: 4.50 },
      { barcode: "400400400025", barcodeFormat: "UPC-A", itemId: BAR_INV.limes.itemId, itemName: BAR_INV.limes.name, unit: "bag", unitCost: 6.00 },
      { barcode: "400400400026", barcodeFormat: "UPC-A", itemId: BAR_INV.lemons.itemId, itemName: BAR_INV.lemons.name, unit: "bag", unitCost: 4.00 },
      { barcode: "400400400027", barcodeFormat: "UPC-A", itemId: BAR_INV.olives.itemId, itemName: BAR_INV.olives.name, unit: "jar", unitCost: 8.00 },
      { barcode: "400400400030", barcodeFormat: "UPC-A", itemId: BAR_INV.wings.itemId, itemName: BAR_INV.wings.name, unit: "case", unitCost: 32.00 },
      { barcode: "400400400031", barcodeFormat: "UPC-A", itemId: BAR_INV.fries.itemId, itemName: BAR_INV.fries.name, unit: "case", unitCost: 18.00 },
      { barcode: "400400400032", barcodeFormat: "UPC-A", itemId: BAR_INV.nachoChips.itemId, itemName: BAR_INV.nachoChips.name, unit: "bag", unitCost: 8.00 },
      { barcode: "400400400033", barcodeFormat: "UPC-A", itemId: BAR_INV.cheese.itemId, itemName: BAR_INV.cheese.name, unit: "gal", unitCost: 12.00 },
      { barcode: "400400400034", barcodeFormat: "UPC-A", itemId: BAR_INV.sliders.itemId, itemName: BAR_INV.sliders.name, unit: "case", unitCost: 22.00 },
      { barcode: "400400400035", barcodeFormat: "UPC-A", itemId: BAR_INV.buns.itemId, itemName: BAR_INV.buns.name, unit: "pack", unitCost: 5.00 },
    ],
  },
];

const BAR_STAFF = [
  { storeId: BAR, staffId: "staff-bar-001", name: "Jake Thompson",  email: "jake@copperrail.example.com",  role: "manager",    phone: "512-555-3001", active: true, hourlyRate: 25.00 },
  { storeId: BAR, staffId: "staff-bar-002", name: "Sasha Moreno",   email: "sasha@copperrail.example.com", role: "bartender",  phone: "512-555-3002", active: true, hourlyRate: 12.00 },
  { storeId: BAR, staffId: "staff-bar-003", name: "Ryan O'Brien",   email: "ryan@copperrail.example.com",  role: "bartender",  phone: "512-555-3003", active: true, hourlyRate: 12.00 },
  { storeId: BAR, staffId: "staff-bar-004", name: "Marcus Lee",     email: "marcus@copperrail.example.com", role: "barback",   phone: "512-555-3004", active: true, hourlyRate: 10.00 },
  { storeId: BAR, staffId: "staff-bar-005", name: "Tony Reeves",    email: "tony@copperrail.example.com",  role: "door-staff", phone: "512-555-3005", active: true, hourlyRate: 15.00 },
];

// ══════════════════════════════════════════════════════════════
// STORE 4 — CAFE: "Maple Street Coffee"
// ══════════════════════════════════════════════════════════════
const CAFE = "store-004";

const CAFE_INV = {
  // Coffee
  espresso:    { itemId: "cafe-001", name: "Espresso Beans (5lb)",       category: "Coffee",    unit: "bag",    costPerUnit: 42.00, lowStockThreshold: 3 },
  dripCoffee:  { itemId: "cafe-002", name: "Drip Blend Beans (5lb)",     category: "Coffee",    unit: "bag",    costPerUnit: 32.00, lowStockThreshold: 3 },
  decaf:       { itemId: "cafe-003", name: "Decaf Beans (5lb)",          category: "Coffee",    unit: "bag",    costPerUnit: 34.00, lowStockThreshold: 2 },
  // Milk & Dairy
  wholeMilk:   { itemId: "cafe-010", name: "Whole Milk (1gal)",          category: "Dairy",     unit: "gal",    costPerUnit: 4.50,  lowStockThreshold: 5 },
  oatMilk:     { itemId: "cafe-011", name: "Oat Milk (1gal)",            category: "Dairy",     unit: "gal",    costPerUnit: 7.00,  lowStockThreshold: 4 },
  almondMilk:  { itemId: "cafe-012", name: "Almond Milk (1gal)",         category: "Dairy",     unit: "gal",    costPerUnit: 6.00,  lowStockThreshold: 3 },
  cream:       { itemId: "cafe-013", name: "Heavy Cream (1qt)",          category: "Dairy",     unit: "qt",     costPerUnit: 5.50,  lowStockThreshold: 3 },
  // Syrups
  vanilla:     { itemId: "cafe-020", name: "Vanilla Syrup (750ml)",      category: "Syrups",    unit: "bottle", costPerUnit: 8.00,  lowStockThreshold: 3 },
  caramel:     { itemId: "cafe-021", name: "Caramel Syrup (750ml)",      category: "Syrups",    unit: "bottle", costPerUnit: 8.00,  lowStockThreshold: 3 },
  hazelnut:    { itemId: "cafe-022", name: "Hazelnut Syrup (750ml)",     category: "Syrups",    unit: "bottle", costPerUnit: 8.00,  lowStockThreshold: 2 },
  mocha:       { itemId: "cafe-023", name: "Chocolate/Mocha Sauce (64oz)", category: "Syrups",  unit: "bottle", costPerUnit: 12.00, lowStockThreshold: 2 },
  // Tea
  chaiConc:    { itemId: "cafe-025", name: "Chai Concentrate (1gal)",    category: "Tea",       unit: "gal",    costPerUnit: 15.00, lowStockThreshold: 2 },
  teaBags:     { itemId: "cafe-026", name: "Assorted Tea Bags (100ct)",  category: "Tea",       unit: "box",    costPerUnit: 18.00, lowStockThreshold: 2 },
  // Pastries & Food
  croissants:  { itemId: "cafe-030", name: "Butter Croissants (12pk)",   category: "Pastry",    unit: "dozen",  costPerUnit: 14.00, lowStockThreshold: 2 },
  muffins:     { itemId: "cafe-031", name: "Blueberry Muffins (12pk)",   category: "Pastry",    unit: "dozen",  costPerUnit: 12.00, lowStockThreshold: 2 },
  scones:      { itemId: "cafe-032", name: "Assorted Scones (12pk)",     category: "Pastry",    unit: "dozen",  costPerUnit: 15.00, lowStockThreshold: 1 },
  bagels:      { itemId: "cafe-033", name: "Bagels (12pk)",              category: "Pastry",    unit: "dozen",  costPerUnit: 8.00,  lowStockThreshold: 2 },
  creamCheese: { itemId: "cafe-034", name: "Cream Cheese (3lb)",         category: "Dairy",     unit: "tub",    costPerUnit: 9.00,  lowStockThreshold: 1 },
  avocado:     { itemId: "cafe-035", name: "Avocados (case of 24)",      category: "Produce",   unit: "case",   costPerUnit: 28.00, lowStockThreshold: 1 },
  bread:       { itemId: "cafe-036", name: "Sourdough Bread (loaf)",     category: "Bakery",    unit: "loaf",   costPerUnit: 4.50,  lowStockThreshold: 3 },
  turkey:      { itemId: "cafe-037", name: "Turkey Breast (deli, 3lb)",  category: "Protein",   unit: "pack",   costPerUnit: 16.00, lowStockThreshold: 2 },
  cheddar:     { itemId: "cafe-038", name: "Cheddar Cheese (2lb)",       category: "Dairy",     unit: "block",  costPerUnit: 8.00,  lowStockThreshold: 2 },
  // Cups & Supplies
  cups12:      { itemId: "cafe-040", name: "12oz Paper Cups (500ct)",    category: "Supplies",  unit: "sleeve", costPerUnit: 35.00, lowStockThreshold: 1 },
  cups16:      { itemId: "cafe-041", name: "16oz Paper Cups (500ct)",    category: "Supplies",  unit: "sleeve", costPerUnit: 40.00, lowStockThreshold: 1 },
  lids:        { itemId: "cafe-042", name: "Cup Lids (500ct)",           category: "Supplies",  unit: "sleeve", costPerUnit: 20.00, lowStockThreshold: 1 },
};
const cafeInvList = Object.values(CAFE_INV);

const CAFE_RECIPES = [
  {
    recipeId: "cafe-rec-001", name: "Latte (16oz)", category: "Espresso", sellingPrice: 5.50,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" }, // ~18g double shot
      { itemId: CAFE_INV.wholeMilk.itemId, quantity: 0.09, unit: "gal" }, // ~12oz milk
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-002", name: "Oat Milk Latte (16oz)", category: "Espresso", sellingPrice: 6.25,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" },
      { itemId: CAFE_INV.oatMilk.itemId, quantity: 0.09, unit: "gal" },
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-003", name: "Cappuccino (12oz)", category: "Espresso", sellingPrice: 5.00,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" },
      { itemId: CAFE_INV.wholeMilk.itemId, quantity: 0.06, unit: "gal" },
      { itemId: CAFE_INV.cups12.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-004", name: "Americano (16oz)", category: "Espresso", sellingPrice: 4.00,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" },
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-005", name: "Vanilla Latte (16oz)", category: "Espresso", sellingPrice: 6.00,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" },
      { itemId: CAFE_INV.wholeMilk.itemId, quantity: 0.09, unit: "gal" },
      { itemId: CAFE_INV.vanilla.itemId, quantity: 0.027, unit: "bottle" }, // ~20ml pump
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-006", name: "Mocha (16oz)", category: "Espresso", sellingPrice: 6.25,
    ingredients: [
      { itemId: CAFE_INV.espresso.itemId, quantity: 0.008, unit: "bag" },
      { itemId: CAFE_INV.wholeMilk.itemId, quantity: 0.08, unit: "gal" },
      { itemId: CAFE_INV.mocha.itemId, quantity: 0.02, unit: "bottle" },
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-007", name: "Drip Coffee (16oz)", category: "Drip", sellingPrice: 3.25,
    ingredients: [
      { itemId: CAFE_INV.dripCoffee.itemId, quantity: 0.005, unit: "bag" },
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-008", name: "Chai Latte (16oz)", category: "Tea", sellingPrice: 5.75,
    ingredients: [
      { itemId: CAFE_INV.chaiConc.itemId, quantity: 0.06, unit: "gal" },
      { itemId: CAFE_INV.wholeMilk.itemId, quantity: 0.06, unit: "gal" },
      { itemId: CAFE_INV.cups16.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-009", name: "Hot Tea", category: "Tea", sellingPrice: 3.00,
    ingredients: [
      { itemId: CAFE_INV.teaBags.itemId, quantity: 0.01, unit: "box" },
      { itemId: CAFE_INV.cups12.itemId, quantity: 0.002, unit: "sleeve" },
    ],
  },
  {
    recipeId: "cafe-rec-010", name: "Butter Croissant", category: "Pastry", sellingPrice: 3.75,
    ingredients: [
      { itemId: CAFE_INV.croissants.itemId, quantity: 0.083, unit: "dozen" },
    ],
  },
  {
    recipeId: "cafe-rec-011", name: "Blueberry Muffin", category: "Pastry", sellingPrice: 3.50,
    ingredients: [
      { itemId: CAFE_INV.muffins.itemId, quantity: 0.083, unit: "dozen" },
    ],
  },
  {
    recipeId: "cafe-rec-012", name: "Scone", category: "Pastry", sellingPrice: 3.75,
    ingredients: [
      { itemId: CAFE_INV.scones.itemId, quantity: 0.083, unit: "dozen" },
    ],
  },
  {
    recipeId: "cafe-rec-013", name: "Bagel w/ Cream Cheese", category: "Food", sellingPrice: 4.25,
    ingredients: [
      { itemId: CAFE_INV.bagels.itemId, quantity: 0.083, unit: "dozen" },
      { itemId: CAFE_INV.creamCheese.itemId, quantity: 0.033, unit: "tub" },
    ],
  },
  {
    recipeId: "cafe-rec-014", name: "Avocado Toast", category: "Food", sellingPrice: 8.50,
    ingredients: [
      { itemId: CAFE_INV.bread.itemId, quantity: 0.125, unit: "loaf" }, // 2 slices
      { itemId: CAFE_INV.avocado.itemId, quantity: 0.042, unit: "case" }, // 1 avocado
    ],
  },
  {
    recipeId: "cafe-rec-015", name: "Turkey Cheddar Sandwich", category: "Food", sellingPrice: 9.50,
    ingredients: [
      { itemId: CAFE_INV.bread.itemId, quantity: 0.125, unit: "loaf" },
      { itemId: CAFE_INV.turkey.itemId, quantity: 0.083, unit: "pack" },
      { itemId: CAFE_INV.cheddar.itemId, quantity: 0.05, unit: "block" },
    ],
  },
];

const CAFE_SUPPLIERS = [
  {
    supplierId: "sup-cafe-001", name: "Onyx Coffee Roasters", contactName: "Lena Park",
    contactEmail: "lena@onyxcoffee.example.com", contactPhone: "512-555-8001",
    deliverySchedule: "Monday, Thursday",
    catalog: [
      { barcode: "500500500001", barcodeFormat: "UPC-A", itemId: CAFE_INV.espresso.itemId, itemName: CAFE_INV.espresso.name, unit: "bag", unitCost: 42.00, casePack: 4 },
      { barcode: "500500500002", barcodeFormat: "UPC-A", itemId: CAFE_INV.dripCoffee.itemId, itemName: CAFE_INV.dripCoffee.name, unit: "bag", unitCost: 32.00, casePack: 4 },
      { barcode: "500500500003", barcodeFormat: "UPC-A", itemId: CAFE_INV.decaf.itemId, itemName: CAFE_INV.decaf.name, unit: "bag", unitCost: 34.00, casePack: 4 },
    ],
  },
  {
    supplierId: "sup-cafe-002", name: "HEB Dairy & Grocery", contactName: "Carlos Ruiz",
    contactEmail: "carlos@hebsupply.example.com", contactPhone: "512-555-8002",
    deliverySchedule: "Tuesday, Friday",
    catalog: [
      { barcode: "500500500010", barcodeFormat: "UPC-A", itemId: CAFE_INV.wholeMilk.itemId, itemName: CAFE_INV.wholeMilk.name, unit: "gal", unitCost: 4.50 },
      { barcode: "500500500011", barcodeFormat: "UPC-A", itemId: CAFE_INV.oatMilk.itemId, itemName: CAFE_INV.oatMilk.name, unit: "gal", unitCost: 7.00 },
      { barcode: "500500500012", barcodeFormat: "UPC-A", itemId: CAFE_INV.almondMilk.itemId, itemName: CAFE_INV.almondMilk.name, unit: "gal", unitCost: 6.00 },
      { barcode: "500500500013", barcodeFormat: "UPC-A", itemId: CAFE_INV.cream.itemId, itemName: CAFE_INV.cream.name, unit: "qt", unitCost: 5.50 },
      { barcode: "500500500034", barcodeFormat: "UPC-A", itemId: CAFE_INV.creamCheese.itemId, itemName: CAFE_INV.creamCheese.name, unit: "tub", unitCost: 9.00 },
      { barcode: "500500500035", barcodeFormat: "UPC-A", itemId: CAFE_INV.avocado.itemId, itemName: CAFE_INV.avocado.name, unit: "case", unitCost: 28.00 },
      { barcode: "500500500037", barcodeFormat: "UPC-A", itemId: CAFE_INV.turkey.itemId, itemName: CAFE_INV.turkey.name, unit: "pack", unitCost: 16.00 },
      { barcode: "500500500038", barcodeFormat: "UPC-A", itemId: CAFE_INV.cheddar.itemId, itemName: CAFE_INV.cheddar.name, unit: "block", unitCost: 8.00 },
    ],
  },
  {
    supplierId: "sup-cafe-003", name: "Morning Glory Bakehouse", contactName: "Beth Garcia",
    contactEmail: "beth@morningglory.example.com", contactPhone: "512-555-8003",
    deliverySchedule: "Daily (Mon-Sat)",
    catalog: [
      { barcode: "500500500030", barcodeFormat: "UPC-A", itemId: CAFE_INV.croissants.itemId, itemName: CAFE_INV.croissants.name, unit: "dozen", unitCost: 14.00 },
      { barcode: "500500500031", barcodeFormat: "UPC-A", itemId: CAFE_INV.muffins.itemId, itemName: CAFE_INV.muffins.name, unit: "dozen", unitCost: 12.00 },
      { barcode: "500500500032", barcodeFormat: "UPC-A", itemId: CAFE_INV.scones.itemId, itemName: CAFE_INV.scones.name, unit: "dozen", unitCost: 15.00 },
      { barcode: "500500500033", barcodeFormat: "UPC-A", itemId: CAFE_INV.bagels.itemId, itemName: CAFE_INV.bagels.name, unit: "dozen", unitCost: 8.00 },
      { barcode: "500500500036", barcodeFormat: "UPC-A", itemId: CAFE_INV.bread.itemId, itemName: CAFE_INV.bread.name, unit: "loaf", unitCost: 4.50 },
    ],
  },
];

const CAFE_STAFF = [
  { storeId: CAFE, staffId: "staff-cafe-001", name: "Emily Chen",     email: "emily@maplestreet.example.com",  role: "manager",     phone: "512-555-4001", active: true, hourlyRate: 22.00 },
  { storeId: CAFE, staffId: "staff-cafe-002", name: "Jordan Williams", email: "jordan@maplestreet.example.com", role: "barista",     phone: "512-555-4002", active: true, hourlyRate: 15.00 },
  { storeId: CAFE, staffId: "staff-cafe-003", name: "Mia Rodriguez",  email: "mia@maplestreet.example.com",    role: "barista",     phone: "512-555-4003", active: true, hourlyRate: 15.00 },
  { storeId: CAFE, staffId: "staff-cafe-004", name: "Noah Baker",     email: "noah@maplestreet.example.com",   role: "shift-lead",  phone: "512-555-4004", active: true, hourlyRate: 17.50 },
];

// ══════════════════════════════════════════════════════════════
// SEED FUNCTION
// ══════════════════════════════════════════════════════════════
async function seed() {
  // ── 1. STORES ──
  console.log("=== Stores ===");
  await put(T.STORES, {
    storeId: BAR, ownerId: OWNER_ID, name: "The Copper Rail",
    address: "415 E 6th St, Austin TX 78701", operatorType: "bar", createdAt: NOW, updatedAt: NOW,
  });
  await put(T.STORES, {
    storeId: CAFE, ownerId: OWNER_ID, name: "Maple Street Coffee",
    address: "2300 S Lamar Blvd, Austin TX 78704", operatorType: "cafe", createdAt: NOW, updatedAt: NOW,
  });

  // ── 2. INVENTORY ──
  console.log("=== Bar Inventory ===");
  for (const inv of barInvList) {
    await put(T.INVENTORY, { storeId: BAR, ...inv, quantity: rand(3, 15), updatedAt: NOW });
  }
  console.log("=== Cafe Inventory ===");
  for (const inv of cafeInvList) {
    await put(T.INVENTORY, { storeId: CAFE, ...inv, quantity: rand(3, 12), updatedAt: NOW });
  }

  // ── 3. RECIPES ──
  console.log("=== Bar Recipes ===");
  for (const r of BAR_RECIPES) {
    await put(T.RECIPES, { ...r, createdAt: NOW, updatedAt: NOW });
  }
  console.log("=== Cafe Recipes ===");
  for (const r of CAFE_RECIPES) {
    await put(T.RECIPES, { ...r, createdAt: NOW, updatedAt: NOW });
  }

  // ── 4. SUPPLIERS ──
  console.log("=== Bar Suppliers ===");
  for (const s of BAR_SUPPLIERS) await put(T.SUPPLIERS, { ...s, createdAt: NOW, updatedAt: NOW });
  console.log("=== Cafe Suppliers ===");
  for (const s of CAFE_SUPPLIERS) await put(T.SUPPLIERS, { ...s, createdAt: NOW, updatedAt: NOW });

  // ── 5. PURCHASE ORDERS ──
  console.log("=== Purchase Orders ===");
  // Bar: weekly spirits + beer, weekly food
  for (let week = 0; week < 4; week++) {
    const orderDay = 7 * week + 1;
    const deliverDay = 7 * week;
    // Spirits order
    const spiritLines = [
      { itemId: BAR_INV.vodka.itemId, itemName: BAR_INV.vodka.name, unit: "bottle", quantityOrdered: 6, quantityReceived: week > 0 ? 6 : 0, unitCost: 24.00 },
      { itemId: BAR_INV.whiskey.itemId, itemName: BAR_INV.whiskey.name, unit: "bottle", quantityOrdered: 4, quantityReceived: week > 0 ? 4 : 0, unitCost: 22.00 },
      { itemId: BAR_INV.tequila.itemId, itemName: BAR_INV.tequila.name, unit: "bottle", quantityOrdered: 3, quantityReceived: week > 0 ? 3 : 0, unitCost: 32.00 },
      { itemId: BAR_INV.bourbon.itemId, itemName: BAR_INV.bourbon.name, unit: "bottle", quantityOrdered: 3, quantityReceived: week > 0 ? 3 : 0, unitCost: 26.00 },
      { itemId: BAR_INV.gin.itemId, itemName: BAR_INV.gin.name, unit: "bottle", quantityOrdered: 2, quantityReceived: week > 0 ? 2 : 0, unitCost: 20.00 },
      { itemId: BAR_INV.houseRed.itemId, itemName: BAR_INV.houseRed.name, unit: "bottle", quantityOrdered: 6, quantityReceived: week > 0 ? 6 : 0, unitCost: 8.00 },
      { itemId: BAR_INV.houseWhite.itemId, itemName: BAR_INV.houseWhite.name, unit: "bottle", quantityOrdered: 6, quantityReceived: week > 0 ? 6 : 0, unitCost: 7.50 },
    ];
    const spiritTotal = r2(spiritLines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
    await put(T.PURCHASE_ORDERS, {
      orderId: `po-bar-spirits-w${week}`, storeId: BAR, supplierId: "sup-bar-001", supplierName: "Republic National Distributing",
      status: week === 0 ? "submitted" : "received", lines: spiritLines, totalCost: spiritTotal,
      expectedDeliveryDate: daysAgo(deliverDay),
      createdAt: tsAt(daysAgo(orderDay), 10), updatedAt: tsAt(daysAgo(deliverDay), 11),
    });

    // Beer order
    const beerLines = [
      { itemId: BAR_INV.beerDraft.itemId, itemName: BAR_INV.beerDraft.name, unit: "keg", quantityOrdered: 2, quantityReceived: week > 0 ? 2 : 0, unitCost: 165.00 },
      { itemId: BAR_INV.beerLager.itemId, itemName: BAR_INV.beerLager.name, unit: "keg", quantityOrdered: 2, quantityReceived: week > 0 ? 2 : 0, unitCost: 140.00 },
      { itemId: BAR_INV.beerBottle.itemId, itemName: BAR_INV.beerBottle.name, unit: "case", quantityOrdered: 8, quantityReceived: week > 0 ? 8 : 0, unitCost: 28.00 },
    ];
    const beerTotal = r2(beerLines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
    await put(T.PURCHASE_ORDERS, {
      orderId: `po-bar-beer-w${week}`, storeId: BAR, supplierId: "sup-bar-002", supplierName: "Austin Beer Works Dist.",
      status: week === 0 ? "submitted" : "received", lines: beerLines, totalCost: beerTotal,
      expectedDeliveryDate: daysAgo(deliverDay),
      createdAt: tsAt(daysAgo(orderDay), 9), updatedAt: tsAt(daysAgo(deliverDay), 10),
    });
  }

  // Cafe: weekly coffee + daily pastries
  for (let week = 0; week < 4; week++) {
    const orderDay = 7 * week + 1;
    const deliverDay = 7 * week;
    // Coffee order
    const coffeeLines = [
      { itemId: CAFE_INV.espresso.itemId, itemName: CAFE_INV.espresso.name, unit: "bag", quantityOrdered: 4, quantityReceived: week > 0 ? 4 : 0, unitCost: 42.00 },
      { itemId: CAFE_INV.dripCoffee.itemId, itemName: CAFE_INV.dripCoffee.name, unit: "bag", quantityOrdered: 3, quantityReceived: week > 0 ? 3 : 0, unitCost: 32.00 },
      { itemId: CAFE_INV.decaf.itemId, itemName: CAFE_INV.decaf.name, unit: "bag", quantityOrdered: 1, quantityReceived: week > 0 ? 1 : 0, unitCost: 34.00 },
    ];
    const coffeeTotal = r2(coffeeLines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
    await put(T.PURCHASE_ORDERS, {
      orderId: `po-cafe-coffee-w${week}`, storeId: CAFE, supplierId: "sup-cafe-001", supplierName: "Onyx Coffee Roasters",
      status: week === 0 ? "submitted" : "received", lines: coffeeLines, totalCost: coffeeTotal,
      expectedDeliveryDate: daysAgo(deliverDay),
      createdAt: tsAt(daysAgo(orderDay), 6), updatedAt: tsAt(daysAgo(deliverDay), 7),
    });

    // Dairy order (2x/week)
    for (const dayOffset of [1, 4]) {
      const dOrder = 7 * week + dayOffset;
      if (dOrder > 29) continue;
      const dairyLines = [
        { itemId: CAFE_INV.wholeMilk.itemId, itemName: CAFE_INV.wholeMilk.name, unit: "gal", quantityOrdered: 8, quantityReceived: week > 0 ? 8 : 0, unitCost: 4.50 },
        { itemId: CAFE_INV.oatMilk.itemId, itemName: CAFE_INV.oatMilk.name, unit: "gal", quantityOrdered: 5, quantityReceived: week > 0 ? 5 : 0, unitCost: 7.00 },
        { itemId: CAFE_INV.almondMilk.itemId, itemName: CAFE_INV.almondMilk.name, unit: "gal", quantityOrdered: 3, quantityReceived: week > 0 ? 3 : 0, unitCost: 6.00 },
        { itemId: CAFE_INV.cream.itemId, itemName: CAFE_INV.cream.name, unit: "qt", quantityOrdered: 4, quantityReceived: week > 0 ? 4 : 0, unitCost: 5.50 },
      ];
      const dairyTotal = r2(dairyLines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0));
      await put(T.PURCHASE_ORDERS, {
        orderId: `po-cafe-dairy-w${week}d${dayOffset}`, storeId: CAFE, supplierId: "sup-cafe-002", supplierName: "HEB Dairy & Grocery",
        status: week === 0 ? "submitted" : "received", lines: dairyLines, totalCost: dairyTotal,
        expectedDeliveryDate: daysAgo(dOrder - 1),
        createdAt: tsAt(daysAgo(dOrder), 5), updatedAt: tsAt(daysAgo(dOrder - 1), 6),
      });
    }
  }

  // ── 6. STAFF ──
  console.log("=== Staff ===");
  for (const s of BAR_STAFF) await put(T.STAFF, { ...s, createdAt: NOW, updatedAt: NOW });
  for (const s of CAFE_STAFF) await put(T.STAFF, { ...s, createdAt: NOW, updatedAt: NOW });

  // ── 7. TRANSACTIONS ──
  console.log("=== Transactions (30 days) ===");
  const txnBatch = [];

  // BAR transactions — evening-heavy, big weekends
  const barDrinkRecipes = BAR_RECIPES.filter(r => r.category !== "Bar Food");
  const barFoodRecipes = BAR_RECIPES.filter(r => r.category === "Bar Food");

  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const dow = new Date(date).getDay();
    const isFriSat = dow === 5 || dow === 6;
    const isWeekend = dow === 0 || dow === 6 || dow === 5;
    // Bar: ~40 txns weeknight, ~80+ Fri/Sat
    const barCount = isFriSat ? rand(70, 100) : isWeekend ? rand(45, 60) : rand(30, 50);

    for (let t = 0; t < barCount; t++) {
      const recipe = pick(barDrinkRecipes);
      const qty = recipe.category === "Draft Beer" || recipe.category === "Bottled Beer" ? rand(1, 3) : 1;
      const lineItems = [
        { recipeId: recipe.recipeId, recipeName: recipe.name, quantity: qty, price: recipe.sellingPrice },
      ];
      // ~35% chance of food order with drinks
      if (Math.random() < 0.35) {
        const food = pick(barFoodRecipes);
        lineItems.push({ recipeId: food.recipeId, recipeName: food.name, quantity: 1, price: food.sellingPrice });
      }
      // ~20% chance of second drink
      if (Math.random() < 0.20) {
        const d2 = pick(barDrinkRecipes);
        lineItems.push({ recipeId: d2.recipeId, recipeName: d2.name, quantity: 1, price: d2.sellingPrice });
      }

      const totalAmount = r2(lineItems.reduce((s, li) => s + li.price * li.quantity, 0));
      const foodCost = r2(totalAmount * (0.18 + Math.random() * 0.08)); // ~18-26% pour cost
      // Bar hours: 4PM-2AM, peak 8PM-midnight
      const hour = rand(16, 25) % 24;

      txnBatch.push({
        storeId: BAR, transactionId: `txn-${BAR}-d${day}-${t}`,
        timestamp: tsAt(date, hour, rand(0, 59)),
        lineItems, totalAmount,
        foodCost, foodCostPercentage: r2((foodCost / totalAmount) * 100),
        ingredientDeductions: recipe.ingredients.map((ing) => {
          const item = barInvList.find((i) => i.itemId === ing.itemId);
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

  // CAFE transactions — morning-heavy, weekday peaks
  const cafeDrinkRecipes = CAFE_RECIPES.filter(r => ["Espresso", "Drip", "Tea"].includes(r.category));
  const cafeFoodRecipes = CAFE_RECIPES.filter(r => ["Pastry", "Food"].includes(r.category));

  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const dow = new Date(date).getDay();
    const isWeekend = dow === 0 || dow === 6;
    // Cafe: ~100 weekday (commuters), ~70 weekend (brunch crowd)
    const cafeCount = isWeekend ? rand(55, 80) : rand(80, 120);

    for (let t = 0; t < cafeCount; t++) {
      const recipe = pick(cafeDrinkRecipes);
      const lineItems = [
        { recipeId: recipe.recipeId, recipeName: recipe.name, quantity: 1, price: recipe.sellingPrice },
      ];
      // ~55% chance of pastry/food with coffee
      if (Math.random() < 0.55) {
        const food = pick(cafeFoodRecipes);
        lineItems.push({ recipeId: food.recipeId, recipeName: food.name, quantity: 1, price: food.sellingPrice });
      }
      // ~15% get a second drink (for a friend)
      if (Math.random() < 0.15) {
        const d2 = pick(cafeDrinkRecipes);
        lineItems.push({ recipeId: d2.recipeId, recipeName: d2.name, quantity: 1, price: d2.sellingPrice });
      }

      const totalAmount = r2(lineItems.reduce((s, li) => s + li.price * li.quantity, 0));
      const foodCost = r2(totalAmount * (0.25 + Math.random() * 0.10)); // ~25-35% food cost
      // Cafe hours: 6AM-4PM, peak 7-10AM
      const hour = Math.random() < 0.6 ? rand(6, 9) : rand(10, 15);

      txnBatch.push({
        storeId: CAFE, transactionId: `txn-${CAFE}-d${day}-${t}`,
        timestamp: tsAt(date, hour, rand(0, 59)),
        lineItems, totalAmount,
        foodCost, foodCostPercentage: r2((foodCost / totalAmount) * 100),
        ingredientDeductions: recipe.ingredients.map((ing) => {
          const item = cafeInvList.find((i) => i.itemId === ing.itemId);
          return {
            itemId: ing.itemId, itemName: item?.name || "Unknown",
            quantityDeducted: r2(ing.quantity), unit: ing.unit,
            costPerUnit: item?.costPerUnit || 0,
            totalCost: r2((item?.costPerUnit || 0) * ing.quantity),
          };
        }),
        createdAt: tsAt(date, hour, rand(0, 59)),
      });
    }
  }

  await batchWrite(T.TRANSACTIONS, txnBatch);
  const barTxns = txnBatch.filter(t => t.storeId === BAR);
  const cafeTxns = txnBatch.filter(t => t.storeId === CAFE);
  console.log(`  -> ${txnBatch.length} transactions (Bar: ${barTxns.length}, Cafe: ${cafeTxns.length})`);

  // ── 8. WASTE LOGS ──
  console.log("=== Waste Logs ===");
  const wasteBatch = [];

  // Bar waste: spillage, expired garnishes, flat beer
  const barWastePatterns = [
    { inv: BAR_INV.limes, reason: "expired", minQty: 0.3, maxQty: 0.8, freq: 0.5, notes: "Dried out, not usable for garnish" },
    { inv: BAR_INV.lemons, reason: "expired", minQty: 0.2, maxQty: 0.6, freq: 0.4, notes: "Browned, past prime" },
    { inv: BAR_INV.cranberry, reason: "expired", minQty: 0.1, maxQty: 0.3, freq: 0.2, notes: "Opened too long, off taste" },
    { inv: BAR_INV.beerDraft, reason: "spillage", minQty: 0.005, maxQty: 0.015, freq: 0.6, notes: "Tap spillage, foam waste during rush" },
    { inv: BAR_INV.vodka, reason: "spillage", minQty: 0.01, maxQty: 0.03, freq: 0.3, notes: "Over-pour / spill during busy shift" },
    { inv: BAR_INV.wings, reason: "expired", minQty: 0.05, maxQty: 0.15, freq: 0.25, notes: "Leftover wings end of night" },
    { inv: BAR_INV.olives, reason: "expired", minQty: 0.1, maxQty: 0.3, freq: 0.15, notes: "Olive jar left out too long" },
  ];

  // Cafe waste: pastry spoilage (big issue), expired milk
  const cafeWastePatterns = [
    { inv: CAFE_INV.croissants, reason: "expired", minQty: 0.08, maxQty: 0.25, freq: 0.7, notes: "Unsold croissants, stale by close" },
    { inv: CAFE_INV.muffins, reason: "expired", minQty: 0.08, maxQty: 0.25, freq: 0.65, notes: "Day-old muffins, can't sell next day" },
    { inv: CAFE_INV.scones, reason: "expired", minQty: 0.08, maxQty: 0.17, freq: 0.5, notes: "Unsold scones" },
    { inv: CAFE_INV.wholeMilk, reason: "expired", minQty: 0.1, maxQty: 0.4, freq: 0.3, notes: "Opened jug past use-by" },
    { inv: CAFE_INV.oatMilk, reason: "expired", minQty: 0.05, maxQty: 0.2, freq: 0.2, notes: "Opened, expired" },
    { inv: CAFE_INV.bagels, reason: "expired", minQty: 0.08, maxQty: 0.17, freq: 0.4, notes: "Unsold bagels going stale" },
    { inv: CAFE_INV.avocado, reason: "expired", minQty: 0.02, maxQty: 0.06, freq: 0.35, notes: "Overripe, brown inside" },
    { inv: CAFE_INV.dripCoffee, reason: "over-prep", minQty: 0.003, maxQty: 0.008, freq: 0.5, notes: "Brewed pot dumped after 30min" },
  ];

  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const wp of barWastePatterns) {
      if (Math.random() < wp.freq) {
        const qty = r2(wp.minQty + Math.random() * (wp.maxQty - wp.minQty));
        wasteBatch.push({
          storeId: BAR, wasteId: `w-${BAR}-d${day}-${wp.inv.itemId}`,
          ingredientId: wp.inv.itemId, ingredientName: wp.inv.name,
          quantity: qty, unit: wp.inv.unit,
          costPerUnit: wp.inv.costPerUnit,
          totalCost: r2(qty * wp.inv.costPerUnit),
          reason: wp.reason, notes: wp.notes,
          loggedBy: pick(["jake@copperrail.example.com", "sasha@copperrail.example.com"]),
          timestamp: tsAt(date, rand(16, 23), rand(0, 59)),
          createdAt: tsAt(date, rand(16, 23), rand(0, 59)),
        });
      }
    }
    for (const wp of cafeWastePatterns) {
      if (Math.random() < wp.freq) {
        const qty = r2(wp.minQty + Math.random() * (wp.maxQty - wp.minQty));
        wasteBatch.push({
          storeId: CAFE, wasteId: `w-${CAFE}-d${day}-${wp.inv.itemId}`,
          ingredientId: wp.inv.itemId, ingredientName: wp.inv.name,
          quantity: qty, unit: wp.inv.unit,
          costPerUnit: wp.inv.costPerUnit,
          totalCost: r2(qty * wp.inv.costPerUnit),
          reason: wp.reason, notes: wp.notes,
          loggedBy: pick(["emily@maplestreet.example.com", "jordan@maplestreet.example.com"]),
          timestamp: tsAt(date, rand(14, 17), rand(0, 59)),
          createdAt: tsAt(date, rand(14, 17), rand(0, 59)),
        });
      }
    }
  }
  await batchWrite(T.WASTE_LOGS, wasteBatch);
  const barWaste = wasteBatch.filter(w => w.storeId === BAR);
  const cafeWaste = wasteBatch.filter(w => w.storeId === CAFE);
  console.log(`  -> ${wasteBatch.length} waste logs (Bar: ${barWaste.length}, $${r2(barWaste.reduce((s, w) => s + w.totalCost, 0))} | Cafe: ${cafeWaste.length}, $${r2(cafeWaste.reduce((s, w) => s + w.totalCost, 0))})`);

  // ── 9. SCHEDULES (30 days historical + 7 forward) ──
  console.log("=== Schedules ===");
  const allStaff = [...BAR_STAFF, ...CAFE_STAFF];
  const schedBatch = [];
  for (let day = 29; day >= -7; day--) {
    const date = daysAgo(day);
    for (const s of allStaff) {
      if (rand(0, 6) === 0) continue; // ~14% days off
      const isBar = s.storeId === BAR;
      schedBatch.push({
        shiftId: `shift-${s.staffId}-d${day}`, storeId: s.storeId,
        staffId: s.staffId, staffName: s.name, date,
        startTime: isBar ? (s.role === "manager" ? "14:00" : "16:00") : (s.role === "manager" ? "05:30" : "06:00"),
        endTime: isBar ? (s.role === "manager" ? "23:00" : "02:00") : (s.role === "manager" ? "14:00" : "13:00"),
        position: s.role,
      });
    }
  }
  await batchWrite(T.SCHEDULES, schedBatch);

  // ── 10. TIME CLOCK ──
  console.log("=== Time Clock ===");
  const clockBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const s of allStaff) {
      if (rand(0, 6) === 0) continue; // ~14% days off
      const isBar = s.storeId === BAR;
      const clockInH = isBar
        ? (s.role === "manager" ? rand(14, 15) : rand(16, 17))
        : (s.role === "manager" ? rand(5, 6) : rand(5, 7));
      const hours = r2(isBar ? rand(7, 10) + Math.random() : rand(6, 8) + Math.random());
      const clockInTime = tsAt(date, clockInH, rand(0, 15));
      const outH = clockInH + Math.floor(hours);
      const clockOutTime = tsAt(date, outH > 23 ? outH - 24 : outH, rand(0, 59));
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
  console.log(`  -> ${clockBatch.length} time entries`);

  // ── 11. TEMP LOGS ──
  console.log("=== Temp Logs ===");
  const tempBatch = [];
  const tempZones = [
    { loc: "Bar Walk-in Cooler", min: 34, max: 40, store: BAR },
    { loc: "Bar Keg Cooler", min: 36, max: 42, store: BAR },
    { loc: "Cafe Fridge", min: 34, max: 40, store: CAFE },
    { loc: "Pastry Display", min: 60, max: 72, store: CAFE },
  ];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const tz of tempZones) {
      for (const hour of [8, 14, 20]) {
        const temp = rand(tz.min, tz.max);
        const isCooler = tz.loc.includes("Cooler") || tz.loc.includes("Fridge");
        const isFreezer = tz.loc.includes("Freezer");
        const inRange = isFreezer ? temp <= 0 : isCooler ? temp <= 40 : true;
        const ts = tsAt(date, hour);
        tempBatch.push({
          storeId: tz.store,
          logId: `temp-${tz.store}-${tz.loc.replace(/\s/g, "")}-d${day}-h${hour}`,
          location: tz.loc, temperature: temp,
          unit: "F", inRange, rangeNote: inRange ? "" : `Temperature ${temp}F out of range`,
          recordedBy: "System", timestamp: ts, createdAt: ts,
        });
      }
    }
  }
  await batchWrite(T.TEMP_LOGS, tempBatch);
  console.log(`  -> ${tempBatch.length} temp logs`);

  // ── 12. FORECASTS ──
  console.log("=== Forecasts ===");
  // Bar forecast items
  const barForecastItems = [
    { item: BAR_INV.vodka, avgDaily: 1.2, variance: 0.3 },
    { item: BAR_INV.whiskey, avgDaily: 0.8, variance: 0.2 },
    { item: BAR_INV.beerDraft, avgDaily: 0.3, variance: 0.1 },
    { item: BAR_INV.beerBottle, avgDaily: 1.5, variance: 0.4 },
    { item: BAR_INV.limes, avgDaily: 1.2, variance: 0.3 },
    { item: BAR_INV.wings, avgDaily: 0.4, variance: 0.1 },
  ];
  for (const fi of barForecastItems) {
    const predicted = r2(fi.avgDaily + (Math.random() - 0.5) * fi.variance * 2);
    const errorPct = 0.08 + Math.random() * 0.12;
    const actual = r2(Math.max(0.1, predicted * (1 + (Math.random() > 0.5 ? errorPct : -errorPct))));
    await put(T.FORECASTS, {
      forecastId: `latest-${BAR}`, storeRecipeKey: `${fi.item.itemId}-${daysAgo(0)}`,
      storeId: BAR, itemId: fi.item.itemId, itemName: fi.item.name,
      predicted, actual, unit: fi.item.unit, forecastDate: daysAgo(0), createdAt: NOW,
    });
  }

  // Cafe forecast items
  const cafeForecastItems = [
    { item: CAFE_INV.espresso, avgDaily: 1.8, variance: 0.3 },
    { item: CAFE_INV.dripCoffee, avgDaily: 0.9, variance: 0.2 },
    { item: CAFE_INV.wholeMilk, avgDaily: 3.5, variance: 0.8 },
    { item: CAFE_INV.oatMilk, avgDaily: 2.0, variance: 0.5 },
    { item: CAFE_INV.croissants, avgDaily: 1.5, variance: 0.3 },
    { item: CAFE_INV.muffins, avgDaily: 1.2, variance: 0.3 },
  ];
  for (const fi of cafeForecastItems) {
    const predicted = r2(fi.avgDaily + (Math.random() - 0.5) * fi.variance * 2);
    const errorPct = 0.06 + Math.random() * 0.10;
    const actual = r2(Math.max(0.1, predicted * (1 + (Math.random() > 0.5 ? errorPct : -errorPct))));
    await put(T.FORECASTS, {
      forecastId: `latest-${CAFE}`, storeRecipeKey: `${fi.item.itemId}-${daysAgo(0)}`,
      storeId: CAFE, itemId: fi.item.itemId, itemName: fi.item.name,
      predicted, actual, unit: fi.item.unit, forecastDate: daysAgo(0), createdAt: NOW,
    });
  }

  // Demand forecasts (7 days ahead)
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(-day);
    await put(T.FORECASTS, {
      forecastId: `fc-bar-${date}`, storeRecipeKey: `${BAR}#${date}`, storeId: BAR, forecastDate: date,
      type: "demand", predictedRevenue: r2(rand(1200, 2500) + Math.random() * 200), predictedValue: r2(rand(1200, 2500) + Math.random() * 200),
      predictions: [
        { itemId: BAR_INV.vodka.itemId, name: BAR_INV.vodka.name, predictedUsage: r2(0.8 + Math.random() * 0.8), unit: "bottle", confidence: r2(0.78 + Math.random() * 0.15) },
        { itemId: BAR_INV.beerDraft.itemId, name: BAR_INV.beerDraft.name, predictedUsage: r2(0.2 + Math.random() * 0.3), unit: "keg", confidence: r2(0.80 + Math.random() * 0.12) },
        { itemId: BAR_INV.limes.itemId, name: BAR_INV.limes.name, predictedUsage: r2(0.8 + Math.random() * 0.6), unit: "bag", confidence: r2(0.75 + Math.random() * 0.15) },
        { itemId: BAR_INV.wings.itemId, name: BAR_INV.wings.name, predictedUsage: r2(0.2 + Math.random() * 0.4), unit: "case", confidence: r2(0.72 + Math.random() * 0.15) },
      ],
      createdAt: NOW,
    });
    await put(T.FORECASTS, {
      forecastId: `fc-cafe-${date}`, storeRecipeKey: `${CAFE}#${date}`, storeId: CAFE, forecastDate: date,
      type: "demand", predictedRevenue: r2(rand(600, 1200) + Math.random() * 100), predictedValue: r2(rand(600, 1200) + Math.random() * 100),
      predictions: [
        { itemId: CAFE_INV.espresso.itemId, name: CAFE_INV.espresso.name, predictedUsage: r2(1.5 + Math.random() * 0.6), unit: "bag", confidence: r2(0.85 + Math.random() * 0.10) },
        { itemId: CAFE_INV.wholeMilk.itemId, name: CAFE_INV.wholeMilk.name, predictedUsage: r2(2.5 + Math.random() * 1.5), unit: "gal", confidence: r2(0.82 + Math.random() * 0.12) },
        { itemId: CAFE_INV.croissants.itemId, name: CAFE_INV.croissants.name, predictedUsage: r2(1.0 + Math.random() * 0.8), unit: "dozen", confidence: r2(0.78 + Math.random() * 0.12) },
        { itemId: CAFE_INV.bagels.itemId, name: CAFE_INV.bagels.name, predictedUsage: r2(0.8 + Math.random() * 0.6), unit: "dozen", confidence: r2(0.75 + Math.random() * 0.15) },
      ],
      createdAt: NOW,
    });
  }

  // ── 13. NOTIFICATIONS ──
  console.log("=== Notifications ===");
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-bar-001", type: "waste-alert",
    title: "High Spillage Alert - The Copper Rail", storeId: BAR,
    message: "Draft beer spillage is up 15% this week. Consider recalibrating taps or scheduling barback during peak hours.",
    read: false, timestamp: tsAt(daysAgo(0), 15),
  });
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-cafe-001", type: "waste-alert",
    title: "Pastry Waste Alert - Maple Street Coffee", storeId: CAFE,
    message: "Croissants and muffins waste averaging $18/day this week. Consider reducing daily pastry order by 20%.",
    read: false, timestamp: tsAt(daysAgo(0), 8),
  });
  await put(T.NOTIFICATIONS, {
    userId: "demo-owner", notificationId: "notif-cafe-002", type: "low-stock",
    title: "Low Stock - Oat Milk", storeId: CAFE,
    message: "Oat milk at Maple Street Coffee is below threshold: 3 gal remaining (min: 4 gal). Next delivery: Friday.",
    read: false, timestamp: tsAt(daysAgo(0), 7),
  });

  // ── 14. PRICE HISTORY ──
  console.log("=== Price History ===");
  const barPriceItems = [
    { sup: "sup-bar-001", supName: "Republic National Distributing", item: BAR_INV.vodka, base: 24.00, variance: 1.50 },
    { sup: "sup-bar-001", supName: "Republic National Distributing", item: BAR_INV.tequila, base: 32.00, variance: 2.00 },
    { sup: "sup-bar-002", supName: "Austin Beer Works Dist.", item: BAR_INV.beerDraft, base: 165.00, variance: 5.00 },
  ];
  const cafePriceItems = [
    { sup: "sup-cafe-001", supName: "Onyx Coffee Roasters", item: CAFE_INV.espresso, base: 42.00, variance: 3.00 },
    { sup: "sup-cafe-002", supName: "HEB Dairy & Grocery", item: CAFE_INV.wholeMilk, base: 4.50, variance: 0.50 },
    { sup: "sup-cafe-002", supName: "HEB Dairy & Grocery", item: CAFE_INV.oatMilk, base: 7.00, variance: 0.75 },
  ];
  for (let week = 3; week >= 0; week--) {
    const date = daysAgo(week * 7);
    for (const pi of [...barPriceItems, ...cafePriceItems]) {
      await put(T.PRICE_HISTORY, {
        priceId: `ph-${pi.item.itemId}-w${week}`,
        supplierId: pi.sup, supplierName: pi.supName,
        itemId: pi.item.itemId, itemName: pi.item.name,
        price: r2(pi.base + (Math.random() - 0.3) * pi.variance),
        unit: pi.item.unit, timestamp: date,
      });
    }
  }

  // ── CAMERAS ──
  console.log("=== Cameras ===");
  await put(T.CAMERAS, { storeId: BAR, cameraId: "cam-bar-01", name: "Bar Counter", location: "register", wyzeDeviceId: "WD-BAR-01", wyzeDeviceMac: "AA:BB:CC:03:01:01", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: BAR, cameraId: "cam-bar-02", name: "Stockroom", location: "storage", wyzeDeviceId: "WD-BAR-02", wyzeDeviceMac: "AA:BB:CC:03:01:02", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: BAR, cameraId: "cam-bar-03", name: "Front Entrance", location: "entrance", wyzeDeviceId: "WD-BAR-03", wyzeDeviceMac: "AA:BB:CC:03:01:03", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: CAFE, cameraId: "cam-cafe-01", name: "Coffee Bar", location: "register", wyzeDeviceId: "WD-CAFE-01", wyzeDeviceMac: "AA:BB:CC:04:01:01", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: CAFE, cameraId: "cam-cafe-02", name: "Pastry Display", location: "dining", wyzeDeviceId: "WD-CAFE-02", wyzeDeviceMac: "AA:BB:CC:04:01:02", isOnline: true, createdAt: NOW, updatedAt: NOW });
  console.log("  → 3 bar + 2 cafe cameras");

  // ── INCIDENTS (cross-linked to cameras, waste, transactions) ──
  console.log("=== Incidents ===");
  await put(T.INCIDENTS, {
    storeId: BAR, incidentId: "inc-bar-001", cameraId: "cam-bar-01",
    transactionId: "txn-store-003-d2-0",
    type: "discrepancy", status: "investigating",
    title: "Register short $47 after Friday close",
    notes: "End-of-night cash count shows register short. Reviewing bar counter camera for transaction discrepancies.",
    timestamp: `${daysAgo(2)}T02:30:00Z`,
    footageStartTime: `${daysAgo(2)}T00:00:00Z`, footageEndTime: `${daysAgo(2)}T02:45:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(2)}T10:00:00Z`, updatedAt: `${daysAgo(2)}T10:00:00Z`,
  });
  await put(T.INCIDENTS, {
    storeId: BAR, incidentId: "inc-bar-002", cameraId: "cam-bar-02",
    type: "theft", status: "resolved",
    title: "Unauthorized stockroom access after hours",
    notes: "Camera caught door opening at 3:15 AM. Turned out to be cleaning crew with valid key. False alarm.",
    timestamp: `${daysAgo(7)}T03:15:00Z`,
    footageStartTime: `${daysAgo(7)}T03:13:00Z`, footageEndTime: `${daysAgo(7)}T03:17:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(7)}T09:00:00Z`, updatedAt: `${daysAgo(6)}T11:00:00Z`,
  });
  await put(T.INCIDENTS, {
    storeId: CAFE, incidentId: "inc-cafe-001", cameraId: "cam-cafe-02",
    wasteId: "waste-cafe-d3-0",
    type: "waste-verification", status: "resolved",
    title: "Large pastry waste flagged",
    notes: "12 muffins + 8 croissants discarded end of day. Manager verified — normal spoilage for weekend overstock.",
    timestamp: `${daysAgo(3)}T17:00:00Z`,
    footageStartTime: `${daysAgo(3)}T16:58:00Z`, footageEndTime: `${daysAgo(3)}T17:02:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(3)}T17:05:00Z`, updatedAt: `${daysAgo(3)}T17:30:00Z`,
  });
  await put(T.INCIDENTS, {
    storeId: CAFE, incidentId: "inc-cafe-002", cameraId: "cam-cafe-01",
    type: "safety", status: "open",
    title: "Wet floor near espresso station",
    notes: "Customer reported slippery floor. Checking camera to assess frequency. May need non-slip mats.",
    timestamp: `${daysAgo(1)}T11:20:00Z`,
    footageStartTime: `${daysAgo(1)}T11:18:00Z`, footageEndTime: `${daysAgo(1)}T11:22:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(1)}T11:25:00Z`, updatedAt: `${daysAgo(1)}T11:25:00Z`,
  });
  console.log("  → 2 bar + 2 cafe incidents (linked to cameras, transactions, waste)");

  // ── REVENUE SOURCES ──
  console.log("=== Revenue Sources ===");
  const barRevenueSources = [
    { storeId: BAR, sourceId: "src-bar-pool", name: "Pool Tables", type: "pool_tables", isActive: true, createdAt: NOW },
    { storeId: BAR, sourceId: "src-bar-darts", name: "Dart Boards", type: "darts", isActive: true, createdAt: NOW },
    { storeId: BAR, sourceId: "src-bar-cover", name: "Cover Charge", type: "cover_charge", isActive: true, createdAt: NOW },
    { storeId: BAR, sourceId: "src-bar-music", name: "Live Music Night", type: "live_music", isActive: true, createdAt: NOW },
    { storeId: BAR, sourceId: "src-bar-trivia", name: "Tuesday Trivia", type: "trivia", isActive: true, createdAt: NOW },
    { storeId: BAR, sourceId: "src-bar-events", name: "Private Events", type: "private_events", isActive: true, createdAt: NOW },
  ];
  const cafeRevenueSources = [
    { storeId: CAFE, sourceId: "src-cafe-catering", name: "Catering Orders", type: "catering", isActive: true, createdAt: NOW },
    { storeId: CAFE, sourceId: "src-cafe-merch", name: "Merchandise & Bags", type: "merchandise", isActive: true, createdAt: NOW },
    { storeId: CAFE, sourceId: "src-cafe-events", name: "Private Events", type: "private_events", isActive: true, createdAt: NOW },
  ];
  for (const rs of [...barRevenueSources, ...cafeRevenueSources]) {
    await put(T.REVENUE_SOURCES, rs);
  }
  console.log(`  → ${barRevenueSources.length} bar + ${cafeRevenueSources.length} cafe revenue sources`);

  // Seed some revenue entries for the past 30 days
  const revEntryBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
    const isFriSat = new Date(date).getDay() === 5 || new Date(date).getDay() === 6;

    // Bar revenue entries (more on weekends)
    if (isFriSat || rand(0, 2) > 0) {
      // Pool tables
      revEntryBatch.push({
        storeId: BAR, entryId: `rev-entry-bar-pool-d${day}`, sourceId: "src-bar-pool",
        date, amount: r2(rand(40, 120) + Math.random() * 20),
        notes: `${rand(4, 12)} games played`, createdAt: `${date}T23:00:00Z`,
      });
      // Cover charge on Fri/Sat
      if (isFriSat) {
        revEntryBatch.push({
          storeId: BAR, entryId: `rev-entry-bar-cover-d${day}`, sourceId: "src-bar-cover",
          date, amount: r2(rand(150, 400) + Math.random() * 50),
          notes: `${rand(20, 55)} covers at $${rand(5, 10)} each`, createdAt: `${date}T23:30:00Z`,
        });
        revEntryBatch.push({
          storeId: BAR, entryId: `rev-entry-bar-music-d${day}`, sourceId: "src-bar-music",
          date, amount: r2(rand(200, 600)),
          notes: "Live band performance", createdAt: `${date}T23:30:00Z`,
        });
      }
      // Trivia (Wednesdays)
      if (new Date(date).getDay() === 3) {
        revEntryBatch.push({
          storeId: BAR, entryId: `rev-entry-bar-trivia-d${day}`, sourceId: "src-bar-trivia",
          date, amount: r2(rand(50, 150)),
          notes: `${rand(6, 14)} teams`, createdAt: `${date}T22:00:00Z`,
        });
      }
    }

    // Cafe revenue entries
    if (rand(0, 4) > 0) {
      revEntryBatch.push({
        storeId: CAFE, entryId: `rev-entry-cafe-merch-d${day}`, sourceId: "src-cafe-merch",
        date, amount: r2(rand(15, 80) + Math.random() * 10),
        notes: "Coffee bags, mugs, t-shirts", createdAt: `${date}T17:00:00Z`,
      });
    }
    if (isWeekend && rand(0, 2) === 0) {
      revEntryBatch.push({
        storeId: CAFE, entryId: `rev-entry-cafe-catering-d${day}`, sourceId: "src-cafe-catering",
        date, amount: r2(rand(200, 800)),
        notes: "Catering order", createdAt: `${date}T12:00:00Z`,
      });
    }
  }
  await batchWrite(T.REVENUE_ENTRIES, revEntryBatch);
  console.log(`  → ${revEntryBatch.length} revenue entries (30 days)`);

  // ── SUMMARY ──
  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE — Bar & Cafe Demo Data");
  console.log("═══════════════════════════════════════");
  console.log(`  Bar: "The Copper Rail" (store-003) — operatorType: bar`);
  console.log(`    Inventory:    ${barInvList.length} items (spirits, beer, wine, mixers, food)`);
  console.log(`    Recipes:      ${BAR_RECIPES.length} (cocktails, draft, bottled, wine, bar food)`);
  console.log(`    Suppliers:    ${BAR_SUPPLIERS.length} (spirits dist, beer dist, bar supply)`);
  console.log(`    Staff:        ${BAR_STAFF.length} (manager, 2 bartenders, barback, door staff)`);
  console.log(`    Transactions: ${barTxns.length} (30 days, evening-heavy, Fri/Sat peaks)`);
  console.log(`    Waste:        ${barWaste.length} logs ($${r2(barWaste.reduce((s, w) => s + w.totalCost, 0))})`);
  console.log("");
  console.log(`  Cafe: "Maple Street Coffee" (store-004) — operatorType: cafe`);
  console.log(`    Inventory:    ${cafeInvList.length} items (coffee, milk, syrups, pastries, food)`);
  console.log(`    Recipes:      ${CAFE_RECIPES.length} (espresso, drip, tea, pastries, sandwiches)`);
  console.log(`    Suppliers:    ${CAFE_SUPPLIERS.length} (coffee roaster, dairy/grocery, bakehouse)`);
  console.log(`    Staff:        ${CAFE_STAFF.length} (manager, 2 baristas, shift lead)`);
  console.log(`    Transactions: ${cafeTxns.length} (30 days, morning-heavy, weekday peaks)`);
  console.log(`    Waste:        ${cafeWaste.length} logs ($${r2(cafeWaste.reduce((s, w) => s + w.totalCost, 0))})`);
  console.log("");
  console.log(`  Owner: matt@foodwise.io now has 4 stores:`);
  console.log(`    1. Subway - Downtown Austin (QSR)`);
  console.log(`    2. Subway - Lakeline Mall (QSR)`);
  console.log(`    3. The Copper Rail (Bar)`);
  console.log(`    4. Maple Street Coffee (Cafe)`);
  console.log("═══════════════════════════════════════\n");
}

seed().catch(console.error);
