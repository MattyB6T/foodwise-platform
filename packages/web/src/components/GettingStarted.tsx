import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useStore } from "../stores/StoreProvider";

const DISMISSED_KEY = "leantable_checklist_dismissed";

interface Step {
  label: string;
  path: string;
  check: (data: any) => boolean;
  dataKey: string;
}

const steps: Step[] = [
  { label: "Add your first store", path: "/settings", check: (d) => (d?.stores?.length || 0) > 0, dataKey: "stores" },
  { label: "Add inventory items", path: "/inventory", check: (d) => (d?.items?.length || 0) > 0, dataKey: "inventory" },
  { label: "Create a recipe", path: "/recipes", check: (d) => (d?.recipes?.length || 0) > 0, dataKey: "recipes" },
  { label: "Add team members", path: "/team", check: (d) => (d?.staff?.length || 0) > 0, dataKey: "staff" },
  { label: "Set up a schedule", path: "/schedule", check: (d) => (d?.shifts?.length || 0) > 0, dataKey: "schedule" },
];

export function GettingStarted() {
  const navigate = useNavigate();
  const { selectedStoreId } = useStore();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");

  const { data: storesData } = useQuery({ queryKey: ["stores"], queryFn: () => api.listStores() });
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId,
  });
  const { data: recipesData } = useQuery({ queryKey: ["recipes"], queryFn: () => api.getRecipes() });
  const { data: staffData } = useQuery({
    queryKey: ["staff", selectedStoreId],
    queryFn: () => api.listStaff(selectedStoreId!),
    enabled: !!selectedStoreId,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["schedule", selectedStoreId],
    queryFn: () => api.getSchedule(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  if (dismissed) return null;

  const dataMap: Record<string, any> = {
    stores: storesData,
    inventory: inventoryData,
    recipes: recipesData,
    staff: staffData,
    schedule: scheduleData,
  };

  const completed = steps.filter((s) => s.check(dataMap[s.dataKey]));
  const completedCount = completed.length;

  if (completedCount === steps.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 transition-colors">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Getting Started</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{completedCount} of {steps.length} complete</p>
        </div>
        <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-4">
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-1">
        {steps.map((step) => {
          const done = step.check(dataMap[step.dataKey]);
          return (
            <button
              key={step.label}
              onClick={() => !done && navigate(step.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                done
                  ? "opacity-60"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                done
                  ? "bg-green-100 dark:bg-green-900/40"
                  : "bg-slate-100 dark:bg-slate-700"
              }`}>
                {done ? (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <div className="w-2 h-2 bg-slate-300 dark:bg-slate-500 rounded-full" />
                )}
              </div>
              <span className={`text-sm font-medium ${done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>
                {step.label}
              </span>
              {!done && (
                <svg className="w-4 h-4 text-slate-400 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
