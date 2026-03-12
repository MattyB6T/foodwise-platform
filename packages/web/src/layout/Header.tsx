import { useStore } from "../stores/StoreProvider";
import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../components/NotificationBell";

export function Header() {
  const { stores, selectedStoreId, selectedStoreName, setSelectedStoreId } = useStore();
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 transition-colors">
      <div className="flex items-center gap-4">
        <select
          value={selectedStoreId || ""}
          onChange={(e) => setSelectedStoreId(e.target.value)}
          className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {stores.map((store: any) => (
            <option key={store.storeId} value={store.storeId}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <span className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</span>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
