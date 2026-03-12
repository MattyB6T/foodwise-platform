import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { fullDate, currencyDollars } from "../../utils/format";
import { Tooltip } from "../../components/Tooltip";
import { downloadCSV } from "../../utils/csvExport";
import { CreateOrderPage } from "./CreateOrderPage";
import { OrderDetailPage } from "./OrderDetailPage";

type View = { type: "list" } | { type: "create" } | { type: "detail"; order: any };

export function OrdersPage() {
  const { selectedStoreId } = useStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<View>({ type: "list" });

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Orders</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{orders.length} orders <Tooltip content="Order workflow: Draft (building the order) → Submitted (sent to supplier) → Partial (some items received) → Received (fully delivered and checked in)." /></p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCSV(
              "purchase-orders.csv",
              ["Order ID", "Supplier", "Date", "Delivery Date", "Items", "Total", "Status"],
              orders.map((o: any) => [o.orderId?.slice(0, 8), o.supplierName || "", fullDate(o.createdAt), o.expectedDeliveryDate || "", o.lines?.length || 0, o.totalCost || 0, o.status || "draft"])
            )}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export CSV
          </button>
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

      {orders.length === 0 ? (
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Delivery</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Items</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
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
        </div>
      )}
    </div>
  );
}
