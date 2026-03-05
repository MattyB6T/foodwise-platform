"""Purchase order generator based on demand forecasts and current inventory."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def generate_purchase_order(
    forecasts: dict[str, Any],
    recipes: list[dict[str, Any]],
    inventory: list[dict[str, Any]],
    lead_time_days: int = 2,
) -> list[dict[str, Any]]:
    """Compare forecasted demand against current inventory to generate a purchase order.

    Args:
        forecasts: Output from build_forecast(), keyed by store_id#recipe_id.
        recipes: List of recipe dicts, each with recipeId, ingredients[{itemId, quantity, unit}].
        inventory: List of inventory dicts, each with storeId, itemId, quantity, unit, name,
                   costPerUnit, supplier.
        lead_time_days: Days of lead time to account for (1-2, default 2).

    Returns:
        List of order line items: {storeId, itemId, itemName, currentStock, requiredQuantity,
        orderQuantity, unit, estimatedCost, supplier}.
    """
    lead_time_days = max(1, min(lead_time_days, 7))

    # Build recipe lookup: recipeId -> list of ingredients
    recipe_map: dict[str, list[dict[str, Any]]] = {}
    for recipe in recipes:
        recipe_map[recipe["recipeId"]] = recipe.get("ingredients", [])

    # Build inventory lookup: (storeId, itemId) -> inventory record
    inv_map: dict[str, dict[str, Any]] = {}
    for item in inventory:
        inv_key = f"{item['storeId']}#{item['itemId']}"
        inv_map[inv_key] = item

    # Calculate total ingredient demand over the forecast + lead time window
    # We forecast for 7 days, but we need to order enough to cover lead_time_days
    # beyond current stock
    ingredient_demand: dict[str, dict[str, Any]] = {}

    for key, data in forecasts.items():
        store_id = data["store_id"]
        recipe_id = data["recipe_id"]
        forecast_rows = data["forecast"]

        ingredients = recipe_map.get(recipe_id, [])
        if not ingredients:
            logger.warning("No recipe found for %s, skipping", recipe_id)
            continue

        # Sum predicted demand over the full forecast window + lead time buffer
        # Use upper bound for safety stock
        total_predicted = sum(
            row.get("upper_bound", row.get("predicted_quantity", 0))
            for row in forecast_rows[: 7 + lead_time_days]
        )

        for ing in ingredients:
            item_id = ing["itemId"]
            qty_per_unit = ing["quantity"]
            unit = ing["unit"]
            demand_key = f"{store_id}#{item_id}"

            total_ingredient_qty = total_predicted * qty_per_unit

            if demand_key in ingredient_demand:
                ingredient_demand[demand_key]["required"] += total_ingredient_qty
            else:
                inv_item = inv_map.get(demand_key, {})
                ingredient_demand[demand_key] = {
                    "storeId": store_id,
                    "itemId": item_id,
                    "itemName": inv_item.get("name", item_id),
                    "unit": unit,
                    "currentStock": inv_item.get("quantity", 0),
                    "costPerUnit": inv_item.get("costPerUnit", 0),
                    "supplier": inv_item.get("supplier", "unknown"),
                    "required": total_ingredient_qty,
                }

    # Generate order lines where demand exceeds current stock
    order_lines: list[dict[str, Any]] = []

    for demand_key, info in ingredient_demand.items():
        deficit = info["required"] - info["currentStock"]
        if deficit <= 0:
            continue

        # Round up to reasonable order quantity
        order_qty = round(deficit, 2)

        order_lines.append(
            {
                "storeId": info["storeId"],
                "itemId": info["itemId"],
                "itemName": info["itemName"],
                "currentStock": info["currentStock"],
                "requiredQuantity": round(info["required"], 2),
                "orderQuantity": order_qty,
                "unit": info["unit"],
                "estimatedCost": round(order_qty * info["costPerUnit"], 2),
                "supplier": info["supplier"],
            }
        )

    # Sort by estimated cost descending for prioritization
    order_lines.sort(key=lambda x: x["estimatedCost"], reverse=True)

    return order_lines
