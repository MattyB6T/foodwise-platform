#!/bin/bash
# Seed demo data into all DynamoDB tables
export AWS_PROFILE=foodwise
REGION="us-east-1"

# Table name prefix
P="FoodwiseStack-CoreStackNestedStackCoreStackNestedStackResource06DFB247-ME86T0DHUM3I"

STORES="${P}-StoresTableE2108BD4-EK9NVR11MBRF"
INVENTORY="${P}-InventoryTableFD135387-VIU7DCR1LFX1"
TRANSACTIONS="${P}-TransactionsTable0A011FCB-98K5KU5NV0EH"
RECIPES="${P}-RecipesTable058A1F33-K5YZ74IQTK02"
SUPPLIERS="${P}-SuppliersTableF9BC2E6D-1273XLCCW4GPY"
PURCHASE_ORDERS="${P}-PurchaseOrdersTable491A23F2-6BM6GNY3UWTE"
WASTE_LOGS="${P}-WasteLogsTable99DF3E91-EWPGQTOKSEP1"
STAFF="${P}-StaffTable11B9C6C0-8K6Q6SA5SSY8"
SCHEDULES="${P}-SchedulesTableFBEB0188-1GOWBUDVKHLFZ"
CAMERAS="${P}-CamerasTable183C7F3A-5RF2XYCU9L25"
INCIDENTS="${P}-IncidentsTable307EBBA6-1MPTP9ZRCS4LD"
TEMP_LOGS="${P}-TempLogsTable8E4B3D0B-1B9H6NPTB1A4O"
FORECASTS="${P}-ForecastsTable40A833D2-N0WBS9RRLSID"
PREP_LISTS="${P}-PrepListsTable449FCF89-FKHXRE44KL24"
AUDIT_TRAIL="${P}-AuditTrailTable4CEE68C7-1HROZ6Y00ZMFF"
NOTIFICATIONS="${P}-NotificationsTable76DCFC6C-1VIBTP9OJE5J6"
INVENTORY_COUNTS="${P}-InventoryCountsTable27D2854D-14YKODS08NQ4V"
TIME_CLOCK="${P}-TimeClockTable3A097BD6-1T3JECZRQNBFW"
PRICE_HISTORY="${P}-PriceHistoryTable5AD3E5A9-UMN2PN0ITSMI"
KIOSK_DEVICES="${P}-KioskDevicesTable4E61EA47-1D1LG2WRQI45I"
RECEIVING_LOGS="${P}-ReceivingLogsTable3AC8C0B1-1F70MJDRT0QBN"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(date -u +%Y-%m-%d)
YESTERDAY=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)

put() {
  aws dynamodb put-item --table-name "$1" --item "$2" --region $REGION 2>&1
}

echo "=== Seeding Stores ==="
STORE1="store-001"
STORE2="store-002"

put "$STORES" '{
  "storeId":{"S":"store-001"},"name":{"S":"Downtown Bistro"},"address":{"S":"123 Main St, Austin TX 78701"},
  "phone":{"S":"512-555-0100"},"type":{"S":"restaurant"},"owner":{"S":"matt@foodwise.io"},
  "createdAt":{"S":"'$NOW'"},"healthScore":{"N":"82"},"monthlyBudget":{"N":"45000"}
}'

put "$STORES" '{
  "storeId":{"S":"store-002"},"name":{"S":"Lakeside Cafe"},"address":{"S":"456 Lake Dr, Austin TX 78702"},
  "phone":{"S":"512-555-0200"},"type":{"S":"cafe"},"owner":{"S":"matt@foodwise.io"},
  "createdAt":{"S":"'$NOW'"},"healthScore":{"N":"91"},"monthlyBudget":{"N":"28000"}
}'

