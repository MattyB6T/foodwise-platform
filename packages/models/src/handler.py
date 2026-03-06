"""Lambda handler for demand forecasting service.

Triggered by:
- EventBridge schedule (nightly at 2 AM UTC)
- On-demand via API Gateway POST /forecasts
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from .forecast import build_forecast, forecast_to_dynamo_items
from .purchase_orders import generate_purchase_order

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

TRANSACTIONS_TABLE = os.environ.get("TRANSACTIONS_TABLE", "transactions")
INVENTORY_TABLE = os.environ.get("INVENTORY_TABLE", "inventory")
RECIPES_TABLE = os.environ.get("RECIPES_TABLE", "recipes")
FORECASTS_TABLE = os.environ.get("FORECASTS_TABLE", "forecasts")
STORES_TABLE = os.environ.get("STORES_TABLE", "stores")


class DecimalEncoder(json.JSONEncoder):
    """Handle Decimal types from DynamoDB."""

    def default(self, o: Any) -> Any:
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def _json_response(status_code: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def _fetch_sales_data(store_id: str, days: int = 90) -> list[dict[str, Any]]:
    """Fetch transaction data for a store from the last N days."""
    table = dynamodb.Table(TRANSACTIONS_TABLE)
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    query_kwargs = {
        "IndexName": "timestamp-index",
        "KeyConditionExpression": Key("storeId").eq(store_id)
        & Key("timestamp").gte(since),
    }

    sales: list[dict[str, Any]] = []
    while True:
        response = table.query(**query_kwargs)
        for tx in response.get("Items", []):
            tx_date = tx["timestamp"][:10]  # YYYY-MM-DD
            for line_item in tx.get("lineItems", []):
                sales.append(
                    {
                        "date": tx_date,
                        "store_id": store_id,
                        "recipe_id": line_item["recipeId"],
                        "quantity_sold": float(line_item["quantity"]),
                    }
                )
        if "LastEvaluatedKey" not in response:
            break
        query_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return sales


def _fetch_all_store_ids() -> list[str]:
    """Scan the stores table to get all store IDs."""
    table = dynamodb.Table(STORES_TABLE)
    response = table.scan(ProjectionExpression="storeId")
    return [item["storeId"] for item in response.get("Items", [])]


def _fetch_recipes() -> list[dict[str, Any]]:
    """Fetch all recipes."""
    table = dynamodb.Table(RECIPES_TABLE)
    response = table.scan()
    return response.get("Items", [])


def _fetch_inventory(store_id: str) -> list[dict[str, Any]]:
    """Fetch all inventory for a store."""
    table = dynamodb.Table(INVENTORY_TABLE)
    response = table.query(
        KeyConditionExpression=Key("storeId").eq(store_id),
    )
    return response.get("Items", [])


def _store_forecast(items: list[dict[str, Any]]) -> None:
    """Batch write forecast items to DynamoDB."""
    table = dynamodb.Table(FORECASTS_TABLE)
    with table.batch_writer() as batch:
        for item in items:
            # Convert floats to Decimal for DynamoDB
            batch.put_item(Item=json.loads(json.dumps(item), parse_float=Decimal))


def _run_forecast(
    store_ids: list[str] | None = None,
    lead_time_days: int = 2,
) -> dict[str, Any]:
    """Run the full forecast pipeline for given stores (or all stores)."""
    if store_ids is None:
        store_ids = _fetch_all_store_ids()

    if not store_ids:
        return {"message": "No stores found", "forecasts": {}, "purchaseOrders": []}

    forecast_id = str(uuid.uuid4())
    generated_at = datetime.utcnow().isoformat() + "Z"
    recipes = _fetch_recipes()

    all_forecasts: dict[str, Any] = {}
    all_purchase_orders: list[dict[str, Any]] = []

    for store_id in store_ids:
        logger.info("Processing store: %s", store_id)

        try:
            sales_data = _fetch_sales_data(store_id)
            if not sales_data:
                logger.warning("No sales data for store %s, skipping", store_id)
                continue

            forecasts = build_forecast(sales_data)
            all_forecasts.update(forecasts)

            # Generate purchase orders
            inventory = _fetch_inventory(store_id)
            purchase_orders = generate_purchase_order(
                forecasts, recipes, inventory, lead_time_days
            )
            all_purchase_orders.extend(purchase_orders)

        except ValueError as e:
            logger.warning("Skipping store %s: %s", store_id, str(e))
            continue
        except Exception:
            logger.exception("Error forecasting store %s", store_id)
            continue

    # Store forecasts in DynamoDB
    if all_forecasts:
        dynamo_items = forecast_to_dynamo_items(
            all_forecasts, forecast_id, generated_at
        )
        _store_forecast(dynamo_items)

    return {
        "forecastId": forecast_id,
        "generatedAt": generated_at,
        "storesProcessed": len(store_ids),
        "forecastCount": len(all_forecasts),
        "purchaseOrders": all_purchase_orders,
    }


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda entry point. Handles both scheduled and API triggers."""
    logger.info("Event: %s", json.dumps(event, default=str))

    # Determine if this is an API Gateway request or EventBridge schedule
    is_api = "httpMethod" in event or "requestContext" in event

    try:
        if is_api:
            # On-demand API trigger
            body = {}
            if event.get("body"):
                body = json.loads(event["body"])

            store_ids = body.get("storeIds")
            lead_time_days = body.get("leadTimeDays", 2)

            result = _run_forecast(store_ids, lead_time_days)
            return _json_response(200, result)

        else:
            # EventBridge scheduled trigger
            result = _run_forecast()
            logger.info(
                "Scheduled forecast complete: %d forecasts, %d purchase order lines",
                result["forecastCount"],
                len(result["purchaseOrders"]),
            )
            return result

    except Exception:
        logger.exception("Forecast handler error")
        if is_api:
            return _json_response(500, {"message": "Internal server error"})
        raise
