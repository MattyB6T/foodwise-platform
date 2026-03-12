import { cn } from "../utils/cn";

interface Tab {
  key: string;
  label: string;
  icon?: string;
}

interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

const tabIcons: Record<string, string> = {
  inventory: "M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  counts: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  expiration: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  "temp-logs": "M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z",
  recipes: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  "prep-lists": "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  schedule: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18",
  timesheets: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
};

export function PageTabs({ tabs, activeTab, onChange }: PageTabsProps) {
  return (
    <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const iconPath = tab.icon ? tabIcons[tab.icon] : undefined;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              isActive
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            {iconPath && (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath} />
              </svg>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
