import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

export function ForecastScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const s = makeStyles(colors);

  const loadForecast = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.getStoreDashboard(selectedStoreId);
      setDashboard(result);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  const runForecast = async () => {
    setRunning(true);
    try {
      await api.runForecast();
      Alert.alert("Success", "Forecast generation started. Results will appear shortly.");
      setTimeout(loadForecast, 3000);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to run forecast");
    } finally {
      setRunning(false);
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
        <Text style={[s.title, { color: colors.text }]}>Demand Forecasts</Text>
        <TouchableOpacity
          style={[s.runBtn, { backgroundColor: colors.primary }]}
          onPress={runForecast}
          disabled={running}
        >
          {running ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.runBtnText}>Run Forecast</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : !dashboard ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>No forecast data available yet.{"\n"}Run a forecast to generate predictions.</Text>
        </View>
      ) : (
        <FlatList
          data={dashboard.forecasts || []}
          keyExtractor={(item, i) => item.recipeId || i.toString()}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <View style={[s.summaryCard, { backgroundColor: colors.surface }]}>
              <Text style={[s.summaryTitle, { color: colors.text }]}>Store Overview</Text>
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: colors.primary }]}>{dashboard.inventory?.totalItems || 0}</Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>Items</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: colors.secondary }]}>{dashboard.todayTransactions || 0}</Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>Txns Today</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statNum, { color: colors.warning }]}>{dashboard.lowStockCount || 0}</Text>
                  <Text style={[s.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.forecastCard, { backgroundColor: colors.surface }]}>
              <Text style={[s.forecastName, { color: colors.text }]}>{item.recipeName || item.recipeId}</Text>
              <View style={s.forecastRow}>
                <View style={s.forecastCol}>
                  <Text style={[s.forecastLabel, { color: colors.textSecondary }]}>Predicted</Text>
                  <Text style={[s.forecastValue, { color: colors.primary }]}>{item.predictedDemand || "N/A"}</Text>
                </View>
                <View style={s.forecastCol}>
                  <Text style={[s.forecastLabel, { color: colors.textSecondary }]}>Confidence</Text>
                  <Text style={[s.forecastValue, { color: colors.secondary }]}>{item.confidence ? `${Math.round(item.confidence * 100)}%` : "N/A"}</Text>
                </View>
                <View style={s.forecastCol}>
                  <Text style={[s.forecastLabel, { color: colors.textSecondary }]}>Trend</Text>
                  <Text style={[s.forecastValue, { color: (item.trend || 0) >= 0 ? colors.secondary : colors.danger }]}>
                    {(item.trend || 0) >= 0 ? "+" : ""}{item.trend || 0}%
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>No forecast entries. Run a forecast to see predictions.</Text>
          }
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
    runBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    runBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
    emptyText: { fontSize: fontSize.md, textAlign: "center", lineHeight: 24 },
    summaryCard: { borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
    summaryTitle: { fontSize: fontSize.md, fontWeight: "700", marginBottom: spacing.sm },
    statsRow: { flexDirection: "row", justifyContent: "space-around" },
    stat: { alignItems: "center" },
    statNum: { fontSize: fontSize.xl, fontWeight: "700" },
    statLabel: { fontSize: fontSize.xs },
    forecastCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    forecastName: { fontSize: fontSize.md, fontWeight: "600", marginBottom: spacing.xs },
    forecastRow: { flexDirection: "row", justifyContent: "space-between" },
    forecastCol: { alignItems: "center" },
    forecastLabel: { fontSize: fontSize.xs },
    forecastValue: { fontSize: fontSize.md, fontWeight: "700" },
  });
