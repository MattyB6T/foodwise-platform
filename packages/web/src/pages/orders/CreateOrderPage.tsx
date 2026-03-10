import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";

interface LineItem {
  itemId: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  unitCost: number;
}

export function CreateOrderPage({ onBack }: { onBack: () => void }) {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]
  );
  const [lines, setLines] = useState<LineItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);

  // Manual add fields
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState("each");
  const [manualQty, setManualQty] = useState("");
  const [manualCost, setManualCost] = useState("");

  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.getSuppliers(),
  });

  const suppliers = suppliersData?.suppliers || [];
  const selectedSupplier = suppliers.find((s: any) => s.supplierId === supplierId);

  const createMutation = useMutation({
    mutationFn: (body: any) => api.createPurchaseOrder(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      onBack();
    },
  });

  const addFromCatalog = (item: any) => {
    if (lines.some((l) => l.itemId === item.itemId)) return;
    setLines([
      ...lines,
      {
        itemId: item.itemId,
        itemName: item.itemName,
        unit: item.unit,
        quantityOrdered: 1,
        unitCost: item.unitCost,
      },
    ]);
  };

  const addManualItem = () => {
    if (!manualName.trim() || !manualQty || !manualCost) return;
    setLines([
      ...lines,
      {
        itemId: `manual-${Date.now()}`,
        itemName: manualName.trim(),
        unit: manualUnit,
        quantityOrdered: parseFloat(manualQty),
        unitCost: parseFloat(manualCost),
      },
    ]);
    setManualName("");
    setManualQty("");
    setManualCost("");
  };

  const updateLine = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const totalCost = lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0);

  const handleSubmit = (asDraft: boolean) => {
    if (!selectedStoreId || !supplierId || lines.length === 0) return;
    createMutation.mutate({
      storeId: selectedStoreId,
      supplierId,
      expectedDeliveryDate,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        unit: l.unit,
        quantityOrdered: l.quantityOrdered,
        unitCost: l.unitCost,
      })),
    });
  };

  if (loadingSuppliers) return <PageLoader />;

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
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Purchase Order</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Create an order for your supplier</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Order details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Supplier</h2>
            {suppliers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No suppliers configured yet. Add suppliers in Settings.</p>
            ) : (
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setLines([]);
                  setShowCatalog(false);
                }}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s: any) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {selectedSupplier && (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400 space-y-1">
                {selectedSupplier.contactName && <p>Contact: {selectedSupplier.contactName}</p>}
                {selectedSupplier.contactEmail && <p>Email: {selectedSupplier.contactEmail}</p>}
                {selectedSupplier.deliverySchedule && <p>Delivery: {selectedSupplier.deliverySchedule}</p>}
              </div>
            )}
          </div>

          {/* Delivery Date */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Expected Delivery</h2>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          {/* Line Items */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Line Items</h2>
              <div className="flex gap-2">
                {selectedSupplier?.catalog?.length > 0 && (
                  <button
                    onClick={() => setShowCatalog(!showCatalog)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    {showCatalog ? "Hide Catalog" : "Add from Catalog"}
                  </button>
                )}
              </div>
            </div>

            {/* Supplier catalog */}
            {showCatalog && selectedSupplier?.catalog?.length > 0 && (
              <div className="mb-4 border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {selectedSupplier.name} Catalog
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
                  {selectedSupplier.catalog.map((item: any) => {
                    const alreadyAdded = lines.some((l) => l.itemId === item.itemId);
                    return (
                      <div key={item.itemId} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.itemName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ${item.unitCost.toFixed(2)}/{item.unit}
                          </p>
                        </div>
                        <button
                          onClick={() => addFromCatalog(item)}
                          disabled={alreadyAdded}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            alreadyAdded
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {alreadyAdded ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual add */}
            <div className="flex gap-2 mb-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Item Name</label>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Tomatoes"
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="w-20">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Unit</label>
                <input
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="w-20">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Qty</label>
                <input
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Unit Cost</label>
                <input
                  value={manualCost}
                  onChange={(e) => setManualCost(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$"
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <button
                onClick={addManualItem}
                disabled={!manualName.trim() || !manualQty || !manualCost}
                className="px-3 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>

            {/* Line items table */}
            {lines.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
                No items yet. Add items from the supplier catalog or manually above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Qty</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit Cost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={line.itemId} className="border-b border-slate-50 dark:border-slate-700/50">
                        <td className="px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{line.itemName}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantityOrdered}
                            onChange={(e) => updateLine(i, "quantityOrdered", parseFloat(e.target.value) || 0)}
                            className="w-20 text-center border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{line.unit}</td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost}
                            onChange={(e) => updateLine(i, "unitCost", parseFloat(e.target.value) || 0)}
                            className="w-24 text-right border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                          ${(line.quantityOrdered * line.unitCost).toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeLine(i)}
                            className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sticky top-6 transition-colors">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Supplier</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{selectedSupplier?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Items</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{lines.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Delivery</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{expectedDeliveryDate || "—"}</span>
              </div>
              <hr className="border-slate-100 dark:border-slate-700" />
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">${totalCost.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => handleSubmit(true)}
              disabled={!supplierId || lines.length === 0 || createMutation.isPending}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-2"
            >
              {createMutation.isPending ? "Creating..." : "Create Draft Order"}
            </button>

            {createMutation.isError && (
              <p className="text-sm text-red-600 mt-2">
                Failed to create order. Please try again.
              </p>
            )}

            <button
              onClick={onBack}
              className="w-full py-2.5 text-slate-600 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
