import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { fullDate, currencyDollars } from "../../utils/format";

interface OrderDetailProps {
  order: any;
  onBack: () => void;
}

export function OrderDetailPage({ order, onBack }: OrderDetailProps) {
  const queryClient = useQueryClient();
  const isDraft = order.status === "draft";
  const canReceive = order.status === "submitted" || order.status === "partial";

  const [lines, setLines] = useState(
    (order.lines || []).map((l: any) => ({ ...l }))
  );
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    order.expectedDeliveryDate || ""
  );

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.updatePurchaseOrder(order.orderId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => api.emailPurchaseOrder(order.orderId),
  });

  const receiveMutation = useMutation({
    mutationFn: (body: { lines: { itemId: string; itemName: string; quantityReceived: number; unit: string }[] }) =>
      api.receivePurchaseOrder(order.orderId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      setReceiving(false);
      setReceiveQtys({});
      onBack();
    },
  });

  const totalCost = lines.reduce(
    (sum: number, l: any) => sum + (l.quantityOrdered || 0) * (l.unitCost || 0),
    0
  );

  const handleSaveDraft = () => {
    updateMutation.mutate(
      {
        lines: lines.map((l: any) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          unit: l.unit,
          quantityOrdered: l.quantityOrdered,
          unitCost: l.unitCost,
        })),
        expectedDeliveryDate,
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleSubmitOrder = () => {
    updateMutation.mutate(
      { status: "submitted" },
      {
        onSuccess: () => {
          onBack();
        },
      }
    );
  };

  const handleSendEmail = () => {
    emailMutation.mutate(undefined, {
      onSuccess: (data) => {
        alert(`Purchase order sent to ${data.supplierEmail || order.supplierName}`);
      },
      onError: () => {
        alert("Failed to send email. Make sure the supplier has an email address configured.");
      },
    });
  };

  const handleStartReceiving = () => {
    const defaults: Record<string, number> = {};
    for (const line of lines) {
      const remaining = (line.quantityOrdered || 0) - (line.quantityReceived || 0);
      defaults[line.itemId] = Math.max(0, remaining);
    }
    setReceiveQtys(defaults);
    setReceiving(true);
  };

  const handleReceiveAll = () => {
    const defaults: Record<string, number> = {};
    for (const line of lines) {
      const remaining = (line.quantityOrdered || 0) - (line.quantityReceived || 0);
      defaults[line.itemId] = Math.max(0, remaining);
    }
    setReceiveQtys(defaults);
  };

  const handleSubmitReceiving = () => {
    const receiveLines = lines
      .filter((l: any) => (receiveQtys[l.itemId] || 0) > 0)
      .map((l: any) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        quantityReceived: receiveQtys[l.itemId] || 0,
        unit: l.unit,
      }));

    if (receiveLines.length === 0) return;
    receiveMutation.mutate({ lines: receiveLines });
  };

  const updateLine = (index: number, field: string, value: number) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const showReceivedCol = receiving || order.status === "partial" || order.status === "received";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Order</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {order.orderId?.slice(0, 8)}... &middot; Created {fullDate(order.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {isDraft && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? "Submitting..." : "Submit Order"}
              </button>
            </>
          )}
          {isDraft && editing && (
            <>
              <button
                onClick={() => {
                  setLines((order.lines || []).map((l: any) => ({ ...l })));
                  setEditing(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
          {order.status === "submitted" && !receiving && (
            <button
              onClick={handleSendEmail}
              disabled={emailMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {emailMutation.isPending ? "Sending..." : "Email to Supplier"}
            </button>
          )}
          {canReceive && !receiving && (
            <button
              onClick={handleStartReceiving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Receive Shipment
            </button>
          )}
          {receiving && (
            <>
              <button
                onClick={() => { setReceiving(false); setReceiveQtys({}); }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiveAll}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
              >
                Receive All
              </button>
              <button
                onClick={handleSubmitReceiving}
                disabled={receiveMutation.isPending || Object.values(receiveQtys).every((q) => q === 0)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {receiveMutation.isPending ? "Saving..." : "Confirm Receipt"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Receiving mode banner */}
      {receiving && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Receiving Mode</p>
            <p className="text-xs text-green-700 dark:text-green-400">Enter the quantity received for each item. Inventory will be updated automatically.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order info + items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Supplier</h2>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{order.supplierName}</p>
          </div>

          {/* Line items */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Items ({lines.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ordered</th>
                    {showReceivedCol && (
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        {receiving ? "Receiving Now" : "Received"}
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit Cost</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line: any, i: number) => {
                    const alreadyReceived = line.quantityReceived || 0;
                    const remaining = Math.max(0, (line.quantityOrdered || 0) - alreadyReceived);
                    const isFullyReceived = alreadyReceived >= (line.quantityOrdered || 0);

                    return (
                      <tr key={line.itemId} className={`border-b border-slate-50 dark:border-slate-700/50 ${receiving && isFullyReceived ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.itemName}</span>
                          {receiving && alreadyReceived > 0 && (
                            <span className="block text-xs text-slate-400 dark:text-slate-500">
                              Previously received: {alreadyReceived}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editing ? (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={line.quantityOrdered}
                              onChange={(e) => updateLine(i, "quantityOrdered", parseFloat(e.target.value) || 0)}
                              className="w-20 text-center border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                            />
                          ) : (
                            <span className="text-sm text-slate-700 dark:text-slate-300">{line.quantityOrdered}</span>
                          )}
                        </td>
                        {showReceivedCol && (
                          <td className="px-4 py-3 text-center">
                            {receiving ? (
                              isFullyReceived ? (
                                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Complete</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="0.01"
                                  value={receiveQtys[line.itemId] ?? 0}
                                  onChange={(e) => setReceiveQtys({ ...receiveQtys, [line.itemId]: parseFloat(e.target.value) || 0 })}
                                  className="w-20 text-center border border-green-300 dark:border-green-700 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-green-50 dark:bg-green-900/20 dark:text-slate-100"
                                />
                              )
                            ) : (
                              <span
                                className={`text-sm font-medium ${
                                  isFullyReceived
                                    ? "text-green-600"
                                    : alreadyReceived > 0
                                    ? "text-amber-600"
                                    : "text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                {alreadyReceived}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{line.unit}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitCost}
                              onChange={(e) => updateLine(i, "unitCost", parseFloat(e.target.value) || 0)}
                              className="w-24 text-right border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                            />
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300">${line.unitCost?.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                          ${((line.quantityOrdered || 0) * (line.unitCost || 0)).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <td
                      colSpan={showReceivedCol ? 5 : 4}
                      className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 text-right"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      ${totalCost.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sticky top-6 transition-colors">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</p>
                <div className="mt-1">
                  <StatusBadge status={order.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Order ID</p>
                <p className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1">{order.orderId}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Supplier</p>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">{order.supplierName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Expected Delivery</p>
                {editing ? (
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="mt-1 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                ) : (
                  <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                    {order.expectedDeliveryDate || "Not set"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Created</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{fullDate(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Items</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{lines.length} line items</p>
              </div>
              <hr className="border-slate-100 dark:border-slate-700" />
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Cost</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{currencyDollars(totalCost)}</p>
              </div>
            </div>

            {/* Status workflow hint */}
            <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Workflow</p>
              <div className="flex items-center gap-1 text-xs">
                {["draft", "submitted", "partial", "received"].map((s, i) => (
                  <span key={s} className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        s === order.status
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {s}
                    </span>
                    {i < 3 && <span className="text-slate-300 dark:text-slate-600">&rarr;</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receive error */}
      {receiveMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">Failed to record receipt. Please try again.</p>
        </div>
      )}
    </div>
  );
}
