import { cn } from "../utils/cn";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const colors: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  "needs-attention": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  inactive: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = colors[status.toLowerCase()] || "bg-slate-100 text-slate-600";
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize",
      colorClass,
      className
    )}>
      {status}
    </span>
  );
}
