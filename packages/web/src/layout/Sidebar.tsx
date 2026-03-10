import { NavLink } from "react-router-dom";
import { cn } from "../utils/cn";

const navItems = [
  { to: "/", icon: "grid", label: "Dashboard" },
  { to: "/inventory", icon: "package", label: "Inventory" },
  { to: "/counts", icon: "clipboard", label: "Counts" },
  { to: "/expiration", icon: "alert-triangle", label: "Expiration" },
  { to: "/waste", icon: "trash-2", label: "Waste" },
  { to: "/temp-logs", icon: "thermometer", label: "Temp Logs" },
  { to: "/orders", icon: "shopping-cart", label: "Orders" },
  { to: "/prep-lists", icon: "list", label: "Prep Lists" },
  { to: "/schedule", icon: "calendar", label: "Schedule" },
  { to: "/timesheets", icon: "clock", label: "Timesheets" },
  { to: "/team", icon: "users", label: "Team" },
  { to: "/revenue", icon: "dollar-sign", label: "Revenue" },
  { to: "/integrations", icon: "link", label: "Integrations" },
  { to: "/security", icon: "shield", label: "Security" },
  { to: "/reports", icon: "bar-chart-2", label: "Reports" },
  { to: "/forecast", icon: "trending-up", label: "Forecast" },
  { to: "/assistant", icon: "message-circle", label: "Assistant" },
  { to: "/settings", icon: "settings", label: "Settings" },
];

// Simple SVG icons to avoid extra deps
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    package: "M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
    "trash-2": "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
    "shopping-cart": "M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6",
    calendar: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    "bar-chart-2": "M18 20V10M12 20V4M6 20v-6",
    "trending-up": "M23 6l-9.5 9.5-5-5L1 18",
    clock: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
    "dollar-sign": "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "message-circle": "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
    clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    "alert-triangle": "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
    thermometer: "M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z",
  };

  return (
    <svg className={cn("w-5 h-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name] || ""} />
    </svg>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-200 z-40",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-700/50">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
          </svg>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            Lean<span className="text-blue-400">Table</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors text-sm font-medium",
              isActive
                ? "bg-blue-600/20 text-blue-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Icon name={item.icon} className="flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="p-4 border-t border-slate-700/50 text-slate-400 hover:text-white transition-colors"
      >
        <svg className={cn("w-5 h-5 transition-transform", collapsed && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
        </svg>
      </button>
    </aside>
  );
}
