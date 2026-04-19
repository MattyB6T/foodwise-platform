import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { MetricCard } from "../../components/MetricCard";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { fullDate, currencyDollars } from "../../utils/format";
import { HelpLabel } from "../../components/Tooltip";
import { downloadCSV } from "../../utils/csvExport";

type SortField = "date" | "item" | "quantity" | "reason" | "cost";
type SortDir = "asc" | "desc";

export function WastePage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [reasonFilter, setReasonFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showLogForm, setShowLogForm] = useState(false);

  // Manual entry form
  const [logForm, setLogForm] = useState({ ingredientId: "", quantity: "", reason: "expired", notes: "" });

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

  const { data: inventory } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId && showLogForm,
  });

  const logMutation = useMutation({
    mutationFn: (body: { ingredientId: string; quantity: number; reason: string; notes?: string }) =>
      api.recordWaste(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waste", selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ["wasteAnalytics", selectedStoreId] });
      setShowLogForm(false);
      setLogForm({ ingredientId: "", quantity: "", reason: "expired", notes: "" });
    },
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
  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...logs];
    if (reasonFilter !== "All") result = result.filter((w: any) => (w.reason || "Other") === reasonFilter);
    result.sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "date": aVal = a.timestamp || a.createdAt || ""; bVal = b.timestamp || b.createdAt || ""; break;
        case "item": aVal = a.ingredientName || a.itemName || ""; bVal = b.ingredientName || b.itemName || ""; break;
        case "quantity": aVal = a.quantity || 0; bVal = b.quantity || 0; break;
        case "reason": aVal = a.reason || ""; bVal = b.reason || ""; break;
        case "cost": aVal = a.estimatedCost || a.cost || 0; bVal = b.estimatedCost || b.cost || 0; break;
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [logs, reasonFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  };

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none`}
      onClick={() => toggleSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {sortField === field && (
          <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14l5-5 5 5z" />
          </svg>
        )}
      </div>
    </th>
  );

  const handleLogWaste = () => {
    if (!logForm.ingredientId || !logForm.quantity) return;
    logMutation.mutate({
      ingredientId: logForm.ingredientId,
      quantity: Number(logForm.quantity),
      reason: logForm.reason,
      notes: logForm.notes || undefined,
    });
  };

  const inputClass = "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500";
  const items: any[] = inventory?.items || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Waste Log</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{logs.length} entries in the last {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showLogForm ? "Cancel" : "Log Waste"}
          </button>
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
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year (YTD)</option>
          </select>
        </div>
      </div>

      {/* Log Waste Form */}
      {showLogForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Log Waste Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Item *</label>
              <select
                value={logForm.ingredientId}
                onChange={(e) => setLogForm({ ...logForm, ingredientId: e.target.value })}
                className={`${inputClass} w-full`}
              >
                <option value="">Select item...</option>
                {items.map((item: any) => (
                  <option key={item.itemId} value={item.itemId}>{item.name} ({item.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.1"
                value={logForm.quantity}
                onChange={(e) => setLogForm({ ...logForm, quantity: e.target.value })}
                placeholder="e.g. 5"
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Reason</label>
              <select
                value={logForm.reason}
                onChange={(e) => setLogForm({ ...logForm, reason: e.target.value })}
                className={`${inputClass} w-full`}
              >
                <option value="expired">Expired</option>
                <option value="over-prepared">Over-prepared</option>
                <option value="spoiled">Spoiled</option>
                <option value="dropped">Dropped</option>
                <option value="contaminated">Contaminated</option>
                <option value="customer-return">Customer Return</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Notes</label>
              <input
                type="text"
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                placeholder="Optional"
                className={`${inputClass} w-full`}
              />
            </div>
            <button
              onClick={handleLogWaste}
              disabled={!logForm.ingredientId || !logForm.quantity || logMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {logMutation.isPending ? "Saving..." : "Log Waste"}
            </button>
          </div>
          {logMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3">
              {(logMutation.error as Error)?.message || "Failed to log waste"}
            </p>
          )}
        </div>
      )}

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
              <div
                key={reason}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${reasonFilter === reason ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}
                onClick={() => setReasonFilter(reasonFilter === reason ? "All" : reason)}
              >
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
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">
              {reasonFilter !== "All" ? `Entries: ${reasonFilter}` : "Recent Entries"}
            </h2>
            {reasonFilter !== "All" && (
              <button onClick={() => setReasonFilter("All")} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Clear filter</button>
            )}
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No waste entries" description={reasonFilter !== "All" ? `No "${reasonFilter}" entries in this period.` : "No waste has been logged in this period."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <SortHeader field="date" label="Date" />
                    <SortHeader field="item" label="Item" />
                    <SortHeader field="quantity" label="Qty" />
                    <SortHeader field="reason" label="Reason" />
                    <SortHeader field="cost" label="Cost" align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((entry: any, i: number) => (
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
