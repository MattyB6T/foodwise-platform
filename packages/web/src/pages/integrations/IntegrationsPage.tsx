import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";

type Tab = "connections" | "mappings" | "transactions";
type PosSystem = "toast" | "square" | "csv";

const POS_LABELS: Record<PosSystem, string> = {
  toast: "Toast",
  square: "Square",
  csv: "CSV Import",
};

const POS_COLORS: Record<PosSystem, string> = {
  toast: "bg-orange-500",
  square: "bg-blue-500",
  csv: "bg-slate-500",
};

function getConfidenceClasses(confidence: number) {
  if (confidence >= 85)
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400";
  if (confidence >= 60)
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleString();
}

export function IntegrationsPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("connections");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPosSystem, setNewPosSystem] = useState<PosSystem>("toast");
  const [newConfig, setNewConfig] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ["pos-connections", selectedStoreId],
    queryFn: () => api.listPosConnections(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const mappingsQuery = useQuery({
    queryKey: ["pos-mappings", selectedStoreId],
    queryFn: () => api.listPosMappings(selectedStoreId!),
    enabled: !!selectedStoreId && activeTab === "mappings",
  });

  const transactionsQuery = useQuery({
    queryKey: ["pos-transactions", selectedStoreId],
    queryFn: () => api.listPosTransactions(selectedStoreId!, 50),
    enabled: !!selectedStoreId && activeTab === "transactions",
  });

  const syncStatusQuery = useQuery({
    queryKey: ["pos-sync-status", selectedStoreId],
    queryFn: () => api.getPosSyncStatus(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPosConnection(selectedStoreId!, {
        posSystem: newPosSystem,
        config: Object.keys(newConfig).length > 0 ? newConfig : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-connections", selectedStoreId] });
      setShowAddForm(false);
      setNewConfig({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ connectionId, status }: { connectionId: string; status: string }) =>
      api.updatePosConnection(selectedStoreId!, connectionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-connections", selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ["pos-sync-status", selectedStoreId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api.deletePosConnection(selectedStoreId!, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-connections", selectedStoreId] });
      queryClient.invalidateQueries({ queryKey: ["pos-sync-status", selectedStoreId] });
      setDeleteConfirmId(null);
    },
  });

  if (!selectedStoreId) {
    return <EmptyState title="No store selected" description="Select a store to manage POS integrations." />;
  }

  if (connectionsQuery.isLoading) return <PageLoader />;

  const connections = connectionsQuery.data?.connections ?? [];
  const mappings = mappingsQuery.data?.mappings ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: "connections", label: "Connections" },
    { key: "mappings", label: "Mappings" },
    { key: "transactions", label: "Transactions" },
  ];

  function renderConfigFields() {
    if (newPosSystem === "toast") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Webhook Secret
            </label>
            <input
              type="text"
              value={newConfig.webhookSecret ?? ""}
              onChange={(e) => setNewConfig({ ...newConfig, webhookSecret: e.target.value })}
              placeholder="HMAC secret from Toast"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Restaurant GUID
            </label>
            <input
              type="text"
              value={newConfig.restaurantGuid ?? ""}
              onChange={(e) => setNewConfig({ ...newConfig, restaurantGuid: e.target.value })}
              placeholder="Toast restaurant GUID"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );
    }
    if (newPosSystem === "square") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Location ID
            </label>
            <input
              type="text"
              value={newConfig.locationId ?? ""}
              onChange={(e) => setNewConfig({ ...newConfig, locationId: e.target.value })}
              placeholder="Square location ID"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You will be redirected to Square OAuth after creating the connection.
          </p>
        </div>
      );
    }
    // CSV
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        CSV imports use S3 upload or the direct API. No additional configuration needed.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          POS Integrations
        </h1>
      </div>

      {/* Tabs */}
      <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connections Tab */}
      {activeTab === "connections" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {showAddForm ? "Cancel" : "Add Connection"}
            </button>
          </div>

          {/* Add Connection Form */}
          {showAddForm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                New POS Connection
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  POS System
                </label>
                <select
                  value={newPosSystem}
                  onChange={(e) => {
                    setNewPosSystem(e.target.value as PosSystem);
                    setNewConfig({});
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="toast">Toast</option>
                  <option value="square">Square</option>
                  <option value="csv">CSV Import</option>
                </select>
              </div>
              {renderConfigFields()}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewConfig({});
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {createMutation.isPending ? "Creating..." : "Create Connection"}
                </button>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to create connection. Please try again.
                </p>
              )}
            </div>
          )}

          {/* Connection Cards */}
          {connections.length === 0 && !showAddForm ? (
            <EmptyState
              title="No POS connections"
              description="Add a connection to start syncing sales data from your point-of-sale system."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((conn: any) => {
                const posSystem = conn.posSystem as PosSystem;
                const isActive = conn.status === "active";

                return (
                  <div
                    key={conn.connectionId}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`${POS_COLORS[posSystem] ?? "bg-slate-500"} text-white text-xs font-bold px-2.5 py-1 rounded-md`}
                        >
                          {POS_LABELS[posSystem] ?? posSystem}
                        </span>
                        <StatusBadge status={conn.status} />
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Last Sync</span>
                        <span className="text-slate-900 dark:text-slate-100">
                          {formatDate(conn.lastSyncAt)}
                        </span>
                      </div>
                      {conn.syncStats && (
                        <>
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Total Synced</span>
                            <span className="text-slate-900 dark:text-slate-100">
                              {conn.syncStats.totalSynced?.toLocaleString() ?? "0"}
                            </span>
                          </div>
                          {conn.syncStats.errors > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>Errors</span>
                              <span className="text-red-600 dark:text-red-400">
                                {conn.syncStats.errors}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Created</span>
                        <span className="text-slate-900 dark:text-slate-100">
                          {formatDate(conn.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            connectionId: conn.connectionId,
                            status: isActive ? "paused" : "active",
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        {isActive ? "Pause" : "Resume"}
                      </button>
                      {deleteConfirmId === conn.connectionId ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(conn.connectionId)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                          >
                            {deleteMutation.isPending ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(conn.connectionId)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mappings Tab */}
      {activeTab === "mappings" && (
        <div>
          {mappingsQuery.isLoading ? (
            <PageLoader />
          ) : mappings.length === 0 ? (
            <EmptyState
              title="No mappings yet"
              description="Mappings are created automatically when POS transactions are synced."
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        POS Item Name
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        POS System
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Mapped To
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Confidence
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {mappings.map((mapping: any, idx: number) => {
                      const confidence = Math.round((mapping.confidence ?? 0) * 100);
                      const mappedTo = mapping.recipeId
                        ? `Recipe: ${mapping.recipeId}`
                        : mapping.ingredientId
                          ? `Ingredient: ${mapping.ingredientId}`
                          : "Unmapped";

                      return (
                        <tr
                          key={mapping.posItemKey ?? idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                            {mapping.posItemName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`${POS_COLORS[mapping.posSystem as PosSystem] ?? "bg-slate-500"} text-white text-xs font-bold px-2 py-0.5 rounded`}
                            >
                              {POS_LABELS[mapping.posSystem as PosSystem] ?? mapping.posSystem}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {mappedTo}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${getConfidenceClasses(confidence)}`}
                            >
                              {confidence}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize">
                            {mapping.mappingSource ?? "auto"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div>
          {transactionsQuery.isLoading ? (
            <PageLoader />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="No transactions"
              description="Transactions will appear here once your POS connections start syncing data."
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Timestamp
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        POS System
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Items
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Total
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {transactions.map((txn: any, idx: number) => (
                      <tr
                        key={txn.transactionId ?? idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                          {formatDate(txn.timestamp ?? txn.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`${POS_COLORS[txn.posSystem as PosSystem] ?? "bg-slate-500"} text-white text-xs font-bold px-2 py-0.5 rounded`}
                          >
                            {POS_LABELS[txn.posSystem as PosSystem] ?? txn.posSystem}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {Array.isArray(txn.items)
                            ? txn.items.map((i: any) => i.name ?? i.posItemName).join(", ")
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100 font-medium">
                          {txn.total != null
                            ? `$${(txn.total / 100).toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={txn.status ?? "processed"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
