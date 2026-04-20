import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { Tooltip } from "../../components/Tooltip";

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function ForecastPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const { data: prepData, isLoading } = useQuery({
    queryKey: ["prepLists", selectedStoreId, date],
    queryFn: () => api.getPrepLists(selectedStoreId!, date),
    enabled: !!selectedStoreId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generatePrepList(selectedStoreId!, { action: "generate", date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prepLists", selectedStoreId, date] });
    },
  });

  if (isLoading) return <PageLoader />;

  const prepLists: any[] = prepData?.prepLists || [];
  const currentList = prepLists[0];
  const items: any[] = currentList?.items || [];

  const totalItems = items.length;
  const completedItems = items.filter((i: any) => i.completed).length;
  const isToday = date === new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Forecast & Prep</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            AI-powered demand forecasting and prep lists{" "}
            <Tooltip content="Forecasts are generated from your sales history using machine learning. The more transaction data you have, the more accurate predictions become." />
          </p>
        </div>
        {!currentList && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !selectedStoreId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            {generateMutation.isPending ? "Generating..." : "Generate Prep List"}
          </button>
        )}
      </div>

      {/* Date Navigator */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-6 transition-colors">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setDate(shiftDate(date, -1)); setExpandedIdx(null); }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatDate(date)}</p>
            {!isToday && (
              <button
                onClick={() => { setDate(new Date().toISOString().split("T")[0]); setExpandedIdx(null); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-0.5"
              >
                Back to today
              </button>
            )}
          </div>
          <button
            onClick={() => { setDate(shiftDate(date, 1)); setExpandedIdx(null); }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {currentList && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Items</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalItems}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Completed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedItems}/{totalItems}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Progress</p>
            <div className="mt-2">
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}%
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status</p>
            <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
              currentList.status === "completed"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                : currentList.status === "in_progress"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
            }`}>
              {currentList.status === "in_progress" ? "In Progress" : currentList.status || "Pending"}
            </span>
          </div>
        </div>
      )}

      {/* Prep List */}
      {!currentList ? (
        <EmptyState
          title={`No prep list for ${formatDate(date)}`}
          description="Generate a prep list based on your recipe forecasts and current inventory levels."
          action={{
            label: generateMutation.isPending ? "Generating..." : "Generate Prep List",
            onClick: () => generateMutation.mutate(),
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState title="Empty prep list" description="No items were generated for this date. This usually means no recipes or forecasts are available." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Prep Items</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click a row to see ingredient details</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th className="w-8 px-4 py-2"></th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Recipe</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Est. Servings</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ingredients</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const isExpanded = expandedIdx === idx;
                const ingredients: any[] = item.ingredients || [];
                const shortages = ingredients.filter((ing: any) => ing.quantityNeeded > ing.quantityOnHand);
                return (
                  <tr key={idx} className="border-b border-slate-50 dark:border-slate-700/50">
                    <td colSpan={5} className="p-0">
                      <div
                        className="grid hover:bg-slate-50/50 dark:hover:bg-slate-700/30 cursor-pointer"
                        style={{ gridTemplateColumns: "2rem 1fr 8rem 8rem 6rem" }}
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      >
                        <div className="px-4 py-3 flex items-center">
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l8 7-8 7z" /></svg>
                        </div>
                        <div className="px-4 py-3">
                          <p className={`text-sm font-semibold ${item.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-slate-100"}`}>
                            {item.recipeName}
                          </p>
                        </div>
                        <div className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">{item.estimatedServings ?? "--"}</div>
                        <div className="px-4 py-3 text-sm text-right">
                          <span className="text-slate-600 dark:text-slate-300">{ingredients.length}</span>
                          {shortages.length > 0 && (
                            <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">({shortages.length} short)</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-center">
                          {item.completed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                              Done
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Pending</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && ingredients.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-700/20 px-6 py-4 border-t border-slate-100 dark:border-slate-700/50">
                          <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
                            <span>Ingredient</span><span className="text-right">Needed</span><span className="text-right">On Hand</span><span>Unit</span><span>Status</span>
                          </div>
                          {ingredients.map((ing: any, j: number) => {
                            const short = ing.quantityNeeded > ing.quantityOnHand;
                            return (
                              <div key={j} className="grid grid-cols-5 gap-2 text-sm py-1.5 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                                <span className="text-slate-900 dark:text-slate-100">{ing.name || ing.itemId}</span>
                                <span className="text-right text-slate-600 dark:text-slate-300">{ing.quantityNeeded?.toFixed(1) ?? "--"}</span>
                                <span className="text-right text-slate-600 dark:text-slate-300">{ing.quantityOnHand?.toFixed(1) ?? "--"}</span>
                                <span className="text-slate-500 dark:text-slate-400">{ing.unit || "--"}</span>
                                <span>
                                  {short ? (
                                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                      Short {(ing.quantityNeeded - ing.quantityOnHand).toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">OK</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
