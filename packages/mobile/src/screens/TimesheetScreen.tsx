import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type Tab = "weekly" | "live";

export function TimesheetScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const navigation = useNavigation<NavProp>();
  const [tab, setTab] = useState<Tab>("weekly");
  const [employees, setEmployees] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const s = makeStyles(colors);

  const getWeekStart = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
    return d.toISOString().split("T")[0];
  };

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      if (tab === "weekly") {
        const week = getWeekStart(weekOffset);
        const data = await api.getTimesheetWeek(selectedStoreId, week);
        setEmployees(data.employees || []);
      } else {
        const data = await api.getTimesheetLive(selectedStoreId);
        setLiveData(data.live || []);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, tab, weekOffset]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (tab !== "live") return;
    const iv = setInterval(loadData, 30000);
    return () => clearInterval(iv);
  }, [tab, loadData]);

  const handleExport = async () => {
    if (!selectedStoreId) return;
    try {
      const week = getWeekStart(weekOffset);
      const data = await api.exportTimesheet(selectedStoreId, week);
      if (Platform.OS === "web" && data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `timesheet-${week}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Export Ready", "CSV export is available on web.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Export failed");
    }
  };

  const handleApproveAll = async () => {
    if (!selectedStoreId) return;
    for (const emp of employees) {
      for (const entry of emp.entries || []) {
        if (!entry.managerApproved && entry.clockOutTime) {
          try {
            await api.approveTimeEntry(selectedStoreId, entry.entryId);
          } catch (_) {}
        }
      }
    }
    Alert.alert("Done", "All completed entries approved.");
    loadData();
  };

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Select a store first</Text>
      </View>
    );
  }

  const weekLabel = getWeekStart(weekOffset);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />

      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, tab === "weekly" && { backgroundColor: colors.primary }]} onPress={() => setTab("weekly")}>
          <Text style={[s.tabText, { color: tab === "weekly" ? "#fff" : colors.text }]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === "live" && { backgroundColor: colors.primary }]} onPress={() => setTab("live")}>
          <Text style={[s.tabText, { color: tab === "live" ? "#fff" : colors.text }]}>Live</Text>
        </TouchableOpacity>
      </View>

      {tab === "weekly" && (
        <View style={s.weekNav}>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)}>
            <Text style={[s.weekArrow, { color: colors.primary }]}>← Prev</Text>
          </TouchableOpacity>
          <Text style={[s.weekLabel, { color: colors.text }]}>Week of {weekLabel}</Text>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)}>
            <Text style={[s.weekArrow, { color: colors.primary }]}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === "weekly" && (
        <View style={s.actionsBar}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={handleApproveAll}>
            <Text style={s.actionBtnText}>Approve All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.secondary }]} onPress={handleExport}>
            <Text style={s.actionBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : tab === "weekly" ? (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.staffId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.empCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate("TimeEntryDetail" as any, { staffId: item.staffId, staffName: item.staffName, storeId: selectedStoreId, week: weekLabel })}
            >
              <View style={s.empRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.empName, { color: colors.text }]}>{item.staffName}</Text>
                  <Text style={[s.empEntries, { color: colors.textSecondary }]}>{item.entries?.length || 0} entries</Text>
                </View>
                <View style={s.empRight}>
                  <Text style={[s.empHours, { color: colors.primary }]}>{Math.round((item.totalHours || 0) * 10) / 10}h</Text>
                  {item.entries?.some((e: any) => e.flagged) && (
                    <Text style={s.flagIcon}>⚠️</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: colors.textSecondary }]}>No entries this week</Text>}
        />
      ) : (
        <FlatList
          data={liveData}
          keyExtractor={(item) => item.entryId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={[s.liveCard, { backgroundColor: colors.surface }]}>
              <View style={s.empRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.empName, { color: colors.text }]}>{item.staffName}</Text>
                  <Text style={[s.empEntries, { color: colors.textSecondary }]}>
                    Since {new Date(item.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {item.onBreak ? " (on break)" : ""}
                  </Text>
                </View>
                <View style={s.empRight}>
                  <Text style={[s.empHours, { color: item.onBreak ? colors.warning : colors.secondary }]}>
                    {Math.floor(item.minutesOnShift / 60)}h {item.minutesOnShift % 60}m
                  </Text>
                  {item.flagged && <Text style={s.flagIcon}>⚠️</Text>}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[s.empty, { color: colors.textSecondary }]}>No one currently on shift</Text>}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    tabBar: { flexDirection: "row", marginHorizontal: spacing.lg, marginVertical: spacing.sm, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface },
    tabBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: 10 },
    tabText: { fontWeight: "600", fontSize: fontSize.sm },
    weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    weekArrow: { fontWeight: "600", fontSize: fontSize.sm },
    weekLabel: { fontWeight: "700", fontSize: fontSize.sm },
    actionsBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    actionBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.xs },
    empCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    empRow: { flexDirection: "row", alignItems: "center" },
    empName: { fontSize: fontSize.md, fontWeight: "600" },
    empEntries: { fontSize: fontSize.xs, marginTop: 2 },
    empRight: { alignItems: "flex-end" },
    empHours: { fontSize: fontSize.lg, fontWeight: "700" },
    flagIcon: { fontSize: 16, marginTop: 2 },
    liveCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    empty: { textAlign: "center", padding: spacing.xl, fontSize: fontSize.sm },
  });
