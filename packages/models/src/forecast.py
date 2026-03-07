"""Demand forecasting service using Facebook Prophet."""

import logging
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from prophet import Prophet

logger = logging.getLogger(__name__)


def _get_seasonality_config(operator_type: str) -> dict[str, Any]:
    """Return Prophet seasonality settings based on operator type."""
    configs = {
        "qsr": {
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.05,
        },
        "cafe": {
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.03,  # more stable patterns
        },
        "bar": {
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.08,  # more volatile weekend patterns
        },
        "hybrid": {
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.05,
        },
        "restaurant": {
            "daily_seasonality": True,
            "weekly_seasonality": True,
            "changepoint_prior_scale": 0.05,
        },
    }
    return configs.get(operator_type, configs["qsr"])


def build_forecast(
    sales_data: list[dict[str, Any]],
    forecast_days: int = 7,
    operator_type: str = "qsr",
) -> dict[str, Any]:
    """Generate a demand forecast from historical daily sales data.

    Args:
        sales_data: List of dicts with keys: date, store_id, recipe_id, quantity_sold.
                    Must have at least 30 days of data.
        forecast_days: Number of days to forecast (default 7).
        operator_type: Type of food service operation (qsr, cafe, bar, hybrid, restaurant).

    Returns:
        Dict keyed by (store_id, recipe_id) with forecast rows.
    """
    if not sales_data:
        raise ValueError("sales_data must not be empty")

    df = pd.DataFrame(sales_data)
    required_cols = {"date", "store_id", "recipe_id", "quantity_sold"}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"sales_data must contain columns: {required_cols}")

    df["date"] = pd.to_datetime(df["date"])
    df["quantity_sold"] = pd.to_numeric(df["quantity_sold"])

    unique_days = df["date"].nunique()
    if unique_days < 30:
        raise ValueError(
            f"Need at least 30 days of data, got {unique_days}"
        )

    seasonality = _get_seasonality_config(operator_type)
    forecasts: dict[str, Any] = {}

    for (store_id, recipe_id), group in df.groupby(["store_id", "recipe_id"]):
        prophet_df = (
            group.groupby("date")["quantity_sold"]
            .sum()
            .reset_index()
            .rename(columns={"date": "ds", "quantity_sold": "y"})
        )

        # Skip items with very sparse data
        if len(prophet_df) < 10:
            logger.warning(
                "Skipping %s/%s: only %d data points",
                store_id,
                recipe_id,
                len(prophet_df),
            )
            continue

        model = Prophet(
            daily_seasonality=seasonality["daily_seasonality"],
            weekly_seasonality=seasonality["weekly_seasonality"],
            yearly_seasonality=False,
            changepoint_prior_scale=seasonality["changepoint_prior_scale"],
        )
        model.fit(prophet_df)

        future = model.make_future_dataframe(periods=forecast_days)
        prediction = model.predict(future)

        # Extract only the forecast period
        forecast_rows = prediction.tail(forecast_days)[
            ["ds", "yhat", "yhat_lower", "yhat_upper"]
        ].copy()

        forecast_rows["ds"] = forecast_rows["ds"].dt.strftime("%Y-%m-%d")
        # Clamp negatives to zero
        forecast_rows["yhat"] = forecast_rows["yhat"].clip(lower=0).round(2)
        forecast_rows["yhat_lower"] = (
            forecast_rows["yhat_lower"].clip(lower=0).round(2)
        )
        forecast_rows["yhat_upper"] = forecast_rows["yhat_upper"].clip(lower=0).round(2)

        key = f"{store_id}#{recipe_id}"
        forecasts[key] = {
            "store_id": store_id,
            "recipe_id": recipe_id,
            "forecast": forecast_rows.rename(
                columns={
                    "ds": "date",
                    "yhat": "predicted_quantity",
                    "yhat_lower": "lower_bound",
                    "yhat_upper": "upper_bound",
                }
            ).to_dict(orient="records"),
        }

    return forecasts


def forecast_to_dynamo_items(
    forecasts: dict[str, Any],
    forecast_id: str,
    generated_at: str,
) -> list[dict[str, Any]]:
    """Convert forecast results to DynamoDB items for storage.

    Args:
        forecasts: Output from build_forecast().
        forecast_id: Unique ID for this forecast run.
        generated_at: ISO timestamp of when the forecast was generated.

    Returns:
        List of DynamoDB items ready for batch write.
    """
    items = []
    for key, data in forecasts.items():
        items.append(
            {
                "forecastId": forecast_id,
                "storeRecipeKey": key,
                "storeId": data["store_id"],
                "recipeId": data["recipe_id"],
                "forecast": data["forecast"],
                "generatedAt": generated_at,
            }
        )
    return items
