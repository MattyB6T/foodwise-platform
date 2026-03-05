# FoodWise Seed Data Script
# Run from: d:\Projects\foodwise-platform
# Usage: .\scripts\seed-data.ps1

$ErrorActionPreference = "Stop"

# --- Config ---
$baseUrl = "https://l6ayozti46.execute-api.us-east-1.amazonaws.com/v1"
$userPoolClientId = "2ub76h3h848ngbpk22fmlljsp8"
$username = "admin@foodwise.io"
$password = "FoodWise2026!"

# --- Authenticate ---
Write-Host "`n=== Authenticating ===" -ForegroundColor Cyan
$auth = aws cognito-idp initiate-auth --client-id $userPoolClientId --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=$username,PASSWORD=$password | ConvertFrom-Json
$token = $auth.AuthenticationResult.IdToken
$headers = @{Authorization=$token; "Content-Type"="application/json"}
Write-Host "Authenticated as $username" -ForegroundColor Green

# --- Helper function ---
function Api-Call {
    param([string]$Method, [string]$Path, [string]$Body)
    $params = @{
        UseBasicParsing = $true
        Method = $Method
        Uri = "$baseUrl$Path"
        Headers = $headers
    }
    if ($Body) { $params.Body = $Body }
    $response = Invoke-WebRequest @params
    return $response.Content | ConvertFrom-Json
}

# --- Step 1: Create Store ---
Write-Host "`n=== Creating Store ===" -ForegroundColor Cyan
$store = Api-Call "POST" "/stores" '{"name":"Subway - Main Street","address":"123 Main Street, Springfield, IL 62701"}'
$storeId = $store.storeId
Write-Host "Store created: $($store.name) (ID: $storeId)" -ForegroundColor Green

# --- Step 2: Add Ingredients ---
Write-Host "`n=== Adding Ingredients ===" -ForegroundColor Cyan
$inventoryBody = @{
    items = @(
        @{name="Italian Bread";category="bread";quantity=200;unit="roll";costPerUnit=0.35;lowStockThreshold=20}
        @{name="Turkey";category="protein";quantity=500;unit="oz";costPerUnit=0.45;lowStockThreshold=50}
        @{name="Ham";category="protein";quantity=400;unit="oz";costPerUnit=0.40;lowStockThreshold=50}
        @{name="Lettuce";category="produce";quantity=300;unit="oz";costPerUnit=0.08;lowStockThreshold=30}
        @{name="Tomato";category="produce";quantity=200;unit="oz";costPerUnit=0.10;lowStockThreshold=20}
        @{name="American Cheese";category="dairy";quantity=300;unit="slice";costPerUnit=0.15;lowStockThreshold=30}
        @{name="Meatballs";category="protein";quantity=150;unit="portion";costPerUnit=0.50;lowStockThreshold=20}
        @{name="Marinara Sauce";category="sauce";quantity=200;unit="oz";costPerUnit=0.20;lowStockThreshold=20}
        @{name="Chicken Teriyaki";category="protein";quantity=150;unit="portion";costPerUnit=0.55;lowStockThreshold=20}
    )
} | ConvertTo-Json -Depth 3

$invResult = Api-Call "POST" "/stores/$storeId/inventory" $inventoryBody

$bread = ($invResult.updatedItems | Where-Object {$_.name -eq "Italian Bread"}).itemId
$turkey = ($invResult.updatedItems | Where-Object {$_.name -eq "Turkey"}).itemId
$ham = ($invResult.updatedItems | Where-Object {$_.name -eq "Ham"}).itemId
$lettuce = ($invResult.updatedItems | Where-Object {$_.name -eq "Lettuce"}).itemId
$tomato = ($invResult.updatedItems | Where-Object {$_.name -eq "Tomato"}).itemId
$cheese = ($invResult.updatedItems | Where-Object {$_.name -eq "American Cheese"}).itemId
$meatballs = ($invResult.updatedItems | Where-Object {$_.name -eq "Meatballs"}).itemId
$marinara = ($invResult.updatedItems | Where-Object {$_.name -eq "Marinara Sauce"}).itemId
$chicken = ($invResult.updatedItems | Where-Object {$_.name -eq "Chicken Teriyaki"}).itemId

foreach ($item in $invResult.updatedItems) {
    Write-Host "  Added: $($item.name) - $($item.quantity) $($item.unit) @ `$$($item.costPerUnit)/$($item.unit)" -ForegroundColor Gray
}
Write-Host "9 ingredients added" -ForegroundColor Green

