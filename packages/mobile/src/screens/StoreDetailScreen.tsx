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
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { colors, fontSize, spacing } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function StoreDetailScreen() {
  const { selectedStoreId, selectedStoreName } = useStore();
  const navigation = useNavigation<NavProp>();
  const [healthScore, setHealthScore] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const lowStockItems = (inventory?.items || []).filter(
    (i: any) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.storeName}>{selectedStoreName}</Text>
        {healthScore && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{healthScore.overallScore}</Text>
            <Text style={styles.scoreLabel}>/100 Health Score</Text>
            <StatusBadge status={healthScore.status} />
          </View>
        )}
      </View>

      {healthScore && (
        <>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.breakdownRow}>
            {[
              { label: "Food Cost", value: healthScore.components.foodCostScore },
              { label: "Waste", value: healthScore.components.wasteScore },
              { label: "Forecast", value: healthScore.components.forecastAccuracyScore },
              { label: "Turnover", value: healthScore.components.inventoryTurnoverScore },
              { label: "Stockouts", value: healthScore.components.stockoutScore },
            ].map((item) => (
              <View key={item.label} style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{item.value}</Text>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Food Cost"
                value={`${healthScore.details.foodCostPercentage}%`}
                status={healthScore.details.foodCostPercentage > 35 ? "red" : healthScore.details.foodCostPercentage > 30 ? "yellow" : "green"}
              />
            </View>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Waste Rate"
                value={`${healthScore.details.wastePercentage}%`}
                status={healthScore.details.wastePercentage > 7 ? "red" : healthScore.details.wastePercentage > 4 ? "yellow" : "green"}
              />
            </View>
          </View>

          {healthScore.recommendations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {healthScore.recommendations.map((rec: string, i: number) => (
                <View key={i} style={styles.recCard}>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {lowStockItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Low Stock Alerts ({lowStockItems.length})
          </Text>
          {lowStockItems.map((item: any) => (
            <View key={item.itemId} style={styles.alertCard}>
              <Text style={styles.alertName}>{item.name}</Text>
              <Text style={styles.alertDetail}>
                {item.quantity} {item.unit} (threshold: {item.lowStockThreshold})
              </Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("BarcodeScanner" as any)}
        >
          <Text style={styles.actionIcon}>📦</Text>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("WasteLog" as any)}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={styles.actionLabel}>Log Waste</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("OrderReview" as any)}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("Assistant" as any)}
        >
          <Text style={styles.actionIcon}>🤖</Text>
          <Text style={styles.actionLabel}>Assistant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("Security" as any)}
        >
          <Text style={styles.actionIcon}>🛡</Text>
          <Text style={styles.actionLabel}>Security</Text>
        </TouchableOpacity>
      </View>

      {/* Camera Quick Links */}
      {cameras.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Cameras ({cameras.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.lg }}>
            {cameras.map((cam: any) => (
              <TouchableOpacity
                key={cam.cameraId}
                style={styles.cameraChip}
                onPress={() => navigation.navigate("Security" as any)}
              >
                <View style={[styles.camDot, cam.isOnline ? styles.camOnline : styles.camOffline]} />
                <Text style={styles.cameraChipText}>{cam.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Recent Incidents */}
      {incidents.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Open Incidents ({incidents.length})</Text>
          {incidents.slice(0, 3).map((inc: any) => (
            <TouchableOpacity
              key={inc.incidentId}
              style={styles.incidentCard}
              onPress={() => navigation.navigate("Security" as any)}
            >
              <View style={styles.incidentRow}>
                <View style={[styles.incidentDot, { backgroundColor: inc.status === "open" ? colors.danger : colors.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.incidentTitle}>{inc.title}</Text>
                  <Text style={styles.incidentMeta}>
                    {inc.type} &middot; {new Date(inc.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.incidentArrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  storeName: { fontSize: fontSize.xl, fontWeight: "800", color: "#fff" },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  scoreValue: { fontSize: 48, fontWeight: "800", color: "#fff" },
  scoreLabel: { fontSize: fontSize.md, color: "rgba(255,255,255,0.7)" },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  breakdownItem: { alignItems: "center" },
  breakdownValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.primary },
  breakdownLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  metricsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  metricHalf: { flex: 1 },
  recCard: {
    backgroundColor: "#EBF8FF",
    borderRadius: 8,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  recText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  alertCard: {
    backgroundColor: "#FED7D7",
    borderRadius: 8,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  alertName: { fontSize: fontSize.md, fontWeight: "600", color: colors.danger },
  alertDetail: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  actionBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    width: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: { fontSize: 28, marginBottom: spacing.xs },
  actionLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },
  cameraChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  camDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  camOnline: { backgroundColor: colors.green },
  camOffline: { backgroundColor: colors.red },
  cameraChipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
  incidentCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  incidentRow: { flexDirection: "row", alignItems: "center" },
  incidentDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  incidentTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  incidentMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  incidentArrow: { fontSize: fontSize.lg, color: colors.textSecondary },
});
