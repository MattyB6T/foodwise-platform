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
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

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

type ViewMode = "history" | "counting" | "variance";

export function CountScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>("history");
  const [counts, setCounts] = useState<CountSession[]>([]);
  const [activeCount, setActiveCount] = useState<CountSession | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localQuantities, setLocalQuantities] = useState<Record<string, string>>({});
  const s = makeStyles(colors);

  const loadCounts = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.listCounts(selectedStoreId);
      setCounts(result.counts || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load counts");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const startNewCount = async () => {
    if (!selectedStoreId) return;
    setCreating(true);
    try {
      const result = await api.createCount(selectedStoreId);
      setActiveCount(result);
      setLocalQuantities({});
      setSelectedCategory("All");
      setViewMode("counting");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start count");
    } finally {
      setCreating(false);
    }
  };

  const resumeCount = async (countId: string) => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.getCountVariance(selectedStoreId, countId);
      setActiveCount(result);
      const quantities: Record<string, string> = {};
      (result.items || []).forEach((item: CountItem) => {
        if (item.actualQuantity !== null) {
          quantities[item.itemId] = item.actualQuantity.toString();
        }
      });
      setLocalQuantities(quantities);
      setSelectedCategory("All");
      if (result.status === "completed") {
        setViewMode("variance");
      } else {
        setViewMode("counting");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load count");
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (complete: boolean) => {
    if (!selectedStoreId || !activeCount) return;
    setSubmitting(true);
    try {
      const items = Object.entries(localQuantities)
        .filter(([_, val]) => val !== "")
        .map(([itemId, val]) => ({
          itemId,
          actualQuantity: parseFloat(val),
        }));

      const result = await api.saveCount(selectedStoreId, activeCount.countId, {
        items,
        status: complete ? "completed" : "in_progress",
      });

      if (complete) {
        Alert.alert(
          "Count Complete",
          `${result.completedItems} items counted. ${result.discrepancyCount} discrepancies found.`,
          [{ text: "OK", onPress: () => { setViewMode("history"); loadCounts(); } }]
        );
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

  const categories = activeCount?.items
    ? ["All", ...new Set(activeCount.items.map((i) => i.category))]
    : ["All"];

  const filteredItems = activeCount?.items?.filter(
    (i) => selectedCategory === "All" || i.category === selectedCategory
  ) || [];

  const completedCount = Object.values(localQuantities).filter((v) => v !== "").length;
  const totalCount = activeCount?.items?.length || 0;

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  if (viewMode === "history") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <StorePicker />
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Inventory Counts</Text>
          <TouchableOpacity
            style={[s.newBtn, { backgroundColor: colors.primary }]}
            onPress={startNewCount}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.newBtnText}>+ New Count</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : counts.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>
              No inventory counts yet.{"\n"}Start a new count to track inventory accuracy.
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
                  <View style={[
                    s.statusBadge,
                    { backgroundColor: item.status === "completed" ? colors.secondary + "20" : colors.warning + "20" },
                  ]}>
                    <Text style={{
                      fontSize: fontSize.xs,
                      fontWeight: "600",
                      color: item.status === "completed" ? colors.secondary : colors.warning,
                    }}>
                      {item.status === "completed" ? "Completed" : "In Progress"}
                    </Text>
                  </View>
                  {item.discrepancyCount > 0 && (
                    <View style={[s.statusBadge, { backgroundColor: colors.danger + "20" }]}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: "600", color: colors.danger }}>
                        {item.discrepancyCount} discrepancies
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.countDate, { color: colors.text }]}>
                  {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text style={[s.countMeta, { color: colors.textSecondary }]}>
                  {item.completedItems}/{item.totalItems} items counted | By: {item.createdBy}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  if (viewMode === "variance" && activeCount) {
    const discrepancies = (activeCount.items || [])
      .filter((i) => i.actualQuantity !== null && Math.abs(i.variancePercent || 0) > 5)
      .sort((a, b) => Math.abs(b.variancePercent || 0) - Math.abs(a.variancePercent || 0));

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Variance Report</Text>
          <TouchableOpacity
            style={[s.newBtn, { backgroundColor: colors.textSecondary }]}
            onPress={() => { setViewMode("history"); setActiveCount(null); }}
          >
            <Text style={s.newBtnText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.summaryCard, { backgroundColor: colors.surface }]}>
          <Text style={[s.summaryTitle, { color: colors.text }]}>Summary</Text>
          <Text style={[s.summaryText, { color: colors.textSecondary }]}>
            Total Items: {activeCount.totalItems} | Counted: {activeCount.completedItems}
          </Text>
          <Text style={[s.summaryText, { color: discrepancies.length > 0 ? colors.danger : colors.secondary }]}>
            Discrepancies ({">"}5%): {discrepancies.length}
          </Text>
        </View>

        {discrepancies.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={[s.emptyText, { color: colors.secondary }]}>
              No significant discrepancies found!
            </Text>
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
                    <Text style={[s.itemCategory, { color: colors.textSecondary }]}>{item.category}</Text>
                  </View>
                  <View style={s.varianceData}>
                    <Text style={[s.variancePercent, {
                      color: (item.variancePercent || 0) < 0 ? colors.danger : colors.warning,
                    }]}>
                      {(item.variancePercent || 0) > 0 ? "+" : ""}{item.variancePercent}%
                    </Text>
                    <Text style={[s.varianceDetail, { color: colors.textSecondary }]}>
                      Expected: {item.expectedQuantity} {item.unit}
                    </Text>
                    <Text style={[s.varianceDetail, { color: colors.textSecondary }]}>
                      Actual: {item.actualQuantity} {item.unit}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // Counting view
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>
          Count ({completedCount}/{totalCount})
        </Text>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: colors.textSecondary }]}
          onPress={() => {
            if (completedCount > 0) {
              Alert.alert("Save Progress?", "Save your current progress before leaving?", [
                { text: "Discard", style: "destructive", onPress: () => { setViewMode("history"); setActiveCount(null); } },
                { text: "Save", onPress: () => saveProgress(false).then(() => { setViewMode("history"); setActiveCount(null); }) },
                { text: "Cancel", style: "cancel" },
              ]);
            } else {
              setViewMode("history");
              setActiveCount(null);
            }
          }}
        >
          <Text style={s.newBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryBar} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              s.categoryTab,
              { backgroundColor: selectedCategory === cat ? colors.primary : colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={{ color: selectedCategory === cat ? "#fff" : colors.text, fontSize: fontSize.sm, fontWeight: "600" }}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.itemId}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => {
          const val = localQuantities[item.itemId] || "";
          const hasValue = val !== "";
          const numVal = parseFloat(val);
          const variance = hasValue ? numVal - item.expectedQuantity : null;
          const variancePct = hasValue && item.expectedQuantity > 0
            ? Math.round(((numVal - item.expectedQuantity) / item.expectedQuantity) * 100)
            : null;
          const isDiscrepancy = variancePct !== null && Math.abs(variancePct) > 5;

          return (
            <View style={[
              s.countItemCard,
              { backgroundColor: colors.surface },
              isDiscrepancy && { borderLeftWidth: 3, borderLeftColor: colors.danger },
            ]}>
              <View style={s.countItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, { color: colors.text }]}>{item.itemName}</Text>
                  <Text style={[s.itemCategory, { color: colors.textSecondary }]}>
                    Expected: {item.expectedQuantity} {item.unit}
                  </Text>
                </View>
                <View style={s.inputContainer}>
                  <TextInput
                    style={[
                      s.qtyInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: isDiscrepancy ? colors.danger : colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={val}
                    onChangeText={(text) => setLocalQuantities((prev) => ({ ...prev, [item.itemId]: text }))}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={[s.unitLabel, { color: colors.textSecondary }]}>{item.unit}</Text>
                </View>
                {variancePct !== null && (
                  <View style={[s.varianceBadge, { backgroundColor: isDiscrepancy ? colors.danger + "20" : colors.secondary + "20" }]}>
                    <Text style={{
                      fontSize: fontSize.xs,
                      fontWeight: "700",
                      color: isDiscrepancy ? colors.danger : colors.secondary,
                    }}>
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
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: colors.primaryLight }]}
          onPress={() => saveProgress(false)}
          disabled={submitting}
        >
          <Text style={[s.saveBtnText, { color: colors.primary }]}>Save Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: colors.secondary }, submitting && { opacity: 0.6 }]}
          onPress={() => {
            Alert.alert("Complete Count?", `${completedCount}/${totalCount} items counted. Submit final count?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Submit", onPress: () => saveProgress(true) },
            ]);
          }}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>Complete Count</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    newBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    newBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    emptyText: { fontSize: fontSize.md, textAlign: "center", lineHeight: 24 },
    countCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    countCardHeader: { flexDirection: "row", gap: 8, marginBottom: spacing.xs },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
    countDate: { fontSize: fontSize.md, fontWeight: "600", marginBottom: 2 },
    countMeta: { fontSize: fontSize.xs },
    summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: 10, padding: spacing.md },
    summaryTitle: { fontSize: fontSize.md, fontWeight: "700", marginBottom: spacing.xs },
    summaryText: { fontSize: fontSize.sm, marginBottom: 2 },
    varianceCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    varianceRow: { flexDirection: "row", alignItems: "center" },
    varianceData: { alignItems: "flex-end" },
    variancePercent: { fontSize: fontSize.lg, fontWeight: "700" },
    varianceDetail: { fontSize: fontSize.xs },
    categoryBar: { maxHeight: 44, marginBottom: spacing.sm },
    categoryTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, marginRight: spacing.sm, borderWidth: 1 },
    countItemCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    countItemRow: { flexDirection: "row", alignItems: "center" },
    itemName: { fontSize: fontSize.md, fontWeight: "600" },
    itemCategory: { fontSize: fontSize.xs, marginTop: 2 },
    inputContainer: { alignItems: "center", marginHorizontal: spacing.sm },
    qtyInput: { borderRadius: 8, width: 70, textAlign: "center", padding: spacing.sm, fontSize: fontSize.md, fontWeight: "700", borderWidth: 1 },
    unitLabel: { fontSize: fontSize.xs, marginTop: 2 },
    varianceBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6, minWidth: 50, alignItems: "center" },
    bottomBar: { flexDirection: "row", padding: spacing.md, gap: spacing.sm },
    saveBtn: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: "center" },
    saveBtnText: { fontSize: fontSize.md, fontWeight: "700" },
    submitBtn: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: "center" },
    submitBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
