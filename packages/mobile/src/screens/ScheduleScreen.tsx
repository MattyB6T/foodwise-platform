import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

type ViewTab = "schedule" | "timeclock";

interface Shift {
  shiftId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string | null;
}

interface TimeEntry {
  entryId: string;
  staffName: string;
  staffEmail: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  status: string;
}

export function ScheduleScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [tab, setTab] = useState<ViewTab>("timeclock");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const s = makeStyles(colors);

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      if (tab === "schedule") {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        const weekStart = monday.toISOString().split("T")[0];
        const result = await api.getSchedule(selectedStoreId, weekStart);
        setShifts(result.shifts || []);
      } else {
        const today = new Date().toISOString().split("T")[0];
        const result = await api.getTimeEntries(selectedStoreId, today);
        const entries = result.entries || [];
        setTimeEntries(entries);
        const active = entries.find((e: TimeEntry) => e.status === "active");
        setActiveEntry(active || null);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClockIn = async () => {
    if (!selectedStoreId) return;
    setClockingIn(true);
    try {
      const result = await api.clockAction(selectedStoreId, { action: "clock-in" });
      setActiveEntry(result);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to clock in");
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedStoreId || !activeEntry) return;
    setClockingIn(true);
    try {
      await api.clockAction(selectedStoreId, { action: "clock-out", entryId: activeEntry.entryId });
      setActiveEntry(null);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to clock out");
    } finally {
      setClockingIn(false);
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

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === "timeclock" && { backgroundColor: colors.primary }]}
          onPress={() => setTab("timeclock")}
        >
          <Text style={[s.tabText, { color: tab === "timeclock" ? "#fff" : colors.text }]}>Time Clock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === "schedule" && { backgroundColor: colors.primary }]}
          onPress={() => setTab("schedule")}
        >
          <Text style={[s.tabText, { color: tab === "schedule" ? "#fff" : colors.text }]}>Schedule</Text>
        </TouchableOpacity>
      </View>

      {tab === "timeclock" ? (
        <View style={{ flex: 1 }}>
          {/* Clock In/Out Card */}
          <View style={[s.clockCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.clockTitle, { color: colors.text }]}>
              {activeEntry ? "Currently Clocked In" : "Ready to Clock In"}
            </Text>
            {activeEntry && (
              <Text style={[s.clockDetail, { color: colors.textSecondary }]}>
                Since {new Date(activeEntry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}
            <TouchableOpacity
              style={[s.clockBtn, { backgroundColor: activeEntry ? colors.danger : colors.secondary }]}
              onPress={activeEntry ? handleClockOut : handleClockIn}
              disabled={clockingIn}
            >
              {clockingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.clockBtnText}>{activeEntry ? "Clock Out" : "Clock In"}</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: colors.text }]}>Today's Entries</Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={timeEntries}
              keyExtractor={(item) => item.entryId}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
              renderItem={({ item }) => (
                <View style={[s.entryCard, { backgroundColor: colors.surface }]}>
                  <View style={s.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.entryName, { color: colors.text }]}>{item.staffName || item.staffEmail}</Text>
                      <Text style={[s.entryTime, { color: colors.textSecondary }]}>
                        In: {new Date(item.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {item.clockOut && ` | Out: ${new Date(item.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      </Text>
                    </View>
                    <View style={s.hoursContainer}>
                      {item.totalHours !== null ? (
                        <Text style={[s.hoursText, { color: colors.primary }]}>{item.totalHours}h</Text>
                      ) : (
                        <View style={[s.activeBadge, { backgroundColor: colors.secondary + "20" }]}>
                          <Text style={{ color: colors.secondary, fontSize: fontSize.xs, fontWeight: "600" }}>Active</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>No time entries today</Text>
              }
            />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>This Week</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={shifts}
              keyExtractor={(item) => item.shiftId}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
              renderItem={({ item }) => (
                <View style={[s.entryCard, { backgroundColor: colors.surface }]}>
                  <View style={s.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.entryName, { color: colors.text }]}>{item.staffName}</Text>
                      <Text style={[s.entryTime, { color: colors.textSecondary }]}>
                        {item.date} | {item.startTime} - {item.endTime}
                      </Text>
                      {item.position && (
                        <Text style={[s.positionTag, { color: colors.primary }]}>{item.position}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>No shifts scheduled this week</Text>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    tabBar: { flexDirection: "row", marginHorizontal: spacing.lg, marginVertical: spacing.sm, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surface },
    tabBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: 10 },
    tabText: { fontWeight: "600", fontSize: fontSize.sm },
    clockCard: { margin: spacing.lg, borderRadius: 12, padding: spacing.lg, alignItems: "center" },
    clockTitle: { fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.xs },
    clockDetail: { fontSize: fontSize.sm, marginBottom: spacing.md },
    clockBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 25, minWidth: 160, alignItems: "center" },
    clockBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
    sectionTitle: { fontSize: fontSize.md, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    entryCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    entryRow: { flexDirection: "row", alignItems: "center" },
    entryName: { fontSize: fontSize.md, fontWeight: "600" },
    entryTime: { fontSize: fontSize.xs, marginTop: 2 },
    positionTag: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
    hoursContainer: { alignItems: "center" },
    hoursText: { fontSize: fontSize.lg, fontWeight: "700" },
    activeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
    emptyText: { textAlign: "center", padding: spacing.lg, fontSize: fontSize.sm },
  });
