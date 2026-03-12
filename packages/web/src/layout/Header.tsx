import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../stores/StoreProvider";
import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../components/NotificationBell";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { stores, selectedStoreId, selectedStoreName, setSelectedStoreId } = useStore();
  const { user, logout } = useAuth();
  const isAssistantActive = location.pathname === "/assistant";

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

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/assistant")}
          className={`relative p-2 rounded-lg transition-colors ${
            isAssistantActive
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="AI Assistant"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
        </button>
        <NotificationBell />
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
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
