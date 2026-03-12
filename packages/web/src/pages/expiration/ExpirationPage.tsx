import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { Tooltip } from "../../components/Tooltip";

const DAYS_OPTIONS = [3, 7, 14, 30] as const;

const STATUS_BADGE_MAP: Record<string, string> = {
  expired: "critical",
  critical: "warning",
  warning: "pending",
  ok: "green",
};

const ROW_TINT: Record<string, string> = {
  expired: "bg-red-50/60 dark:bg-red-950/20",
  critical: "bg-amber-50/60 dark:bg-amber-950/20",
  warning: "bg-yellow-50/60 dark:bg-yellow-950/20",
  ok: "",
};

export function ExpirationPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [daysAhead, setDaysAhead] = useState<number>(7);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  const alertsQuery = useQuery({
    queryKey: ["expiration-alerts", selectedStoreId, daysAhead],
    queryFn: () => api.getExpirationAlerts(selectedStoreId!, daysAhead),
    enabled: !!selectedStoreId,
  });

  const setExpirationMutation = useMutation({
    mutationFn: ({
      itemId,
      expirationDate,
    }: {
      itemId: string;
      expirationDate: string;
    }) =>
      api.setExpiration(selectedStoreId!, { itemId, expirationDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expiration-alerts", selectedStoreId],
      });
      setEditingItemId(null);
      setEditDate("");
    },
  });

  if (!selectedStoreId) {
    return <EmptyState title="Select a store to view expiration tracking." />;
  }

  if (alertsQuery.isLoading) {
    return <PageLoader />;
  }

  if (alertsQuery.isError) {
    return (
      <EmptyState title="Failed to load expiration data. Please try again." />
    );
  }

  const data = alertsQuery.data;
  const summary = data?.summary;
  const items = data?.items ?? [];

  function handleEditClick(itemId: string, currentDate?: string) {
    setEditingItemId(itemId);
    setEditDate(currentDate ?? "");
  }

  function handleSave(itemId: string) {
    if (!editDate) return;
    setExpirationMutation.mutate({ itemId, expirationDate: editDate });
  }

  function handleCancel() {
    setEditingItemId(null);
    setEditDate("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Expiration Tracking
        </h1>
        <select
          value={daysAhead}
          onChange={(e) => setDaysAhead(Number(e.target.value))}
          className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Next {d} days
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 rounded-xl border shadow-sm p-4">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Expired <Tooltip content="Items past their expiration date. These should be discarded immediately for food safety." />
          </p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
            {summary?.expired ?? 0}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 rounded-xl border shadow-sm p-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Critical <Tooltip content="Expiring within 2 days. Use these first (FIFO) or consider discounting/repurposing." />
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {summary?.critical ?? 0}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 rounded-xl border shadow-sm p-4">
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            Warning <Tooltip content="Expiring within 3-7 days. Plan to use these in upcoming prep or specials." />
          </p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">
            {summary?.warning ?? 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Total
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary?.total ?? 0}
          </p>
        </div>
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <EmptyState title="No expiration alerts for the selected time range." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Quantity
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Expiration Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Days Left
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((item: any) => (
                  <tr key={item.itemId} className={ROW_TINT[item.status] ?? ""}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {item.category}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {editingItemId === item.itemId ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        item.expirationDate
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {item.daysUntilExpiry < 0
                        ? `${Math.abs(item.daysUntilExpiry)}d overdue`
                        : `${item.daysUntilExpiry}d`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={item.status === "expired" ? "critical" : item.status === "critical" ? "warning" : item.status === "warning" ? "pending" : "green"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingItemId === item.itemId ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSave(item.itemId)}
                            disabled={
                              !editDate || setExpirationMutation.isPending
                            }
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {setExpirationMutation.isPending
                              ? "Saving..."
                              : "Save"}
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleEditClick(item.itemId, item.expirationDate)
                          }
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                        >
                          Set Expiration
                        </button>
                      )}
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