echo "=== Seeding Inventory (Store 1) ==="
for item in \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-001"},"name":{"S":"Chicken Breast"},"category":{"S":"Protein"},"quantity":{"N":"45"},"unit":{"S":"lb"},"unitCost":{"N":"4.50"},"parLevel":{"N":"30"},"reorderPoint":{"N":"15"},"expirationDate":{"S":"'$TODAY'"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-002"},"name":{"S":"Atlantic Salmon"},"category":{"S":"Protein"},"quantity":{"N":"22"},"unit":{"S":"lb"},"unitCost":{"N":"12.00"},"parLevel":{"N":"20"},"reorderPoint":{"N":"10"},"expirationDate":{"S":"2026-03-08"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-003"},"name":{"S":"Roma Tomatoes"},"category":{"S":"Produce"},"quantity":{"N":"60"},"unit":{"S":"lb"},"unitCost":{"N":"2.25"},"parLevel":{"N":"40"},"reorderPoint":{"N":"20"},"expirationDate":{"S":"2026-03-09"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-004"},"name":{"S":"Mixed Greens"},"category":{"S":"Produce"},"quantity":{"N":"18"},"unit":{"S":"lb"},"unitCost":{"N":"3.50"},"parLevel":{"N":"25"},"reorderPoint":{"N":"12"},"expirationDate":{"S":"2026-03-07"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-005"},"name":{"S":"Olive Oil"},"category":{"S":"Pantry"},"quantity":{"N":"8"},"unit":{"S":"gal"},"unitCost":{"N":"18.00"},"parLevel":{"N":"5"},"reorderPoint":{"N":"3"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-006"},"name":{"S":"Mozzarella"},"category":{"S":"Dairy"},"quantity":{"N":"15"},"unit":{"S":"lb"},"unitCost":{"N":"6.00"},"parLevel":{"N":"12"},"reorderPoint":{"N":"6"},"expirationDate":{"S":"2026-03-10"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-007"},"name":{"S":"Flour (AP)"},"category":{"S":"Pantry"},"quantity":{"N":"50"},"unit":{"S":"lb"},"unitCost":{"N":"0.80"},"parLevel":{"N":"40"},"reorderPoint":{"N":"20"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-001"},"itemId":{"S":"inv-008"},"name":{"S":"Heavy Cream"},"category":{"S":"Dairy"},"quantity":{"N":"6"},"unit":{"S":"qt"},"unitCost":{"N":"4.00"},"parLevel":{"N":"8"},"reorderPoint":{"N":"4"},"expirationDate":{"S":"2026-03-08"},"lastUpdated":{"S":"'$NOW'"}}' \
; do
  put "$INVENTORY" "$item"
done

echo "=== Seeding Inventory (Store 2) ==="
for item in \
  '{"storeId":{"S":"store-002"},"itemId":{"S":"inv-101"},"name":{"S":"Espresso Beans"},"category":{"S":"Beverage"},"quantity":{"N":"30"},"unit":{"S":"lb"},"unitCost":{"N":"14.00"},"parLevel":{"N":"20"},"reorderPoint":{"N":"10"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-002"},"itemId":{"S":"inv-102"},"name":{"S":"Whole Milk"},"category":{"S":"Dairy"},"quantity":{"N":"12"},"unit":{"S":"gal"},"unitCost":{"N":"4.50"},"parLevel":{"N":"10"},"reorderPoint":{"N":"5"},"expirationDate":{"S":"2026-03-09"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-002"},"itemId":{"S":"inv-103"},"name":{"S":"Croissants"},"category":{"S":"Bakery"},"quantity":{"N":"24"},"unit":{"S":"ea"},"unitCost":{"N":"1.75"},"parLevel":{"N":"30"},"reorderPoint":{"N":"15"},"expirationDate":{"S":"2026-03-07"},"lastUpdated":{"S":"'$NOW'"}}' \
  '{"storeId":{"S":"store-002"},"itemId":{"S":"inv-104"},"name":{"S":"Avocado"},"category":{"S":"Produce"},"quantity":{"N":"40"},"unit":{"S":"ea"},"unitCost":{"N":"1.50"},"parLevel":{"N":"30"},"reorderPoint":{"N":"15"},"expirationDate":{"S":"2026-03-08"},"lastUpdated":{"S":"'$NOW'"}}' \
; do
  put "$INVENTORY" "$item"
done

