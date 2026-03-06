import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { OwnerDashboard } from "@foodwise/shared";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { getAllStores, getStoreSnapshot } from "../utils/storeMetrics";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const stores = await getAllStores();

    if (stores.length === 0) {
      return success({
        storeCount: 0,
        stores: [],
        totals: {
          totalSales: 0,
          avgFoodCostPercentage: 0,
          totalWasteCost: 0,
          avgHealthScore: 0,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // Fetch snapshots for all stores in parallel
    const snapshots = await Promise.all(stores.map(getStoreSnapshot));

    const totalSales = snapshots.reduce((s, snap) => s + snap.salesLast30d, 0);
    const avgFoodCost =
      snapshots.reduce((s, snap) => s + snap.foodCostPercentage, 0) /
      snapshots.length;
    const totalWasteCost = snapshots.reduce(
      (s, snap) => s + (snap.salesLast30d * snap.wastePercentage) / 100,
      0
    );
    const avgHealthScore =
      snapshots.reduce((s, snap) => s + snap.healthScore, 0) / snapshots.length;

    const dashboard: OwnerDashboard = {
      storeCount: stores.length,
      stores: snapshots,
      totals: {
        totalSales: Math.round(totalSales * 100) / 100,
        avgFoodCostPercentage: Math.round(avgFoodCost * 100) / 100,
        totalWasteCost: Math.round(totalWasteCost * 100) / 100,
        avgHealthScore: Math.round(avgHealthScore),
      },
      generatedAt: new Date().toISOString(),
    };

    return success(dashboard);
  } catch (err) {
    console.error("GetOwnerDashboard error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
