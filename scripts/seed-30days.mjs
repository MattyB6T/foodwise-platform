import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: fromIni({ profile: "foodwise" }),
});
const doc = DynamoDBDocumentClient.from(client);

const P = "FoodwiseStack-CoreStackNestedStackCoreStackNestedStackResource06DFB247-ME86T0DHUM3I";
const T = {
  STORES: `${P}-StoresTableE2108BD4-EK9NVR11MBRF`,
  INVENTORY: `${P}-InventoryTableFD135387-VIU7DCR1LFX1`,
  TRANSACTIONS: `${P}-TransactionsTable0A011FCB-98K5KU5NV0EH`,
  RECIPES: `${P}-RecipesTable058A1F33-K5YZ74IQTK02`,
  SUPPLIERS: `${P}-SuppliersTableF9BC2E6D-1273XLCCW4GPY`,
  PURCHASE_ORDERS: `${P}-PurchaseOrdersTable491A23F2-6BM6GNY3UWTE`,
  WASTE_LOGS: `${P}-WasteLogsTable99DF3E91-EWPGQTOKSEP1`,
  STAFF: `${P}-StaffTable11B9C6C0-8K6Q6SA5SSY8`,
  SCHEDULES: `${P}-SchedulesTableFBEB0188-1GOWBUDVKHLFZ`,
  TIME_CLOCK: `${P}-TimeClockTable3A097BD6-1T3JECZRQNBFW`,
  CAMERAS: `${P}-CamerasTable183C7F3A-5RF2XYCU9L25`,
  TEMP_LOGS: `${P}-TempLogsTable8E4B3D0B-1B9H6NPTB1A4O`,
  FORECASTS: `${P}-ForecastsTable40A833D2-N0WBS9RRLSID`,
  INCIDENTS: `${P}-IncidentsTable307EBBA6-1MPTP9ZRCS4LD`,
  PREP_LISTS: `${P}-PrepListsTable449FCF89-FKHXRE44KL24`,
  AUDIT_TRAIL: `${P}-AuditTrailTable4CEE68C7-1HROZ6Y00ZMFF`,
  RECEIVING_LOGS: `${P}-ReceivingLogsTable3AC8C0B1-1F70MJDRT0QBN`,
  PRICE_HISTORY: `${P}-PriceHistoryTable5AD3E5A9-UMN2PN0ITSMI`,
  NOTIFICATIONS: `${P}-NotificationsTable76DCFC6C-1VIBTP9OJE5J6`,
  INVENTORY_COUNTS: `${P}-InventoryCountsTable27D2854D-14YKODS08NQ4V`,
  KIOSK_DEVICES: `${P}-KioskDevicesTable4E61EA47-1D1LG2WRQI45I`,
};

async function put(table, item) {
  await doc.send(new PutCommand({ TableName: table, Item: item }));
}

async function batchWrite(table, items) {
  // DynamoDB batch write max 25 items
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25).map((item) => ({
      PutRequest: { Item: item },
    }));
    await doc.send(new BatchWriteCommand({ RequestItems: { [table]: batch } }));
  }
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const NOW = new Date().toISOString();
const TODAY = daysAgo(0);

