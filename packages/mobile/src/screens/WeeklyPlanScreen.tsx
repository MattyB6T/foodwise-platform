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
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { StatusBadge } from "../components/StatusBadge";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";

interface DayPlan {
  date: string;
  dayName: string;
  projectedRevenue: number;
  projectedTransactions: number;
  recommendedStaffCount: number;
  recommendedStaffHours: number;
  projectedLaborCost: number;
  projectedFoodCost: number;
  confidence: "high" | "medium" | "low";
}

interface OrderRecommendation {
  ingredientName: string;
  currentStock: number;
  unit: string;
  projectedUsage: number;
  recommendedOrder: number;
  bufferAmount: number;
  urgency: "order-now" | "order-soon" | "adequate";
}

interface WeeklyPlanData {
  storeId: string;
  storeName: string;
  weekStarting: string;
  bufferPercentage: number;
  dayPlans: DayPlan[];
  weekTotals: {
    projectedRevenue: number;
    projectedFoodCost: number;
    projectedLaborCost: number;
    projectedWasteCost: number;
    projectedProfit: number;
    profitMargin: number;
    recommendedTotalStaffHours: number;
  };
  orderRecommendations: OrderRecommendation[];
  wasteAlerts: string[];
  aiInsights?: string;
  dataQuality: {
    weeksOfData: number;
    confidence: "high" | "medium" | "low";
    message: string;
  };
  generatedAt: string;
}

const BUFFER_OPTIONS = [5, 10, 15, 20, 25];

