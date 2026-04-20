import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { Tooltip } from "../../components/Tooltip";
import { Pagination, usePagination } from "../../components/Pagination";

type Tab = "history" | "sources" | "log";
type DateRange = 7 | 14 | 30 | 90;

const SOURCE_TYPES = [
  { value: "pool_tables", label: "Pool / Billiards" },
  { value: "darts", label: "Dart Boards" },
  { value: "arcade", label: "Arcade Machines" },
  { value: "cover_charge", label: "Cover Charge / Door Fees" },
  { value: "live_music", label: "Live Music" },
  { value: "private_events", label: "Private Events / Bookings" },
  { value: "trivia", label: "Trivia Night" },
  { value: "catering", label: "Catering" },
  { value: "merchandise", label: "Merchandise / Retail" },
  { value: "custom", label: "Custom" },
];

function formatCents(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const emptySourceForm = { name: "", type: "custom" };

export function RevenuePage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [days, setDays] = useState<DateRange>(30);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [logForm, setLogForm] = useState({ sourceId: "", amount: "", date: new Date().toISOString().split("T")[0], note: "" });
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(0);

  // Fetch sources
  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["revenueSources", selectedStoreId],
    queryFn: () => api.listRevenueSources(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  // Fetch entries with date range
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["revenueEntries", selectedStoreId, days],
    queryFn: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      return api.listRevenueEntries(selectedStoreId!, {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      });
    },
    enabled: !!selectedStoreId,
  });

  const addSourceMutation = useMutation({
    mutationFn: (body: { name: string; type: string }) =>
      api.createRevenueSource(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenueSources", selectedStoreId] });
      setShowAddSource(false);
      setSourceForm(emptySourceForm);
    },
  });

  const patchSourceMutation = useMutation({
    mutationFn: ({ sourceId, body }: { sourceId: string; body: { name?: string; isActive?: boolean } }) =>
      api.patchRevenueSource(selectedStoreId!, sourceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenueSources", selectedStoreId] });
      setEditingSourceId(null);
    },
  });

  const logEntryMutation = useMutation({
    mutationFn: (body: { sourceId: string; amount: number; date: string; note?: string }) =>
      api.createRevenueEntry(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenueEntries", selectedStoreId] });
      setLogForm({ sourceId: logForm.sourceId, amount: "", date: new Date().toISOString().split("T")[0], note: "" });
      setActiveTab("history");
    },
  });

  const sources: any[] = sourcesData?.sources || [];
  const entries: any[] = entriesData?.entries || [];

  // Filter entries by source
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (sourceFilter !== "All") {
      result = result.filter((e: any) => e.sourceId === sourceFilter);
    }
    result.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [entries, sourceFilter]);

  // Summary calculations
  const totalRevenueCents = filteredEntries.reduce(
    (sum: number, e: any) => sum + (e.amountCents || 0),
    0
  );
  const entryCount = filteredEntries.length;

  const topSource = useMemo(() => {
    const bySource: Record<string, { name: string; total: number }> = {};
    filteredEntries.forEach((e: any) => {
      if (!bySource[e.sourceId]) {
        bySource[e.sourceId] = { name: e.sourceName || "Unknown", total: 0 };
      }
      bySource[e.sourceId].total += e.amountCents || 0;
    });
    const sorted = Object.values(bySource).sort((a, b) => b.total - a.total);
    return sorted[0] || null;
  }, [filteredEntries]);

  // Default to first source for log form
  useEffect(() => {
    if (sources.length > 0 && !logForm.sourceId) {
      setLogForm((f) => ({ ...f, sourceId: sources[0].sourceId }));
    }
  }, [sources]);

  const isLoading = activeTab === "history" ? entriesLoading : sourcesLoading;

  if (isLoading) return <PageLoader />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "history", label: "History" },
    { key: "sources", label: "Sources" },
    { key: "log", label: "Log Entry" },
  ];

  const handleLogEntry = () => {
    const parsed = parseFloat(logForm.amount);
    if (!logForm.sourceId || isNaN(parsed) || parsed <= 0) return;
    logEntryMutation.mutate({
      sourceId: logForm.sourceId,
      amount: Math.round(parsed * 100), // cents
      date: logForm.date,
      note: logForm.note.trim() || undefined,
    });
  };

  const handleAddSource = () => {
    if (!sourceForm.name.trim()) return;
    addSourceMutation.mutate({ name: sourceForm.name.trim(), type: sourceForm.type });
  };

  const handleRenameSource = (sourceId: string) => {
    if (!editName.trim()) return;
    patchSourceMutation.mutate({ sourceId, body: { name: editName.trim() } });
  };

  const handleToggleSource = (sourceId: string, currentlyActive: boolean) => {
    patchSourceMutation.mutate({ sourceId, body: { isActive: !currentlyActive } });
  };

  const startEditing = (source: any) => {
    setEditingSourceId(source.sourceId);
    setEditName(source.name);
  };

  const typeLabel = (type: string) =>
    SOURCE_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Ancillary Revenue
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track non-food-sale revenue streams <Tooltip content="Revenue from sources other than food/drink sales — like pool tables, cover charges, trivia nights, catering, or merchandise. Tracked separately so your food cost % stays accurate." />
          </p>
        </div>
        {activeTab === "sources" && (
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddSource ? "Cancel" : "Add Source"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* History Tab */}
      {activeTab === "history" && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as DateRange)}
              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Sources</option>
              {sources.map((s: any) => (
                <option key={s.sourceId} value={s.sourceId}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {filteredEntries.length} entries
            </span>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 transition-colors">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Total Revenue
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCents(totalRevenueCents)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 transition-colors">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Entry Count
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {entryCount}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 transition-colors">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Top Source
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {topSource ? topSource.name : "--"}
              </p>
              {topSource && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {formatCents(topSource.total)}
                </p>
              )}
            </div>
          </div>

          {/* Entries Table */}
          {filteredEntries.length === 0 ? (
            <EmptyState
              title="No revenue entries"
              description="No ancillary revenue has been logged in this period."
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Source</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(filteredEntries).map((entry: any) => (
                      <tr
                        key={entry.entryId}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{entry.sourceName || "--"}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">{formatCents(entry.amountCents || 0)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">{entry.notes || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={page} totalItems={filteredEntries.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      )}

      {/* Sources Tab */}
      {activeTab === "sources" && (
        <div>
          {/* Add source form */}
          {showAddSource && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6 transition-colors">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">New Revenue Source</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name *</label>
                  <input
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                    placeholder="e.g. Pool Tables"
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Type</label>
                  <select
                    value={sourceForm.type}
                    onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SOURCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSource}
                    disabled={!sourceForm.name.trim() || addSourceMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {addSourceMutation.isPending ? "Adding..." : "Add Source"}
                  </button>
                </div>
              </div>
              {addSourceMutation.isError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-3">
                  {(addSourceMutation.error as Error)?.message || "Failed to add source"}
                </p>
              )}
            </div>
          )}

          {sources.length === 0 && !showAddSource ? (
            <EmptyState
              title="No revenue sources"
              description="Add revenue sources to start tracking non-food-sale income."
              action={{ label: "Add Source", onClick: () => setShowAddSource(true) }}
            />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source: any) => (
                      <tr
                        key={source.sourceId}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3">
                          {editingSourceId === source.sourceId ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameSource(source.sourceId);
                                  if (e.key === "Escape") setEditingSourceId(null);
                                }}
                              />
                              <button
                                onClick={() => handleRenameSource(source.sourceId)}
                                disabled={patchSourceMutation.isPending}
                                className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSourceId(null)}
                                className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{source.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {typeLabel(source.type)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              source.isActive !== false
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {source.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {editingSourceId !== source.sourceId && (
                              <button
                                onClick={() => startEditing(source)}
                                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Rename"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleSource(source.sourceId, source.isActive !== false)}
                              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                source.isActive !== false
                                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              }`}
                            >
                              {source.isActive !== false ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
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

      {/* Log Entry Tab */}
      {activeTab === "log" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Log Revenue Entry</h2>
          {sources.length === 0 ? (
            <EmptyState
              title="No revenue sources"
              description="Add a revenue source first before logging entries."
              action={{ label: "Go to Sources", onClick: () => setActiveTab("sources") }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Source *</label>
                <select
                  value={logForm.sourceId}
                  onChange={(e) => setLogForm({ ...logForm, sourceId: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sources.map((s: any) => (
                    <option key={s.sourceId} value={s.sourceId}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={logForm.amount}
                  onChange={(e) => setLogForm({ ...logForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Date *</label>
                <input
                  type="date"
                  value={logForm.date}
                  onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Note (optional)</label>
                <input
                  value={logForm.note}
                  onChange={(e) => setLogForm({ ...logForm, note: e.target.value })}
                  placeholder="e.g. Friday trivia night"
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  onClick={handleLogEntry}
                  disabled={!logForm.sourceId || !logForm.amount || logEntryMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {logEntryMutation.isPending ? "Logging..." : "Log Revenue"}
                </button>
                {logEntryMutation.isError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {(logEntryMutation.error as Error)?.message || "Failed to log entry"}
                  </p>
                )}
                {logEntryMutation.isSuccess && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Entry logged successfully!</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
