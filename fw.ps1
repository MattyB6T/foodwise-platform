# FoodWise CLI Helper
# Usage: powershell -ExecutionPolicy Bypass -File .\fw.ps1 <command>
# Commands: check, setup-store, load-transactions, run-forecast

param([string]$Command = "help")

$BASE = "https://l6ayozti46.execute-api.us-east-1.amazonaws.com/v1"
$USER_POOL_ID = "us-east-1_p8FX80yTD"
$REGION = "us-east-1"

function Get-Token {
    $clientId = (aws cognito-idp list-user-pool-clients --region $REGION --user-pool-id $USER_POOL_ID | ConvertFrom-Json).UserPoolClients[0].ClientId
    $auth = (aws cognito-idp initiate-auth --region $REGION --auth-flow USER_PASSWORD_AUTH --client-id $clientId --auth-parameters USERNAME=admin@foodwise.io,PASSWORD=FoodWise2026! | ConvertFrom-Json)
    return $auth.AuthenticationResult.IdToken
}

function Invoke-API($method, $path, $token, $body = $null) {
    $uri = "$BASE$path"
    $headers = @{ Authorization = "Bearer $token" }
    if ($body) {
        return Invoke-RestMethod -Uri $uri -Headers $headers -Method $method -Body ($body | ConvertTo-Json -Depth 10) -ContentType "application/json"
    } else {
        return Invoke-RestMethod -Uri $uri -Headers $headers -Method $method
    }
}

