import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";

type Tab = "incidents" | "cameras";

const LOCATIONS = [
  { value: "register", label: "Register" },
  { value: "prep-area", label: "Prep Area" },
  { value: "drive-thru", label: "Drive-Thru" },
  { value: "storage", label: "Storage" },
  { value: "dining", label: "Dining" },
  { value: "entrance", label: "Entrance" },
];

const emptyCameraForm = { name: "", location: "register", wyzeDeviceId: "", wyzeDeviceMac: "" };

export function SecurityPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("incidents");
  const [days, setDays] = useState(30);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [cameraForm, setCameraForm] = useState(emptyCameraForm);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: incidentData, isLoading: incidentsLoading } = useQuery({
    queryKey: ["incidents", selectedStoreId, days],
    queryFn: () => api.listIncidents(selectedStoreId!, { startDate: startDate.toISOString().split("T")[0] }),
    enabled: !!selectedStoreId,
  });

  const { data: cameraData, isLoading: camerasLoading } = useQuery({
    queryKey: ["cameras", selectedStoreId],
    queryFn: () => api.listCameras(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const addCameraMutation = useMutation({
    mutationFn: (body: { name: string; location: string; wyzeDeviceId: string; wyzeDeviceMac: string }) =>
      api.registerCamera(selectedStoreId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras", selectedStoreId] });
      setShowAddCamera(false);
      setCameraForm(emptyCameraForm);
    },
  });

  const incidents: any[] = incidentData?.incidents || [];
  const cameras: any[] = cameraData?.cameras || [];
  const isLoading = tab === "incidents" ? incidentsLoading : camerasLoading;

  if (isLoading) return <PageLoader />;

  const incidentsByType: Record<string, number> = {};
  incidents.forEach((inc: any) => {
    const t = inc.type || "other";
    incidentsByType[t] = (incidentsByType[t] || 0) + 1;
  });

  const canSubmitCamera = cameraForm.name.trim() && cameraForm.wyzeDeviceId.trim() && cameraForm.wyzeDeviceMac.trim();

  const handleAddCamera = () => {
    if (!canSubmitCamera) return;
    addCameraMutation.mutate({
      name: cameraForm.name.trim(),
      location: cameraForm.location,
      wyzeDeviceId: cameraForm.wyzeDeviceId.trim(),
      wyzeDeviceMac: cameraForm.wyzeDeviceMac.trim(),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Cameras, transactions & incidents</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "cameras" && (
            <button
              onClick={() => setShowAddCamera(!showAddCamera)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddCamera ? "Cancel" : "Add Camera"}
            </button>
          )}
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            {(["incidents", "cameras"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  tab === t
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "incidents" && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <span className="text-sm text-slate-500 dark:text-slate-400">{incidents.length} incidents</span>
          </div>

          {/* Summary cards */}
          {incidents.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(incidentsByType).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([type, count]) => (
                <div key={type} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{type}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{count}</p>
                </div>
              ))}
            </div>
          )}

          {/* Incidents table */}
          {incidents.length === 0 ? (
            <EmptyState title="No incidents" description="No security incidents recorded in this period." />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Camera</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Severity</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc: any) => (
                      <tr key={inc.incidentId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {inc.timestamp ? new Date(inc.timestamp).toLocaleString() : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{inc.type || "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">{inc.description || "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{inc.cameraName || inc.cameraId || "--"}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={
                            inc.severity === "high" ? "critical" :
                            inc.severity === "medium" ? "warning" : "green"
                          } />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={inc.status || "open"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "cameras" && (
        <>
          {/* Add camera form */}
          {showAddCamera && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6 transition-colors">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Register New Camera</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Camera Name *</label>
                  <input
                    value={cameraForm.name}
                    onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })}
                    placeholder="e.g. Front Register"
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Location *</label>
                  <select
                    value={cameraForm.location}
                    onChange={(e) => setCameraForm({ ...cameraForm, location: e.target.value })}
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc.value} value={loc.value}>{loc.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Wyze Device ID *</label>
                  <input
                    value={cameraForm.wyzeDeviceId}
                    onChange={(e) => setCameraForm({ ...cameraForm, wyzeDeviceId: e.target.value })}
                    placeholder="Device ID from Wyze app"
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Wyze MAC Address *</label>
                  <input
                    value={cameraForm.wyzeDeviceMac}
                    onChange={(e) => setCameraForm({ ...cameraForm, wyzeDeviceMac: e.target.value })}
                    placeholder="e.g. 2C:AA:8E:XX:XX:XX"
                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleAddCamera}
                  disabled={!canSubmitCamera || addCameraMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {addCameraMutation.isPending ? "Registering..." : "Register Camera"}
                </button>
                {addCameraMutation.isError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {(addCameraMutation.error as Error)?.message || "Failed to register camera"}
                  </p>
                )}
              </div>
            </div>
          )}

          {cameras.length === 0 && !showAddCamera ? (
            <EmptyState
              title="No cameras configured"
              description="Register your first security camera to get started."
              action={{ label: "Add Camera", onClick: () => setShowAddCamera(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cameras.map((cam: any) => (
                <div key={cam.cameraId} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                  {/* Camera thumbnail placeholder */}
                  <div className="h-40 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-300 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cam.name || cam.cameraId}</h3>
                      <StatusBadge status={cam.status || (cam.isOnline ? "active" : "inactive")} />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      {cam.location && <p>Location: <span className="capitalize">{cam.location.replace("-", " ")}</span></p>}
                      {cam.wyzeDeviceId && <p>Device: {cam.wyzeDeviceId}</p>}
                      {cam.createdAt && <p>Added: {new Date(cam.createdAt).toLocaleDateString()}</p>}
                      {cam.updatedAt && <p>Last updated: {new Date(cam.updatedAt).toLocaleString()}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