export function WeeklyPlanScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [plan, setPlan] = useState<WeeklyPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buffer, setBuffer] = useState(15);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (!selectedStoreId) {
      setError("Select a store from the Dashboard first");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await api.getWeeklyPlan(selectedStoreId, buffer);
      setPlan(data);
    } catch (err: any) {
      setError(err.message || "Failed to load weekly plan");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStoreId, buffer]);

  useEffect(() => {
    setLoading(true);
    fetchPlan();
  }, [fetchPlan]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlan();
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return colors.green;
    if (c === "medium") return colors.yellow;
    return colors.red;
  };

  const urgencyStyle = (u: string) => {
    if (u === "order-now") return { bg: colors.dangerLight, text: colors.danger, label: "Order Now" };
    if (u === "order-soon") return { bg: colors.warningLight, text: colors.warning, label: "Order Soon" };
    return { bg: colors.successLight, text: colors.green, label: "OK" };
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.loadingText, { color: colors.textSecondary }]}>
          Analyzing historical data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[s.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchPlan}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!plan) return null;

  const orderNowCount = plan.orderRecommendations.filter((o) => o.urgency === "order-now").length;
  const orderSoonCount = plan.orderRecommendations.filter((o) => o.urgency === "order-soon").length;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Summary */}
      <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
        <Text style={s.summaryTitle}>Week of {plan.weekStarting}</Text>
        <Text style={s.summaryStore}>{plan.storeName}</Text>

        <View style={s.summaryRow}>
          <View style={s.summaryMetric}>
            <Text style={s.summaryValue}>${plan.weekTotals.projectedRevenue.toLocaleString()}</Text>
            <Text style={s.summaryLabel}>Projected Revenue</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryMetric}>
            <Text style={s.summaryValue}>{plan.weekTotals.profitMargin}%</Text>
            <Text style={s.summaryLabel}>Profit Margin</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryMetric}>
            <Text style={s.summaryValue}>{plan.weekTotals.recommendedTotalStaffHours}h</Text>
            <Text style={s.summaryLabel}>Staff Hours</Text>
          </View>
        </View>

        <View style={s.costRow}>
          <View style={s.costPill}>
            <Text style={s.costPillLabel}>Food</Text>
            <Text style={s.costPillValue}>${plan.weekTotals.projectedFoodCost.toLocaleString()}</Text>
          </View>
          <View style={s.costPill}>
            <Text style={s.costPillLabel}>Labor</Text>
            <Text style={s.costPillValue}>${plan.weekTotals.projectedLaborCost.toLocaleString()}</Text>
          </View>
          <View style={s.costPill}>
            <Text style={s.costPillLabel}>Waste</Text>
            <Text style={s.costPillValue}>${plan.weekTotals.projectedWasteCost.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Data Quality Banner */}
      {plan.dataQuality && plan.dataQuality.confidence !== "high" && (
        <View style={[s.qualityBanner, {
          backgroundColor: plan.dataQuality.confidence === "medium" ? colors.warningLight : colors.dangerLight,
          borderColor: plan.dataQuality.confidence === "medium" ? colors.warning : colors.danger,
        }]}>
          <Ionicons
            name="information-circle"
            size={18}
            color={plan.dataQuality.confidence === "medium" ? colors.warning : colors.danger}
          />
          <Text style={[s.qualityText, {
            color: plan.dataQuality.confidence === "medium" ? colors.warning : colors.danger,
          }]}>
            {plan.dataQuality.message}
          </Text>
        </View>
      )}

      {/* Buffer Selector */}
      <View style={s.bufferSection}>
        <Text style={[s.bufferLabel, { color: colors.text }]}>Safety Buffer</Text>
        <View style={s.bufferRow}>
          {BUFFER_OPTIONS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[
                s.bufferChip,
                { borderColor: colors.borderLight },
                buffer === b && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setBuffer(b)}
            >
              <Text
                style={[
                  s.bufferChipText,
                  { color: colors.textSecondary },
                  buffer === b && { color: "#fff" },
                ]}
              >
                {b}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Insights */}
      {plan.aiInsights && (
        <View style={[s.insightsCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <View style={s.insightsHeader}>
            <View style={[s.insightsIcon, { backgroundColor: "#e9d8fd" }]}>
              <Ionicons name="sparkles" size={18} color="#805ad5" />
            </View>
            <Text style={[s.insightsTitle, { color: colors.text }]}>AI Insights</Text>
          </View>
          <Text style={[s.insightsText, { color: colors.textSecondary }]}>
            {plan.aiInsights}
          </Text>
        </View>
      )}

      {/* Day Plans */}
      <View style={s.sectionHeaderRow}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Daily Breakdown</Text>
      </View>

      {plan.dayPlans.map((day) => {
        const isExpanded = expandedDay === day.date;
        return (
          <TouchableOpacity
            key={day.date}
            style={[s.dayCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            onPress={() => setExpandedDay(isExpanded ? null : day.date)}
            activeOpacity={0.7}
          >
            <View style={s.dayHeader}>
              <View style={s.dayNameRow}>
                <Text style={[s.dayName, { color: colors.text }]}>{day.dayName}</Text>
                <Text style={[s.dayDate, { color: colors.textMuted }]}>{day.date}</Text>
              </View>
              <View style={s.dayRight}>
                <View style={[s.confidenceDot, { backgroundColor: confidenceColor(day.confidence) }]} />
                <Text style={[s.dayRevenue, { color: colors.text }]}>
                  ${day.projectedRevenue.toLocaleString()}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            </View>

            <View style={s.dayQuickStats}>
              <View style={s.quickStat}>
                <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                <Text style={[s.quickStatText, { color: colors.textSecondary }]}>
                  {day.recommendedStaffCount} staff
                </Text>
              </View>
              <View style={s.quickStat}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={[s.quickStatText, { color: colors.textSecondary }]}>
                  {day.recommendedStaffHours}h
                </Text>
              </View>
              <View style={s.quickStat}>
                <Ionicons name="receipt-outline" size={14} color={colors.textMuted} />
                <Text style={[s.quickStatText, { color: colors.textSecondary }]}>
                  ~{day.projectedTransactions} orders
                </Text>
              </View>
            </View>

            {isExpanded && (
              <View style={[s.dayDetails, { borderTopColor: colors.borderLight }]}>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.textMuted }]}>Food Cost</Text>
                  <Text style={[s.detailValue, { color: colors.text }]}>
                    ${day.projectedFoodCost.toLocaleString()}
                  </Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.textMuted }]}>Labor Cost</Text>
                  <Text style={[s.detailValue, { color: colors.text }]}>
                    ${day.projectedLaborCost.toLocaleString()}
                  </Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={[s.detailLabel, { color: colors.textMuted }]}>Confidence</Text>
                  <StatusBadge
                    status={day.confidence === "high" ? "green" : day.confidence === "medium" ? "yellow" : "red"}
                    label={day.confidence}
                  />
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Order Recommendations */}
      {plan.orderRecommendations.length > 0 && (
        <>
          <TouchableOpacity
            style={s.sectionHeaderRow}
            onPress={() => setShowOrders(!showOrders)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Order Recommendations</Text>
              <Text style={[s.sectionSubtitle, { color: colors.textMuted }]}>
                {orderNowCount > 0 ? `${orderNowCount} urgent` : ""}
                {orderNowCount > 0 && orderSoonCount > 0 ? " · " : ""}
                {orderSoonCount > 0 ? `${orderSoonCount} soon` : ""}
                {orderNowCount === 0 && orderSoonCount === 0 ? "All items adequate" : ""}
              </Text>
            </View>
            <Ionicons
              name={showOrders ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {showOrders &&
            plan.orderRecommendations.map((item, idx) => {
              const us = urgencyStyle(item.urgency);
              return (
                <View
                  key={idx}
                  style={[s.orderCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
                >
                  <View style={s.orderHeader}>
                    <Text style={[s.orderName, { color: colors.text }]}>{item.ingredientName}</Text>
                    <View style={[s.urgencyBadge, { backgroundColor: us.bg }]}>
                      <Text style={[s.urgencyText, { color: us.text }]}>{us.label}</Text>
                    </View>
                  </View>
                  <View style={s.orderStats}>
                    <View style={s.orderStat}>
                      <Text style={[s.orderStatLabel, { color: colors.textMuted }]}>On Hand</Text>
                      <Text style={[s.orderStatValue, { color: colors.text }]}>
                        {item.currentStock} {item.unit}
                      </Text>
                    </View>
                    <View style={s.orderStat}>
                      <Text style={[s.orderStatLabel, { color: colors.textMuted }]}>Projected Use</Text>
                      <Text style={[s.orderStatValue, { color: colors.text }]}>
                        {item.projectedUsage} {item.unit}
                      </Text>
                    </View>
                    <View style={s.orderStat}>
                      <Text style={[s.orderStatLabel, { color: colors.textMuted }]}>Order</Text>
                      <Text style={[s.orderStatValue, { color: colors.primary, fontWeight: "800" }]}>
                        {item.recommendedOrder} {item.unit}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
        </>
      )}

      {/* Waste Alerts */}
      {plan.wasteAlerts.length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Waste Alerts</Text>
          </View>
          {plan.wasteAlerts.map((alert, idx) => (
            <View
              key={idx}
              style={[s.wasteAlert, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            >
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <Text style={[s.wasteAlertText, { color: colors.textSecondary }]}>{alert}</Text>
            </View>
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
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
    loadingText: { fontSize: fontSize.sm, marginTop: spacing.sm },
    errorText: { fontSize: fontSize.md, fontWeight: "600", textAlign: "center", paddingHorizontal: spacing.xl },
    retryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.sm },
    retryBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },

    // Summary card
    summaryCard: {
      padding: spacing.lg,
      borderBottomLeftRadius: borderRadius.xl,
      borderBottomRightRadius: borderRadius.xl,
    },
    summaryTitle: { color: "#fff", fontSize: fontSize.lg, fontWeight: "800", letterSpacing: -0.3 },
    summaryStore: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.sm, marginTop: 2 },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.15)",
    },
    summaryMetric: { flex: 1, alignItems: "center" },
    summaryValue: { color: "#fff", fontSize: fontSize.xl, fontWeight: "800" },
    summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs, marginTop: 2 },
    summaryDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },
    costRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    costPill: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: borderRadius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
    },
    costPillLabel: { color: "rgba(255,255,255,0.65)", fontSize: fontSize.xs },
    costPillValue: { color: "#fff", fontSize: fontSize.sm, fontWeight: "700", marginTop: 2 },

    // Data quality banner
    qualityBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
    },
    qualityText: { fontSize: fontSize.xs, fontWeight: "600", flex: 1 },

    // Buffer
    bufferSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    bufferLabel: { fontSize: fontSize.sm, fontWeight: "700", marginBottom: spacing.sm },
    bufferRow: { flexDirection: "row", gap: spacing.sm },
    bufferChip: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    bufferChipText: { fontSize: fontSize.sm, fontWeight: "600" },

    // AI Insights
    insightsCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
    },
    insightsHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    insightsIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    insightsTitle: { fontSize: fontSize.md, fontWeight: "700" },
    insightsText: { fontSize: fontSize.sm, lineHeight: 20 },

    // Section header
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2 },

    // Day cards
    dayCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
    },
    dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dayNameRow: { flex: 1 },
    dayName: { fontSize: fontSize.md, fontWeight: "700" },
    dayDate: { fontSize: fontSize.xs, marginTop: 1 },
    dayRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    confidenceDot: { width: 8, height: 8, borderRadius: 4 },
    dayRevenue: { fontSize: fontSize.md, fontWeight: "800" },
    dayQuickStats: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    quickStat: { flexDirection: "row", alignItems: "center", gap: 4 },
    quickStatText: { fontSize: fontSize.xs },
    dayDetails: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      gap: spacing.xs + 2,
    },
    detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    detailLabel: { fontSize: fontSize.sm },
    detailValue: { fontSize: fontSize.sm, fontWeight: "600" },

    // Order recommendations
    orderCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
    },
    orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orderName: { fontSize: fontSize.md, fontWeight: "700", flex: 1 },
    urgencyBadge: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    urgencyText: { fontSize: fontSize.xs, fontWeight: "700" },
    orderStats: { flexDirection: "row", marginTop: spacing.sm, gap: spacing.sm },
    orderStat: { flex: 1, alignItems: "center" },
    orderStatLabel: { fontSize: fontSize.xs },
    orderStatValue: { fontSize: fontSize.sm, fontWeight: "600", marginTop: 2 },

    // Waste alerts
    wasteAlert: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
    },
    wasteAlertText: { fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  });
