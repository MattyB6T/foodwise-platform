import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";

export function ForecastPage() {
  const { selectedStoreId } = useStore();

  const { data: prepData, isLoading } = useQuery({
    queryKey: ["prepLists", selectedStoreId],
    queryFn: () => api.getPrepLists(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  if (isLoading) return <PageLoader />;

  const prepLists: any[] = prepData?.prepLists || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Forecast & Prep</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">AI-powered demand forecasting and prep lists</p>
      </div>

      {prepLists.length === 0 ? (
        <EmptyState title="No prep lists yet" description="Forecasts generate prep lists automatically. Make sure you have transaction history." />
      ) : (
        <div className="space-y-4">
          {prepLists.map((list: any, i: number) => (
            <div key={list.prepListId || i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    Prep List — {list.date ? new Date(list.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Today"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{list.items?.length || 0} items</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  list.status === "completed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                }`}>
                  {list.status || "pending"}
                </span>
              </div>
              {list.items && (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Forecast Qty</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">On Hand</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">To Prep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((item: any, j: number) => (
                      <tr key={j} className="border-b border-slate-50 dark:border-slate-700/50">
                        <td className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">{item.name || item.recipeName}</td>
                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-300">{item.forecastQuantity ?? "--"}</td>
                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-300">{item.onHand ?? "--"}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">{item.toPrepare ?? item.quantity ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