async function seed() {
  console.log("=== Seeding Stores ===");
  await put(T.STORES, {
    storeId: "store-001", name: "Downtown Bistro", address: "123 Main St, Austin TX 78701",
    phone: "512-555-0100", type: "restaurant", owner: "matt@foodwise.io",
    createdAt: NOW, healthScore: 82, monthlyBudget: 45000,
  });
  await put(T.STORES, {
    storeId: "store-002", name: "Lakeside Cafe", address: "456 Lake Dr, Austin TX 78702",
    phone: "512-555-0200", type: "cafe", owner: "matt@foodwise.io",
    createdAt: NOW, healthScore: 91, monthlyBudget: 28000,
  });

  console.log("=== Seeding Inventory ===");
  const invItems = [
    { storeId: "store-001", itemId: "inv-001", name: "Chicken Breast", category: "Protein", quantity: 45, unit: "lb", costPerUnit: 4.50, lowStockThreshold: 15, expirationDate: daysAgo(-2) },
    { storeId: "store-001", itemId: "inv-002", name: "Atlantic Salmon", category: "Protein", quantity: 22, unit: "lb", costPerUnit: 12.00, lowStockThreshold: 10, expirationDate: daysAgo(-3) },
    { storeId: "store-001", itemId: "inv-003", name: "Roma Tomatoes", category: "Produce", quantity: 60, unit: "lb", costPerUnit: 2.25, lowStockThreshold: 20, expirationDate: daysAgo(-4) },
    { storeId: "store-001", itemId: "inv-004", name: "Mixed Greens", category: "Produce", quantity: 18, unit: "lb", costPerUnit: 3.50, lowStockThreshold: 12, expirationDate: daysAgo(-1) },
    { storeId: "store-001", itemId: "inv-005", name: "Olive Oil", category: "Pantry", quantity: 8, unit: "gal", costPerUnit: 18.00, lowStockThreshold: 3 },
    { storeId: "store-001", itemId: "inv-006", name: "Mozzarella", category: "Dairy", quantity: 15, unit: "lb", costPerUnit: 6.00, lowStockThreshold: 6, expirationDate: daysAgo(-5) },
    { storeId: "store-001", itemId: "inv-007", name: "Flour (AP)", category: "Pantry", quantity: 50, unit: "lb", costPerUnit: 0.80, lowStockThreshold: 20 },
    { storeId: "store-001", itemId: "inv-008", name: "Heavy Cream", category: "Dairy", quantity: 6, unit: "qt", costPerUnit: 4.00, lowStockThreshold: 4, expirationDate: daysAgo(-2) },
    { storeId: "store-002", itemId: "inv-101", name: "Espresso Beans", category: "Beverage", quantity: 30, unit: "lb", costPerUnit: 14.00, lowStockThreshold: 10 },
    { storeId: "store-002", itemId: "inv-102", name: "Whole Milk", category: "Dairy", quantity: 12, unit: "gal", costPerUnit: 4.50, lowStockThreshold: 5, expirationDate: daysAgo(-3) },
    { storeId: "store-002", itemId: "inv-103", name: "Croissants", category: "Bakery", quantity: 24, unit: "ea", costPerUnit: 1.75, lowStockThreshold: 15, expirationDate: daysAgo(-1) },
    { storeId: "store-002", itemId: "inv-104", name: "Avocado", category: "Produce", quantity: 40, unit: "ea", costPerUnit: 1.50, lowStockThreshold: 15, expirationDate: daysAgo(-2) },
  ];
  for (const item of invItems) {
    await put(T.INVENTORY, { ...item, updatedAt: NOW });
  }

  console.log("=== Seeding Recipes ===");
  await put(T.RECIPES, {
    recipeId: "recipe-001", name: "Grilled Chicken Caesar", category: "Entree", servings: 1,
    prepTime: 15, cookTime: 12, menuPrice: 16.95,
    ingredients: [
      { itemId: "inv-001", name: "Chicken Breast", quantity: 0.5, unit: "lb" },
      { itemId: "inv-004", name: "Mixed Greens", quantity: 0.25, unit: "lb" },
      { itemId: "inv-006", name: "Mozzarella", quantity: 0.125, unit: "lb" },
    ],
    foodCost: 4.00, foodCostPct: 23.6, createdAt: NOW,
  });
  await put(T.RECIPES, {
    recipeId: "recipe-002", name: "Margherita Pizza", category: "Entree", servings: 1,
    prepTime: 20, cookTime: 10, menuPrice: 14.50,
    ingredients: [
      { itemId: "inv-007", name: "Flour (AP)", quantity: 0.5, unit: "lb" },
      { itemId: "inv-003", name: "Roma Tomatoes", quantity: 0.375, unit: "lb" },
      { itemId: "inv-006", name: "Mozzarella", quantity: 0.25, unit: "lb" },
      { itemId: "inv-005", name: "Olive Oil", quantity: 0.02, unit: "gal" },
    ],
    foodCost: 3.35, foodCostPct: 23.1, createdAt: NOW,
  });
  await put(T.RECIPES, {
    recipeId: "recipe-003", name: "Salmon Bowl", category: "Entree", servings: 1,
    prepTime: 10, cookTime: 8, menuPrice: 19.95,
    ingredients: [
      { itemId: "inv-002", name: "Atlantic Salmon", quantity: 0.375, unit: "lb" },
      { itemId: "inv-004", name: "Mixed Greens", quantity: 0.2, unit: "lb" },
      { itemId: "inv-003", name: "Roma Tomatoes", quantity: 0.125, unit: "lb" },
    ],
    foodCost: 5.50, foodCostPct: 27.6, createdAt: NOW,
  });

  console.log("=== Seeding 30 days of Transactions ===");
  const menuItems = [
    { recipeId: "recipe-001", recipeName: "Grilled Chicken Caesar", price: 16.95, foodCost: 4.00,
      deductions: [{ itemId: "inv-001", itemName: "Chicken Breast", qty: 0.5, unit: "lb", costPerUnit: 4.50 },
                   { itemId: "inv-004", itemName: "Mixed Greens", qty: 0.25, unit: "lb", costPerUnit: 3.50 },
                   { itemId: "inv-006", itemName: "Mozzarella", qty: 0.125, unit: "lb", costPerUnit: 6.00 }] },
    { recipeId: "recipe-002", recipeName: "Margherita Pizza", price: 14.50, foodCost: 3.35,
      deductions: [{ itemId: "inv-007", itemName: "Flour (AP)", qty: 0.5, unit: "lb", costPerUnit: 0.80 },
                   { itemId: "inv-003", itemName: "Roma Tomatoes", qty: 0.375, unit: "lb", costPerUnit: 2.25 },
                   { itemId: "inv-006", itemName: "Mozzarella", qty: 0.25, unit: "lb", costPerUnit: 6.00 }] },
    { recipeId: "recipe-003", recipeName: "Salmon Bowl", price: 19.95, foodCost: 5.50,
      deductions: [{ itemId: "inv-002", itemName: "Atlantic Salmon", qty: 0.375, unit: "lb", costPerUnit: 12.00 },
                   { itemId: "inv-004", itemName: "Mixed Greens", qty: 0.2, unit: "lb", costPerUnit: 3.50 }] },
    { recipeId: "recipe-004", recipeName: "House Salad", price: 9.95, foodCost: 2.00,
      deductions: [{ itemId: "inv-004", itemName: "Mixed Greens", qty: 0.3, unit: "lb", costPerUnit: 3.50 },
                   { itemId: "inv-003", itemName: "Roma Tomatoes", qty: 0.2, unit: "lb", costPerUnit: 2.25 }] },
    { recipeId: "recipe-005", recipeName: "Bruschetta", price: 11.50, foodCost: 2.80,
      deductions: [{ itemId: "inv-007", itemName: "Flour (AP)", qty: 0.25, unit: "lb", costPerUnit: 0.80 },
                   { itemId: "inv-003", itemName: "Roma Tomatoes", qty: 0.3, unit: "lb", costPerUnit: 2.25 }] },
  ];
  const cafeItems = [
    { recipeId: "recipe-101", recipeName: "Latte", price: 5.50, foodCost: 1.20,
      deductions: [{ itemId: "inv-101", itemName: "Espresso Beans", qty: 0.04, unit: "lb", costPerUnit: 14.00 },
                   { itemId: "inv-102", itemName: "Whole Milk", qty: 0.06, unit: "gal", costPerUnit: 4.50 }] },
    { recipeId: "recipe-102", recipeName: "Cappuccino", price: 5.00, foodCost: 1.10,
      deductions: [{ itemId: "inv-101", itemName: "Espresso Beans", qty: 0.04, unit: "lb", costPerUnit: 14.00 },
                   { itemId: "inv-102", itemName: "Whole Milk", qty: 0.04, unit: "gal", costPerUnit: 4.50 }] },
    { recipeId: "recipe-103", recipeName: "Avocado Toast", price: 12.00, foodCost: 3.00,
      deductions: [{ itemId: "inv-104", itemName: "Avocado", qty: 1, unit: "ea", costPerUnit: 1.50 },
                   { itemId: "inv-103", itemName: "Croissants", qty: 1, unit: "ea", costPerUnit: 1.75 }] },
    { recipeId: "recipe-104", recipeName: "Croissant", price: 3.50, foodCost: 1.75,
      deductions: [{ itemId: "inv-103", itemName: "Croissants", qty: 1, unit: "ea", costPerUnit: 1.75 }] },
    { recipeId: "recipe-105", recipeName: "Cold Brew", price: 4.50, foodCost: 0.80,
      deductions: [{ itemId: "inv-101", itemName: "Espresso Beans", qty: 0.05, unit: "lb", costPerUnit: 14.00 }] },
  ];
  const payments = ["card", "cash", "card", "card", "mobile"];

  let txnCount = 0;
  const txnBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
    const store1Txns = isWeekend ? rand(18, 28) : rand(12, 22);
    const store2Txns = isWeekend ? rand(25, 40) : rand(15, 30);

    for (let t = 0; t < store1Txns; t++) {
      const item = menuItems[rand(0, menuItems.length - 1)];
      const qty = rand(1, 3);
      const totalAmount = round2(item.price * qty);
      const foodCost = round2(item.foodCost * qty);
      const ts = `${date}T${String(rand(9, 21)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`;
      txnBatch.push({
        storeId: "store-001", transactionId: `txn-s1-d${day}-${t}`,
        timestamp: ts, createdAt: ts,
        lineItems: [{ recipeId: item.recipeId, recipeName: item.recipeName, quantity: qty, price: item.price }],
        totalAmount, foodCost, foodCostPercentage: round2((foodCost / totalAmount) * 100),
        ingredientDeductions: item.deductions.map(d => ({
          itemId: d.itemId, itemName: d.itemName, quantityDeducted: round2(d.qty * qty),
          unit: d.unit, costPerUnit: d.costPerUnit, totalCost: round2(d.qty * qty * d.costPerUnit),
        })),
      });
      txnCount++;
    }

    for (let t = 0; t < store2Txns; t++) {
      const item = cafeItems[rand(0, cafeItems.length - 1)];
      const qty = rand(1, 4);
      const totalAmount = round2(item.price * qty);
      const foodCost = round2(item.foodCost * qty);
      const ts = `${date}T${String(rand(6, 18)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`;
      txnBatch.push({
        storeId: "store-002", transactionId: `txn-s2-d${day}-${t}`,
        timestamp: ts, createdAt: ts,
        lineItems: [{ recipeId: item.recipeId, recipeName: item.recipeName, quantity: qty, price: item.price }],
        totalAmount, foodCost, foodCostPercentage: round2((foodCost / totalAmount) * 100),
        ingredientDeductions: item.deductions.map(d => ({
          itemId: d.itemId, itemName: d.itemName, quantityDeducted: round2(d.qty * qty),
          unit: d.unit, costPerUnit: d.costPerUnit, totalCost: round2(d.qty * qty * d.costPerUnit),
        })),
      });
      txnCount++;
    }
  }
  await batchWrite(T.TRANSACTIONS, txnBatch);
  console.log(`  → ${txnCount} transactions seeded`);

  console.log("=== Seeding 30 days of Waste Logs ===");
  const wasteReasons = ["expired", "spoiled", "overproduction", "damaged", "contaminated"];
  const wasteItems = [
    { ingredientId: "inv-004", ingredientName: "Mixed Greens", unit: "lb", costPerUnit: 3.50 },
    { ingredientId: "inv-008", ingredientName: "Heavy Cream", unit: "qt", costPerUnit: 4.00 },
    { ingredientId: "inv-001", ingredientName: "Chicken Breast", unit: "lb", costPerUnit: 4.50 },
    { ingredientId: "inv-003", ingredientName: "Roma Tomatoes", unit: "lb", costPerUnit: 2.25 },
    { ingredientId: "inv-103", ingredientName: "Croissants", unit: "ea", costPerUnit: 1.75 },
    { ingredientId: "inv-102", ingredientName: "Whole Milk", unit: "gal", costPerUnit: 4.50 },
  ];
  const wasteBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const numWaste = rand(1, 4);
    for (let w = 0; w < numWaste; w++) {
      const item = wasteItems[rand(0, wasteItems.length - 1)];
      const qty = rand(1, 5);
      const storeId = rand(0, 1) === 0 ? "store-001" : "store-002";
      const ts = `${date}T${String(rand(10, 20)).padStart(2, "0")}:00:00Z`;
      wasteBatch.push({
        storeId, wasteId: `waste-d${day}-${w}`,
        ingredientId: item.ingredientId, ingredientName: item.ingredientName,
        quantity: qty, unit: item.unit, costPerUnit: item.costPerUnit,
        totalCost: round2(item.costPerUnit * qty),
        reason: wasteReasons[rand(0, wasteReasons.length - 1)],
        notes: "", loggedBy: "matt@foodwise.io",
        timestamp: ts, createdAt: ts,
      });
    }
  }
  await batchWrite(T.WASTE_LOGS, wasteBatch);
  console.log(`  → ${wasteBatch.length} waste logs seeded`);

  console.log("=== Seeding Suppliers ===");
  await put(T.SUPPLIERS, { supplierId: "sup-001", name: "Sysco Foods", contactName: "Sarah Chen", email: "sarah@sysco.example.com", phone: "512-555-9000", categories: ["Protein", "Dairy", "Pantry"], rating: 4.5, createdAt: NOW });
  await put(T.SUPPLIERS, { supplierId: "sup-002", name: "Local Farms Co-op", contactName: "Jake Miller", email: "jake@localfarms.example.com", phone: "512-555-9100", categories: ["Produce"], rating: 4.8, createdAt: NOW });
  await put(T.SUPPLIERS, { supplierId: "sup-003", name: "Pacific Seafood", contactName: "Amy Wong", email: "amy@pacificseafood.example.com", phone: "512-555-9200", categories: ["Protein"], rating: 4.2, createdAt: NOW });

  console.log("=== Seeding Purchase Orders ===");
  await put(T.PURCHASE_ORDERS, {
    orderId: "po-001", storeId: "store-001", supplierId: "sup-001", supplierName: "Sysco Foods", status: "delivered",
    lines: [
      { itemName: "Chicken Breast", quantityOrdered: 50, quantityReceived: 50, unit: "lb", unitCost: 4.50 },
      { itemName: "Mozzarella", quantityOrdered: 20, quantityReceived: 18, unit: "lb", unitCost: 6.00 },
    ],
    totalCost: 345, expectedDeliveryDate: daysAgo(1), createdAt: NOW, updatedAt: NOW,
  });
  await put(T.PURCHASE_ORDERS, {
    orderId: "po-002", storeId: "store-001", supplierId: "sup-002", supplierName: "Local Farms Co-op", status: "pending",
    lines: [
      { itemName: "Roma Tomatoes", quantityOrdered: 40, unit: "lb", unitCost: 2.25 },
      { itemName: "Mixed Greens", quantityOrdered: 25, unit: "lb", unitCost: 3.50 },
    ],
    totalCost: 177.50, expectedDeliveryDate: daysAgo(-1), createdAt: NOW, updatedAt: NOW,
  });
  await put(T.PURCHASE_ORDERS, {
    orderId: "po-003", storeId: "store-002", supplierId: "sup-001", supplierName: "Sysco Foods", status: "delivered",
    lines: [
      { itemName: "Whole Milk", quantityOrdered: 15, quantityReceived: 15, unit: "gal", unitCost: 4.50 },
      { itemName: "Espresso Beans", quantityOrdered: 20, quantityReceived: 20, unit: "lb", unitCost: 14.00 },
    ],
    totalCost: 347.50, expectedDeliveryDate: daysAgo(3), createdAt: NOW, updatedAt: NOW,
  });

  console.log("=== Seeding Staff ===");
  const staffMembers = [
    { storeId: "store-001", staffId: "staff-001", name: "Maria Garcia", email: "maria@foodwise.io", role: "manager", pin: "1234", hourlyRate: 22, active: true },
    { storeId: "store-001", staffId: "staff-002", name: "James Wilson", email: "james@foodwise.io", role: "cook", pin: "5678", hourlyRate: 18, active: true },
    { storeId: "store-001", staffId: "staff-003", name: "Sarah Kim", email: "sarah@foodwise.io", role: "server", pin: "9012", hourlyRate: 15, active: true },
    { storeId: "store-002", staffId: "staff-004", name: "Alex Rivera", email: "alex@foodwise.io", role: "barista", pin: "3456", hourlyRate: 16, active: true },
    { storeId: "store-002", staffId: "staff-005", name: "Emma Davis", email: "emma@foodwise.io", role: "manager", pin: "7890", hourlyRate: 21, active: true },
  ];
  for (const s of staffMembers) await put(T.STAFF, { ...s, createdAt: NOW, updatedAt: NOW });

  console.log("=== Seeding Schedules (30 days + 7 forward) ===");
  const schedBatch = [];
  for (let day = 29; day >= -7; day--) {
    const date = daysAgo(day);
    for (const s of staffMembers) {
      if (rand(0, 6) === 0) continue; // ~14% days off
      schedBatch.push({
        shiftId: `shift-${s.staffId}-d${day}`, storeId: s.storeId, staffId: s.staffId,
        staffName: s.name, date, startTime: s.role === "manager" ? "08:00" : "10:00",
        endTime: s.role === "manager" ? "16:00" : "18:00", position: s.role,
      });
    }
  }
  await batchWrite(T.SCHEDULES, schedBatch);

  console.log("=== Seeding Time Clock (30 days) ===");
  const clockBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const s of staffMembers) {
      if (rand(0, 6) === 0) continue; // skip ~14% (days off)
      const clockInH = s.role === "manager" ? rand(7, 9) : rand(9, 11);
      const hours = round2(rand(6, 9) + Math.random());
      const clockInTime = `${date}T${String(clockInH).padStart(2, "0")}:${String(rand(0, 15)).padStart(2, "0")}:00Z`;
      const clockOutTime = `${date}T${String(clockInH + Math.floor(hours)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`;
      clockBatch.push({
        storeId: s.storeId, entryId: `clock-${s.staffId}-d${day}`, staffId: s.staffId,
        staffName: s.name, clockInTime, clockOutTime,
        totalHours: hours, status: "completed", date, approved: day > 0,
      });
    }
  }
  await batchWrite(T.TIME_CLOCK, clockBatch);
  console.log(`  → ${clockBatch.length} time entries seeded`);

  console.log("=== Seeding Cameras ===");
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-001", name: "Kitchen Main", location: "prep-area", wyzeDeviceId: "WD-S1-01", wyzeDeviceMac: "AA:BB:CC:01:01:01", streamUrl: "rtsp://10.0.1.10/stream1", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-002", name: "Walk-in Cooler", location: "storage", wyzeDeviceId: "WD-S1-02", wyzeDeviceMac: "AA:BB:CC:01:01:02", streamUrl: "rtsp://10.0.1.11/stream1", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-003", name: "Back Door", location: "entrance", wyzeDeviceId: "WD-S1-03", wyzeDeviceMac: "AA:BB:CC:01:01:03", streamUrl: "rtsp://10.0.1.12/stream1", isOnline: true, createdAt: NOW, updatedAt: NOW });
  await put(T.CAMERAS, { storeId: "store-002", cameraId: "cam-004", name: "Counter", location: "register", wyzeDeviceId: "WD-S2-01", wyzeDeviceMac: "AA:BB:CC:02:01:01", streamUrl: "rtsp://10.0.2.10/stream1", isOnline: true, createdAt: NOW, updatedAt: NOW });

  console.log("=== Seeding Temp Logs (30 days) ===");
  const tempBatch = [];
  const tempLocations = [
    { loc: "Walk-in Cooler", min: 35, max: 42, store: "store-001" },
    { loc: "Freezer", min: -5, max: 2, store: "store-001" },
    { loc: "Prep Station", min: 65, max: 72, store: "store-001" },
    { loc: "Display Case", min: 36, max: 44, store: "store-002" },
  ];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const tl of tempLocations) {
      for (const hour of [8, 12, 16]) {
        const temp = rand(tl.min, tl.max);
        const inRange = tl.loc.includes("Cooler") ? temp <= 40 : tl.loc === "Freezer" ? temp <= 0 : true;
        const ts = `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
        tempBatch.push({
          storeId: tl.store, logId: `temp-${tl.store}-${tl.loc.replace(/\s/g, "")}-d${day}-h${hour}`,
          location: tl.loc, temperature: temp, unit: "F", inRange,
          rangeNote: inRange ? "" : `Temperature ${temp}F out of range`,
          recordedBy: "System", timestamp: ts, createdAt: ts,
        });
      }
    }
  }
  await batchWrite(T.TEMP_LOGS, tempBatch);
  console.log(`  → ${tempBatch.length} temp logs seeded`);

  console.log("=== Seeding Forecasts ===");
  for (let day = 0; day < 7; day++) {
    const fDate = daysAgo(-day);
    const predictedRevenue = round2(rand(800, 1500) + Math.random() * 100);
    await put(T.FORECASTS, {
      forecastId: `fc-${fDate}`, storeRecipeKey: `store-001#${fDate}`, storeId: "store-001", forecastDate: fDate,
      type: "demand", predictedRevenue, predictedValue: predictedRevenue,
      predictions: [
        { itemId: "inv-001", name: "Chicken Breast", predictedUsage: rand(8, 15), unit: "lb", confidence: round2(0.78 + Math.random() * 0.17) },
        { itemId: "inv-002", name: "Atlantic Salmon", predictedUsage: rand(5, 10), unit: "lb", confidence: round2(0.75 + Math.random() * 0.15) },
        { itemId: "inv-003", name: "Roma Tomatoes", predictedUsage: rand(10, 20), unit: "lb", confidence: round2(0.82 + Math.random() * 0.13) },
      ],
      createdAt: NOW,
    });
  }

  console.log("=== Seeding Incidents ===");
  await put(T.INCIDENTS, {
    storeId: "store-001", incidentId: "inc-001", cameraId: "cam-002",
    type: "safety", status: "resolved",
    title: "Walk-in cooler temperature rose above 40F",
    notes: "Temperature spiked for 15 minutes. Door was left open during delivery. Resolved within 30 minutes.",
    timestamp: `${daysAgo(1)}T22:15:00Z`,
    footageStartTime: `${daysAgo(1)}T22:13:00Z`, footageEndTime: `${daysAgo(1)}T22:17:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(1)}T22:20:00Z`, updatedAt: `${daysAgo(1)}T22:45:00Z`,
  });
  await put(T.INCIDENTS, {
    storeId: "store-001", incidentId: "inc-002", cameraId: "cam-003",
    type: "theft", status: "investigating",
    title: "Back door opened outside business hours",
    notes: "Motion detected at back door at 2:30 AM. Reviewing camera footage. No inventory loss confirmed yet.",
    timestamp: `${daysAgo(3)}T02:30:00Z`,
    footageStartTime: `${daysAgo(3)}T02:28:00Z`, footageEndTime: `${daysAgo(3)}T02:32:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(3)}T08:00:00Z`, updatedAt: `${daysAgo(3)}T08:00:00Z`,
  });
  await put(T.INCIDENTS, {
    storeId: "store-002", incidentId: "inc-003", cameraId: "cam-004",
    wasteId: "waste-d5-0",
    type: "waste-verification", status: "resolved",
    title: "Unusual waste amount flagged at counter",
    notes: "Large quantity of croissants discarded. Manager verified — past expiration date. Process normal.",
    timestamp: `${daysAgo(5)}T14:20:00Z`,
    footageStartTime: `${daysAgo(5)}T14:18:00Z`, footageEndTime: `${daysAgo(5)}T14:22:00Z`,
    createdBy: "matt@foodwise.io", createdAt: `${daysAgo(5)}T14:25:00Z`, updatedAt: `${daysAgo(5)}T14:45:00Z`,
  });

  console.log("=== Seeding Prep Lists ===");
  await put(T.PREP_LISTS, {
    storeId: "store-001", prepListId: "prep-001", date: TODAY,
    items: [
      { name: "Dice tomatoes", quantity: "10 lb", assignedTo: "James Wilson", completed: true },
      { name: "Grill chicken", quantity: "15 lb", assignedTo: "James Wilson", completed: false },
      { name: "Make Caesar dressing", quantity: "2 qt", assignedTo: "Sarah Kim", completed: false },
      { name: "Prep pizza dough", quantity: "20 balls", assignedTo: "James Wilson", completed: true },
    ],
    createdAt: NOW,
  });

  console.log("=== Seeding Receiving Logs ===");
  await put(T.RECEIVING_LOGS, {
    receivingId: "recv-001", storeId: "store-001", orderId: "po-001", supplierId: "sup-001", supplierName: "Sysco Foods",
    receivedBy: "Maria Garcia",
    itemsScanned: [
      { itemId: "inv-001", itemName: "Chicken Breast", quantity: 50, unit: "lb", unitCost: 4.50, barcode: "0001", timestamp: `${daysAgo(1)}T09:00:00Z` },
      { itemId: "inv-006", itemName: "Mozzarella", quantity: 18, unit: "lb", unitCost: 6.00, barcode: "0006", timestamp: `${daysAgo(1)}T09:05:00Z` },
    ],
    discrepancies: [
      { itemId: "inv-006", itemName: "Mozzarella", expected: 20, received: 18, unit: "lb", note: "2 lb short" },
    ],
    totalItemsReceived: 68,
    createdAt: `${daysAgo(1)}T09:00:00Z`,
  });

  console.log("=== Seeding Price History ===");
  for (let day = 29; day >= 0; day -= 7) {
    const date = daysAgo(day);
    await put(T.PRICE_HISTORY, { priceId: `ph-chicken-${day}`, supplierId: "sup-001", supplierName: "Sysco Foods", itemName: "Chicken Breast", price: round2(4.25 + Math.random() * 0.5), unit: "lb", timestamp: date });
    await put(T.PRICE_HISTORY, { priceId: `ph-salmon-${day}`, supplierId: "sup-003", supplierName: "Pacific Seafood", itemName: "Atlantic Salmon", price: round2(11.50 + Math.random() * 1.0), unit: "lb", timestamp: date });
    await put(T.PRICE_HISTORY, { priceId: `ph-tomato-${day}`, supplierId: "sup-002", supplierName: "Local Farms Co-op", itemName: "Roma Tomatoes", price: round2(2.00 + Math.random() * 0.5), unit: "lb", timestamp: date });
  }

  console.log("=== Seeding Audit Trail ===");
  await put(T.AUDIT_TRAIL, { auditId: "audit-001", storeId: "store-001", action: "inventory-received", resourceType: "purchase-order", resourceId: "po-001", timestamp: `${daysAgo(1)}T09:00:00Z`, performedBy: "matt@foodwise.io", details: { supplier: "Sysco Foods", total: 345 } });
  await put(T.AUDIT_TRAIL, { auditId: "audit-002", storeId: "store-001", action: "waste-logged", resourceType: "waste-log", resourceId: "waste-d0-0", timestamp: `${TODAY}T14:00:00Z`, performedBy: "matt@foodwise.io", details: { item: "Mixed Greens", quantity: 3 } });

  console.log("=== Seeding Notifications ===");
  await put(T.NOTIFICATIONS, { userId: "matt@foodwise.io", notificationId: "notif-001", type: "low-stock", title: "Low Stock Alert", message: "Heavy Cream at Downtown Bistro is below reorder point (6 qt remaining, par: 8)", storeId: "store-001", read: false, timestamp: NOW });
  await put(T.NOTIFICATIONS, { userId: "matt@foodwise.io", notificationId: "notif-002", type: "order-delivered", title: "Order Delivered", message: "Sysco Foods delivery received at Downtown Bistro - PO #po-001", storeId: "store-001", read: true, timestamp: `${daysAgo(1)}T09:05:00Z` });
  await put(T.NOTIFICATIONS, { userId: "matt@foodwise.io", notificationId: "notif-003", type: "expiration-warning", title: "Expiration Warning", message: "3 items expiring within 48 hours at Downtown Bistro", storeId: "store-001", read: false, timestamp: NOW });

  console.log("=== Seeding Inventory Counts ===");
  await put(T.INVENTORY_COUNTS, {
    storeId: "store-001", countId: "count-001", date: daysAgo(1), countedBy: "Maria Garcia", status: "completed",
    items: [
      { itemId: "inv-001", name: "Chicken Breast", expected: 48, actual: 45, variance: -3, unit: "lb" },
      { itemId: "inv-003", name: "Roma Tomatoes", expected: 62, actual: 60, variance: -2, unit: "lb" },
      { itemId: "inv-006", name: "Mozzarella", expected: 16, actual: 15, variance: -1, unit: "lb" },
    ],
    totalVariance: -6, completedAt: `${daysAgo(1)}T20:00:00Z`,
  });

  console.log("\n=== SEED COMPLETE ===");
  console.log(`Stores: 2`);
  console.log(`Inventory items: ${invItems.length}`);
  console.log(`Recipes: 3`);
  console.log(`Transactions: ${txnCount} (30 days)`);
  console.log(`Waste logs: ${wasteBatch.length} (30 days)`);
  console.log(`Suppliers: 3`);
  console.log(`Purchase orders: 3`);
  console.log(`Staff: ${staffMembers.length}`);
  console.log(`Schedules: ${schedBatch.length} (30 days + 7 forward)`);
  console.log(`Time clock: ${clockBatch.length} (30 days)`);
  console.log(`Cameras: 4`);
  console.log(`Temp logs: ${tempBatch.length} (30 days)`);
  console.log(`Forecasts: 7 (7 days)`);
  console.log(`Incidents: 3`);
  console.log(`Prep lists: 1`);
  console.log(`Receiving logs: 1`);
  console.log(`Price history: 15 (weekly)`);
  console.log(`Notifications: 3`);
  console.log(`Audit trail: 2`);
  console.log(`Inventory counts: 1`);
}

seed().catch(console.error);