echo "=== Seeding Recipes ==="
put "$RECIPES" '{
  "recipeId":{"S":"recipe-001"},"name":{"S":"Grilled Chicken Caesar"},"category":{"S":"Entree"},"servings":{"N":"1"},
  "prepTime":{"N":"15"},"cookTime":{"N":"12"},"menuPrice":{"N":"16.95"},
  "ingredients":{"L":[
    {"M":{"itemId":{"S":"inv-001"},"name":{"S":"Chicken Breast"},"quantity":{"N":"0.5"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-004"},"name":{"S":"Mixed Greens"},"quantity":{"N":"0.25"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-006"},"name":{"S":"Mozzarella"},"quantity":{"N":"0.125"},"unit":{"S":"lb"}}}
  ]},
  "foodCost":{"N":"4.00"},"foodCostPct":{"N":"23.6"},"createdAt":{"S":"'$NOW'"}
}'

put "$RECIPES" '{
  "recipeId":{"S":"recipe-002"},"name":{"S":"Margherita Pizza"},"category":{"S":"Entree"},"servings":{"N":"1"},
  "prepTime":{"N":"20"},"cookTime":{"N":"10"},"menuPrice":{"N":"14.50"},
  "ingredients":{"L":[
    {"M":{"itemId":{"S":"inv-007"},"name":{"S":"Flour (AP)"},"quantity":{"N":"0.5"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-003"},"name":{"S":"Roma Tomatoes"},"quantity":{"N":"0.375"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-006"},"name":{"S":"Mozzarella"},"quantity":{"N":"0.25"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-005"},"name":{"S":"Olive Oil"},"quantity":{"N":"0.02"},"unit":{"S":"gal"}}}
  ]},
  "foodCost":{"N":"3.35"},"foodCostPct":{"N":"23.1"},"createdAt":{"S":"'$NOW'"}
}'

put "$RECIPES" '{
  "recipeId":{"S":"recipe-003"},"name":{"S":"Salmon Bowl"},"category":{"S":"Entree"},"servings":{"N":"1"},
  "prepTime":{"N":"10"},"cookTime":{"N":"8"},"menuPrice":{"N":"19.95"},
  "ingredients":{"L":[
    {"M":{"itemId":{"S":"inv-002"},"name":{"S":"Atlantic Salmon"},"quantity":{"N":"0.375"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-004"},"name":{"S":"Mixed Greens"},"quantity":{"N":"0.2"},"unit":{"S":"lb"}}},
    {"M":{"itemId":{"S":"inv-003"},"name":{"S":"Roma Tomatoes"},"quantity":{"N":"0.125"},"unit":{"S":"lb"}}}
  ]},
  "foodCost":{"N":"5.50"},"foodCostPct":{"N":"27.6"},"createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Transactions ==="
for i in $(seq 1 12); do
  TXID="txn-$(printf '%03d' $i)"
  HOUR=$((8 + i))
  TOTAL=$((RANDOM % 40 + 15))
  TAX=$(echo "scale=2; $TOTAL * 0.0825" | bc)
  SUBTOTAL=$(echo "scale=2; $TOTAL - $TAX" | bc)
  put "$TRANSACTIONS" '{
    "storeId":{"S":"store-001"},"transactionId":{"S":"'$TXID'"},"type":{"S":"sale"},
    "timestamp":{"S":"'$TODAY'T'$(printf '%02d' $HOUR)':30:00Z"},"total":{"N":"'$TOTAL'"},
    "tax":{"N":"'$TAX'"},"subtotal":{"N":"'$SUBTOTAL'"},
    "lineItems":{"L":[{"M":{"name":{"S":"Grilled Chicken Caesar"},"quantity":{"N":"1"},"price":{"N":"16.95"}}}]},
    "paymentMethod":{"S":"card"},"source":{"S":"pos"}
  }'
done

for i in $(seq 13 20); do
  TXID="txn-$(printf '%03d' $i)"
  HOUR=$((7 + i - 12))
  TOTAL=$((RANDOM % 25 + 8))
  TAX=$(echo "scale=2; $TOTAL * 0.0825" | bc)
  SUBTOTAL=$(echo "scale=2; $TOTAL - $TAX" | bc)
  put "$TRANSACTIONS" '{
    "storeId":{"S":"store-002"},"transactionId":{"S":"'$TXID'"},"type":{"S":"sale"},
    "timestamp":{"S":"'$TODAY'T'$(printf '%02d' $HOUR)':15:00Z"},"total":{"N":"'$TOTAL'"},
    "tax":{"N":"'$TAX'"},"subtotal":{"N":"'$SUBTOTAL'"},
    "lineItems":{"L":[{"M":{"name":{"S":"Latte"},"quantity":{"N":"2"},"price":{"N":"5.50"}}}]},
    "paymentMethod":{"S":"card"},"source":{"S":"pos"}
  }'
done

echo "=== Seeding Suppliers ==="
put "$SUPPLIERS" '{
  "supplierId":{"S":"sup-001"},"name":{"S":"Sysco Foods"},"contactName":{"S":"Sarah Chen"},
  "email":{"S":"sarah@sysco.example.com"},"phone":{"S":"512-555-9000"},
  "categories":{"L":[{"S":"Protein"},{"S":"Dairy"},{"S":"Pantry"}]},
  "rating":{"N":"4.5"},"createdAt":{"S":"'$NOW'"}
}'

put "$SUPPLIERS" '{
  "supplierId":{"S":"sup-002"},"name":{"S":"Local Farms Co-op"},"contactName":{"S":"Jake Miller"},
  "email":{"S":"jake@localfarms.example.com"},"phone":{"S":"512-555-9100"},
  "categories":{"L":[{"S":"Produce"}]},
  "rating":{"N":"4.8"},"createdAt":{"S":"'$NOW'"}
}'

put "$SUPPLIERS" '{
  "supplierId":{"S":"sup-003"},"name":{"S":"Pacific Seafood"},"contactName":{"S":"Amy Wong"},
  "email":{"S":"amy@pacificseafood.example.com"},"phone":{"S":"512-555-9200"},
  "categories":{"L":[{"S":"Protein"}]},
  "rating":{"N":"4.2"},"createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Purchase Orders ==="
put "$PURCHASE_ORDERS" '{
  "orderId":{"S":"po-001"},"storeId":{"S":"store-001"},"supplierId":{"S":"sup-001"},
  "supplierName":{"S":"Sysco Foods"},"status":{"S":"delivered"},
  "items":{"L":[
    {"M":{"name":{"S":"Chicken Breast"},"quantity":{"N":"50"},"unit":{"S":"lb"},"unitCost":{"N":"4.50"},"total":{"N":"225.00"}}},
    {"M":{"name":{"S":"Mozzarella"},"quantity":{"N":"20"},"unit":{"S":"lb"},"unitCost":{"N":"6.00"},"total":{"N":"120.00"}}}
  ]},
  "total":{"N":"345.00"},"orderDate":{"S":"'$YESTERDAY'"},"deliveryDate":{"S":"'$TODAY'"},
  "createdAt":{"S":"'$NOW'"}
}'

