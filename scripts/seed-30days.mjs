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
    { storeId: "store-001", itemId: "inv-001", name: "Chicken Breast", category: "Protein", quantity: 45, unit: "lb", unitCost: 4.50, parLevel: 30, reorderPoint: 15, expirationDate: daysAgo(-2) },
    { storeId: "store-001", itemId: "inv-002", name: "Atlantic Salmon", category: "Protein", quantity: 22, unit: "lb", unitCost: 12.00, parLevel: 20, reorderPoint: 10, expirationDate: daysAgo(-3) },
    { storeId: "store-001", itemId: "inv-003", name: "Roma Tomatoes", category: "Produce", quantity: 60, unit: "lb", unitCost: 2.25, parLevel: 40, reorderPoint: 20, expirationDate: daysAgo(-4) },
    { storeId: "store-001", itemId: "inv-004", name: "Mixed Greens", category: "Produce", quantity: 18, unit: "lb", unitCost: 3.50, parLevel: 25, reorderPoint: 12, expirationDate: daysAgo(-1) },
    { storeId: "store-001", itemId: "inv-005", name: "Olive Oil", category: "Pantry", quantity: 8, unit: "gal", unitCost: 18.00, parLevel: 5, reorderPoint: 3 },
    { storeId: "store-001", itemId: "inv-006", name: "Mozzarella", category: "Dairy", quantity: 15, unit: "lb", unitCost: 6.00, parLevel: 12, reorderPoint: 6, expirationDate: daysAgo(-5) },
    { storeId: "store-001", itemId: "inv-007", name: "Flour (AP)", category: "Pantry", quantity: 50, unit: "lb", unitCost: 0.80, parLevel: 40, reorderPoint: 20 },
    { storeId: "store-001", itemId: "inv-008", name: "Heavy Cream", category: "Dairy", quantity: 6, unit: "qt", unitCost: 4.00, parLevel: 8, reorderPoint: 4, expirationDate: daysAgo(-2) },
    { storeId: "store-002", itemId: "inv-101", name: "Espresso Beans", category: "Beverage", quantity: 30, unit: "lb", unitCost: 14.00, parLevel: 20, reorderPoint: 10 },
    { storeId: "store-002", itemId: "inv-102", name: "Whole Milk", category: "Dairy", quantity: 12, unit: "gal", unitCost: 4.50, parLevel: 10, reorderPoint: 5, expirationDate: daysAgo(-3) },
    { storeId: "store-002", itemId: "inv-103", name: "Croissants", category: "Bakery", quantity: 24, unit: "ea", unitCost: 1.75, parLevel: 30, reorderPoint: 15, expirationDate: daysAgo(-1) },
    { storeId: "store-002", itemId: "inv-104", name: "Avocado", category: "Produce", quantity: 40, unit: "ea", unitCost: 1.50, parLevel: 30, reorderPoint: 15, expirationDate: daysAgo(-2) },
  ];
  for (const item of invItems) {
    await put(T.INVENTORY, { ...item, lastUpdated: NOW });
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
    { name: "Grilled Chicken Caesar", price: 16.95 },
    { name: "Margherita Pizza", price: 14.50 },
    { name: "Salmon Bowl", price: 19.95 },
    { name: "House Salad", price: 9.95 },
    { name: "Bruschetta", price: 11.50 },
  ];
  const cafeItems = [
    { name: "Latte", price: 5.50 },
    { name: "Cappuccino", price: 5.00 },
    { name: "Avocado Toast", price: 12.00 },
    { name: "Croissant", price: 3.50 },
    { name: "Cold Brew", price: 4.50 },
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
      const subtotal = round2(item.price * qty);
      const tax = round2(subtotal * 0.0825);
      const total = round2(subtotal + tax);
      txnBatch.push({
        storeId: "store-001", transactionId: `txn-s1-d${day}-${t}`, type: "sale",
        timestamp: `${date}T${String(rand(9, 21)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`,
        total, tax, subtotal,
        lineItems: [{ name: item.name, quantity: qty, price: item.price }],
        paymentMethod: payments[rand(0, payments.length - 1)], source: "pos",
      });
      txnCount++;
    }

    for (let t = 0; t < store2Txns; t++) {
      const item = cafeItems[rand(0, cafeItems.length - 1)];
      const qty = rand(1, 4);
      const subtotal = round2(item.price * qty);
      const tax = round2(subtotal * 0.0825);
      const total = round2(subtotal + tax);
      txnBatch.push({
        storeId: "store-002", transactionId: `txn-s2-d${day}-${t}`, type: "sale",
        timestamp: `${date}T${String(rand(6, 18)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`,
        total, tax, subtotal,
        lineItems: [{ name: item.name, quantity: qty, price: item.price }],
        paymentMethod: payments[rand(0, payments.length - 1)], source: "pos",
      });
      txnCount++;
    }
  }
  await batchWrite(T.TRANSACTIONS, txnBatch);
  console.log(`  → ${txnCount} transactions seeded`);

  console.log("=== Seeding 30 days of Waste Logs ===");
  const wasteReasons = ["expired", "spoiled", "overproduction", "damaged", "contaminated"];
  const wasteItems = [
    { name: "Mixed Greens", unit: "lb", cost: 3.50 },
    { name: "Heavy Cream", unit: "qt", cost: 4.00 },
    { name: "Chicken Breast", unit: "lb", cost: 4.50 },
    { name: "Roma Tomatoes", unit: "lb", cost: 2.25 },
    { name: "Croissants", unit: "ea", cost: 1.75 },
    { name: "Whole Milk", unit: "gal", cost: 4.50 },
  ];
  const wasteBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    const numWaste = rand(1, 4);
    for (let w = 0; w < numWaste; w++) {
      const item = wasteItems[rand(0, wasteItems.length - 1)];
      const qty = rand(1, 5);
      const storeId = rand(0, 1) === 0 ? "store-001" : "store-002";
      wasteBatch.push({
        storeId, wasteId: `waste-d${day}-${w}`, itemName: item.name,
        quantity: qty, unit: item.unit, reason: wasteReasons[rand(0, wasteReasons.length - 1)],
        cost: round2(item.cost * qty), loggedBy: "matt@foodwise.io",
        timestamp: `${date}T${String(rand(10, 20)).padStart(2, "0")}:00:00Z`,
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
    items: [
      { name: "Chicken Breast", quantity: 50, unit: "lb", unitCost: 4.50, total: 225 },
      { name: "Mozzarella", quantity: 20, unit: "lb", unitCost: 6.00, total: 120 },
    ],
    total: 345, orderDate: daysAgo(2), deliveryDate: daysAgo(1), createdAt: NOW,
  });
  await put(T.PURCHASE_ORDERS, {
    orderId: "po-002", storeId: "store-001", supplierId: "sup-002", supplierName: "Local Farms Co-op", status: "pending",
    items: [
      { name: "Roma Tomatoes", quantity: 40, unit: "lb", unitCost: 2.25, total: 90 },
      { name: "Mixed Greens", quantity: 25, unit: "lb", unitCost: 3.50, total: 87.50 },
    ],
    total: 177.50, orderDate: TODAY, createdAt: NOW,
  });
  await put(T.PURCHASE_ORDERS, {
    orderId: "po-003", storeId: "store-002", supplierId: "sup-001", supplierName: "Sysco Foods", status: "delivered",
    items: [
      { name: "Whole Milk", quantity: 15, unit: "gal", unitCost: 4.50, total: 67.50 },
      { name: "Espresso Beans", quantity: 20, unit: "lb", unitCost: 14.00, total: 280 },
    ],
    total: 347.50, orderDate: daysAgo(5), deliveryDate: daysAgo(3), createdAt: NOW,
  });

  console.log("=== Seeding Staff ===");
  const staffMembers = [
    { storeId: "store-001", staffId: "staff-001", name: "Maria Garcia", email: "maria@foodwise.io", role: "manager", pin: "1234", hourlyRate: 22, status: "active" },
    { storeId: "store-001", staffId: "staff-002", name: "James Wilson", email: "james@foodwise.io", role: "cook", pin: "5678", hourlyRate: 18, status: "active" },
    { storeId: "store-001", staffId: "staff-003", name: "Sarah Kim", email: "sarah@foodwise.io", role: "server", pin: "9012", hourlyRate: 15, status: "active" },
    { storeId: "store-002", staffId: "staff-004", name: "Alex Rivera", email: "alex@foodwise.io", role: "barista", pin: "3456", hourlyRate: 16, status: "active" },
    { storeId: "store-002", staffId: "staff-005", name: "Emma Davis", email: "emma@foodwise.io", role: "manager", pin: "7890", hourlyRate: 21, status: "active" },
  ];
  for (const s of staffMembers) await put(T.STAFF, { ...s, createdAt: NOW });

  console.log("=== Seeding Schedules ===");
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(-day); // upcoming 7 days
    for (const s of staffMembers) {
      await put(T.SCHEDULES, {
        shiftId: `shift-${s.staffId}-d${day}`, storeId: s.storeId, staffId: s.staffId,
        staffName: s.name, date, startTime: s.role === "manager" ? "08:00" : "10:00",
        endTime: s.role === "manager" ? "16:00" : "18:00", role: s.role,
      });
    }
  }

  console.log("=== Seeding Time Clock (30 days) ===");
  const clockBatch = [];
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day);
    for (const s of staffMembers) {
      if (rand(0, 6) === 0) continue; // skip ~14% (days off)
      const clockInH = s.role === "manager" ? rand(7, 9) : rand(9, 11);
      const hours = round2(rand(6, 9) + Math.random());
      clockBatch.push({
        storeId: s.storeId, entryId: `clock-${s.staffId}-d${day}`, staffId: s.staffId,
        staffName: s.name, clockIn: `${date}T${String(clockInH).padStart(2, "0")}:${String(rand(0, 15)).padStart(2, "0")}:00Z`,
        clockOut: `${date}T${String(clockInH + Math.floor(hours)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}:00Z`,
        hoursWorked: hours, status: "completed", date, approved: day > 0,
      });
    }
  }
  await batchWrite(T.TIME_CLOCK, clockBatch);
  console.log(`  → ${clockBatch.length} time entries seeded`);

  console.log("=== Seeding Cameras ===");
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-001", name: "Kitchen Main", location: "kitchen", status: "online", streamUrl: "rtsp://10.0.1.10/stream1", createdAt: NOW });
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-002", name: "Walk-in Cooler", location: "storage", status: "online", streamUrl: "rtsp://10.0.1.11/stream1", createdAt: NOW });
  await put(T.CAMERAS, { storeId: "store-001", cameraId: "cam-003", name: "Back Door", location: "exterior", status: "online", streamUrl: "rtsp://10.0.1.12/stream1", createdAt: NOW });
  await put(T.CAMERAS, { storeId: "store-002", cameraId: "cam-004", name: "Counter", location: "front", status: "online", streamUrl: "rtsp://10.0.2.10/stream1", createdAt: NOW });

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
        const status = tl.loc.includes("Cooler") && temp > 40 ? "warning" : tl.loc === "Freezer" && temp > 0 ? "warning" : "normal";
        tempBatch.push({
          storeId: tl.store, logId: `temp-${tl.store}-${tl.loc.replace(/\s/g, "")}-d${day}-h${hour}`,
          location: tl.loc, temperature: temp, unit: "F", status,
          loggedBy: "System", timestamp: `${date}T${String(hour).padStart(2, "0")}:00:00Z`,
        });
      }
    }
  }
  await batchWrite(T.TEMP_LOGS, tempBatch);
  console.log(`  → ${tempBatch.length} temp logs seeded`);

  console.log("=== Seeding Forecasts ===");
  for (let day = 0; day < 7; day++) {
    const date = daysAgo(-day);
    await put(T.FORECASTS, {
      forecastId: `fc-${date}`, storeRecipeKey: `store-001#${date}`, storeId: "store-001", date,
      type: "demand", predictions: [
        { itemId: "inv-001", name: "Chicken Breast", predictedUsage: rand(8, 15), unit: "lb", confidence: round2(0.78 + Math.random() * 0.17) },
        { itemId: "inv-002", name: "Atlantic Salmon", predictedUsage: rand(5, 10), unit: "lb", confidence: round2(0.75 + Math.random() * 0.15) },
        { itemId: "inv-003", name: "Roma Tomatoes", predictedUsage: rand(10, 20), unit: "lb", confidence: round2(0.82 + Math.random() * 0.13) },
      ],
      createdAt: NOW,
    });
  }

  console.log("=== Seeding Incidents ===");
  await put(T.INCIDENTS, { storeId: "store-001", incidentId: "inc-001", cameraId: "cam-002", type: "temperature-alert", severity: "warning", description: "Walk-in cooler temperature rose above 40F for 15 minutes", status: "resolved", timestamp: `${daysAgo(1)}T22:15:00Z`, resolvedAt: `${daysAgo(1)}T22:45:00Z` });
  await put(T.INCIDENTS, { storeId: "store-001", incidentId: "inc-002", cameraId: "cam-003", type: "unauthorized-access", severity: "high", description: "Back door opened outside business hours", status: "reviewed", timestamp: `${daysAgo(3)}T02:30:00Z` });
  await put(T.INCIDENTS, { storeId: "store-002", incidentId: "inc-003", cameraId: "cam-004", type: "slip-fall", severity: "medium", description: "Potential slip detected near counter area", status: "resolved", timestamp: `${daysAgo(5)}T14:20:00Z`, resolvedAt: `${daysAgo(5)}T14:45:00Z` });

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
    items: [
      { name: "Chicken Breast", orderedQty: 50, receivedQty: 50, unit: "lb", accepted: true },
      { name: "Mozzarella", orderedQty: 20, receivedQty: 18, unit: "lb", accepted: true, note: "2 lb short" },
    ],
    receivedBy: "Maria Garcia", timestamp: `${daysAgo(1)}T09:00:00Z`,
  });

  console.log("=== Seeding Price History ===");
  for (let day = 29; day >= 0; day -= 7) {
    const date = daysAgo(day);
    await put(T.PRICE_HISTORY, { priceId: `ph-chicken-${day}`, supplierId: "sup-001", supplierName: "Sysco Foods", itemName: "Chicken Breast", price: round2(4.25 + Math.random() * 0.5), unit: "lb", timestamp: date });
    await put(T.PRICE_HISTORY, { priceId: `ph-salmon-${day}`, supplierId: "sup-003", supplierName: "Pacific Seafood", itemName: "Atlantic Salmon", price: round2(11.50 + Math.random() * 1.0), unit: "lb", timestamp: date });
    await put(T.PRICE_HISTORY, { priceId: `ph-tomato-${day}`, supplierId: "sup-002", supplierName: "Local Farms Co-op", itemName: "Roma Tomatoes", price: round2(2.00 + Math.random() * 0.5), unit: "lb", timestamp: date });
  }

  console.log("=== Seeding Audit Trail ===");
  await put(T.AUDIT_TRAIL, { auditId: "audit-001", storeId: "store-001", action: "inventory-received", resourceType: "purchase-order", resourceId: "po-001", timestamp: `${daysAgo(1)}T09:00:00Z`, userId: "matt@foodwise.io", details: { supplier: "Sysco Foods", total: 345 } });
  await put(T.AUDIT_TRAIL, { auditId: "audit-002", storeId: "store-001", action: "waste-logged", resourceType: "waste-log", resourceId: "waste-d0-0", timestamp: `${TODAY}T14:00:00Z`, userId: "matt@foodwise.io", details: { item: "Mixed Greens", quantity: 3 } });

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
  console.log(`Schedules: ${staffMembers.length * 7} (7 days)`);
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
