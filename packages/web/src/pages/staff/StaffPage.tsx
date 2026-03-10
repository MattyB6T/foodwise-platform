import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";

export function StaffPage() {
  const { selectedStoreId } = useStore();

  const { data, isLoading } = useQuery({
    queryKey: ["staff", selectedStoreId],
    queryFn: () => api.listStaff(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  if (isLoading) return <PageLoader />;

  const staff: any[] = data?.staff || [];
  const active = staff.filter((s: any) => s.active !== false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Staff</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{active.length} active members</p>
        </div>
      </div>

      {staff.length === 0 ? (
        <EmptyState title="No staff members" description="Add team members to get started." />
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
              </tr>
            </thead>
            <tbody>
              {staff.map((member: any) => (
                <tr key={member.staffId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 capitalize">{member.role}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.email || "--"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.phone || "--"}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                    {member.hourlyRate ? `$${member.hourlyRate}/hr` : "--"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={member.active !== false ? "active" : "inactive"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
