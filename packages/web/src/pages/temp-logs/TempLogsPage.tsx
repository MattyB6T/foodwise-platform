import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";

const LOCATIONS = ["Freezer", "Walk-in Cooler", "Prep Fridge", "Display Case"] as const;

interface TempLogEntry {
  logId: string;
  location: string;
  temperature: number;
  unit: string;
  equipmentId?: string;
  equipmentName?: string;
  inRange: boolean;
  rangeNote?: string;
  notes?: string;
  recordedBy: string;
  timestamp: string;
}

interface TempLogsResponse {
  logs: TempLogEntry[];
  alerts: TempLogEntry[];
  totalLogs: number;
  alertCount: number;
}

export function TempLogsPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [temperature, setTemperature] = useState("");
  const [unit, setUnit] = useState<"F" | "C">("F");
  const [equipmentName, setEquipmentName] = useState("");
  const [notes, setNotes] = useState("");

  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  })();

  const { data, isLoading } = useQuery<TempLogsResponse>({
    queryKey: ["tempLogs", selectedStoreId, days],
    queryFn: () => api.getTempLogs(selectedStoreId!, startDate),
    enabled: !!selectedStoreId,
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      location: string;
      temperature: number;
      unit?: string;
      equipmentName?: string;
      notes?: string;
    }) => api.recordTempLog(selectedStoreId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tempLogs", selectedStoreId] });
      resetForm();
    },
  });

  function resetForm() {
    setShowForm(false);
    setLocation("");
    setCustomLocation("");
    setTemperature("");
    setUnit("F");
    setEquipmentName("");
    setNotes("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedLocation = location === "custom" ? customLocation : location;
    if (!resolvedLocation || !temperature) return;

    mutation.mutate({
      location: resolvedLocation,
      temperature: Number(temperature),
      unit: `°${unit}`,
      ...(equipmentName && { equipmentName }),
      ...(notes && { notes }),
    });
  }

  if (isLoading) return <PageLoader />;

  const logs = data?.logs ?? [];
  const alertCount = data?.alertCount ?? 0;
  const totalLogs = data?.totalLogs ?? logs.length;
  const inRangeCount = totalLogs - alertCount;

  const inputClass =
    "border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Temperature Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {totalLogs} readings in the last {days} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={inputClass}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Record Temperature
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {alertCount} out-of-range temperature reading{alertCount !== 1 ? "s" : ""} detected.
            Review immediately to ensure food safety compliance.
          </p>
        </div>
      )}

      {/* Record Temperature Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Record Temperature
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Location *
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`${inputClass} w-full`}
                required
              >
                <option value="">Select location...</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              {location === "custom" && (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter custom location"
                  className={`${inputClass} w-full mt-2`}
                  required
                />
              )}
            </div>

            {/* Temperature + Unit */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Temperature *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="e.g. 36"
                  className={`${inputClass} flex-1`}
                  required
                />
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                  <button
                    type="button"
                    onClick={() => setUnit("F")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      unit === "F"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                    }`}
                  >
                    &deg;F
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit("C")}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      unit === "C"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                    }`}
                  >
                    &deg;C
                  </button>
                </div>
              </div>
            </div>

            {/* Equipment Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Equipment Name
              </label>
              <input
                type="text"
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                placeholder="e.g. True T-49"
                className={`${inputClass} w-full`}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className={`${inputClass} w-full`}
              />
            </div>

            {/* Submit */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending ? "Saving..." : "Save Reading"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>

            {mutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 md:col-span-3">
                Failed to record temperature. Please try again.
              </p>
            )}
          </form>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Readings</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalLogs}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Out of Range</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{alertCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In Range</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {inRangeCount}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <EmptyState
          title="No temperature logs yet"
          description="Record your first temperature reading to start tracking food safety."
          action={{ label: "Record Temperature", onClick: () => setShowForm(true) }}
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
                    Location
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                    Temperature
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                    Equipment
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                    Recorded By
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                    Notes
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.logId}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                      {log.location}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          log.inRange
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400 font-bold"
                        }
                      >
                        {log.temperature}
                        {log.unit}
                      </span>
                      {!log.inRange && log.rangeNote && (
                        <span className="block text-xs text-red-500 dark:text-red-400 mt-0.5">
                          {log.rangeNote}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {log.equipmentName || "--"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {log.recordedBy}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                      {log.notes || "--"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.inRange ? "good" : "critical"} />
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
