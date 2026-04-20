import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { useAuth } from "../../auth/AuthProvider";
import { useTheme } from "../../theme/ThemeProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ToggleSwitch({ defaultChecked, storageKey }: { defaultChecked: boolean; storageKey: string }) {
  const [checked, setChecked] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : defaultChecked;
  });

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <button
      onClick={toggle}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        checked ? "translate-x-4" : ""
      }`} />
    </button>
  );
}

function NumberInput({ label, value, onChange, min, max, unit, help }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; unit: string; help: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
        <p className="text-xs text-slate-400 dark:text-slate-500">{help}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
          min={min}
          max={max}
          className="w-20 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm text-right text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400 dark:text-slate-500 w-12">{unit}</span>
      </div>
    </div>
  );
}

function TimeclockSettingsCard({ storeId }: { storeId: string | null }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["store-settings", storeId],
    queryFn: () => api.getStoreSettings(storeId!),
    enabled: !!storeId,
  });

  const [maxShift, setMaxShift] = useState(12);
  const [missedClockout, setMissedClockout] = useState(16);
  const [minBreakShift, setMinBreakShift] = useState(6);
  const [shortShift, setShortShift] = useState(6);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.timeclock) {
      setMaxShift(data.timeclock.maxShiftHours);
      setMissedClockout(data.timeclock.missedClockoutHours);
      setMinBreakShift(data.timeclock.minBreakShiftHours);
      setShortShift(data.timeclock.flagShortShiftMinutes);
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateStoreSettings(storeId!, {
      timeclock: {
        maxShiftHours: maxShift,
        missedClockoutHours: missedClockout,
        minBreakShiftHours: minBreakShift,
        flagShortShiftMinutes: shortShift,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-settings", storeId] });
      setDirty(false);
    },
  });

  const update = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  if (!storeId || isLoading) return null;

  return (
    <SectionCard title="Time Clock">
      <div className="space-y-1">
        <NumberInput label="Long shift flag" value={maxShift} onChange={update(setMaxShift)} min={1} max={24} unit="hours" help="Flag shifts longer than this" />
        <NumberInput label="Missed clock-out" value={missedClockout} onChange={update(setMissedClockout)} min={1} max={48} unit="hours" help="Flag if still clocked in after this long" />
        <NumberInput label="Break required after" value={minBreakShift} onChange={update(setMinBreakShift)} min={1} max={12} unit="hours" help="Flag if no break logged on shifts this long" />
        <NumberInput label="Short shift flag" value={shortShift} onChange={update(setShortShift)} min={1} max={60} unit="min" help="Flag shifts shorter than this" />
      </div>
      {dirty && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
          {saveMutation.isSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved!</span>
          )}
          {saveMutation.isError && (
            <span className="text-sm text-red-600 dark:text-red-400">Failed to save</span>
          )}
        </div>
      )}
    </SectionCard>
  );
}

export function SettingsPage() {
  const { selectedStoreId, stores } = useStore();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { data: posData, isLoading } = useQuery({
    queryKey: ["posConnections", selectedStoreId],
    queryFn: () => api.listPosConnections(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  if (isLoading) return <PageLoader />;

  const posConnections: any[] = posData?.connections || [];
  const currentStore = stores.find((s: any) => s.storeId === selectedStoreId);

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    try {
      const { CognitoUserPool } = await import("amazon-cognito-identity-js");
      const { CONFIG } = await import("../../config");
      const pool = new CognitoUserPool({
        UserPoolId: CONFIG.COGNITO_USER_POOL_ID,
        ClientId: CONFIG.COGNITO_CLIENT_ID,
      });
      const cognitoUser = pool.getCurrentUser();
      if (!cognitoUser) throw new Error("Not authenticated");
      await new Promise<void>((resolve, reject) => {
        cognitoUser.getSession((err: any) => {
          if (err) return reject(err);
          cognitoUser.changePassword(currentPassword, newPassword, (err2: any) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Appearance */}
        <SectionCard title="Appearance">
          <SettingRow label="Theme">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    theme === t
                      ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {t === "light" ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                      Light
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                      Dark
                    </span>
                  )}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account">
          <div className="space-y-3">
            <SettingRow label="Email">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.email}</span>
            </SettingRow>
            <SettingRow label="Role">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{user?.groups?.[0] || "owner"}</span>
            </SettingRow>
            <div className="pt-2">
              {!showChangePassword ? (
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Change Password
                </button>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
                  {passwordSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400">Password changed successfully!</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleChangePassword}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Update Password
                    </button>
                    <button
                      onClick={() => { setShowChangePassword(false); setPasswordError(""); }}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Store details */}
        {currentStore && (
          <SectionCard title="Store Details">
            <div className="space-y-3">
              <SettingRow label="Name">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentStore.name}</span>
              </SettingRow>
              <SettingRow label="Address">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentStore.address || "--"}</span>
              </SettingRow>
              <SettingRow label="Business Type">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{currentStore.operatorType || "QSR"}</span>
              </SettingRow>
              <SettingRow label="Store ID">
                <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{currentStore.storeId}</span>
              </SettingRow>
            </div>
          </SectionCard>
        )}

        {/* Time Clock Settings */}
        <TimeclockSettingsCard storeId={selectedStoreId} />

        {/* Notifications */}
        <SectionCard title="Notifications">
          <div className="space-y-3">
            <SettingRow label="Low Stock Alerts">
              <ToggleSwitch defaultChecked={true} storageKey="lt-notif-lowstock" />
            </SettingRow>
            <SettingRow label="Waste Threshold Alerts">
              <ToggleSwitch defaultChecked={true} storageKey="lt-notif-waste" />
            </SettingRow>
            <SettingRow label="Order Status Updates">
              <ToggleSwitch defaultChecked={true} storageKey="lt-notif-orders" />
            </SettingRow>
            <SettingRow label="Weekly Reports">
              <ToggleSwitch defaultChecked={false} storageKey="lt-notif-weekly" />
            </SettingRow>
          </div>
        </SectionCard>

        {/* POS Integrations */}
        <SectionCard title="POS Integrations">
          {posConnections.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No POS systems connected.</p>
          ) : (
            <div className="space-y-3">
              {posConnections.map((conn: any) => (
                <div key={conn.connectionId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{conn.posSystem}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Connected {conn.connectedAt ? new Date(conn.connectedAt).toLocaleDateString() : ""}</p>
                  </div>
                  <StatusBadge status={conn.status || "active"} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* All Stores */}
        <SectionCard title="All Stores">
          <div className="space-y-2">
            {stores.map((store: any) => (
              <div key={store.storeId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{store.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{store.address || ""}</p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{store.operatorType || "qsr"}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Billing */}
        <SectionCard title="Billing & Subscription">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your subscription plan, payment method, and billing history.
            </p>
            <Link
              to="/settings/billing"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap ml-4"
            >
              Manage Plan
            </Link>
          </div>
        </SectionCard>

        {/* Help & Support */}
        <SectionCard title="Help & Support">
          <div className="space-y-3">
            <SettingRow label="Email Support">
              <a href="mailto:support@leantable.app" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                support@leantable.app
              </a>
            </SettingRow>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Have a question, bug report, or feature request? Reach out and we'll get back to you as soon as possible.
            </p>
          </div>
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <div className="space-y-3">
            <SettingRow label="Version">
              <span className="text-sm text-slate-500 dark:text-slate-400">1.0.0</span>
            </SettingRow>
            <SettingRow label="Platform">
              <span className="text-sm text-slate-500 dark:text-slate-400">Web Dashboard</span>
            </SettingRow>
            <div className="pt-2 flex gap-4">
              <a href="https://leantable.app/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </a>
              <a href="https://leantable.app/terms" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Terms of Service
              </a>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