put "$PURCHASE_ORDERS" '{
  "orderId":{"S":"po-002"},"storeId":{"S":"store-001"},"supplierId":{"S":"sup-002"},
  "supplierName":{"S":"Local Farms Co-op"},"status":{"S":"pending"},
  "items":{"L":[
    {"M":{"name":{"S":"Roma Tomatoes"},"quantity":{"N":"40"},"unit":{"S":"lb"},"unitCost":{"N":"2.25"},"total":{"N":"90.00"}}},
    {"M":{"name":{"S":"Mixed Greens"},"quantity":{"N":"25"},"unit":{"S":"lb"},"unitCost":{"N":"3.50"},"total":{"N":"87.50"}}}
  ]},
  "total":{"N":"177.50"},"orderDate":{"S":"'$TODAY'"},
  "createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Waste Logs ==="
put "$WASTE_LOGS" '{
  "storeId":{"S":"store-001"},"wasteId":{"S":"waste-001"},"itemName":{"S":"Mixed Greens"},
  "quantity":{"N":"3"},"unit":{"S":"lb"},"reason":{"S":"expired"},"cost":{"N":"10.50"},
  "loggedBy":{"S":"matt@foodwise.io"},"timestamp":{"S":"'$TODAY'T14:00:00Z"}
}'

put "$WASTE_LOGS" '{
  "storeId":{"S":"store-001"},"wasteId":{"S":"waste-002"},"itemName":{"S":"Heavy Cream"},
  "quantity":{"N":"1"},"unit":{"S":"qt"},"reason":{"S":"spoiled"},"cost":{"N":"4.00"},
  "loggedBy":{"S":"matt@foodwise.io"},"timestamp":{"S":"'$TODAY'T10:30:00Z"}
}'

