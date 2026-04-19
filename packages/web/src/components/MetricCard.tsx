import { cn } from "../utils/cn";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status?: "green" | "yellow" | "red";
  className?: string;
  onClick?: () => void;
}

const statusColors = {
  green: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  yellow: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  red: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
};

const trendIcons = {
  up: "M7 17l5-5 5 5M7 7l5 5 5-5",
  down: "M7 7l5 5 5-5M7 17l5-5 5-5",
  neutral: "M5 12h14",
};

export function MetricCard({ title, value, subtitle, trend, trendValue, status, className, onClick }: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-800 rounded-xl border p-5 shadow-sm transition-colors",
        status ? statusColors[status] : "border-slate-200 dark:border-slate-700",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all",
        className
      )}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        {trend && trendValue && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-semibold mb-1",
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-400"
          )}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={trendIcons[trend]} />
            </svg>
            {trendValue}
          </div>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
