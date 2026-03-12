import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useStore } from "../stores/StoreProvider";

const READ_KEY = "leantable_notifications_read";

interface Notification {
  id: string;
  type: "low-stock" | "expiring" | "timesheet";
  message: string;
  path: string;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { selectedStoreId } = useStore();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const ref = useRef<HTMLDivElement>(null);

  const { data: inventory } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const { data: expiration } = useQuery({
    queryKey: ["expirationAlerts", selectedStoreId, 3],
    queryFn: () => api.getExpirationAlerts(selectedStoreId!, 3),
    enabled: !!selectedStoreId,
  });

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const lowStock = (inventory?.items || []).filter((i: any) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold);
    if (lowStock.length > 0) {
      notifs.push({ id: `low-stock-${lowStock.length}`, type: "low-stock", message: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} below minimum stock level`, path: "/inventory" });
    }
    const expiringItems = expiration?.alerts || [];
    if (expiringItems.length > 0) {
      notifs.push({ id: `expiring-${expiringItems.length}`, type: "expiring", message: `${expiringItems.length} item${expiringItems.length > 1 ? "s" : ""} expiring within 3 days`, path: "/inventory?tab=expiration" });
    }
    return notifs;
  }, [inventory, expiration]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = () => {
    const ids = new Set(notifications.map((n) => n.id));
    setReadIds(ids);
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  };

  const handleClick = (n: Notification) => {
    const newRead = new Set(readIds);
    newRead.add(n.id);
    setReadIds(newRead);
    localStorage.setItem(READ_KEY, JSON.stringify([...newRead]));
    setOpen(false);
    navigate(n.path);
  };

  const iconForType = (type: string) => {
    switch (type) {
      case "low-stock": return "M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z";
      case "expiring": return "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01";
      default: return "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2";
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">No notifications</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {notifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      n.type === "low-stock" ? "bg-red-100 dark:bg-red-900/30" :
                      n.type === "expiring" ? "bg-amber-100 dark:bg-amber-900/30" :
                      "bg-blue-100 dark:bg-blue-900/30"
                    }`}>
                      <svg className={`w-4 h-4 ${
                        n.type === "low-stock" ? "text-red-600 dark:text-red-400" :
                        n.type === "expiring" ? "text-amber-600 dark:text-amber-400" :
                        "text-blue-600 dark:text-blue-400"
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d={iconForType(n.type)} />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!isRead ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}>
                        {n.message}
                      </p>
                    </div>
                    {!isRead && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
