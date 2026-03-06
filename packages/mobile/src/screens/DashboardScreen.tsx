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
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { colors, fontSize, spacing } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const { user, logout } = useAuth();
  const { setSelectedStore } = useStore();
  const navigation = useNavigation<NavProp>();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleStorePress = (storeId: string, storeName: string) => {
    setSelectedStore(storeId, storeName);
    navigation.navigate("StoreDetail");
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {dashboard && (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Total Sales (30d)"
                value={`$${dashboard.totals.totalSales.toLocaleString()}`}
              />
            </View>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Avg Food Cost"
                value={`${dashboard.totals.avgFoodCostPercentage}%`}
                status={dashboard.totals.avgFoodCostPercentage > 35 ? "red" : dashboard.totals.avgFoodCostPercentage > 30 ? "yellow" : "green"}
              />
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Total Waste"
                value={`$${dashboard.totals.totalWasteCost.toLocaleString()}`}
              />
            </View>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Avg Health Score"
                value={`${dashboard.totals.avgHealthScore}/100`}
                status={dashboard.totals.avgHealthScore >= 75 ? "green" : dashboard.totals.avgHealthScore >= 50 ? "yellow" : "red"}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Your Stores ({dashboard.storeCount})
          </Text>

          {dashboard.stores.map((store: any) => (
            <TouchableOpacity
              key={store.storeId}
              style={styles.storeCard}
              onPress={() => handleStorePress(store.storeId, store.storeName)}
            >
              <View style={styles.storeHeader}>
                <Text style={styles.storeName}>{store.storeName}</Text>
                <StatusBadge
                  status={store.healthStatus}
                  label={`${store.healthScore}/100`}
                />
              </View>

              <View style={styles.storeMetrics}>
                <View style={styles.storeMetric}>
                  <Text style={styles.metricLabel}>Food Cost</Text>
                  <Text style={styles.metricValue}>
                    {store.foodCostPercentage}%
                  </Text>
                  <StatusBadge status={store.foodCostStatus} size="sm" />
                </View>
                <View style={styles.storeMetric}>
                  <Text style={styles.metricLabel}>Waste</Text>
                  <Text style={styles.metricValue}>
                    {store.wastePercentage}%
                  </Text>
                  <StatusBadge status={store.wasteStatus} size="sm" />
                </View>
                <View style={styles.storeMetric}>
                  <Text style={styles.metricLabel}>Sales Trend</Text>
                  <Text style={styles.metricValue}>
                    {store.salesTrend === "up"
                      ? "↑"
                      : store.salesTrend === "down"
                        ? "↓"
                        : "→"}
                  </Text>
                </View>
                <View style={styles.storeMetric}>
                  <Text style={styles.metricLabel}>Low Stock</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      store.lowStockCount > 0 && { color: colors.danger },
                    ]}
                  >
                    {store.lowStockCount}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  greeting: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textSecondary },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { fontSize: fontSize.sm, color: colors.textSecondary },
  metricsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  metricHalf: { flex: 1 },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  storeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  storeName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  storeMetrics: { flexDirection: "row", justifyContent: "space-between" },
  storeMetric: { alignItems: "center" },
  metricLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
});