switch ($Command) {

    "check" {
        Write-Host "Getting auth token..." -ForegroundColor Cyan
        $token = Get-Token

        Write-Host "`n=== STORES ===" -ForegroundColor Yellow
        $stores = Invoke-API "GET" "/stores" $token
        $stores | ConvertTo-Json -Depth 5

        if ($stores.stores.Count -gt 0) {
            $storeId = $stores.stores[0].storeId
            Write-Host "`nUsing store: $($stores.stores[0].name) ($storeId)" -ForegroundColor Cyan

            Write-Host "`n=== INVENTORY (ingredients) ===" -ForegroundColor Yellow
            $inventory = Invoke-API "GET" "/stores/$storeId/inventory" $token
            Write-Host "  $($inventory.items.Count) items found"
            $inventory.items | ForEach-Object { Write-Host "  - $($_.name) ($($_.quantity) $($_.unit))" }

            Write-Host "`n=== RECIPES ===" -ForegroundColor Yellow
            $recipes = Invoke-API "GET" "/recipes" $token
            Write-Host "  $($recipes.recipes.Count) recipes found"
            $recipes.recipes | ForEach-Object { Write-Host "  - $($_.name) @ `$$($_.sellingPrice)" }

            Write-Host "`n=== DASHBOARD ===" -ForegroundColor Yellow
            $dashboard = Invoke-API "GET" "/stores/$storeId/dashboard" $token
            $dashboard | ConvertTo-Json -Depth 5
        }
    }

    "setup-store" {
        Write-Host "Getting auth token..." -ForegroundColor Cyan
        $token = Get-Token
        $storeId = ((Invoke-API "GET" "/stores" $token).stores[0].storeId)
        Write-Host "Using storeId: $storeId" -ForegroundColor Cyan

        # Check existing inventory
        $existing = (Invoke-API "GET" "/stores/$storeId/inventory" $token).items
        Write-Host "$($existing.Count) inventory items already exist" -ForegroundColor Cyan

        # Create ingredients via POST /ingredients (writes to inventory table)
        $ingredients = @(
            @{ storeId=$storeId; name="Italian Bread Roll"; unit="roll"; costPerUnit=0.35; supplier="Breadco"; reorderThreshold=20; category="bread"; quantity=200 },
            @{ storeId=$storeId; name="Wheat Bread Roll"; unit="roll"; costPerUnit=0.38; supplier="Breadco"; reorderThreshold=20; category="bread"; quantity=200 },
            @{ storeId=$storeId; name="Flatbread"; unit="piece"; costPerUnit=0.30; supplier="Breadco"; reorderThreshold=15; category="bread"; quantity=150 },
            @{ storeId=$storeId; name="Rotisserie Chicken"; unit="oz"; costPerUnit=0.55; supplier="FreshMeats"; reorderThreshold=50; category="protein"; quantity=300 },
            @{ storeId=$storeId; name="Turkey Breast"; unit="oz"; costPerUnit=0.45; supplier="FreshMeats"; reorderThreshold=50; category="protein"; quantity=300 },
            @{ storeId=$storeId; name="Tuna"; unit="oz"; costPerUnit=0.40; supplier="SeaFresh"; reorderThreshold=20; category="protein"; quantity=150 },
            @{ storeId=$storeId; name="Steak"; unit="oz"; costPerUnit=0.90; supplier="FreshMeats"; reorderThreshold=20; category="protein"; quantity=150 },
            @{ storeId=$storeId; name="Meatballs"; unit="oz"; costPerUnit=0.50; supplier="FreshMeats"; reorderThreshold=20; category="protein"; quantity=150 },
            @{ storeId=$storeId; name="Lettuce"; unit="oz"; costPerUnit=0.08; supplier="FreshProduce"; reorderThreshold=30; category="produce"; quantity=200 },
            @{ storeId=$storeId; name="Tomato"; unit="oz"; costPerUnit=0.10; supplier="FreshProduce"; reorderThreshold=30; category="produce"; quantity=200 },
            @{ storeId=$storeId; name="American Cheese"; unit="slice"; costPerUnit=0.15; supplier="DairyBest"; reorderThreshold=50; category="dairy"; quantity=300 },
            @{ storeId=$storeId; name="Provolone Cheese"; unit="slice"; costPerUnit=0.18; supplier="DairyBest"; reorderThreshold=30; category="dairy"; quantity=200 },
            @{ storeId=$storeId; name="Marinara Sauce"; unit="oz"; costPerUnit=0.20; supplier="SauceCo"; reorderThreshold=20; category="sauce"; quantity=200 }
        )

        $itemIds = @{}
        Write-Host "`nCreating ingredients..." -ForegroundColor Yellow
        foreach ($ing in $ingredients) {
            $result = Invoke-API "POST" "/ingredients" $token $ing
            $itemIds[$ing.name] = $result.itemId
            Write-Host "  + $($ing.name) => $($result.itemId)"
        }

        # Fetch all inventory to get itemIds (including existing ones)
        $allInventory = (Invoke-API "GET" "/stores/$storeId/inventory" $token).items
        $invMap = @{}
        $allInventory | ForEach-Object { $invMap[$_.name] = $_.itemId }

        Write-Host "`nInventory map built with $($invMap.Count) items" -ForegroundColor Cyan

        # Create recipes via POST /recipes
        # Recipe ingredients need: itemId, quantity, unit
        $recipes = @(
            @{
                name = "6-inch Chicken Sub"
                category = "sandwich"
                sellingPrice = 8.99
                ingredients = @(
                    @{ itemId = $invMap["Rotisserie Chicken"]; quantity = 3; unit = "oz" },
                    @{ itemId = $invMap["Italian Bread Roll"]; quantity = 1; unit = "roll" },
                    @{ itemId = $invMap["Lettuce"]; quantity = 1; unit = "oz" },
                    @{ itemId = $invMap["Tomato"]; quantity = 1; unit = "oz" }
                )
            },
            @{
                name = "Footlong Turkey Sub"
                category = "sandwich"
                sellingPrice = 12.99
                ingredients = @(
                    @{ itemId = $invMap["Turkey Breast"]; quantity = 6; unit = "oz" },
                    @{ itemId = $invMap["Wheat Bread Roll"]; quantity = 2; unit = "roll" },
                    @{ itemId = $invMap["Lettuce"]; quantity = 2; unit = "oz" },
                    @{ itemId = $invMap["Tomato"]; quantity = 2; unit = "oz" },
                    @{ itemId = $invMap["Provolone Cheese"]; quantity = 2; unit = "slice" }
                )
            },
            @{
                name = "Meatball Marinara"
                category = "sandwich"
                sellingPrice = 9.49
                ingredients = @(
                    @{ itemId = $invMap["Meatballs"]; quantity = 4; unit = "oz" },
                    @{ itemId = $invMap["Italian Bread Roll"]; quantity = 1; unit = "roll" },
                    @{ itemId = $invMap["Marinara Sauce"]; quantity = 2; unit = "oz" },
                    @{ itemId = $invMap["American Cheese"]; quantity = 2; unit = "slice" }
                )
            },
            @{
                name = "Tuna Sub"
                category = "sandwich"
                sellingPrice = 8.49
                ingredients = @(
                    @{ itemId = $invMap["Tuna"]; quantity = 3; unit = "oz" },
                    @{ itemId = $invMap["Flatbread"]; quantity = 1; unit = "piece" },
                    @{ itemId = $invMap["Lettuce"]; quantity = 1; unit = "oz" },
                    @{ itemId = $invMap["Tomato"]; quantity = 1; unit = "oz" }
                )
            },
            @{
                name = "Steak and Cheese"
                category = "sandwich"
                sellingPrice = 11.99
                ingredients = @(
                    @{ itemId = $invMap["Steak"]; quantity = 4; unit = "oz" },
                    @{ itemId = $invMap["Italian Bread Roll"]; quantity = 1; unit = "roll" },
                    @{ itemId = $invMap["American Cheese"]; quantity = 2; unit = "slice" },
                    @{ itemId = $invMap["Lettuce"]; quantity = 1; unit = "oz" }
                )
            }
        )

        Write-Host "`nCreating recipes..." -ForegroundColor Yellow
        $createdRecipes = @()
        foreach ($recipe in $recipes) {
            # Filter out ingredients with null itemId
            $validIngredients = $recipe.ingredients | Where-Object { $_.itemId -ne $null }
            if ($validIngredients.Count -ne $recipe.ingredients.Count) {
                Write-Host "  WARNING: Some ingredients missing for $($recipe.name) - skipping missing ones" -ForegroundColor Red
            }
            $recipe.ingredients = $validIngredients
            $result = Invoke-API "POST" "/recipes" $token $recipe
            Write-Host "  + $($recipe.name) => $($result.recipeId)"
            $createdRecipes += $result
        }

        Write-Host "`nDone! Created $($createdRecipes.Count) recipes." -ForegroundColor Green
        Write-Host "Run .\fw.ps1 load-transactions next." -ForegroundColor Cyan
    }

    "load-transactions" {
        Write-Host "Getting auth token..." -ForegroundColor Cyan
        $token = Get-Token
        $storeId = ((Invoke-API "GET" "/stores" $token).stores[0].storeId)
        $recipes = (Invoke-API "GET" "/recipes" $token).recipes

        if ($recipes.Count -eq 0) {
            Write-Host "No recipes found. Run setup-store first." -ForegroundColor Red
            exit
        }

        Write-Host "Loading 90 days of transactions for store $storeId" -ForegroundColor Yellow
        Write-Host "Using $($recipes.Count) recipes" -ForegroundColor Cyan

        $today = Get-Date

        # Day-of-week volume (0=Sun ... 6=Sat)
        $dayVolume = @{ 0=45; 1=38; 2=40; 3=42; 4=50; 5=65; 6=60 }

        # Recipe popularity weights (index = position in recipes array)
        # Chicken sub most popular, steak least
        $weights = @(35, 25, 20, 12, 8)

        $total = 0
        $errCount = 0

        for ($d = 89; $d -ge 0; $d--) {
            $date = $today.AddDays(-$d)
            $dow = [int]$date.DayOfWeek
            $txCount = $dayVolume[$dow] + (Get-Random -Minimum -5 -Maximum 10)

            for ($t = 0; $t -lt $txCount; $t++) {
                # Pick a recipe by weight
                $rand = Get-Random -Minimum 1 -Maximum 101
                $cumulative = 0
                $recipeIdx = [Math]::Min($recipes.Count - 1, 0)
                for ($w = 0; $w -lt [Math]::Min($weights.Count, $recipes.Count); $w++) {
                    $cumulative += $weights[$w]
                    if ($rand -le $cumulative) { $recipeIdx = $w; break }
                }

                $recipe = $recipes[$recipeIdx]
                $qty = if ((Get-Random -Minimum 1 -Maximum 10) -gt 8) { 2 } else { 1 }
                $price = [Math]::Round($recipe.sellingPrice * (1 + (Get-Random -Minimum -5 -Maximum 6) / 100.0), 2)

                $tx = @{
                    lineItems = @(
                        @{
                            recipeId = $recipe.recipeId
                            quantity = $qty
                            price = $price
                        }
                    )
                }

                try {
                    Invoke-API "POST" "/stores/$storeId/transactions" $token $tx | Out-Null
                    $total++
                } catch {
                    $errCount++
                    if ($errCount -le 3) { Write-Host "  Error: $_" -ForegroundColor Red }
                }
            }

            if ($d % 15 -eq 0) {
                Write-Host "  Day $([Math]::Abs($d - 89) + 1)/90 done — $total transactions loaded" -ForegroundColor Cyan
            }
        }

        Write-Host "`nDone! Loaded $total transactions ($errCount errors)." -ForegroundColor Green
        Write-Host "Run .\fw.ps1 run-forecast next." -ForegroundColor Cyan
    }

    "run-forecast" {
        Write-Host "Getting auth token..." -ForegroundColor Cyan
        $token = Get-Token
        $storeId = ((Invoke-API "GET" "/stores" $token).stores[0].storeId)

        Write-Host "Triggering AI forecast (this may take 30-60 seconds)..." -ForegroundColor Yellow
        $result = Invoke-API "POST" "/forecasts" $token @{ storeIds = @($storeId); leadTimeDays = 2 }
        $result | ConvertTo-Json -Depth 10
        Write-Host "`nForecast complete!" -ForegroundColor Green
    }

    default {
        Write-Host "FoodWise CLI Helper" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\fw.ps1 [command]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  check              Check current state (stores, inventory, recipes, dashboard)"
        Write-Host "  setup-store        Create ingredients + recipes for the Subway store"
        Write-Host "  load-transactions  Load 90 days of realistic test transactions"
        Write-Host "  run-forecast       Trigger the AI demand forecast"
    }
}