# --- Step 3: Create Recipes ---
Write-Host "`n=== Creating Recipes ===" -ForegroundColor Cyan

# Footlong Turkey Sub ($7.99)
$r1Body = @{name="Footlong Turkey Sub";category="sandwich";sellingPrice=7.99;ingredients=@(
    @{itemId=$bread;quantity=1;unit="roll"}
    @{itemId=$turkey;quantity=6;unit="oz"}
    @{itemId=$lettuce;quantity=2;unit="oz"}
    @{itemId=$tomato;quantity=2;unit="oz"}
    @{itemId=$cheese;quantity=2;unit="slice"}
)} | ConvertTo-Json -Depth 3
$r1 = Api-Call "POST" "/recipes" $r1Body
$turkeySubId = $r1.recipeId
Write-Host "  Footlong Turkey Sub (ID: $turkeySubId) - `$7.99" -ForegroundColor Gray

# Footlong Italian BMT ($8.49)
$r2Body = @{name="Footlong Italian BMT";category="sandwich";sellingPrice=8.49;ingredients=@(
    @{itemId=$bread;quantity=1;unit="roll"}
    @{itemId=$ham;quantity=4;unit="oz"}
    @{itemId=$turkey;quantity=2;unit="oz"}
    @{itemId=$lettuce;quantity=2;unit="oz"}
    @{itemId=$tomato;quantity=2;unit="oz"}
    @{itemId=$cheese;quantity=2;unit="slice"}
)} | ConvertTo-Json -Depth 3
$r2 = Api-Call "POST" "/recipes" $r2Body
$bmtId = $r2.recipeId
Write-Host "  Footlong Italian BMT (ID: $bmtId) - `$8.49" -ForegroundColor Gray

# Meatball Marinara ($7.49)
$r3Body = @{name="Meatball Marinara";category="sandwich";sellingPrice=7.49;ingredients=@(
    @{itemId=$bread;quantity=1;unit="roll"}
    @{itemId=$meatballs;quantity=2;unit="portion"}
    @{itemId=$marinara;quantity=3;unit="oz"}
    @{itemId=$cheese;quantity=2;unit="slice"}
)} | ConvertTo-Json -Depth 3
$r3 = Api-Call "POST" "/recipes" $r3Body
$meatballId = $r3.recipeId
Write-Host "  Meatball Marinara (ID: $meatballId) - `$7.49" -ForegroundColor Gray

# Chicken Teriyaki ($8.99)
$r4Body = @{name="Chicken Teriyaki";category="sandwich";sellingPrice=8.99;ingredients=@(
    @{itemId=$bread;quantity=1;unit="roll"}
    @{itemId=$chicken;quantity=2;unit="portion"}
    @{itemId=$lettuce;quantity=2;unit="oz"}
    @{itemId=$tomato;quantity=2;unit="oz"}
    @{itemId=$cheese;quantity=2;unit="slice"}
)} | ConvertTo-Json -Depth 3
$r4 = Api-Call "POST" "/recipes" $r4Body
$teriyakiId = $r4.recipeId
Write-Host "  Chicken Teriyaki (ID: $teriyakiId) - `$8.99" -ForegroundColor Gray

# Veggie Delite ($5.99)
$r5Body = @{name="Veggie Delite";category="sandwich";sellingPrice=5.99;ingredients=@(
    @{itemId=$bread;quantity=1;unit="roll"}
    @{itemId=$lettuce;quantity=3;unit="oz"}
    @{itemId=$tomato;quantity=3;unit="oz"}
    @{itemId=$cheese;quantity=2;unit="slice"}
)} | ConvertTo-Json -Depth 3
$r5 = Api-Call "POST" "/recipes" $r5Body
$veggieId = $r5.recipeId
Write-Host "  Veggie Delite (ID: $veggieId) - `$5.99" -ForegroundColor Gray
Write-Host "5 recipes created" -ForegroundColor Green

# --- Step 4: Record Transactions ---
Write-Host "`n=== Recording Transactions ===" -ForegroundColor Cyan

# Transaction 1: 3 Turkey Subs, 2 BMTs
$tx1 = Api-Call "POST" "/stores/$storeId/transactions" (@{lineItems=@(
    @{recipeId=$turkeySubId;quantity=3;price=7.99}
    @{recipeId=$bmtId;quantity=2;price=8.49}
)} | ConvertTo-Json -Depth 3)
Write-Host "  TX1: 3x Turkey Sub + 2x BMT = `$$($tx1.totalAmount) (food cost: $($tx1.foodCostPercentage)%)" -ForegroundColor Gray

