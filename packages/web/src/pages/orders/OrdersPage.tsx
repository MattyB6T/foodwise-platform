import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { fullDate, currencyDollars } from "../../utils/format";
import { ExportMenu } from "../../components/ExportMenu";
import { Pagination, usePagination } from "../../components/Pagination";
import { CreateOrderPage } from "./CreateOrderPage";
import { OrderDetailPage } from "./OrderDetailPage";

type View = { type: "list" } | { type: "create" } | { type: "detail"; order: any };
type SortField = "supplier" | "date" | "delivery" | "items" | "total" | "status";
type SortDir = "asc" | "desc";

export function OrdersPage() {
  const { selectedStoreId } = useStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<View>({ type: "list" });
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(0);

  const { data, isLoading } = useQuery({
    queryKey: ["purchaseOrders", selectedStoreId, statusFilter],
    queryFn: () => api.getPurchaseOrders(selectedStoreId!, statusFilter || undefined),
    enabled: !!selectedStoreId,
  });

  if (view.type === "create") {
    return <CreateOrderPage onBack={() => setView({ type: "list" })} />;
  }

  if (view.type === "detail") {
    return (
      <OrderDetailPage
        order={view.order}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  if (isLoading) return <PageLoader />;

  const orders: any[] = data?.orders || [];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  };

  const sorted = useMemo(() => {
    return [...orders].sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "supplier": aVal = a.supplierName || ""; bVal = b.supplierName || ""; break;
        case "date": aVal = a.createdAt || ""; bVal = b.createdAt || ""; break;
        case "delivery": aVal = a.expectedDeliveryDate || ""; bVal = b.expectedDeliveryDate || ""; break;
        case "items": aVal = a.lines?.length || 0; bVal = b.lines?.length || 0; break;
        case "total": aVal = a.totalCost || 0; bVal = b.totalCost || 0; break;
        case "status": aVal = a.status || ""; bVal = b.status || ""; break;
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [orders, sortField, sortDir]);

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none`}
      onClick={() => toggleSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
        {label}
        {sortField === field && (
          <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14l5-5 5 5z" />
          </svg>
        )}
      </div>
    </th>
  );

  return (
    <div>
      {/* Workflow guide banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <span className="font-semibold">Order workflow:</span> Draft (building the order) → Submitted (sent to supplier) → Partial (some items received) → Received (fully delivered and checked in).
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{orders.length} orders</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu
            filename="purchase-orders"
            headers={["Order ID", "Supplier", "Date", "Delivery Date", "Items", "Total", "Status"]}
            rows={orders.map((o: any) => [o.orderId?.slice(0, 8), o.supplierName || "", fullDate(o.createdAt), o.expectedDeliveryDate || "", o.lines?.length || 0, o.totalCost || 0, o.status || "draft"])}
          />
          <button
            onClick={() => setView({ type: "create" })}
            className="px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {["", "draft", "submitted", "partial", "received"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          >
            {status === "" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No purchase orders"
          description="Create a purchase order to start ordering from your suppliers."
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <SortHeader field="supplier" label="Supplier" />
                  <SortHeader field="date" label="Date" />
                  <SortHeader field="delivery" label="Delivery" />
                  <SortHeader field="items" label="Items" align="right" />
                  <SortHeader field="total" label="Total" align="right" />
                  <SortHeader field="status" label="Status" align="center" />
                </tr>
              </thead>
              <tbody>
                {paginate(sorted).map((order: any) => (
                  <tr
                    key={order.orderId}
                    onClick={() => setView({ type: "detail", order })}
                    className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{order.supplierName || "--"}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{order.orderId?.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{fullDate(order.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {order.expectedDeliveryDate || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700 dark:text-slate-300">
                      {order.lines?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                      {currencyDollars(order.totalCost || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.status || "draft"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}
