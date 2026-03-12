import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { Tooltip } from "../../components/Tooltip";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

interface PrepItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  completed: boolean;
}

interface PrepList {
  prepListId: string;
  storeId: string;
  date: string;
  items: PrepItem[];
  createdBy: string;
  createdAt: string;
  status: "pending" | "in-progress" | "completed";
}

export function PrepListsPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["prepLists", selectedStoreId, selectedDate],
    queryFn: () => api.getPrepLists(selectedStoreId!, selectedDate),
    enabled: !!selectedStoreId,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.generatePrepList(selectedStoreId!, {
        action: "generate",
        date: selectedDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["prepLists", selectedStoreId, selectedDate],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (variables: {
      prepListId: string;
      items: PrepItem[];
      status?: string;
    }) =>
      api.updatePrepList(selectedStoreId!, {
        prepListId: variables.prepListId,
        items: variables.items,
        status: variables.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["prepLists", selectedStoreId, selectedDate],
      });
    },
  });

  function handleToggleItem(prepList: PrepList, itemIndex: number) {
    const updatedItems = prepList.items.map((item, idx) =>
      idx === itemIndex ? { ...item, completed: !item.completed } : item
    );

    const allCompleted = updatedItems.every((item) => item.completed);
    const someCompleted = updatedItems.some((item) => item.completed);
    const newStatus = allCompleted
      ? "completed"
      : someCompleted
        ? "in-progress"
        : "pending";

    updateMutation.mutate({
      prepListId: prepList.prepListId,
      items: updatedItems,
      status: newStatus,
    });
  }

  if (!selectedStoreId) {
    return (
      <EmptyState
        title="No store selected"
        description="Please select a store to view prep lists."
      />
    );
  }

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <EmptyState
        title="Failed to load prep lists"
        description="Something went wrong. Please try again."
      />
    );
  }

  const prepLists: PrepList[] = data?.prepLists ?? [];

  const totalItems = prepLists.reduce((sum, pl) => sum + pl.items.length, 0);
  const completedCount = prepLists.reduce(
    (sum, pl) => sum + pl.items.filter((i) => i.completed).length,
    0
  );
  const pendingCount = totalItems - completedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Prep Lists
        </h1>

        <div className="flex items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Previous day"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Next day"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generateMutation.isPending ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              <><span>Generate Prep List</span> <Tooltip content="Creates a prep list based on your sales forecast for the selected date. Uses transaction history to predict what you'll need to prepare." /></>
            )}
          </button>
        </div>
      </div>

      {/* Error from mutations */}
      {(generateMutation.isError || updateMutation.isError) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          {generateMutation.isError
            ? "Failed to generate prep list. Please try again."
            : "Failed to update prep list. Please try again."}
        </div>
      )}

      {/* Empty state */}
      {prepLists.length === 0 ? (
        <EmptyState
          title="No prep lists for this date"
          description="Generate a prep list based on your sales forecast. The system uses your transaction history to predict quantities needed for each item."
          action={{
            label: "Generate Prep List",
            onClick: () => generateMutation.mutate(),
          }}
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Items
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {totalItems}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Completed
              </p>
              <p className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
                {completedCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Pending
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {pendingCount}
              </p>
            </div>
          </div>

          {/* Prep lists */}
          {prepLists.map((prepList) => (
            <div
              key={prepList.prepListId}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
            >
              {/* Prep list header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Prep List
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Created by {prepList.createdBy} on{" "}
                    {new Date(prepList.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={prepList.status} />
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-10">
                        {/* Checkbox column */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {prepList.items.map((item, idx) => (
                      <tr
                        key={idx}
                        className={
                          item.completed
                            ? "bg-slate-50/50 dark:bg-slate-800/50"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        }
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleItem(prepList, idx)}
                            disabled={updateMutation.isPending}
                            className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td
                          className={`px-6 py-4 text-sm font-medium ${
                            item.completed
                              ? "text-slate-400 dark:text-slate-500 line-through"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {item.name}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            item.completed
                              ? "text-slate-400 dark:text-slate-500 line-through"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {item.quantity} {item.unit}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            item.completed
                              ? "text-slate-400 dark:text-slate-500"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {item.category}
                        </td>
                        <td className="px-6 py-4">
                          {item.completed ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
