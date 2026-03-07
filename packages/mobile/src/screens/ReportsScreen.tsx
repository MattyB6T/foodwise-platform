import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

const REPORT_TYPES = [
  { key: "profit_loss", label: "Profit & Loss", icon: "📊", description: "Revenue, costs, and profit margins" },
  { key: "labor", label: "Labor Report", icon: "👥", description: "Hours, labor cost, overtime by employee" },
  { key: "food_cost", label: "Food Cost Trend", icon: "📈", description: "Weekly food cost % over time" },
  { key: "inventory", label: "Inventory Snapshot", icon: "📦", description: "Current stock levels and values" },
  { key: "waste", label: "Waste Report", icon: "🗑️", description: "Waste logs for the selected period" },
  { key: "sales", label: "Sales & Food Cost", icon: "💰", description: "Revenue, food cost, and margins" },
  { key: "purchase_orders", label: "Purchase Orders", icon: "📋", description: "All POs and spend totals" },
  { key: "count_variance", label: "Count Variance", icon: "🔍", description: "Inventory count discrepancies" },
];

export function ReportsScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const s = makeStyles(colors);

  const generateReport = async (reportType: string) => {
    if (!selectedStoreId) return;
    setGenerating(reportType);
    try {
      const result = await api.generateReport({
        storeId: selectedStoreId,
        reportType,
        format: "json",
      });
      setReportData(result);
      setSelectedType(reportType);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  const downloadCSV = async (reportType: string) => {
    if (!selectedStoreId) return;
    setGenerating(reportType);
    try {
      const result = await api.generateReport({
        storeId: selectedStoreId,
        reportType,
        format: "csv",
      });
      if (Platform.OS === "web") {
        const blob = new Blob([typeof result === "string" ? result : JSON.stringify(result)], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("CSV Generated", "CSV export is available on web. Use the JSON view on mobile.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to export");
    } finally {
      setGenerating(null);
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

  if (reportData && selectedType) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>
            {REPORT_TYPES.find((r) => r.key === selectedType)?.label}
          </Text>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: colors.textSecondary }]}
            onPress={() => { setReportData(null); setSelectedType(null); }}
          >
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {/* Summary card */}
          <View style={[s.summaryCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.summaryTitle, { color: colors.text }]}>Summary</Text>
            {selectedType === "inventory" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Items: {reportData.totalItems}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Value: ${reportData.totalInventoryValue?.toFixed(2)}</Text>
              </>
            )}
            {selectedType === "waste" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Entries: {reportData.totalEntries}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Period: {reportData.period?.startDate?.split("T")[0]} to {reportData.period?.endDate?.split("T")[0]}</Text>
              </>
            )}
            {selectedType === "sales" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Transactions: {reportData.totalTransactions}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Revenue: ${reportData.totalRevenue?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Food Cost: ${reportData.totalFoodCost?.toFixed(2)} ({reportData.avgFoodCostPercent}%)</Text>
              </>
            )}
            {selectedType === "purchase_orders" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Orders: {reportData.totalOrders}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Spend: ${reportData.totalSpend?.toFixed(2)}</Text>
              </>
            )}
            {selectedType === "labor" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Employees: {reportData.totalEmployees}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Hours: {reportData.totalHours}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Total Labor Cost: ${reportData.totalLaborCost?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Overtime Hours: {reportData.totalOvertime}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Labor Cost %: {reportData.laborCostPercentage}%</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Revenue: ${reportData.revenue?.toFixed(2)}</Text>
              </>
            )}
            {selectedType === "profit_loss" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Period: {reportData.period?.startDate?.split("T")[0]} to {reportData.period?.endDate?.split("T")[0]}</Text>
                <Text style={[s.summaryLine, { color: colors.text, fontWeight: "600", marginTop: 4 }]}>Revenue: ${reportData.revenue?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Food Cost: ${reportData.foodCost?.toFixed(2)} ({reportData.foodCostPercent}%)</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Labor Cost: ${reportData.laborCost?.toFixed(2)} ({reportData.laborCostPercent}%)</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Waste Cost: ${reportData.wasteCost?.toFixed(2)} ({reportData.wasteCostPercent}%)</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary, fontWeight: "600", marginTop: 4 }]}>Total Expenses: ${reportData.totalExpenses?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: reportData.grossProfit >= 0 ? "#38a169" : "#e53e3e", fontWeight: "600" }]}>Gross Profit: ${reportData.grossProfit?.toFixed(2)} ({reportData.grossMargin}%)</Text>
                <Text style={[s.summaryLine, { color: reportData.netProfit >= 0 ? "#38a169" : "#e53e3e", fontWeight: "700" }]}>Net Profit: ${reportData.netProfit?.toFixed(2)} ({reportData.netMargin}%)</Text>
              </>
            )}
            {selectedType === "food_cost" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Overall Food Cost: {reportData.overallFoodCostPercent}%</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Revenue: ${reportData.totalRevenue?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Food Cost: ${reportData.totalFoodCost?.toFixed(2)}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Weeks Analyzed: {reportData.weeksAnalyzed}</Text>
                <Text style={[s.summaryLine, { color: reportData.trendDirection === "increasing" ? "#e53e3e" : reportData.trendDirection === "decreasing" ? "#38a169" : colors.textSecondary, fontWeight: "600" }]}>
                  Trend: {reportData.trendDirection} ({reportData.trendChange > 0 ? "+" : ""}{reportData.trendChange}%)
                </Text>
              </>
            )}
            {selectedType === "count_variance" && (
              <>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Counts Analyzed: {reportData.countsAnalyzed}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Items with Variance ({">"}2%): {reportData.totalVarianceItems}</Text>
                <Text style={[s.summaryLine, { color: colors.textSecondary }]}>Overall Variance: {reportData.overallVariancePercent}%</Text>
              </>
            )}
          </View>

          {/* Data rows */}
          {selectedType === "profit_loss" ? null : (reportData.items || reportData.logs || reportData.transactions || reportData.orders || reportData.employees || reportData.weeks || reportData.variances || []).map((row: any, idx: number) => (
            <View key={idx} style={[s.dataRow, { backgroundColor: colors.surface }]}>
              <Text style={[s.dataName, { color: colors.text }]}>
                {row.name || row.ingredientId || row.transactionId || row.orderId || row.itemName || (row.weekStart && `Week of ${row.weekStart}`)}
              </Text>
              <Text style={[s.dataDetail, { color: colors.textSecondary }]}>
                {selectedType === "inventory" && `${row.quantity} ${row.unit} | $${row.totalValue?.toFixed(2)}`}
                {selectedType === "waste" && `${row.quantity} | ${row.reason} | ${row.timestamp?.split("T")[0]}`}
                {selectedType === "sales" && `$${row.totalAmount?.toFixed(2)} | FC: ${row.foodCostPercentage}% | ${row.timestamp?.split("T")[0]}`}
                {selectedType === "purchase_orders" && `$${row.totalAmount?.toFixed(2)} | ${row.status} | ${row.createdAt?.split("T")[0]}`}
                {selectedType === "labor" && `${row.totalHours}h | $${row.totalCost?.toFixed(2)} | OT: ${row.overtime}h | $${row.hourlyRate}/hr`}
                {selectedType === "food_cost" && `Revenue: $${row.revenue?.toFixed(2)} | FC: $${row.foodCost?.toFixed(2)} (${row.foodCostPercent}%) | ${row.transactions} txns`}
                {selectedType === "count_variance" && `Expected: ${row.expected} → Actual: ${row.actual} | ${row.variancePercent > 0 ? "+" : ""}${row.variancePercent}% | ${row.date}`}
              </Text>
            </View>
          ))}
        </ScrollView>

        {Platform.OS === "web" && (
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: colors.secondary }]}
            onPress={() => downloadCSV(selectedType)}
            disabled={generating !== null}
          >
            <Text style={s.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Reports</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {REPORT_TYPES.map((rt) => (
          <TouchableOpacity
            key={rt.key}
            style={[s.reportCard, { backgroundColor: colors.surface }]}
            onPress={() => generateReport(rt.key)}
            disabled={generating !== null}
          >
            <View style={s.reportCardContent}>
              <Text style={s.reportIcon}>{rt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.reportLabel, { color: colors.text }]}>{rt.label}</Text>
                <Text style={[s.reportDesc, { color: colors.textSecondary }]}>{rt.description}</Text>
              </View>
              {generating === rt.key ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Generate</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    backBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    backBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    reportCard: { borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
    reportCardContent: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    reportIcon: { fontSize: 28 },
    reportLabel: { fontSize: fontSize.md, fontWeight: "600" },
    reportDesc: { fontSize: fontSize.xs, marginTop: 2 },
    summaryCard: { borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
    summaryTitle: { fontSize: fontSize.md, fontWeight: "700", marginBottom: spacing.xs },
    summaryLine: { fontSize: fontSize.sm, marginBottom: 2 },
    dataRow: { borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    dataName: { fontSize: fontSize.sm, fontWeight: "600" },
    dataDetail: { fontSize: fontSize.xs, marginTop: 2 },
    exportBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: 12, alignItems: "center" },
    exportBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
