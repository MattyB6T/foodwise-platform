import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SchedulePage() {
  const { selectedStoreId } = useStore();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["schedule", selectedStoreId, weekStart],
    queryFn: () => api.getSchedule(selectedStoreId!, weekStart),
    enabled: !!selectedStoreId,
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff", selectedStoreId],
    queryFn: () => api.listStaff(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const shifts: any[] = scheduleData?.shifts || [];
  const staff: any[] = (staffData?.staff || []).filter((s: any) => s.active !== false);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(weekStart, i);
      const d = new Date(dateStr);
      return { dateStr, dayName: DAY_NAMES[d.getDay()], dayNum: d.getDate() };
    }), [weekStart]);

  const shiftsByStaffAndDay = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};
    shifts.forEach((shift: any) => {
      const sid = shift.staffId;
      const date = shift.date;
      if (!map[sid]) map[sid] = {};
      if (!map[sid][date]) map[sid][date] = [];
      map[sid][date].push(shift);
    });
    return map;
  }, [shifts]);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Week of {new Date(weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-40 sticky left-0 bg-slate-50/50 dark:bg-slate-800">Staff</th>
                {weekDays.map((day) => (
                  <th key={day.dateStr} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase min-w-[120px]">
                    <span className="block">{day.dayName}</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">{day.dayNum}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member: any) => (
                <tr key={member.staffId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/30 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{member.role}</p>
                  </td>
                  {weekDays.map((day) => {
                    const dayShifts = shiftsByStaffAndDay[member.staffId]?.[day.dateStr] || [];
                    return (
                      <td key={day.dateStr} className="px-2 py-2 text-center">
                        {dayShifts.map((shift: any, i: number) => (
                          <div key={i} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md px-2 py-1 text-xs font-medium mb-1">
                            {shift.startTime} - {shift.endTime}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">No staff members found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