# Transaction 2: 2 Meatball Marinaras, 1 Chicken Teriyaki
$tx2 = Api-Call "POST" "/stores/$storeId/transactions" (@{lineItems=@(
    @{recipeId=$meatballId;quantity=2;price=7.49}
    @{recipeId=$teriyakiId;quantity=1;price=8.99}
)} | ConvertTo-Json -Depth 3)
Write-Host "  TX2: 2x Meatball + 1x Teriyaki = `$$($tx2.totalAmount) (food cost: $($tx2.foodCostPercentage)%)" -ForegroundColor Gray

# Transaction 3: 4 Veggie Delites
$tx3 = Api-Call "POST" "/stores/$storeId/transactions" (@{lineItems=@(
    @{recipeId=$veggieId;quantity=4;price=5.99}
)} | ConvertTo-Json -Depth 3)
Write-Host "  TX3: 4x Veggie Delite = `$$($tx3.totalAmount) (food cost: $($tx3.foodCostPercentage)%)" -ForegroundColor Gray

# Transaction 4: 1 of each
$tx4 = Api-Call "POST" "/stores/$storeId/transactions" (@{lineItems=@(
    @{recipeId=$turkeySubId;quantity=1;price=7.99}
    @{recipeId=$bmtId;quantity=1;price=8.49}
    @{recipeId=$meatballId;quantity=1;price=7.49}
    @{recipeId=$teriyakiId;quantity=1;price=8.99}
    @{recipeId=$veggieId;quantity=1;price=5.99}
)} | ConvertTo-Json -Depth 3)
Write-Host "  TX4: 1x each sandwich = `$$($tx4.totalAmount) (food cost: $($tx4.foodCostPercentage)%)" -ForegroundColor Gray

# Transaction 5: 2 Turkey Subs, 3 Chicken Teriyakis
$tx5 = Api-Call "POST" "/stores/$storeId/transactions" (@{lineItems=@(
    @{recipeId=$turkeySubId;quantity=2;price=7.99}
    @{recipeId=$teriyakiId;quantity=3;price=8.99}
)} | ConvertTo-Json -Depth 3)
Write-Host "  TX5: 2x Turkey Sub + 3x Teriyaki = `$$($tx5.totalAmount) (food cost: $($tx5.foodCostPercentage)%)" -ForegroundColor Gray
Write-Host "5 transactions recorded" -ForegroundColor Green

# --- Step 5: Verify Inventory ---
Write-Host "`n=== Inventory After Transactions ===" -ForegroundColor Cyan
$inventory = Api-Call "GET" "/stores/$storeId/inventory"
Write-Host ("{0,-20} {1,10} {2,6}" -f "INGREDIENT","REMAINING","UNIT") -ForegroundColor Yellow
Write-Host ("{0,-20} {1,10} {2,6}" -f "--------------------","----------","------") -ForegroundColor Yellow
foreach ($item in $inventory.items) {
    $color = if ($item.quantity -le $item.lowStockThreshold) { "Red" } else { "Gray" }
    Write-Host ("{0,-20} {1,10} {2,6}" -f $item.name, $item.quantity, $item.unit) -ForegroundColor $color
}

# --- Step 6: Dashboard ---
Write-Host "`n=== Dashboard ===" -ForegroundColor Cyan
$dashboard = Api-Call "GET" "/stores/$storeId/dashboard"
Write-Host "  Total Inventory Items: $($dashboard.inventorySummary.totalItems)" -ForegroundColor Gray
Write-Host "  Total Inventory Value: `$$($dashboard.inventorySummary.totalValue)" -ForegroundColor Gray
Write-Host "  Food Cost %%: $($dashboard.foodCostPercentage)%%" -ForegroundColor Gray
Write-Host "  Low Stock Alerts: $($dashboard.lowStockAlerts.Count)" -ForegroundColor Gray
foreach ($alert in $dashboard.lowStockAlerts) {
    Write-Host "    WARNING: $($alert.name) - $($alert.quantity) $($alert.unit) (threshold: $($alert.threshold))" -ForegroundColor Red
}

Write-Host "`n=== Seed Complete ===" -ForegroundColor Green
Write-Host "Store ID: $storeId"
Write-Host "API URL: $baseUrl"
