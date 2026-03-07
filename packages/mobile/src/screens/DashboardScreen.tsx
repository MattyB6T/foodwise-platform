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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.primary }]}>
        <View style={s.headerContent}>
          <View>
            <Text style={s.greeting}>Welcome back</Text>
            <Text style={s.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={s.logoutBtn} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics */}
      <View style={s.metricsSection}>
        {dashboard?.totals && (
          <>
            <View style={s.metricsRow}>
              <View style={s.metricHalf}>
                <MetricCard
                  title="Total Sales"
                  value={`$${(dashboard.totals.totalSales ?? 0).toLocaleString()}`}
                  subtitle="Last 30 days"
                  icon="cash-outline"
                  status="green"
                />
              </View>
              <View style={s.metricHalf}>
                <MetricCard
                  title="Food Cost"
                  value={`${dashboard.totals.avgFoodCostPercentage ?? 0}%`}
                  icon="pie-chart-outline"
                  status={(dashboard.totals.avgFoodCostPercentage ?? 0) > 35 ? "red" : (dashboard.totals.avgFoodCostPercentage ?? 0) > 30 ? "yellow" : "green"}
                />
              </View>
            </View>

            <View style={s.metricsRow}>
              <View style={s.metricHalf}>
                <MetricCard
                  title="Total Waste"
                  value={`$${(dashboard.totals.totalWasteCost ?? 0).toLocaleString()}`}
                  icon="trash-outline"
                  status="red"
                />
              </View>
              <View style={s.metricHalf}>
                <MetricCard
                  title="Health Score"
                  value={`${dashboard.totals.avgHealthScore ?? 0}`}
                  subtitle="out of 100"
                  icon="heart-outline"
                  status={(dashboard.totals.avgHealthScore ?? 0) >= 75 ? "green" : (dashboard.totals.avgHealthScore ?? 0) >= 50 ? "yellow" : "red"}
                />
              </View>
            </View>
          </>
        )}
      </View>

      {/* Stores Section */}
      <View style={s.sectionHeaderRow}>
        <View>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Your Stores</Text>
          <Text style={[s.sectionSubtitle, { color: colors.textMuted }]}>
            {dashboard?.storeCount ?? 0} location{(dashboard?.storeCount ?? 0) !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {(dashboard?.stores || []).map((store: any) => {
        const isSelected = selectedStoreId === store.storeId;
        return (
          <TouchableOpacity
            key={store.storeId}
            style={[
              s.storeCard,
              { backgroundColor: colors.card, borderColor: colors.borderLight },
              isSelected && { borderColor: colors.primary, borderWidth: 2 },
            ]}
            onPress={() => handleStoreSelect(store.storeId, store.storeName)}
            activeOpacity={0.7}
          >
            {isSelected && (
              <View style={[s.selectedBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark-circle" size={12} color="#fff" />
                <Text style={s.selectedBadgeText}>Active</Text>
              </View>
            )}

            <View style={s.storeHeader}>
              <View style={s.storeNameRow}>
                <View style={[s.storeIcon, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[s.storeName, { color: colors.text }]}>{store.storeName}</Text>
              </View>
              <StatusBadge
                status={store.healthStatus}
                label={`${store.healthScore}/100`}
              />
            </View>

            <View style={[s.storeMetrics, { borderColor: colors.borderLight }]}>
              <View style={s.storeMetric}>
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>Food Cost</Text>
                <Text style={[s.metricValue, { color: colors.text }]}>
                  {store.foodCostPercentage}%
                </Text>
                <StatusBadge status={store.foodCostStatus} size="sm" />
              </View>
              <View style={[s.metricDivider, { backgroundColor: colors.borderLight }]} />
              <View style={s.storeMetric}>
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>Waste</Text>
                <Text style={[s.metricValue, { color: colors.text }]}>
                  {store.wastePercentage}%
                </Text>
                <StatusBadge status={store.wasteStatus} size="sm" />
              </View>
              <View style={[s.metricDivider, { backgroundColor: colors.borderLight }]} />
              <View style={s.storeMetric}>
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>Trend</Text>
                <Ionicons
                  name={store.salesTrend === "up" ? "trending-up" : store.salesTrend === "down" ? "trending-down" : "remove"}
                  size={22}
                  color={store.salesTrend === "up" ? colors.green : store.salesTrend === "down" ? colors.red : colors.textMuted}
                />
              </View>
              <View style={[s.metricDivider, { backgroundColor: colors.borderLight }]} />
              <View style={s.storeMetric}>
                <Text style={[s.metricLabel, { color: colors.textMuted }]}>Low Stock</Text>
                <Text
                  style={[
                    s.metricValue,
                    { color: store.lowStockCount > 0 ? colors.danger : colors.text },
                    store.lowStockCount > 0 && { fontWeight: "800" },
                  ]}
                >
                  {store.lowStockCount}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.detailBtn, { backgroundColor: colors.successLight }]}
              onPress={() => handleStoreDetail(store.storeId, store.storeName)}
              activeOpacity={0.7}
            >
              <Text style={[s.detailBtnText, { color: colors.primary }]}>View Full Breakdown</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    // Header
    header: {
      paddingTop: spacing.xl + spacing.sm,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderBottomLeftRadius: borderRadius.xl,
      borderBottomRightRadius: borderRadius.xl,
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    greeting: {
      fontSize: fontSize.xl,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -0.3,
    },
    email: {
      fontSize: fontSize.sm,
      color: "rgba(255,255,255,0.7)",
      marginTop: 2,
    },
    logoutBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },

    // Metrics
    metricsSection: {
      marginTop: -spacing.sm,
      paddingTop: spacing.md,
    },
    metricsRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    metricHalf: { flex: 1 },

    // Section header
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: fontSize.sm,
      marginTop: 2,
    },

    // Store card
    storeCard: {
      borderRadius: borderRadius.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.md + 2,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    selectedBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      marginBottom: spacing.sm,
    },
    selectedBadgeText: {
      color: "#fff",
      fontSize: fontSize.xs,
      fontWeight: "700",
    },
    storeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    storeNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },
    storeIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    storeName: {
      fontSize: fontSize.md,
      fontWeight: "700",
      flex: 1,
    },
    storeMetrics: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: spacing.md,
      borderTopWidth: 1,
    },
    storeMetric: {
      alignItems: "center",
      flex: 1,
      gap: 3,
    },
    metricDivider: {
      width: 1,
      alignSelf: "stretch",
    },
    metricLabel: {
      fontSize: fontSize.xs,
      fontWeight: "500",
    },
    metricValue: {
      fontSize: fontSize.md,
      fontWeight: "700",
    },
    detailBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
    },
    detailBtnText: {
      fontSize: fontSize.sm,
      fontWeight: "700",
    },
  });
