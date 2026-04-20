import { NavLink } from "react-router-dom";
import { cn } from "../utils/cn";
import { useAuth } from "../auth/AuthProvider";

type Role = "owner" | "manager" | "staff" | "readonly";

const ROLE_HIERARCHY: Role[] = ["readonly", "staff", "manager", "owner"];

function getUserRole(groups: string[]): Role {
  if (groups.includes("owner") || groups.length === 0) return "owner"; // no groups = owner (backwards compat)
  if (groups.includes("manager")) return "manager";
  if (groups.includes("staff")) return "staff";
  return "readonly";
}

function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

interface NavItem {
  to: string;
  icon: string;
  label: string;
  minRole?: Role;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "",
    items: [
      { to: "/", icon: "grid", label: "Dashboard" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/inventory", icon: "package", label: "Inventory" },
      { to: "/waste", icon: "trash-2", label: "Waste", minRole: "staff" },
      { to: "/orders", icon: "shopping-cart", label: "Orders", minRole: "manager" },
      { to: "/recipes", icon: "book-open", label: "Recipes" },
    ],
  },
  {
    title: "Team",
    items: [
      { to: "/schedule", icon: "calendar", label: "Schedule", minRole: "staff" },
      { to: "/team", icon: "users", label: "Team", minRole: "manager" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { to: "/revenue", icon: "dollar-sign", label: "Revenue", minRole: "manager" },
      { to: "/reports", icon: "bar-chart-2", label: "Reports", minRole: "manager" },
      { to: "/forecast", icon: "trending-up", label: "Forecast", minRole: "manager" },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/integrations", icon: "link", label: "Integrations", minRole: "owner" },
      { to: "/security", icon: "shield", label: "Security", minRole: "owner" },
      { to: "/import", icon: "upload", label: "Import Data", minRole: "owner" },
      { to: "/settings", icon: "settings", label: "Settings", minRole: "manager" },
    ],
  },
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
    "book-open": "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
    link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
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
  const { user } = useAuth();
  const role = getUserRole(user?.groups || []);

  // Filter nav groups to only show items the user has access to
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasMinRole(role, item.minRole || "readonly")),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-200 z-40",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-700/50">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
            {/* Table top */}
            <rect x="3" y="7" width="26" height="3.5" rx="1.2" fill="white" />
            {/* Left leg */}
            <rect x="5.5" y="10.5" width="3" height="13" rx="0.8" fill="white" opacity="0.8" />
            {/* Right leg */}
            <rect x="23.5" y="10.5" width="3" height="13" rx="0.8" fill="white" opacity="0.8" />
            {/* L letter */}
            <path d="M11 14h2v6.5h3v2h-5V14z" fill="white" />
            {/* T letter */}
            <path d="M17 14h6v2h-2v6.5h-2V16h-2v-2z" fill="white" />
          </svg>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            Lean<span className="text-blue-400">Table</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleGroups.map((group, gi) => (
          <div key={gi} className={group.title ? "mt-4" : ""}>
            {group.title && !collapsed && (
              <p className="px-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
            )}
            {group.title && collapsed && (
              <div className="mx-4 my-2 border-t border-slate-700/50" />
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-colors text-sm font-medium",
                  isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon name={item.icon} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
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
