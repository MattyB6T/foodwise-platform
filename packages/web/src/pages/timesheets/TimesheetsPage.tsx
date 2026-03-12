import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Tooltip, HelpLabel } from "../../components/Tooltip";
import { downloadCSV } from "../../utils/csvExport";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function calcDurationMinutes(clockIn: string, clockOut: string | null): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  return (end - start) / 60000;
}

function calcElapsedSince(iso: string): string {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  return formatDuration(mins);
}

export function TimesheetsPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [liveOpen, setLiveOpen] = useState(true);

  const { data: timesheetData, isLoading } = useQuery({
    queryKey: ["timesheet", selectedStoreId, weekStart],
    queryFn: () => api.getTimesheetWeek(selectedStoreId!, weekStart),
    enabled: !!selectedStoreId,
  });

  const { data: liveData } = useQuery({
    queryKey: ["timesheet-live", selectedStoreId],
    queryFn: () => api.getTimesheetLive(selectedStoreId!),
    enabled: !!selectedStoreId,
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (entryId: string) => api.approveTimeEntry(selectedStoreId!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet", selectedStoreId, weekStart] });
    },
  });

  const entries: any[] = timesheetData?.entries || [];
  const liveEntries: any[] = liveData?.entries || [];

  const totalHours = useMemo(() => {
    return entries.reduce((sum: number, e: any) => {
      if (e.totalHours != null) return sum + e.totalHours;
      return sum + calcDurationMinutes(e.clockIn, e.clockOut) / 60;
    }, 0);
  }, [entries]);

  const thisWeekStart = getWeekStart(new Date());
  const isCurrentWeek = weekStart === thisWeekStart;

  if (isLoading) return <PageLoader />;

  return (
    <div>
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Timesheets</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Week of {new Date(weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(
              `timesheet-${weekStart}.csv`,
              ["Employee", "Date", "Clock In", "Clock Out", "Break (min)", "Hours", "Status"],
              entries.map((e: any) => {
                const hrs = e.totalHours ?? calcDurationMinutes(e.clockIn, e.clockOut) / 60;
                return [e.staffName, formatDate(e.clockIn), formatTime(e.clockIn), e.clockOut ? formatTime(e.clockOut) : "Active", e.breakMinutes ?? "", hrs.toFixed(1), e.approved ? "Approved" : "Pending"];
              })
            )}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export CSV
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(thisWeekStart)}
            className={`px-3 py-2 border rounded-lg text-sm font-medium ${
              isCurrentWeek
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Live Staff Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 transition-colors">
        <button
          onClick={() => setLiveOpen(!liveOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {liveEntries.length > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveEntries.length > 0 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
            </span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              On the Clock <Tooltip content="Staff currently clocked in via the kiosk or mobile app. Updates every 30 seconds." />
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({liveEntries.length})
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${liveOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {liveOpen && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            {liveEntries.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-2">
                No one currently on the clock
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liveEntries.map((entry: any) => (
                  <div
                    key={entry.entryId || entry.staffId}
                    className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30"
                  >
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {entry.staffName}
                      </p>
                      {entry.role && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{entry.role}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        In at {formatTime(entry.clockIn)}
                      </p>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {calcElapsedSince(entry.clockIn)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timesheet Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Clock In</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Clock Out</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Break <Tooltip content="Total break time in minutes. Breaks are logged by staff via the kiosk. Break time is deducted from total hours." /></th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Hours <Tooltip content="Total work hours (clock-in to clock-out minus breaks). Active shifts show elapsed time so far." /></th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status <Tooltip content="Pending entries need manager approval before they count toward payroll. Approve after verifying hours are accurate." /></th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                    No time entries for this week
                  </td>
                </tr>
              ) : (
                <>
                  {entries.map((entry: any) => {
                    const isClockedIn = !entry.clockOut;
                    const hours = entry.totalHours ?? calcDurationMinutes(entry.clockIn, entry.clockOut) / 60;

                    return (
                      <tr
                        key={entry.entryId}
                        className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 ${
                          isClockedIn ? "bg-blue-50/40 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {entry.staffName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatDate(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatTime(entry.clockIn)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {isClockedIn ? (
                            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            formatTime(entry.clockOut)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
                          {entry.breakMinutes != null ? `${entry.breakMinutes}m` : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                          {hours.toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 text-center">
                          {entry.approved ? (
                            <StatusBadge status="approved" />
                          ) : (
                            <StatusBadge status="pending" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!entry.approved && !isClockedIn ? (
                            <button
                              onClick={() => approveMutation.mutate(entry.entryId)}
                              disabled={approveMutation.isPending}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className="bg-slate-50/50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-900 dark:text-slate-100">
                      {totalHours.toFixed(1)}h
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
