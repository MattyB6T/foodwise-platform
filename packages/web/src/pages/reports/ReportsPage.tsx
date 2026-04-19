import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { Tooltip } from "../../components/Tooltip";

const REPORT_TYPES = [
  { value: "food_cost", label: "Food Cost Report", desc: "Ingredient costs vs. revenue — your most important profitability metric" },
  { value: "waste", label: "Waste Report", desc: "All logged waste with costs, reasons, and trends over the period" },
  { value: "inventory", label: "Inventory Valuation", desc: "Current value of all stock on hand by category" },
  { value: "labor", label: "Labor Cost Report", desc: "Staff hours, wages, and labor cost as % of revenue" },
  { value: "sales", label: "Sales Report", desc: "Transaction revenue, food cost, and averages over the period" },
  { value: "profit_loss", label: "Profit & Loss", desc: "Complete P&L — revenue, food cost, labor, waste, and net profit" },
  { value: "count_variance", label: "Count Variance", desc: "Inventory count discrepancies over 2% threshold" },
  { value: "purchase_orders", label: "Purchase Orders", desc: "Supplier orders and spend over the period" },
];

export function ReportsPage() {
  const { selectedStoreId } = useStore();
  const [reportType, setReportType] = useState("food_cost");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { mutate: generate, data: report, isPending } = useMutation({
    mutationFn: () => api.generateReport({
      storeId: selectedStoreId!,
      reportType,
      startDate,
      endDate,
    }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Generate and view reports for your store</p>
      </div>

      {/* Report Builder */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Report Type <Tooltip content={REPORT_TYPES.find(r => r.value === reportType)?.desc || ''} /></label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => generate()}
            disabled={isPending || !selectedStoreId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            {isPending ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Report Results */}
      {report && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">{report.title || "Report Results"}</h2>
            {report.data && (
              <button
                onClick={() => {
                  const csv = convertToCSV(report.data);
                  downloadCSV(csv, `${reportType}-${startDate}-${endDate}.csv`);
                }}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Export CSV
              </button>
            )}
          </div>
          <div className="p-6">
            {/* Summary metrics */}
            {report.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(report.summary).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            {report.data && Array.isArray(report.data) && report.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {Object.keys(report.data[0]).map((key) => (
                        <th key={key} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50">
                        {Object.values(row).map((val: any, j: number) => (
                          <td key={j} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{String(val ?? "--")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Markdown/text report */}
            {report.text && (
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">{report.text}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function convertToCSV(data: any[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
