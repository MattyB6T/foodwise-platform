import { QueryCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";

// Weekly accuracy Lambda — compares last week's forecasts against actual POS transactions
export const handler = async (): Promise<void> => {
  console.log("Forecast accuracy check started");

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get all stores
  const stores = await docClient.send(
    new ScanCommand({
      TableName: TABLES.STORES,
      ProjectionExpression: "storeId",
    })
  );

  for (const store of stores.Items || []) {
    const storeId = store.storeId;

    try {
      // Get forecasts that were made for last week
      const forecasts = await docClient.send(
        new QueryCommand({
          TableName: TABLES.FORECASTS,
          IndexName: "storeId-date-index",
          KeyConditionExpression: "storeId = :sid AND forecastDate BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":sid": storeId,
            ":start": oneWeekAgo.toISOString().split("T")[0],
            ":end": now.toISOString().split("T")[0],
          },
        }).catch(() => ({ Items: [] })) as any
      );

      // Get actual transactions for that period
      const transactions = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TRANSACTIONS,
          IndexName: "timestamp-index",
          KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
          ExpressionAttributeNames: { "#ts": "timestamp" },
          ExpressionAttributeValues: {
            ":sid": storeId,
            ":start": oneWeekAgo.toISOString(),
            ":end": now.toISOString(),
          },
        })
      );

      // Calculate actual daily totals
      const actualDailyTotals = new Map<string, number>();
      for (const txn of transactions.Items || []) {
        const date = (txn.timestamp as string).split("T")[0];
        actualDailyTotals.set(date, (actualDailyTotals.get(date) || 0) + (txn.total || 0));
      }

      // Compare forecast vs actual
      let totalForecasted = 0;
      let totalActual = 0;
      let daysCompared = 0;

      for (const forecast of (forecasts as any).Items || []) {
        const forecastDate = forecast.forecastDate;
        const predicted = forecast.predictedRevenue || forecast.predictedValue || 0;
        const actual = actualDailyTotals.get(forecastDate) || 0;

        totalForecasted += predicted;
        totalActual += actual;
        if (actual > 0) daysCompared++;
      }

      const mape =
        totalActual > 0
          ? Math.abs(totalForecasted - totalActual) / totalActual
          : null;

      const accuracyPct = mape !== null ? Math.max(0, (1 - mape) * 100) : null;

      // Store accuracy record
      await docClient.send(
        new PutCommand({
          TableName: TABLES.FORECAST_ACCURACY,
          Item: {
            accuracyId: uuidv4(),
            storeId,
            weekStart: oneWeekAgo.toISOString().split("T")[0],
            weekEnd: now.toISOString().split("T")[0],
            totalForecasted,
            totalActual,
            mape: mape !== null ? Math.round(mape * 10000) / 10000 : null,
            accuracyPct: accuracyPct !== null ? Math.round(accuracyPct * 100) / 100 : null,
            daysCompared,
            transactionCount: (transactions.Items || []).length,
            calculatedAt: now.toISOString(),
            needsRetraining: accuracyPct !== null && accuracyPct < 70,
          },
        })
      );

      console.log(
        `Store ${storeId}: accuracy=${accuracyPct?.toFixed(1)}%, ` +
          `forecast=${totalForecasted.toFixed(2)}, actual=${totalActual.toFixed(2)}, ` +
          `MAPE=${mape?.toFixed(4)}, days=${daysCompared}`
      );

      // If accuracy is below threshold, flag for retraining
      if (accuracyPct !== null && accuracyPct < 70) {
        console.warn(`Store ${storeId} needs forecast retraining (accuracy: ${accuracyPct.toFixed(1)}%)`);
      }
    } catch (err) {
      console.error(`Forecast accuracy check failed for store ${storeId}:`, err);
    }
  }

  console.log("Forecast accuracy check complete");
};
