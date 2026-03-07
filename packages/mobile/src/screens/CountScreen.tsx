import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

interface InventoryItem {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  updatedAt: string;
}

interface CountItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
}

interface CountSession {
  countId: string;
  storeId: string;
  status: string;
  createdBy: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  completedItems: number;
  discrepancyCount: number;
  notes: string;
  items?: CountItem[];
}

type TopTab = "inventory" | "counts";
type CountView = "history" | "counting" | "variance";

const CATEGORIES = ["Produce", "Dairy", "Meat", "Seafood", "Dry Goods", "Beverages", "Frozen", "Bakery", "Spices", "Other"];
const UNITS = ["lbs", "oz", "kg", "g", "each", "cases", "gallons", "liters", "dozen"];

export function CountScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [topTab, setTopTab] = useState<TopTab>("inventory");

  // Inventory state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [newItem, setNewItem] = useState({
    name: "", category: "Other", quantity: "", unit: "each", costPerUnit: "", lowStockThreshold: "",
  });

  // Count state
  const [countView, setCountView] = useState<CountView>("history");
  const [counts, setCounts] = useState<CountSession[]>([]);
  const [activeCount, setActiveCount] = useState<CountSession | null>(null);
  const [selectedCountCategory, setSelectedCountCategory] = useState("All");
  const [countLoading, setCountLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localQuantities, setLocalQuantities] = useState<Record<string, string>>({});

  // Load inventory
  const loadInventory = useCallback(async () => {
    if (!selectedStoreId) return;
    setInvLoading(true);
    try {
      const result = await api.getInventory(selectedStoreId);
      setItems(result.items || []);
    } catch (err: any) {
      console.error("Load inventory error:", err);
    } finally {
      setInvLoading(false);
    }
  }, [selectedStoreId]);

  // Load counts
  const loadCounts = useCallback(async () => {
    if (!selectedStoreId) return;
    setCountLoading(true);
    try {
      const result = await api.listCounts(selectedStoreId);
      setCounts(result.counts || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load counts");
    } finally {
      setCountLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (topTab === "inventory") loadInventory();
    else loadCounts();
  }, [topTab, loadInventory, loadCounts]);

  // Add item handler
  const handleAddItem = async () => {
    if (!selectedStoreId) return;
    if (!newItem.name.trim()) { Alert.alert("Required", "Item name is required"); return; }
    if (!newItem.quantity || isNaN(Number(newItem.quantity))) { Alert.alert("Required", "Valid quantity is required"); return; }

    setAdding(true);
    try {
      await api.updateInventory(selectedStoreId, {
        items: [{
          name: newItem.name.trim(),
          category: newItem.category,
          quantity: parseFloat(newItem.quantity),
          unit: newItem.unit,
          costPerUnit: parseFloat(newItem.costPerUnit) || 0,
          lowStockThreshold: parseFloat(newItem.lowStockThreshold) || 0,
        }],
      });
      setNewItem({ name: "", category: "Other", quantity: "", unit: "each", costPerUnit: "", lowStockThreshold: "" });
      setShowAddForm(false);
      loadInventory();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add item");
    } finally {
      setAdding(false);
    }
  };

  // Count handlers
  const startNewCount = async () => {
    if (!selectedStoreId) return;
    setCreating(true);
    try {
      const result = await api.createCount(selectedStoreId);
      setActiveCount(result);
      setLocalQuantities({});
      setSelectedCountCategory("All");
      setCountView("counting");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start count");
    } finally {
      setCreating(false);
    }
  };

  const resumeCount = async (countId: string) => {
    if (!selectedStoreId) return;
    setCountLoading(true);
    try {
      const result = await api.getCountVariance(selectedStoreId, countId);
      setActiveCount(result);
      const quantities: Record<string, string> = {};
      (result.items || []).forEach((item: CountItem) => {
        if (item.actualQuantity !== null) quantities[item.itemId] = item.actualQuantity.toString();
      });
      setLocalQuantities(quantities);
      setSelectedCountCategory("All");
      setCountView(result.status === "completed" ? "variance" : "counting");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load count");
    } finally {
      setCountLoading(false);
    }
  };

  const saveProgress = async (complete: boolean) => {
    if (!selectedStoreId || !activeCount) return;
    setSubmitting(true);
    try {
      const countItems = Object.entries(localQuantities)
        .filter(([_, val]) => val !== "")
        .map(([itemId, val]) => ({ itemId, actualQuantity: parseFloat(val) }));

      const result = await api.saveCount(selectedStoreId, activeCount.countId, {
        items: countItems,
        status: complete ? "completed" : "in_progress",
      });

      if (complete) {
        Alert.alert("Count Complete", `${result.completedItems} items counted. ${result.discrepancyCount} discrepancies found.`, [
          { text: "OK", onPress: () => { setCountView("history"); loadCounts(); } },
        ]);
      } else {
        Alert.alert("Saved", "Progress saved successfully.");
        setActiveCount({ ...activeCount, ...result });
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="storefront-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontSize: fontSize.md, color: colors.textMuted, textAlign: "center", marginTop: spacing.md }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  // Filtered inventory items
  const invCategories = ["All", ...new Set(items.map((i) => i.category))];
  const filteredItems = items.filter((i) => {
    const matchesSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === "All" || i.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  // Count sub-views (counting / variance) render without top tabs
  if (topTab === "counts" && countView === "counting" && activeCount) {
    const categories = ["All", ...new Set((activeCount.items || []).map((i) => i.category))];
    const filteredCountItems = (activeCount.items || []).filter(
      (i) => selectedCountCategory === "All" || i.category === selectedCountCategory
    );
    const completedCount = Object.values(localQuantities).filter((v) => v !== "").length;
    const totalCount = activeCount.items?.length || 0;

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Count ({completedCount}/{totalCount})</Text>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: colors.textMuted + "20" }]}
            onPress={() => {
              if (completedCount > 0) {
                Alert.alert("Save Progress?", "Save your current progress before leaving?", [
                  { text: "Discard", style: "destructive", onPress: () => { setCountView("history"); setActiveCount(null); } },
                  { text: "Save", onPress: () => saveProgress(false).then(() => { setCountView("history"); setActiveCount(null); }) },
                  { text: "Cancel", style: "cancel" },
                ]);
              } else {
                setCountView("history");
                setActiveCount(null);
              }
            }}
          >
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={[s.headerBtnText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryBar} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.categoryChip, { backgroundColor: selectedCountCategory === cat ? colors.primary : colors.surface, borderColor: colors.border }]}
              onPress={() => setSelectedCountCategory(cat)}
            >
              <Text style={{ color: selectedCountCategory === cat ? "#fff" : colors.text, fontSize: fontSize.sm, fontWeight: "600" }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          data={filteredCountItems}
          keyExtractor={(item) => item.itemId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const val = localQuantities[item.itemId] || "";
            const hasValue = val !== "";
            const numVal = parseFloat(val);
            const variancePct = hasValue && item.expectedQuantity > 0
              ? Math.round(((numVal - item.expectedQuantity) / item.expectedQuantity) * 100)
              : null;
            const isDiscrepancy = variancePct !== null && Math.abs(variancePct) > 5;

            return (
              <View style={[s.countItemCard, { backgroundColor: colors.surface }, isDiscrepancy && { borderLeftWidth: 3, borderLeftColor: colors.danger }]}>
                <View style={s.countItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, { color: colors.text }]}>{item.itemName}</Text>
                    <Text style={[s.itemMeta, { color: colors.textMuted }]}>Expected: {item.expectedQuantity} {item.unit}</Text>
                  </View>
                  <View style={s.inputContainer}>
                    <TextInput
                      style={[s.qtyInput, { backgroundColor: colors.background, borderColor: isDiscrepancy ? colors.danger : colors.border, color: colors.text }]}
                      value={val}
                      onChangeText={(text) => setLocalQuantities((prev) => ({ ...prev, [item.itemId]: text }))}
                      keyboardType="numeric"
                      placeholder="Qty"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={[s.unitLabel, { color: colors.textMuted }]}>{item.unit}</Text>
                  </View>
                  {variancePct !== null && (
                    <View style={[s.varianceBadge, { backgroundColor: isDiscrepancy ? colors.danger + "20" : colors.secondary + "20" }]}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: isDiscrepancy ? colors.danger : colors.secondary }}>
                        {variancePct > 0 ? "+" : ""}{variancePct}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />

        <View style={s.bottomBar}>
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary + "15" }]} onPress={() => saveProgress(false)} disabled={submitting}>
            <Text style={[s.saveBtnText, { color: colors.primary }]}>Save Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.secondary }, submitting && { opacity: 0.6 }]}
            onPress={() => {
              const cc = Object.values(localQuantities).filter((v) => v !== "").length;
              const tc = activeCount.items?.length || 0;
              Alert.alert("Complete Count?", `${cc}/${tc} items counted. Submit final count?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Submit", onPress: () => saveProgress(true) },
              ]);
            }}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Complete Count</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (topTab === "counts" && countView === "variance" && activeCount) {
    const discrepancies = (activeCount.items || [])
      .filter((i) => i.actualQuantity !== null && Math.abs(i.variancePercent || 0) > 5)
      .sort((a, b) => Math.abs(b.variancePercent || 0) - Math.abs(a.variancePercent || 0));

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Variance Report</Text>
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: colors.textMuted + "20" }]}
            onPress={() => { setCountView("history"); setActiveCount(null); }}
          >
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={[s.headerBtnText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[s.summaryTitle, { color: colors.text }]}>Summary</Text>
          <Text style={[s.summaryText, { color: colors.textMuted }]}>
            Total Items: {activeCount.totalItems} | Counted: {activeCount.completedItems}
          </Text>
          <Text style={[s.summaryText, { color: discrepancies.length > 0 ? colors.danger : colors.secondary }]}>
            Discrepancies ({">"}5%): {discrepancies.length}
          </Text>
        </View>

        {discrepancies.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.secondary} />
            <Text style={[s.emptyText, { color: colors.secondary, marginTop: spacing.sm }]}>No significant discrepancies found!</Text>
          </View>
        ) : (
          <FlatList
            data={discrepancies}
            keyExtractor={(item) => item.itemId}
            contentContainerStyle={{ padding: spacing.md }}
            renderItem={({ item }) => (
              <View style={[s.varianceCard, { backgroundColor: colors.surface }]}>
                <View style={s.varianceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, { color: colors.text }]}>{item.itemName}</Text>
                    <Text style={[s.itemMeta, { color: colors.textMuted }]}>{item.category}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: (item.variancePercent || 0) < 0 ? colors.danger : colors.warning }}>
                      {(item.variancePercent || 0) > 0 ? "+" : ""}{item.variancePercent}%
                    </Text>
                    <Text style={[s.itemMeta, { color: colors.textMuted }]}>Expected: {item.expectedQuantity} {item.unit}</Text>
                    <Text style={[s.itemMeta, { color: colors.textMuted }]}>Actual: {item.actualQuantity} {item.unit}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // Main view with top tabs
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />

      {/* Top Tab Bar */}
      <View style={[s.topTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[s.topTab, topTab === "inventory" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTopTab("inventory")}
        >
          <Ionicons name="cube-outline" size={16} color={topTab === "inventory" ? colors.primary : colors.textMuted} />
          <Text style={[s.topTabText, { color: topTab === "inventory" ? colors.primary : colors.textMuted }]}>Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.topTab, topTab === "counts" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTopTab("counts")}
        >
          <Ionicons name="clipboard-outline" size={16} color={topTab === "counts" ? colors.primary : colors.textMuted} />
          <Text style={[s.topTabText, { color: topTab === "counts" ? colors.primary : colors.textMuted }]}>Counts</Text>
        </TouchableOpacity>
      </View>

      {/* INVENTORY TAB */}
      {topTab === "inventory" && (
        <>
          {/* Search + Add Button */}
          <View style={s.invToolbar}>
            <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder="Search items..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== "" && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryBar} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
            {invCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.categoryChip, { backgroundColor: filterCategory === cat ? colors.primary : colors.surface, borderColor: colors.border }]}
                onPress={() => setFilterCategory(cat)}
              >
                <Text style={{ color: filterCategory === cat ? "#fff" : colors.text, fontSize: fontSize.sm, fontWeight: "600" }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Add Item Form */}
          {showAddForm && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={[s.addFormCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={s.addFormHeader}>
                  <Text style={[s.addFormTitle, { color: colors.text }]}>Add Inventory Item</Text>
                  <TouchableOpacity onPress={() => setShowAddForm(false)}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[s.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Item name *"
                  placeholderTextColor={colors.textMuted}
                  value={newItem.name}
                  onChangeText={(v) => setNewItem((p) => ({ ...p, name: v }))}
                />

                <View style={s.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.formLabel, { color: colors.textMuted }]}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[s.categoryChip, { backgroundColor: newItem.category === cat ? colors.primary : colors.background, borderColor: colors.border, marginBottom: 0 }]}
                          onPress={() => setNewItem((p) => ({ ...p, category: cat }))}
                        >
                          <Text style={{ color: newItem.category === cat ? "#fff" : colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={s.formRow}>
                  <TextInput
                    style={[s.formInput, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Quantity *"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={newItem.quantity}
                    onChangeText={(v) => setNewItem((p) => ({ ...p, quantity: v }))}
                  />
                  <View style={{ flex: 1 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {UNITS.map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[s.unitChip, { backgroundColor: newItem.unit === u ? colors.primary : colors.background, borderColor: colors.border }]}
                          onPress={() => setNewItem((p) => ({ ...p, unit: u }))}
                        >
                          <Text style={{ color: newItem.unit === u ? "#fff" : colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={s.formRow}>
                  <TextInput
                    style={[s.formInput, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Cost per unit ($)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={newItem.costPerUnit}
                    onChangeText={(v) => setNewItem((p) => ({ ...p, costPerUnit: v }))}
                  />
                  <TextInput
                    style={[s.formInput, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="Low stock alert"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={newItem.lowStockThreshold}
                    onChangeText={(v) => setNewItem((p) => ({ ...p, lowStockThreshold: v }))}
                  />
                </View>

                <TouchableOpacity
                  style={[s.addItemBtn, { backgroundColor: colors.primary }, adding && { opacity: 0.6 }]}
                  onPress={handleAddItem}
                  disabled={adding}
                >
                  {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.addItemBtnText}>Add Item</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Inventory List */}
          {invLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : filteredItems.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
              <Text style={[s.emptyText, { color: colors.textMuted, marginTop: spacing.sm }]}>
                {items.length === 0 ? "No inventory items yet.\nTap + to add your first item." : "No items match your search."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.itemId}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
              renderItem={({ item }) => {
                const isLow = item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold;
                return (
                  <View style={[s.invCard, { backgroundColor: colors.surface }, isLow && { borderLeftWidth: 3, borderLeftColor: colors.danger }]}>
                    <View style={s.invCardRow}>
                      <View style={[s.invIconWrap, { backgroundColor: isLow ? colors.danger + "15" : colors.primary + "15" }]}>
                        <Ionicons name={isLow ? "warning-outline" : "cube-outline"} size={18} color={isLow ? colors.danger : colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.itemName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[s.itemMeta, { color: colors.textMuted }]}>{item.category}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.invQty, { color: isLow ? colors.danger : colors.text }]}>
                          {item.quantity} {item.unit}
                        </Text>
                        {item.costPerUnit > 0 && (
                          <Text style={[s.itemMeta, { color: colors.textMuted }]}>${item.costPerUnit.toFixed(2)}/{item.unit}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* COUNTS TAB */}
      {topTab === "counts" && countView === "history" && (
        <>
          <View style={s.header}>
            <Text style={[s.title, { color: colors.text }]}>Inventory Counts</Text>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={startNewCount}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>+ New Count</Text>}
            </TouchableOpacity>
          </View>

          {countLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : counts.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
              <Text style={[s.emptyText, { color: colors.textMuted, marginTop: spacing.sm }]}>
                No inventory counts yet.{"\n"}Start a new count to track accuracy.
              </Text>
            </View>
          ) : (
            <FlatList
              data={counts}
              keyExtractor={(item) => item.countId}
              contentContainerStyle={{ padding: spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.countCard, { backgroundColor: colors.surface }]}
                  onPress={() => resumeCount(item.countId)}
                >
                  <View style={s.countCardHeader}>
                    <View style={[s.statusBadge, { backgroundColor: item.status === "completed" ? colors.secondary + "20" : colors.warning + "20" }]}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: item.status === "completed" ? colors.secondary : colors.warning }}>
                        {item.status === "completed" ? "Completed" : "In Progress"}
                      </Text>
                    </View>
                    {item.discrepancyCount > 0 && (
                      <View style={[s.statusBadge, { backgroundColor: colors.danger + "20" }]}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.danger }}>{item.discrepancyCount} discrepancies</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.countDate, { color: colors.text }]}>
                    {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Text style={[s.itemMeta, { color: colors.textMuted }]}>
                    {item.completedItems}/{item.totalItems} items counted | By: {item.createdBy}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },

    // Top tab bar
    topTabBar: { flexDirection: "row", borderBottomWidth: 1 },
    topTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm + 2 },
    topTabText: { fontSize: fontSize.sm, fontWeight: "700" },

    // Header
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    headerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
    headerBtnText: { fontSize: fontSize.sm, fontWeight: "600" },
    primaryBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
    primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },

    // Search + Add
    invToolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: borderRadius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, gap: spacing.xs },
    searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: fontSize.sm },
    addBtn: { width: 40, height: 40, borderRadius: borderRadius.sm, alignItems: "center", justifyContent: "center" },

    // Category chips
    categoryBar: { maxHeight: 44, marginTop: spacing.sm, marginBottom: spacing.xs },
    categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, marginRight: spacing.xs, borderWidth: 1 },
    unitChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, marginRight: spacing.xs, borderWidth: 1 },

    // Add Form
    addFormCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1 },
    addFormHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
    addFormTitle: { fontSize: fontSize.md, fontWeight: "700" },
    formInput: { borderWidth: 1, borderRadius: borderRadius.sm, padding: spacing.sm, fontSize: fontSize.sm, marginBottom: spacing.sm },
    formLabel: { fontSize: fontSize.xs, fontWeight: "600", marginBottom: 2 },
    formRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
    addItemBtn: { borderRadius: borderRadius.sm, padding: spacing.md, alignItems: "center" },
    addItemBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },

    // Inventory list
    invCard: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
    invCardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    invIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    itemName: { fontSize: fontSize.md, fontWeight: "600" },
    itemMeta: { fontSize: fontSize.xs, marginTop: 2 },
    invQty: { fontSize: fontSize.md, fontWeight: "700" },

    // Count cards
    countCard: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
    countCardHeader: { flexDirection: "row", gap: 8, marginBottom: spacing.xs },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
    countDate: { fontSize: fontSize.md, fontWeight: "600", marginBottom: 2 },

    // Count items
    countItemCard: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
    countItemRow: { flexDirection: "row", alignItems: "center" },
    inputContainer: { alignItems: "center", marginHorizontal: spacing.sm },
    qtyInput: { borderRadius: 8, width: 70, textAlign: "center", padding: spacing.sm, fontSize: fontSize.md, fontWeight: "700", borderWidth: 1 },
    unitLabel: { fontSize: fontSize.xs, marginTop: 2 },
    varianceBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6, minWidth: 50, alignItems: "center" },

    // Variance
    summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.md, padding: spacing.md },
    summaryTitle: { fontSize: fontSize.md, fontWeight: "700", marginBottom: spacing.xs },
    summaryText: { fontSize: fontSize.sm, marginBottom: 2 },
    varianceCard: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
    varianceRow: { flexDirection: "row", alignItems: "center" },

    // Bottom bar
    bottomBar: { flexDirection: "row", padding: spacing.md, gap: spacing.sm },
    saveBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: "center" },
    saveBtnText: { fontSize: fontSize.md, fontWeight: "700" },
    submitBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: "center" },
    submitBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },

    // Empty state
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    emptyText: { fontSize: fontSize.md, textAlign: "center", lineHeight: 24 },
  });
