import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { Tooltip, HelpLabel } from "../../components/Tooltip";

export function CountsPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [expandedCountId, setExpandedCountId] = useState<string | null>(null);
  const [showNewCountForm, setShowNewCountForm] = useState(false);
  const [newCountNotes, setNewCountNotes] = useState("");

  const {
    data: countsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["counts", selectedStoreId],
    queryFn: () => api.listCounts(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const {
    data: varianceData,
    isLoading: isVarianceLoading,
  } = useQuery({
    queryKey: ["countVariance", selectedStoreId, expandedCountId],
    queryFn: () => api.getCountVariance(selectedStoreId!, expandedCountId!),
    enabled: !!selectedStoreId && !!expandedCountId,
  });

  const createCountMutation = useMutation({
    mutationFn: (notes: string) =>
      api.createCount(selectedStoreId!, { notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counts", selectedStoreId] });
      setShowNewCountForm(false);
      setNewCountNotes("");
    },
  });

  const handleToggleExpand = (countId: string) => {
    setExpandedCountId((prev) => (prev === countId ? null : countId));
  };

  const handleCreateCount = (e: React.FormEvent) => {
    e.preventDefault();
    createCountMutation.mutate(newCountNotes);
  };

  if (isLoading) return <PageLoader />;

  const counts = countsData?.counts ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Inventory Counts
        </h1>
        <button
          onClick={() => setShowNewCountForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          Start New Count
        </button>
      </div>

      {/* New Count Form */}
      {showNewCountForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            New Count Session <Tooltip content="A count session snapshots your current system inventory, then lets you enter actual quantities. Compare the two to find discrepancies." />
          </h2>
          <form onSubmit={handleCreateCount} className="space-y-4">
            <div>
              <label
                htmlFor="count-notes"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Notes (optional)
              </label>
              <input
                id="count-notes"
                type="text"
                value={newCountNotes}
                onChange={(e) => setNewCountNotes(e.target.value)}
                placeholder="e.g. Weekly walk-in count"
                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createCountMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createCountMutation.isPending ? "Creating..." : "Create Count"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewCountForm(false);
                  setNewCountNotes("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Cancel
              </button>
            </div>
            {createCountMutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to create count. Please try again.
              </p>
            )}
          </form>
        </div>
      )}

      {/* Counts Table */}
      {isError ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load counts. Please try again.
          </p>
        </div>
      ) : counts.length === 0 ? (
        <EmptyState
          title="No inventory counts yet"
          description="Start a new count session to begin tracking inventory."
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Items Counted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Discrepancies <Tooltip content="Items where your physical count doesn't match the system quantity. This can indicate theft, spoilage, or receiving errors." />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {counts.map((count: any) => (
                <CountRow
                  key={count.countId}
                  count={count}
                  isExpanded={expandedCountId === count.countId}
                  onToggle={() => handleToggleExpand(count.countId)}
                  varianceData={
                    expandedCountId === count.countId ? varianceData : undefined
                  }
                  isVarianceLoading={
                    expandedCountId === count.countId && isVarianceLoading
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CountRow({
  count,
  isExpanded,
  onToggle,
  varianceData,
  isVarianceLoading,
}: {
  count: any;
  isExpanded: boolean;
  onToggle: () => void;
  varianceData: any;
  isVarianceLoading: boolean;
}) {
  const formattedDate = new Date(count.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
          {formattedDate}
        </td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge
            status={count.status === "completed" ? "approved" : "warning"}
          />
        </td>
        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
          {count.completedItems ?? 0}
          <span className="text-slate-500 dark:text-slate-400">
            {" "}
            / {count.totalItems ?? 0}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {count.discrepancyCount > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {count.discrepancyCount}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">0</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {count.createdBy ?? "-"}
        </td>
        <td className="px-4 py-3 text-sm">
          <button
            onClick={onToggle}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td
            colSpan={6}
            className="px-4 py-4 bg-slate-50/50 dark:bg-slate-700/20"
          >
            {isVarianceLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading variance details...
              </p>
            ) : varianceData ? (
              <VarianceDetails data={varianceData} />
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

function VarianceDetails({ data }: { data: any }) {
  const { summary, discrepancies } = data;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Items"
          value={summary.totalItems}
        />
        <SummaryCard
          label="Completed"
          value={summary.completedItems}
        />
        <SummaryCard
          label="Expected Qty"
          value={summary.totalExpectedQuantity}
        />
        <SummaryCard
          label="Actual Qty"
          value={summary.totalActualQuantity}
        />
      </div>

      {/* Overall Variance */}
      {summary.overallVariance != null && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Overall variance:{" "}
          <span
            className={
              summary.overallVariance === 0
                ? "text-green-600 dark:text-green-400 font-medium"
                : "text-amber-600 dark:text-amber-400 font-medium"
            }
          >
            {summary.overallVariance > 0 ? "+" : ""}
            {summary.overallVariance}
          </span>
        </p>
      )}

      {/* Discrepancies */}
      {discrepancies && discrepancies.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Discrepancies ({discrepancies.length})
          </h4>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Expected
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {discrepancies.map((d: any, i: number) => (
                  <tr key={d.itemId ?? i}>
                    <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                      {d.itemName ?? d.itemId}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {d.expectedQuantity}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {d.actualQuantity}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={
                          d.variance < 0
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-amber-600 dark:text-amber-400 font-medium"
                        }
                      >
                        {d.variance > 0 ? "+" : ""}
                        {d.variance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-green-600 dark:text-green-400">
          No discrepancies found.
        </p>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {value ?? 0}
      </p>
    </div>
  );
}
