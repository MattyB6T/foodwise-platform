import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";
import { PageLoader } from "../../components/LoadingSpinner";
import { EmptyState } from "../../components/EmptyState";
import { currencyDollars } from "../../utils/format";

interface Ingredient {
  itemId: string;
  name?: string;
  quantity: number;
  unit: string;
  costPerUnit?: number;
}

interface Recipe {
  recipeId: string;
  name: string;
  category: string;
  sellingPrice: number;
  ingredients: Ingredient[];
  createdAt: string;
  updatedAt: string;
}

type SortField = "name" | "category" | "sellingPrice" | "foodCost" | "margin";
type SortDir = "asc" | "desc";

interface RecipeForm {
  name: string;
  category: string;
  sellingPrice: string;
  ingredients: { itemId: string; quantity: string; unit: string }[];
}

const emptyForm: RecipeForm = {
  name: "",
  category: "",
  sellingPrice: "",
  ingredients: [{ itemId: "", quantity: "", unit: "" }],
};

export function RecipesPage() {
  const { selectedStoreId } = useStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeForm>({ ...emptyForm });

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.getRecipes(),
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["inventory", selectedStoreId],
    queryFn: () => api.getInventory(selectedStoreId!),
    enabled: !!selectedStoreId,
  });

  const recipes: Recipe[] = recipesData?.recipes || [];
  const inventoryItems: any[] = inventoryData?.items || [];

  const createMutation = useMutation({
    mutationFn: (body: { name: string; category: string; sellingPrice: number; ingredients: { itemId: string; quantity: number; unit: string }[] }) =>
      api.createRecipe(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setShowModal(false);
      setForm({ ...emptyForm });
    },
  });

  const categories = useMemo(() => {
    const cats = new Set(recipes.map((r) => r.category));
    return ["All", ...Array.from(cats).sort()];
  }, [recipes]);

  const getIngredientCost = (recipe: Recipe) => {
    return recipe.ingredients.reduce((sum, ing) => {
      const item = inventoryItems.find((i: any) => i.itemId === ing.itemId);
      return sum + (ing.quantity || 0) * (item?.costPerUnit || ing.costPerUnit || 0);
    }, 0);
  };

  const filtered = useMemo(() => {
    let result = recipes;
    if (categoryFilter !== "All") result = result.filter((r) => r.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === "foodCost") {
        aVal = getIngredientCost(a);
        bVal = getIngredientCost(b);
      } else if (sortField === "margin") {
        aVal = a.sellingPrice > 0 ? ((a.sellingPrice - getIngredientCost(a)) / a.sellingPrice) * 100 : 0;
        bVal = b.sellingPrice > 0 ? ((b.sellingPrice - getIngredientCost(b)) / b.sellingPrice) * 100 : 0;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return result;
  }, [recipes, categoryFilter, search, sortField, sortDir, inventoryItems]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
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

  const addIngredientRow = () => {
    setForm({ ...form, ingredients: [...form.ingredients, { itemId: "", quantity: "", unit: "" }] });
  };

  const removeIngredientRow = (idx: number) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const updateIngredient = (idx: number, field: string, value: string) => {
    const updated = [...form.ingredients];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "itemId" && value) {
      const item = inventoryItems.find((i: any) => i.itemId === value);
      if (item) updated[idx].unit = item.unit || "";
    }
    setForm({ ...form, ingredients: updated });
  };

  const handleSubmit = () => {
    if (!form.name || !form.sellingPrice || form.ingredients.every((i) => !i.itemId)) return;
    createMutation.mutate({
      name: form.name,
      category: form.category || "uncategorized",
      sellingPrice: parseFloat(form.sellingPrice),
      ingredients: form.ingredients
        .filter((i) => i.itemId && i.quantity)
        .map((i) => ({ itemId: i.itemId, quantity: parseFloat(i.quantity), unit: i.unit })),
    });
  };

  if (recipesLoading) return <PageLoader />;

  const totalRecipes = recipes.length;
  const avgMargin = totalRecipes > 0
    ? recipes.reduce((sum, r) => {
        const cost = getIngredientCost(r);
        return sum + (r.sellingPrice > 0 ? ((r.sellingPrice - cost) / r.sellingPrice) * 100 : 0);
      }, 0) / totalRecipes
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recipes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {totalRecipes} recipes &middot; Avg margin: {avgMargin.toFixed(1)}%
          </p>
        </div>
        <button
          onClick={() => { setForm({ ...emptyForm }); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Recipe
        </button>
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
            placeholder="Search recipes..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
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
        <EmptyState
          title="No recipes yet"
          description="Create your first recipe to start tracking food costs and margins."
          action={{ label: "Add Recipe", onClick: () => { setForm({ ...emptyForm }); setShowModal(true); } }}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <SortHeader field="name" label="Recipe" />
                  <SortHeader field="category" label="Category" />
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ingredients</th>
                  <SortHeader field="foodCost" label="Food Cost" />
                  <SortHeader field="sellingPrice" label="Selling Price" />
                  <SortHeader field="margin" label="Margin" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((recipe) => {
                  const cost = getIngredientCost(recipe);
                  const margin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - cost) / recipe.sellingPrice) * 100 : 0;
                  const isExpanded = expandedId === recipe.recipeId;
                  return (
                    <tr key={recipe.recipeId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : recipe.recipeId)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l8 7-8 7z" /></svg>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{recipe.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{recipe.category}</td>
                      <td className="px-4 py-3 text-sm text-center text-slate-600 dark:text-slate-300">{recipe.ingredients.length}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{currencyDollars(cost)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{currencyDollars(recipe.sellingPrice)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${margin >= 70 ? "text-green-600" : margin >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded ingredient detail */}
          {expandedId && (() => {
            const recipe = recipes.find((r) => r.recipeId === expandedId);
            if (!recipe) return null;
            return (
              <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/20 px-6 py-4">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Ingredients for {recipe.name}</h4>
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  <span>Item</span><span>Quantity</span><span>Unit</span><span>Cost</span>
                </div>
                {recipe.ingredients.map((ing, idx) => {
                  const item = inventoryItems.find((i: any) => i.itemId === ing.itemId);
                  const lineCost = (ing.quantity || 0) * (item?.costPerUnit || ing.costPerUnit || 0);
                  return (
                    <div key={idx} className="grid grid-cols-4 gap-2 text-sm py-1 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                      <span className="text-slate-900 dark:text-slate-100">{item?.name || ing.itemId}</span>
                      <span className="text-slate-600 dark:text-slate-300">{ing.quantity}</span>
                      <span className="text-slate-500 dark:text-slate-400">{ing.unit}</span>
                      <span className="text-slate-700 dark:text-slate-300">{currencyDollars(lineCost)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Add Recipe Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Recipe</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipe Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Caesar Salad"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Salads"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                    placeholder="12.99"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ingredients</label>
                  <button onClick={addIngredientRow} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Row</button>
                </div>
                <div className="space-y-2">
                  {form.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={ing.itemId}
                        onChange={(e) => updateIngredient(idx, "itemId", e.target.value)}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select item...</option>
                        {inventoryItems.map((item: any) => (
                          <option key={item.itemId} value={item.itemId}>{item.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                        placeholder="Qty"
                        className="w-20 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                        placeholder="Unit"
                        className="w-20 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {form.ingredients.length > 1 && (
                        <button onClick={() => removeIngredientRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !form.name || !form.sellingPrice}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? "Creating..." : "Create Recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
