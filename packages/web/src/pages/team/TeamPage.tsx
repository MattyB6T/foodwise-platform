import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";

const ROLES = ["manager", "cook", "cashier", "server", "prep", "driver", "host"];

export function TeamPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "cook", phone: "" });
  const [editForm, setEditForm] = useState({ name: "", role: "", phone: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["staff", selectedStoreId],
    queryFn: () => api.listStaff(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const addMutation = useMutation({
    mutationFn: (body: { name: string; email: string; role: string; phone?: string }) =>
      api.addStaff(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", selectedStoreId] });
      setShowAdd(false);
      setForm({ name: "", email: "", role: "cook", phone: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: any }) =>
      api.updateStaff(selectedStoreId!, staffId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", selectedStoreId] });
      setEditingId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (staffId: string) => api.updateStaff(selectedStoreId!, staffId, { active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", selectedStoreId] });
    },
  });

  if (isLoading) return <PageLoader />;

  const staff: any[] = data?.staff || [];
  const active = staff.filter((s: any) => s.active !== false);
  const inactive = staff.filter((s: any) => s.active === false);

  const handleAdd = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    addMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      phone: form.phone.trim() || undefined,
    });
  };

  const startEdit = (member: any) => {
    setEditingId(member.staffId);
    setEditForm({ name: member.name, role: member.role, phone: member.phone || "" });
  };

  const handleUpdate = (staffId: string) => {
    updateMutation.mutate({ staffId, body: editForm });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Team</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {active.length} active member{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAdd ? "Cancel" : "Add Team Member"}
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6 transition-colors">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">New Team Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Optional"
                  className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || !form.email.trim() || addMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
              >
                {addMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
          {addMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3">
              {(addMutation.error as Error)?.message || "Failed to add team member"}
            </p>
          )}
        </div>
      )}

      {/* Active staff */}
      {active.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Add your first team member to get started."
          action={{ label: "Add Team Member", onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Phone</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Rate</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((member: any) => (
                <tr key={member.staffId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                  {editingId === member.staffId ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.email || "--"}</td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded px-2 py-1 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                        {member.hourlyRate ? `$${member.hourlyRate}/hr` : "--"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status="active" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdate(member.staffId)}
                            disabled={updateMutation.isPending}
                            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 capitalize">{member.role}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.email || "--"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.phone || "--"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                        {member.hourlyRate ? `$${member.hourlyRate}/hr` : "--"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status="active" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(member)}
                            className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deactivate ${member.name}?`)) removeMutation.mutate(member.staffId);
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Deactivate"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inactive staff */}
      {inactive.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Inactive Members ({inactive.length})</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors opacity-60">
            <table className="w-full">
              <tbody>
                {inactive.map((member: any) => (
                  <tr key={member.staffId} className="border-b border-slate-50 dark:border-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{member.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 capitalize">{member.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">{member.email || "--"}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status="inactive" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => updateMutation.mutate({ staffId: member.staffId, body: { active: true } })}
                        className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                      >
                        Reactivate
                      </button>
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
