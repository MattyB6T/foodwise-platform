import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { MetricCard } from "../../components/MetricCard";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { fullDate, currencyDollars } from "../../utils/format";
import { Tooltip, HelpLabel } from "../../components/Tooltip";
import { downloadCSV } from "../../utils/csvExport";

export function WastePage() {
  const { selectedStoreId } = useStore();
  const [days, setDays] = useState(30);

  const { data: waste, isLoading } = useQuery({
    queryKey: ["waste", selectedStoreId, days],
    queryFn: () => {
      const start = new Date();
      start.setDate(start.getDate() - days);
      return api.getWaste(selectedStoreId!, start.toISOString().split("T")[0]);
    },
    enabled: !!selectedStoreId,
  });

  const { data: analytics } = useQuery({
    queryKey: ["wasteAnalytics", selectedStoreId, days],
    queryFn: () => api.getWasteAnalytics(selectedStoreId!, days),
    enabled: !!selectedStoreId,
  });

  if (isLoading) return <PageLoader />;

  const logs: any[] = waste?.wasteLogs || waste?.logs || [];
  const totalCost = logs.reduce((sum: number, w: any) => sum + (w.estimatedCost || w.cost || 0), 0);

  // Group by reason
  const byReason: Record<string, number> = {};
  logs.forEach((w: any) => {
    const reason = w.reason || "Other";
    byReason[reason] = (byReason[reason] || 0) + 1;
  });
  const sortedReasons = Object.entries(byReason).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Waste Log</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{logs.length} entries in the last {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCSV(
              "waste-log.csv",
              ["Date", "Item", "Quantity", "Unit", "Reason", "Estimated Cost"],
              logs.map((w: any) => [w.timestamp || w.createdAt, w.ingredientName || w.itemName || "", w.quantity, w.unit || "", w.reason, w.estimatedCost || w.cost || 0])
            )}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export CSV
          </button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-slate-100"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Entries" value={logs.length} />
        <MetricCard title="Estimated Cost" value={currencyDollars(totalCost)} status={totalCost > 500 ? "red" : totalCost > 200 ? "yellow" : "green"} />
        <MetricCard title="Top Reason" value={sortedReasons[0]?.[0] || "--"} subtitle={`${sortedReasons[0]?.[1] || 0} entries`} />
        <MetricCard
          title="Waste Rate"
          value={analytics?.wastePercentage ? `${analytics.wastePercentage}%` : "--"}
          status={
            (analytics?.wastePercentage || 0) > 7 ? "red"
            : (analytics?.wastePercentage || 0) > 4 ? "yellow" : "green"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waste by reason */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-slate-100"><HelpLabel label="By Reason" tooltip="Breakdown by why food was wasted. 'Expired' and 'over-prepared' are avoidable — focus on reducing these first." /></h2>
          </div>
          <div className="p-4 space-y-2">
            {sortedReasons.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between p-2">
                <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${(count / logs.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Waste log table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Recent Entries</h2>
          </div>
          {logs.length === 0 ? (
            <EmptyState title="No waste entries" description="No waste has been logged in this period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((entry: any, i: number) => (
                    <tr key={entry.wasteId || i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{fullDate(entry.timestamp || entry.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{entry.ingredientName || entry.itemName || "--"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{entry.quantity} {entry.unit}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 capitalize">{entry.reason}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                        {currencyDollars(entry.estimatedCost || entry.cost || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
