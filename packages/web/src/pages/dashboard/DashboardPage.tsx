import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { MetricCard } from "../../components/MetricCard";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";

export function DashboardPage() {
  const { selectedStoreId, selectedStoreName, stores } = useStore();

  const { data: ownerDash, isLoading: ownerLoading } = useQuery({
    queryKey: ["ownerDashboard"],
    queryFn: () => api.getOwnerDashboard(),
  });

  const { data: healthScore, isLoading: healthLoading } = useQuery({
    queryKey: ["healthScore", selectedStoreId],
    queryFn: () => api.getHealthScore(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  if (ownerLoading || healthLoading) return <PageLoader />;

  const lowStockItems = (inventory?.items || []).filter(
    (i: any) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
  );

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {stores.length > 1 ? `Overview across ${stores.length} locations` : selectedStoreName}
        </p>
      </div>

      {/* Owner dashboard cards (multi-store) */}
      {ownerDash && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Stores"
            value={ownerDash.storeCount || stores.length}
            subtitle="Active locations"
          />
          <MetricCard
            title="Avg Health Score"
            value={ownerDash.totals?.avgHealthScore || healthScore?.overallScore || "--"}
            status={
              (ownerDash.totals?.avgHealthScore || healthScore?.overallScore || 0) >= 75
                ? "green" : (ownerDash.totals?.avgHealthScore || healthScore?.overallScore || 0) >= 50
                ? "yellow" : "red"
            }
          />
          <MetricCard
            title="Food Cost"
            value={`${healthScore?.details?.foodCostPercentage || ownerDash.totals?.avgFoodCostPercentage || "--"}%`}
            status={
              (healthScore?.details?.foodCostPercentage || 0) > 35 ? "red"
              : (healthScore?.details?.foodCostPercentage || 0) > 30 ? "yellow" : "green"
            }
          />
          <MetricCard
            title="Waste Rate"
            value={`${healthScore?.details?.wastePercentage || ownerDash.totals?.totalWasteCost || "--"}%`}
            status={
              (healthScore?.details?.wastePercentage || 0) > 7 ? "red"
              : (healthScore?.details?.wastePercentage || 0) > 4 ? "yellow" : "green"
            }
          />
        </div>
      )}

      {/* Health score breakdown */}
      {healthScore && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Health Score Breakdown</h2>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{healthScore.overallScore}</span>
              <StatusBadge status={healthScore.status} />
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { label: "Food Cost", value: healthScore.components?.foodCostScore },
              { label: "Waste", value: healthScore.components?.wasteScore },
              { label: "Forecast Accuracy", value: healthScore.components?.forecastAccuracyScore },
              { label: "Inventory Turnover", value: healthScore.components?.inventoryTurnoverScore },
              { label: "Stockouts", value: healthScore.components?.stockoutScore },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{item.value ?? "--"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendations */}
        {healthScore?.recommendations?.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recommendations</h2>
            </div>
            <div className="p-4 space-y-3">
              {healthScore.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low stock alerts */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Low Stock Alerts</h2>
            {lowStockItems.length > 0 && (
              <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            )}
          </div>
          <div className="p-4">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">All stock levels are healthy</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.slice(0, 8).map((item: any) => (
                  <div key={item.itemId} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{item.quantity} {item.unit}</p>
                      <p className="text-xs text-slate-400">min: {item.lowStockThreshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-store comparison if multiple stores */}
      {stores.length > 1 && ownerDash?.stores && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-6 transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Store Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Store</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Health Score</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Food Cost %</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Waste %</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {ownerDash.stores.map((store: any) => (
                  <tr key={store.storeId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{store.storeName}</td>
                    <td className="px-6 py-3 text-sm text-right font-bold text-slate-900 dark:text-slate-100">{store.healthScore ?? "--"}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-700 dark:text-slate-300">{store.foodCostPercentage ?? "--"}%</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-700 dark:text-slate-300">{store.wastePercentage ?? "--"}%</td>
                    <td className="px-6 py-3 text-center">
                      <StatusBadge status={store.healthStatus || "active"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