put "$WASTE_LOGS" '{
  "storeId":{"S":"store-002"},"wasteId":{"S":"waste-003"},"itemName":{"S":"Croissants"},
  "quantity":{"N":"6"},"unit":{"S":"ea"},"reason":{"S":"stale"},"cost":{"N":"10.50"},
  "loggedBy":{"S":"matt@foodwise.io"},"timestamp":{"S":"'$TODAY'T16:00:00Z"}
}'

echo "=== Seeding Staff ==="
put "$STAFF" '{
  "storeId":{"S":"store-001"},"staffId":{"S":"staff-001"},"name":{"S":"Maria Garcia"},
  "email":{"S":"maria@foodwise.io"},"role":{"S":"manager"},"pin":{"S":"1234"},
  "hourlyRate":{"N":"22.00"},"status":{"S":"active"},"createdAt":{"S":"'$NOW'"}
}'

put "$STAFF" '{
  "storeId":{"S":"store-001"},"staffId":{"S":"staff-002"},"name":{"S":"James Wilson"},
  "email":{"S":"james@foodwise.io"},"role":{"S":"cook"},"pin":{"S":"5678"},
  "hourlyRate":{"N":"18.00"},"status":{"S":"active"},"createdAt":{"S":"'$NOW'"}
}'

put "$STAFF" '{
  "storeId":{"S":"store-001"},"staffId":{"S":"staff-003"},"name":{"S":"Sarah Kim"},
  "email":{"S":"sarah@foodwise.io"},"role":{"S":"server"},"pin":{"S":"9012"},
  "hourlyRate":{"N":"15.00"},"status":{"S":"active"},"createdAt":{"S":"'$NOW'"}
}'

put "$STAFF" '{
  "storeId":{"S":"store-002"},"staffId":{"S":"staff-004"},"name":{"S":"Alex Rivera"},
  "email":{"S":"alex@foodwise.io"},"role":{"S":"barista"},"pin":{"S":"3456"},
  "hourlyRate":{"N":"16.00"},"status":{"S":"active"},"createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Schedules ==="
put "$SCHEDULES" '{
  "storeId":{"S":"store-001"},"scheduleId":{"S":"sched-001"},"staffId":{"S":"staff-001"},
  "staffName":{"S":"Maria Garcia"},"date":{"S":"'$TODAY'"},
  "startTime":{"S":"08:00"},"endTime":{"S":"16:00"},"role":{"S":"manager"}
}'

put "$SCHEDULES" '{
  "storeId":{"S":"store-001"},"scheduleId":{"S":"sched-002"},"staffId":{"S":"staff-002"},
  "staffName":{"S":"James Wilson"},"date":{"S":"'$TODAY'"},
  "startTime":{"S":"10:00"},"endTime":{"S":"18:00"},"role":{"S":"cook"}
}'

put "$SCHEDULES" '{
  "storeId":{"S":"store-001"},"scheduleId":{"S":"sched-003"},"staffId":{"S":"staff-003"},
  "staffName":{"S":"Sarah Kim"},"date":{"S":"'$TODAY'"},
  "startTime":{"S":"11:00"},"endTime":{"S":"19:00"},"role":{"S":"server"}
}'

echo "=== Seeding Time Clock ==="
put "$TIME_CLOCK" '{
  "storeId":{"S":"store-001"},"entryId":{"S":"clock-001"},"staffId":{"S":"staff-001"},
  "staffName":{"S":"Maria Garcia"},"clockIn":{"S":"'$TODAY'T08:02:00Z"},
  "clockOut":{"S":"'$TODAY'T16:05:00Z"},"hoursWorked":{"N":"8.05"},
  "status":{"S":"completed"},"date":{"S":"'$TODAY'"}
}'

put "$TIME_CLOCK" '{
  "storeId":{"S":"store-001"},"entryId":{"S":"clock-002"},"staffId":{"S":"staff-002"},
  "staffName":{"S":"James Wilson"},"clockIn":{"S":"'$TODAY'T10:00:00Z"},
  "status":{"S":"active"},"date":{"S":"'$TODAY'"}
}'

