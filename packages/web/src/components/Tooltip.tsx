import { useState, useRef, useEffect } from "react";
import { cn } from "../utils/cn";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 80 ? "bottom" : "top");
    }
  }, [show]);

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children || <InfoIcon />}
      {show && (
        <span
          className={cn(
            "absolute z-50 w-64 px-3 py-2 text-xs font-normal leading-relaxed text-slate-200 bg-slate-800 dark:bg-slate-700 rounded-lg shadow-lg border border-slate-700 dark:border-slate-600",
            "pointer-events-none",
            position === "top" ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2"
          )}
        >
          {content}
          <span
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45",
              position === "top" ? "-bottom-1 border-b border-r border-slate-700 dark:border-slate-600" : "-top-1 border-t border-l border-slate-700 dark:border-slate-600"
            )}
          />
        </span>
      )}
    </span>
  );
}

function InfoIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help transition-colors ml-1"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

interface HelpLabelProps {
  label: string;
  tooltip: string;
  className?: string;
}

export function HelpLabel({ label, tooltip, className }: HelpLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {label}
      <Tooltip content={tooltip} />
    </span>
  );
}
