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
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
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

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
      }
    >
      <View style={[s.header, { backgroundColor: colors.primary }]}>
        <Text style={s.storeName}>{selectedStoreName}</Text>
        {healthScore && (
          <View style={s.scoreRow}>
            <Text style={s.scoreValue}>{healthScore.overallScore}</Text>
            <Text style={s.scoreLabel}>/100 Health Score</Text>
            <StatusBadge status={healthScore.status} />
          </View>
        )}
      </View>

      {healthScore && (
        <>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Score Breakdown</Text>
          <View style={s.breakdownRow}>
            {[
              { label: "Food Cost", value: healthScore.components.foodCostScore },
              { label: "Waste", value: healthScore.components.wasteScore },
              { label: "Forecast", value: healthScore.components.forecastAccuracyScore },
              { label: "Turnover", value: healthScore.components.inventoryTurnoverScore },
              { label: "Stockouts", value: healthScore.components.stockoutScore },
            ].map((item) => (
              <View key={item.label} style={s.breakdownItem}>
                <Text style={[s.breakdownValue, { color: colors.primary }]}>{item.value}</Text>
                <Text style={[s.breakdownLabel, { color: colors.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.sectionTitle, { color: colors.text }]}>Key Metrics</Text>
          <View style={s.metricsRow}>
            <View style={s.metricHalf}>
              <MetricCard
                title="Food Cost"
                value={`${healthScore.details.foodCostPercentage}%`}
                status={healthScore.details.foodCostPercentage > 35 ? "red" : healthScore.details.foodCostPercentage > 30 ? "yellow" : "green"}
              />
            </View>
            <View style={s.metricHalf}>
              <MetricCard
                title="Waste Rate"
                value={`${healthScore.details.wastePercentage}%`}
                status={healthScore.details.wastePercentage > 7 ? "red" : healthScore.details.wastePercentage > 4 ? "yellow" : "green"}
              />
            </View>
          </View>

          {healthScore.recommendations.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Recommendations</Text>
              {healthScore.recommendations.map((rec: string, i: number) => (
                <View key={i} style={[s.recCard, { backgroundColor: colors.surface, borderLeftColor: colors.primaryLight }]}>
                  <Text style={[s.recText, { color: colors.text }]}>{rec}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {lowStockItems.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Low Stock Alerts ({lowStockItems.length})
          </Text>
          {lowStockItems.map((item: any) => (
            <View key={item.itemId} style={[s.alertCard, { backgroundColor: colors.danger + "20", borderWidth: 1, borderColor: colors.danger + "40" }]}>
              <Text style={[s.alertName, { color: colors.danger }]}>{item.name}</Text>
              <Text style={[s.alertDetail, { color: colors.text }]}>
                {item.quantity} {item.unit} (threshold: {item.lowStockThreshold})
              </Text>
            </View>
          ))}
        </>
      )}

      <View style={s.actionsRow}>
        {[
          { icon: "📦", label: "Receive", screen: "BarcodeScanner" },
          { icon: "🗑️", label: "Log Waste", screen: "WasteLog" },
          { icon: "📋", label: "Orders", screen: "OrderReview" },
          { icon: "👥", label: "Who's In", screen: "LiveStaff" },
          { icon: "🤖", label: "Assistant", screen: "Assistant" },
        ].map((action) => (
          <TouchableOpacity
            key={action.screen}
            style={[s.actionBtn, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate(action.screen as any)}
          >
            <Text style={s.actionIcon}>{action.icon}</Text>
            <Text style={[s.actionLabel, { color: colors.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cameras.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Cameras ({cameras.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.lg }}>
            {cameras.map((cam: any) => (
              <TouchableOpacity
                key={cam.cameraId}
                style={[s.cameraChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate("Security" as any)}
              >
                <View style={[s.camDot, { backgroundColor: cam.isOnline ? colors.green : colors.red }]} />
                <Text style={[s.cameraChipText, { color: colors.text }]}>{cam.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {incidents.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Open Incidents ({incidents.length})</Text>
          {incidents.slice(0, 3).map((inc: any) => (
            <TouchableOpacity
              key={inc.incidentId}
              style={[s.incidentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate("Security" as any)}
            >
              <View style={s.incidentRow}>
                <View style={[s.incidentDot, { backgroundColor: inc.status === "open" ? colors.danger : colors.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.incidentTitle, { color: colors.text }]}>{inc.title}</Text>
                  <Text style={[s.incidentMeta, { color: colors.textSecondary }]}>
                    {inc.type} &middot; {new Date(inc.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[s.incidentArrow, { color: colors.textSecondary }]}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { padding: spacing.lg, paddingTop: spacing.xl },
    storeName: { fontSize: fontSize.xl, fontWeight: "800", color: "#fff" },
    scoreRow: { flexDirection: "row", alignItems: "baseline", marginTop: spacing.sm, gap: spacing.xs },
    scoreValue: { fontSize: 48, fontWeight: "800", color: "#fff" },
    scoreLabel: { fontSize: fontSize.md, color: "rgba(255,255,255,0.7)" },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", padding: spacing.lg, paddingBottom: spacing.sm },
    breakdownRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    breakdownItem: { alignItems: "center" },
    breakdownValue: { fontSize: fontSize.lg, fontWeight: "700" },
    breakdownLabel: { fontSize: fontSize.xs },
    metricsRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
    metricHalf: { flex: 1 },
    recCard: { borderRadius: 8, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderLeftWidth: 3 },
    recText: { fontSize: fontSize.sm, lineHeight: 20 },
    alertCard: { borderRadius: 8, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    alertName: { fontSize: fontSize.md, fontWeight: "600" },
    alertDetail: { fontSize: fontSize.sm, marginTop: 2 },
    actionsRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
    actionBtn: { borderRadius: 12, padding: spacing.md, alignItems: "center", width: 80, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    actionIcon: { fontSize: 28, marginBottom: spacing.xs },
    actionLabel: { fontSize: fontSize.xs, fontWeight: "600" },
    cameraChip: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm, borderWidth: 1 },
    camDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
    cameraChipText: { fontSize: fontSize.sm, fontWeight: "600" },
    incidentCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: 10, padding: spacing.md, borderWidth: 1 },
    incidentRow: { flexDirection: "row", alignItems: "center" },
    incidentDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
    incidentTitle: { fontSize: fontSize.sm, fontWeight: "600" },
    incidentMeta: { fontSize: fontSize.xs, marginTop: 2 },
    incidentArrow: { fontSize: fontSize.lg },
  });
