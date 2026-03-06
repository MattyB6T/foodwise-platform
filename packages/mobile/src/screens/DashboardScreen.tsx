import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const { user, logout } = useAuth();
  const { selectedStoreId, setSelectedStore } = useStore();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavProp>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const s = makeStyles(colors);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getOwnerDashboard();
      setDashboard(data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleStoreSelect = (storeId: string, storeName: string) => {
    setSelectedStore(storeId, storeName);
  };

  const handleStoreDetail = (storeId: string, storeName: string) => {
    setSelectedStore(storeId, storeName);
    navigation.navigate("StoreDetail" as any);
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={s.header}>
        <View>
          <Text style={[s.greeting, { color: colors.text }]}>Welcome back</Text>
          <Text style={[s.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={[s.logoutBtn, { borderColor: colors.border }]}>
          <Text style={[s.logoutText, { color: colors.textSecondary }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {dashboard && (
        <>
          <View style={s.metricsRow}>
            <View style={s.metricHalf}>
              <MetricCard
                title="Total Sales (30d)"
                value={`$${dashboard.totals.totalSales.toLocaleString()}`}
              />
            </View>
            <View style={s.metricHalf}>
              <MetricCard
                title="Avg Food Cost"
                value={`${dashboard.totals.avgFoodCostPercentage}%`}
                status={dashboard.totals.avgFoodCostPercentage > 35 ? "red" : dashboard.totals.avgFoodCostPercentage > 30 ? "yellow" : "green"}
              />
            </View>
          </View>

          <View style={s.metricsRow}>
            <View style={s.metricHalf}>
              <MetricCard
                title="Total Waste"
                value={`$${dashboard.totals.totalWasteCost.toLocaleString()}`}
              />
            </View>
            <View style={s.metricHalf}>
              <MetricCard
                title="Avg Health Score"
                value={`${dashboard.totals.avgHealthScore}/100`}
                status={dashboard.totals.avgHealthScore >= 75 ? "green" : dashboard.totals.avgHealthScore >= 50 ? "yellow" : "red"}
              />
            </View>
          </View>

          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Your Stores ({dashboard.storeCount})
          </Text>

          {dashboard.stores.map((store: any) => {
            const isSelected = selectedStoreId === store.storeId;
            return (
              <TouchableOpacity
                key={store.storeId}
                style={[
                  s.storeCard,
                  { backgroundColor: colors.surface },
                  isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
                ]}
                onPress={() => handleStoreSelect(store.storeId, store.storeName)}
              >
                {isSelected && (
                  <View style={[s.selectedBadge, { backgroundColor: colors.primary }]}>
                    <Text style={s.selectedBadgeText}>Active Store</Text>
                  </View>
                )}
                <View style={s.storeHeader}>
                  <Text style={[s.storeName, { color: colors.text }]}>{store.storeName}</Text>
                  <StatusBadge
                    status={store.healthStatus}
                    label={`${store.healthScore}/100`}
                  />
                </View>

                <View style={s.storeMetrics}>
                  <View style={s.storeMetric}>
                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Food Cost</Text>
                    <Text style={[s.metricValue, { color: colors.text }]}>
                      {store.foodCostPercentage}%
                    </Text>
                    <StatusBadge status={store.foodCostStatus} size="sm" />
                  </View>
                  <View style={s.storeMetric}>
                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Waste</Text>
                    <Text style={[s.metricValue, { color: colors.text }]}>
                      {store.wastePercentage}%
                    </Text>
                    <StatusBadge status={store.wasteStatus} size="sm" />
                  </View>
                  <View style={s.storeMetric}>
                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Sales Trend</Text>
                    <Text style={[s.metricValue, { color: colors.text }]}>
                      {store.salesTrend === "up"
                        ? "\u2191"
                        : store.salesTrend === "down"
                          ? "\u2193"
                          : "\u2192"}
                    </Text>
                  </View>
                  <View style={s.storeMetric}>
                    <Text style={[s.metricLabel, { color: colors.textSecondary }]}>Low Stock</Text>
                    <Text
                      style={[
                        s.metricValue,
                        { color: colors.text },
                        store.lowStockCount > 0 && { color: colors.danger },
                      ]}
                    >
                      {store.lowStockCount}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.detailBtn, { borderTopColor: colors.border }]}
                  onPress={() => handleStoreDetail(store.storeId, store.storeName)}
                >
                  <Text style={[s.detailBtnText, { color: colors.primary }]}>View Full Breakdown →</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    greeting: { fontSize: fontSize.lg, fontWeight: "700" },
    email: { fontSize: fontSize.sm },
    logoutBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
    },
    logoutText: { fontSize: fontSize.sm },
    metricsRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    metricHalf: { flex: 1 },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: "700",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    storeCard: {
      borderRadius: 12,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: "transparent",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    selectedBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
      marginBottom: spacing.xs,
    },
    selectedBadgeText: {
      color: "#fff",
      fontSize: fontSize.xs,
      fontWeight: "700",
    },
    detailBtn: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      alignItems: "center",
    },
    detailBtnText: {
      fontSize: fontSize.sm,
      fontWeight: "700",
    },
    storeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    storeName: { fontSize: fontSize.md, fontWeight: "700" },
    storeMetrics: { flexDirection: "row", justifyContent: "space-between" },
    storeMetric: { alignItems: "center" },
    metricLabel: {
      fontSize: fontSize.xs,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: fontSize.md,
      fontWeight: "600",
      marginBottom: 2,
    },
  });
