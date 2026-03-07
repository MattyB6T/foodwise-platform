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
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function StoreDetailScreen() {
  const { selectedStoreId, selectedStoreName } = useStore();
  const { colors } = useTheme();
  const navigation = useNavigation<NavProp>();
  const [healthScore, setHealthScore] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const s = makeStyles(colors);

  const fetchData = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const [hs, inv, camRes, incRes] = await Promise.all([
        api.getHealthScore(selectedStoreId),
        api.getInventory(selectedStoreId),
        api.listCameras(selectedStoreId).catch(() => ({ cameras: [] })),
        api.listIncidents(selectedStoreId, { status: "open" }).catch(() => ({ incidents: [] })),
      ]);
      setHealthScore(hs);
      setInventory(inv);
      setCameras(camRes.cameras || []);
      setIncidents(incRes.incidents || []);
    } catch (err) {
      console.error("Store detail error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const lowStockItems = (inventory?.items || []).filter(
    (i: any) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
  );

  const quickActions: { icon: keyof typeof Ionicons.glyphMap; label: string; screen: string; bg: string; fg: string }[] = [
    { icon: "scan-outline", label: "Receive", screen: "BarcodeScanner", bg: colors.successLight, fg: colors.primary },
    { icon: "trash-outline", label: "Log Waste", screen: "WasteLog", bg: colors.dangerLight, fg: colors.danger },
    { icon: "cart-outline", label: "Orders", screen: "OrderReview", bg: colors.warningLight, fg: colors.warning },
    { icon: "people-outline", label: "Who's In", screen: "LiveStaff", bg: colors.successLight, fg: colors.secondary },
    { icon: "chatbubble-outline", label: "Assistant", screen: "Assistant", bg: colors.successLight, fg: colors.primary },
  ];

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Hero header */}
      <View style={[s.header, { backgroundColor: colors.primary }]}>
        <View style={s.headerTop}>
          <View style={[s.storeIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Ionicons name="storefront" size={22} color="#fff" />
          </View>
          <Text style={s.storeName}>{selectedStoreName}</Text>
        </View>
        {healthScore && (
          <View style={s.scoreRow}>
            <Text style={s.scoreValue}>{healthScore.overallScore}</Text>
            <View>
              <Text style={s.scoreLabel}>Health Score</Text>
              <StatusBadge status={healthScore.status} />
            </View>
          </View>
        )}
      </View>

      {healthScore && (
        <>
          {/* Score breakdown */}
          <View style={[s.breakdownCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Score Breakdown</Text>
            <View style={s.breakdownRow}>
              {[
                { label: "Food Cost", value: healthScore.components.foodCostScore, icon: "pie-chart-outline" as const },
                { label: "Waste", value: healthScore.components.wasteScore, icon: "trash-outline" as const },
                { label: "Forecast", value: healthScore.components.forecastAccuracyScore, icon: "analytics-outline" as const },
                { label: "Turnover", value: healthScore.components.inventoryTurnoverScore, icon: "repeat-outline" as const },
                { label: "Stockouts", value: healthScore.components.stockoutScore, icon: "alert-circle-outline" as const },
              ].map((item) => (
                <View key={item.label} style={s.breakdownItem}>
                  <View style={[s.breakdownIconWrap, { backgroundColor: colors.successLight }]}>
                    <Ionicons name={item.icon} size={14} color={colors.primary} />
                  </View>
                  <Text style={[s.breakdownValue, { color: colors.text }]}>{item.value}</Text>
                  <Text style={[s.breakdownLabel, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Key Metrics */}
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Key Metrics</Text>
          </View>
          <View style={s.metricsRow}>
            <View style={s.metricHalf}>
              <MetricCard
                title="Food Cost"
                value={`${healthScore.details.foodCostPercentage}%`}
                icon="pie-chart-outline"
                status={healthScore.details.foodCostPercentage > 35 ? "red" : healthScore.details.foodCostPercentage > 30 ? "yellow" : "green"}
              />
            </View>
            <View style={s.metricHalf}>
              <MetricCard
                title="Waste Rate"
                value={`${healthScore.details.wastePercentage}%`}
                icon="trash-outline"
                status={healthScore.details.wastePercentage > 7 ? "red" : healthScore.details.wastePercentage > 4 ? "yellow" : "green"}
              />
            </View>
          </View>

          {/* Recommendations */}
          {healthScore.recommendations.length > 0 && (
            <>
              <View style={s.sectionHeaderRow}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Recommendations</Text>
              </View>
              {healthScore.recommendations.map((rec: string, i: number) => (
                <View key={i} style={[s.recCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <View style={[s.recIconWrap, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={[s.recText, { color: colors.text }]}>{rec}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Low Stock Alerts</Text>
            <View style={[s.countBadge, { backgroundColor: colors.dangerLight }]}>
              <Text style={[s.countBadgeText, { color: colors.danger }]}>{lowStockItems.length}</Text>
            </View>
          </View>
          {lowStockItems.map((item: any) => (
            <View key={item.itemId} style={[s.alertCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <View style={[s.alertIconWrap, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.alertName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[s.alertDetail, { color: colors.textMuted }]}>
                  {item.quantity} {item.unit} remaining (min: {item.lowStockThreshold})
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Quick Actions */}
      <View style={s.sectionHeaderRow}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      </View>
      <View style={s.actionsRow}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.screen}
            style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            onPress={() => navigation.navigate(action.screen as any)}
            activeOpacity={0.7}
          >
            <View style={[s.actionIconWrap, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon} size={20} color={action.fg} />
            </View>
            <Text style={[s.actionLabel, { color: colors.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cameras */}
      {cameras.length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Cameras</Text>
            <Text style={[s.sectionCount, { color: colors.textMuted }]}>{cameras.length} active</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.lg }}>
            {cameras.map((cam: any) => (
              <TouchableOpacity
                key={cam.cameraId}
                style={[s.cameraChip, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                onPress={() => navigation.navigate("Security" as any)}
                activeOpacity={0.7}
              >
                <View style={[s.camDot, { backgroundColor: cam.isOnline ? colors.green : colors.red }]} />
                <Text style={[s.cameraChipText, { color: colors.text }]}>{cam.name}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Open Incidents</Text>
            <View style={[s.countBadge, { backgroundColor: colors.dangerLight }]}>
              <Text style={[s.countBadgeText, { color: colors.danger }]}>{incidents.length}</Text>
            </View>
          </View>
          {incidents.slice(0, 3).map((inc: any) => (
            <TouchableOpacity
              key={inc.incidentId}
              style={[s.incidentCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
              onPress={() => navigation.navigate("Security" as any)}
              activeOpacity={0.7}
            >
              <View style={[s.incidentDot, { backgroundColor: inc.status === "open" ? colors.danger : colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.incidentTitle, { color: colors.text }]}>{inc.title}</Text>
                <Text style={[s.incidentMeta, { color: colors.textMuted }]}>
                  {inc.type} &middot; {new Date(inc.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </>
      )}

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
      padding: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xl,
      borderBottomLeftRadius: borderRadius.xl,
      borderBottomRightRadius: borderRadius.xl,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    storeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    storeName: {
      fontSize: fontSize.xl,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -0.3,
      flex: 1,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    scoreValue: {
      fontSize: 52,
      fontWeight: "900",
      color: "#fff",
      letterSpacing: -2,
    },
    scoreLabel: {
      fontSize: fontSize.sm,
      color: "rgba(255,255,255,0.7)",
      fontWeight: "600",
      marginBottom: spacing.xs,
    },

    // Section headers
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    sectionCount: {
      fontSize: fontSize.sm,
      fontWeight: "500",
    },
    countBadge: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    countBadgeText: {
      fontSize: fontSize.sm,
      fontWeight: "700",
    },

    // Breakdown card
    breakdownCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    breakdownItem: { alignItems: "center", gap: 3 },
    breakdownIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    breakdownValue: { fontSize: fontSize.md, fontWeight: "800" },
    breakdownLabel: { fontSize: fontSize.xs, fontWeight: "500" },

    // Metrics
    metricsRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
    metricHalf: { flex: 1 },

    // Recommendations
    recCard: {
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    recIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    recText: { fontSize: fontSize.sm, lineHeight: 20, flex: 1 },

    // Alerts
    alertCard: {
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    alertIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    alertName: { fontSize: fontSize.md, fontWeight: "700" },
    alertDetail: { fontSize: fontSize.sm, marginTop: 2 },

    // Quick actions
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    actionBtn: {
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: "center",
      width: "18%",
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    actionLabel: { fontSize: fontSize.xs, fontWeight: "700", textAlign: "center" },

    // Cameras
    cameraChip: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginRight: spacing.sm,
      borderWidth: 1,
      gap: spacing.xs,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    camDot: { width: 8, height: 8, borderRadius: 4 },
    cameraChipText: { fontSize: fontSize.sm, fontWeight: "600" },

    // Incidents
    incidentCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    incidentDot: { width: 10, height: 10, borderRadius: 5 },
    incidentTitle: { fontSize: fontSize.sm, fontWeight: "700" },
    incidentMeta: { fontSize: fontSize.xs, marginTop: 2 },
  });
