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
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

interface ExpirationItem {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expirationDate: string;
  daysUntilExpiry: number;
  status: "expired" | "critical" | "warning" | "ok";
}

export function ExpirationScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [daysAhead, setDaysAhead] = useState(7);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newExpDate, setNewExpDate] = useState("");
  const s = makeStyles(colors);

  const loadAlerts = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.getExpirationAlerts(selectedStoreId, daysAhead);
      setItems(result.items || []);
      setSummary(result.summary);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, daysAhead]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const updateExpiration = async (itemId: string, date: string) => {
    if (!selectedStoreId || !date) return;
    try {
      await api.setExpiration(selectedStoreId, { itemId, expirationDate: date });
      setEditingItem(null);
      setNewExpDate("");
      loadAlerts();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "expired": return colors.danger;
      case "critical": return colors.danger;
      case "warning": return colors.warning;
      default: return colors.secondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "expired": return "EXPIRED";
      case "critical": return "EXPIRES SOON";
      case "warning": return "WARNING";
      default: return "OK";
    }
  };

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Expiration Alerts</Text>
        <View style={s.daysSelector}>
          {[3, 7, 14, 30].map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.dayBtn, { backgroundColor: daysAhead === d ? colors.primary : colors.surface, borderColor: colors.border }]}
              onPress={() => setDaysAhead(d)}
            >
              <Text style={{ color: daysAhead === d ? "#fff" : colors.text, fontSize: fontSize.xs, fontWeight: "600" }}>{d}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {summary && (
        <View style={[s.summaryRow, { backgroundColor: colors.surface }]}>
          <View style={[s.summaryBadge, { backgroundColor: colors.danger + "20" }]}>
            <Text style={[s.summaryNum, { color: colors.danger }]}>{summary.expired}</Text>
            <Text style={[s.summaryLabel, { color: colors.danger }]}>Expired</Text>
          </View>
          <View style={[s.summaryBadge, { backgroundColor: colors.danger + "15" }]}>
            <Text style={[s.summaryNum, { color: colors.danger }]}>{summary.critical}</Text>
            <Text style={[s.summaryLabel, { color: colors.danger }]}>Critical</Text>
          </View>
          <View style={[s.summaryBadge, { backgroundColor: colors.warning + "20" }]}>
            <Text style={[s.summaryNum, { color: colors.warning }]}>{summary.warning}</Text>
            <Text style={[s.summaryLabel, { color: colors.warning }]}>Warning</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: colors.secondary }]}>
            No expiration alerts for the next {daysAhead} days
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.itemId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={[s.itemCard, { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: getStatusColor(item.status) }]}>
              <View style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                    {item.quantity} {item.unit} | {item.category}
                  </Text>
                </View>
                <View style={s.expiryInfo}>
                  <View style={[s.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: getStatusColor(item.status) }}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                  <Text style={[s.daysText, { color: getStatusColor(item.status) }]}>
                    {item.daysUntilExpiry < 0
                      ? `${Math.abs(item.daysUntilExpiry)}d overdue`
                      : item.daysUntilExpiry === 0
                      ? "Today"
                      : `${item.daysUntilExpiry}d left`}
                  </Text>
                  <Text style={[s.dateText, { color: colors.textSecondary }]}>
                    {new Date(item.expirationDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              {editingItem === item.itemId ? (
                <View style={s.editRow}>
                  <TextInput
                    style={[s.dateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    value={newExpDate}
                    onChangeText={setNewExpDate}
                  />
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => updateExpiration(item.itemId, newExpDate)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: fontSize.sm }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingItem(null)}>
                    <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => { setEditingItem(item.itemId); setNewExpDate(item.expirationDate.split("T")[0]); }}>
                  <Text style={[s.editLink, { color: colors.primary }]}>Edit date</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    daysSelector: { flexDirection: "row", gap: 4 },
    dayBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    summaryRow: { flexDirection: "row", marginHorizontal: spacing.lg, borderRadius: 10, padding: spacing.md, justifyContent: "space-around", marginBottom: spacing.sm },
    summaryBadge: { alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    summaryNum: { fontSize: fontSize.xl, fontWeight: "700" },
    summaryLabel: { fontSize: fontSize.xs, fontWeight: "600" },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    emptyText: { fontSize: fontSize.md, textAlign: "center" },
    itemCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    itemRow: { flexDirection: "row", alignItems: "center" },
    itemName: { fontSize: fontSize.md, fontWeight: "600" },
    itemDetail: { fontSize: fontSize.xs, marginTop: 2 },
    expiryInfo: { alignItems: "flex-end" },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6, marginBottom: 2 },
    daysText: { fontSize: fontSize.sm, fontWeight: "700" },
    dateText: { fontSize: fontSize.xs },
    editRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
    dateInput: { borderRadius: 8, padding: spacing.sm, fontSize: fontSize.sm, borderWidth: 1, flex: 1 },
    saveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    editLink: { fontSize: fontSize.xs, marginTop: spacing.xs },
  });
