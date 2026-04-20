import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { StatusBadge } from "../../components/StatusBadge";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { currencyDollars } from "../../utils/format";
import { Tooltip } from "../../components/Tooltip";
import { ExportMenu } from "../../components/ExportMenu";
import { Pagination, usePagination } from "../../components/Pagination";

type SortField = "name" | "category" | "quantity" | "costPerUnit" | "totalValue" | "stockStatus";
type SortDir = "asc" | "desc";

export function InventoryPage() {
  const { selectedStoreId } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortField, setSortField] = useState<SortField>("stockStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(0);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const items: any[] = data?.items || [];

  const categories = useMemo(() => {
    const cats = new Set(items.map((i: any) => i.category));
    return ["All", ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (category !== "All") result = result.filter((i: any) => i.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i: any) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
    }
    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === "totalValue") {
        aVal = (a.quantity || 0) * (a.costPerUnit || 0);
        bVal = (b.quantity || 0) * (b.costPerUnit || 0);
      }
      if (sortField === "stockStatus") {
        const aLow = a.lowStockThreshold > 0 && a.quantity <= a.lowStockThreshold ? 0 : 1;
        const bLow = b.lowStockThreshold > 0 && b.quantity <= b.lowStockThreshold ? 0 : 1;
        return sortDir === "asc" ? aLow - bLow : bLow - aLow;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return result;
  }, [items, category, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 14l5-5 5 5z" />
          </svg>
        )}
      </div>
    </th>
  );

  if (isLoading) return <PageLoader />;

  const totalValue = items.reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.costPerUnit || 0), 0);
  const lowStockCount = items.filter((i: any) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inventory</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {items.length} items &middot; {currencyDollars(totalValue)} total value <Tooltip content="Sum of (quantity x unit cost) for all items. Track this weekly to spot cost creep early." />
            {lowStockCount > 0 && <span className="text-red-600 font-semibold"> &middot; {lowStockCount} low stock <Tooltip content="Items below their minimum threshold. Set thresholds per item based on how fast you go through them." /></span>}
          </p>
        </div>
        <ExportMenu
          filename="inventory"
          headers={["Name", "Category", "Quantity", "Unit", "Unit Cost", "Total Value", "Status"]}
          rows={filtered.map((i: any) => [i.name, i.category, i.quantity, i.unit, i.costPerUnit || 0, ((i.quantity || 0) * (i.costPerUnit || 0)).toFixed(2), i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold ? "Low Stock" : "OK"])}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400 dark:text-slate-500">{filtered.length} results</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No inventory items found" description="Try changing your filters or add items to get started." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <SortHeader field="name" label="Item" />
                  <SortHeader field="category" label="Category" />
                  <SortHeader field="quantity" label="Quantity" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit</th>
                  <SortHeader field="costPerUnit" label="Unit Cost" />
                  <SortHeader field="totalValue" label="Total Value" />
                  <SortHeader field="stockStatus" label="Status" />
                </tr>
              </thead>
              <tbody>
                {paginate(filtered).map((item: any) => {
                  const isLow = item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold;
                  const totalVal = (item.quantity || 0) * (item.costPerUnit || 0);
                  return (
                    <tr key={item.itemId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.category}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${isLow ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
                          {item.quantity}
                        </span>
                        {isLow && <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">(min: {item.lowStockThreshold}) <Tooltip content="Minimum stock level you've set. When quantity drops to or below this, you'll see a low stock alert." /></span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{currencyDollars(item.costPerUnit || 0)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{currencyDollars(totalVal)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={isLow ? "red" : "green"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}