echo "=== Seeding Cameras ==="
put "$CAMERAS" '{
  "storeId":{"S":"store-001"},"cameraId":{"S":"cam-001"},"name":{"S":"Kitchen Main"},
  "location":{"S":"kitchen"},"status":{"S":"online"},"streamUrl":{"S":"rtsp://10.0.1.10/stream1"},
  "createdAt":{"S":"'$NOW'"}
}'

put "$CAMERAS" '{
  "storeId":{"S":"store-001"},"cameraId":{"S":"cam-002"},"name":{"S":"Walk-in Cooler"},
  "location":{"S":"storage"},"status":{"S":"online"},"streamUrl":{"S":"rtsp://10.0.1.11/stream1"},
  "createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Temp Logs ==="
put "$TEMP_LOGS" '{
  "storeId":{"S":"store-001"},"logId":{"S":"temp-001"},"location":{"S":"Walk-in Cooler"},
  "temperature":{"N":"38"},"unit":{"S":"F"},"status":{"S":"normal"},
  "loggedBy":{"S":"Maria Garcia"},"timestamp":{"S":"'$TODAY'T08:30:00Z"}
}'

put "$TEMP_LOGS" '{
  "storeId":{"S":"store-001"},"logId":{"S":"temp-002"},"location":{"S":"Freezer"},
  "temperature":{"N":"-2"},"unit":{"S":"F"},"status":{"S":"normal"},
  "loggedBy":{"S":"Maria Garcia"},"timestamp":{"S":"'$TODAY'T08:35:00Z"}
}'

put "$TEMP_LOGS" '{
  "storeId":{"S":"store-001"},"logId":{"S":"temp-003"},"location":{"S":"Prep Station"},
  "temperature":{"N":"68"},"unit":{"S":"F"},"status":{"S":"normal"},
  "loggedBy":{"S":"James Wilson"},"timestamp":{"S":"'$TODAY'T10:15:00Z"}
}'

echo "=== Seeding Forecasts ==="
put "$FORECASTS" '{
  "storeId":{"S":"store-001"},"forecastId":{"S":"fc-001"},"date":{"S":"'$TODAY'"},
  "type":{"S":"demand"},"predictions":{"L":[
    {"M":{"itemId":{"S":"inv-001"},"name":{"S":"Chicken Breast"},"predictedUsage":{"N":"12"},"unit":{"S":"lb"},"confidence":{"N":"0.87"}}},
    {"M":{"itemId":{"S":"inv-002"},"name":{"S":"Atlantic Salmon"},"predictedUsage":{"N":"8"},"unit":{"S":"lb"},"confidence":{"N":"0.82"}}},
    {"M":{"itemId":{"S":"inv-003"},"name":{"S":"Roma Tomatoes"},"predictedUsage":{"N":"15"},"unit":{"S":"lb"},"confidence":{"N":"0.91"}}}
  ]},
  "createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Incidents ==="
put "$INCIDENTS" '{
  "storeId":{"S":"store-001"},"incidentId":{"S":"inc-001"},"cameraId":{"S":"cam-002"},
  "type":{"S":"temperature-alert"},"severity":{"S":"warning"},
  "description":{"S":"Walk-in cooler temperature rose above 40F for 15 minutes"},
  "status":{"S":"resolved"},"timestamp":{"S":"'$YESTERDAY'T22:15:00Z"},
  "resolvedAt":{"S":"'$YESTERDAY'T22:45:00Z"}
}'

echo "=== Seeding Prep Lists ==="
put "$PREP_LISTS" '{
  "storeId":{"S":"store-001"},"prepListId":{"S":"prep-001"},"date":{"S":"'$TODAY'"},
  "items":{"L":[
    {"M":{"name":{"S":"Dice tomatoes"},"quantity":{"S":"10 lb"},"assignedTo":{"S":"James Wilson"},"completed":{"BOOL":true}}},
    {"M":{"name":{"S":"Grill chicken"},"quantity":{"S":"15 lb"},"assignedTo":{"S":"James Wilson"},"completed":{"BOOL":false}}},
    {"M":{"name":{"S":"Make Caesar dressing"},"quantity":{"S":"2 qt"},"assignedTo":{"S":"Sarah Kim"},"completed":{"BOOL":false}}}
  ]},
  "createdAt":{"S":"'$NOW'"}
}'

