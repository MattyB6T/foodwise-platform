import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { Tooltip } from "../../components/Tooltip";

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

interface ShiftForm {
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
}

export function SchedulePage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingForCell, setAddingForCell] = useState<{ staffId: string; staffName: string; date: string } | null>(null);
  const [form, setForm] = useState<ShiftForm>({ staffId: "", date: "", startTime: "09:00", endTime: "17:00", position: "" });
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: (body: { staffId: string; staffName: string; date: string; startTime: string; endTime: string; position?: string }) =>
      api.createShift(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", selectedStoreId, weekStart] });
      setShowAddModal(false);
      setAddingForCell(null);
      setForm({ staffId: "", date: "", startTime: "09:00", endTime: "17:00", position: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (shiftId: string) => api.deleteShift(selectedStoreId!, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", selectedStoreId, weekStart] });
      setDeletingShiftId(null);
    },
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

  const openAddModal = (staffId?: string, staffName?: string, date?: string) => {
    if (staffId && date) {
      setAddingForCell({ staffId, staffName: staffName || "", date });
      setForm({ staffId, date, startTime: "09:00", endTime: "17:00", position: "" });
    } else {
      setAddingForCell(null);
      setForm({ staffId: staff[0]?.staffId || "", date: weekDays[0]?.dateStr || "", startTime: "09:00", endTime: "17:00", position: "" });
    }
    setShowAddModal(true);
  };

  const weekLabel = new Date(weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const buildTextSchedule = () => {
    let text = `Schedule — Week of ${weekLabel}\n${"─".repeat(40)}\n\n`;
    for (const member of staff) {
      text += `${member.name} (${member.role})\n`;
      let hasShifts = false;
      for (const day of weekDays) {
        const dayShifts = shiftsByStaffAndDay[member.staffId]?.[day.dateStr] || [];
        if (dayShifts.length > 0) {
          hasShifts = true;
          const times = dayShifts.map((s: any) => `${s.startTime}–${s.endTime}${s.position ? ` (${s.position})` : ""}`).join(", ");
          text += `  ${day.dayName} ${day.dayNum}: ${times}\n`;
        }
      }
      if (!hasShifts) text += "  No shifts this week\n";
      text += "\n";
    }
    return text.trim();
  };

  const handleCopyText = async () => {
    const text = buildTextSchedule();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let rows = "";
    for (const member of staff) {
      let cells = `<td style="padding:8px 12px;font-weight:600;white-space:nowrap;border:1px solid #e2e8f0">${member.name}<br><span style="font-weight:400;font-size:12px;color:#64748b">${member.role}</span></td>`;
      for (const day of weekDays) {
        const dayShifts = shiftsByStaffAndDay[member.staffId]?.[day.dateStr] || [];
        if (dayShifts.length > 0) {
          const content = dayShifts.map((s: any) =>
            `<div style="background:#eff6ff;border-radius:4px;padding:3px 6px;margin:2px 0;font-size:12px">${s.startTime}–${s.endTime}${s.position ? `<br><span style="font-size:11px;color:#6b7280">${s.position}</span>` : ""}</div>`
          ).join("");
          cells += `<td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center">${content}</td>`;
        } else {
          cells += `<td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;color:#cbd5e1">—</td>`;
        }
      }
      rows += `<tr>${cells}</tr>`;
    }

    const dayHeaders = weekDays.map(d => `<th style="padding:8px 6px;border:1px solid #e2e8f0;text-align:center;font-size:12px;text-transform:uppercase;color:#64748b">${d.dayName}<br>${d.dayNum}</th>`).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Schedule — Week of ${weekLabel}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;color:#1e293b}table{width:100%;border-collapse:collapse}@media print{body{padding:0}}</style></head><body>
      <h2 style="margin:0 0 4px">Weekly Schedule</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px">Week of ${weekLabel}</p>
      <table>
        <thead><tr><th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b">Staff</th>${dayHeaders}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:11px;color:#94a3b8">Printed from LeanTable</p>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSubmit = () => {
    const selectedStaff = staff.find((s: any) => s.staffId === form.staffId);
    createMutation.mutate({
      staffId: form.staffId,
      staffName: selectedStaff?.name || addingForCell?.staffName || "",
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      position: form.position || undefined,
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Week of {new Date(weekStart).toLocaleDateString("en-US", { month: "long", day: "numeric" })} <Tooltip content="Weekly shift schedule for your team. Click any cell to add a shift, or use the Add Shift button. Shifts created on mobile sync automatically." /></p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAddModal()}
            disabled={staff.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Add Shift
          </button>
          <button
            onClick={handlePrint}
            disabled={staff.length === 0}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title="Print schedule"
          >
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          </button>
          <button
            onClick={handleCopyText}
            disabled={staff.length === 0}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            title={copied ? "Copied!" : "Copy as text"}
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            )}
          </button>
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
                      <td
                        key={day.dateStr}
                        className="px-2 py-2 text-center cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 group"
                        onClick={() => openAddModal(member.staffId, member.name, day.dateStr)}
                      >
                        {dayShifts.map((shift: any) => (
                          <div
                            key={shift.shiftId}
                            className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md px-2 py-1 text-xs font-medium mb-1 relative group/shift"
                          >
                            {shift.startTime} - {shift.endTime}
                            {shift.position && <span className="block text-[10px] text-blue-500 dark:text-blue-500">{shift.position}</span>}
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingShiftId(shift.shiftId); }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none hidden group-hover/shift:flex items-center justify-center hover:bg-red-600"
                              title="Delete shift"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        {dayShifts.length === 0 && (
                          <span className="text-slate-300 dark:text-slate-600 text-lg opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">No staff members found. Add team members on the Team page to start scheduling shifts.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Shift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Add Shift</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Staff Member</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  disabled={!!addingForCell}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  {staff.map((s: any) => (
                    <option key={s.staffId} value={s.staffId}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <select
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  disabled={!!addingForCell}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  {weekDays.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>{d.dayName} {d.dayNum}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Position <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="e.g. Cashier, Line Cook"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            {createMutation.isError && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-3">Failed to create shift. Please try again.</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.staffId || !form.date || !form.startTime || !form.endTime || createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Adding..." : "Add Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingShiftId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeletingShiftId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Shift</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to remove this shift? This can't be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingShiftId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingShiftId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