echo "=== Seeding Audit Trail ==="
put "$AUDIT_TRAIL" '{
  "auditId":{"S":"audit-001"},"storeId":{"S":"store-001"},"action":{"S":"inventory-received"},
  "resourceType":{"S":"purchase-order"},"resourceId":{"S":"po-001"},
  "timestamp":{"S":"'$TODAY'T09:00:00Z"},"userId":{"S":"matt@foodwise.io"},
  "details":{"M":{"supplier":{"S":"Sysco Foods"},"total":{"N":"345.00"}}}
}'

echo "=== Seeding Receiving Logs ==="
put "$RECEIVING_LOGS" '{
  "storeId":{"S":"store-001"},"logId":{"S":"recv-001"},"orderId":{"S":"po-001"},
  "supplierId":{"S":"sup-001"},"supplierName":{"S":"Sysco Foods"},
  "items":{"L":[
    {"M":{"name":{"S":"Chicken Breast"},"orderedQty":{"N":"50"},"receivedQty":{"N":"50"},"unit":{"S":"lb"},"accepted":{"BOOL":true}}},
    {"M":{"name":{"S":"Mozzarella"},"orderedQty":{"N":"20"},"receivedQty":{"N":"18"},"unit":{"S":"lb"},"accepted":{"BOOL":true},"note":{"S":"2 lb short"}}}
  ]},
  "receivedBy":{"S":"Maria Garcia"},"timestamp":{"S":"'$TODAY'T09:00:00Z"}
}'

echo "=== Seeding Price History ==="
put "$PRICE_HISTORY" '{
  "itemKey":{"S":"Chicken Breast#sup-001"},"timestamp":{"S":"'$TODAY'"},
  "supplierId":{"S":"sup-001"},"supplierName":{"S":"Sysco Foods"},
  "itemName":{"S":"Chicken Breast"},"price":{"N":"4.50"},"unit":{"S":"lb"}
}'

put "$PRICE_HISTORY" '{
  "itemKey":{"S":"Atlantic Salmon#sup-003"},"timestamp":{"S":"'$TODAY'"},
  "supplierId":{"S":"sup-003"},"supplierName":{"S":"Pacific Seafood"},
  "itemName":{"S":"Atlantic Salmon"},"price":{"N":"12.00"},"unit":{"S":"lb"}
}'

echo "=== Seeding Notifications ==="
put "$NOTIFICATIONS" '{
  "userId":{"S":"matt@foodwise.io"},"notificationId":{"S":"notif-001"},
  "type":{"S":"low-stock"},"title":{"S":"Low Stock Alert"},
  "message":{"S":"Heavy Cream at Downtown Bistro is below reorder point (6 qt remaining, par: 8)"},
  "storeId":{"S":"store-001"},"read":{"BOOL":false},"timestamp":{"S":"'$NOW'"}
}'

put "$NOTIFICATIONS" '{
  "userId":{"S":"matt@foodwise.io"},"notificationId":{"S":"notif-002"},
  "type":{"S":"order-delivered"},"title":{"S":"Order Delivered"},
  "message":{"S":"Sysco Foods delivery received at Downtown Bistro - PO #po-001"},
  "storeId":{"S":"store-001"},"read":{"BOOL":true},"timestamp":{"S":"'$TODAY'T09:05:00Z"}
}'

echo ""
echo "=== SEED COMPLETE ==="
echo "Stores: 2 (Downtown Bistro, Lakeside Cafe)"
echo "Inventory: 12 items (8 + 4)"
echo "Recipes: 3"
echo "Transactions: 20 (12 + 8)"
echo "Suppliers: 3"
echo "Purchase Orders: 2"
echo "Waste Logs: 3"
echo "Staff: 4"
echo "Schedules: 3"
echo "Time Clock: 2"
echo "Cameras: 2"
echo "Temp Logs: 3"
echo "Forecasts: 1"
echo "Incidents: 1"
echo "Prep Lists: 1"
echo "Audit Trail: 1"
echo "Receiving Logs: 1"
echo "Price History: 2"
echo "Notifications: 2"
