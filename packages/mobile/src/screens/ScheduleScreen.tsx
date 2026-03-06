import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

interface Shift {
  shiftId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string | null;
}

export function ScheduleScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const s = makeStyles(colors);

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      const weekStart = monday.toISOString().split("T")[0];
      const result = await api.getSchedule(selectedStoreId, weekStart);
      setShifts(result.shifts || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => { loadData(); }, [loadData]);

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
      <Text style={[s.sectionTitle, { color: colors.text }]}>This Week's Schedule</Text>
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
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    sectionTitle: { fontSize: fontSize.md, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.sm },
    entryCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    entryRow: { flexDirection: "row", alignItems: "center" },
    entryName: { fontSize: fontSize.md, fontWeight: "600" },
    entryTime: { fontSize: fontSize.xs, marginTop: 2 },
    positionTag: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
    emptyText: { textAlign: "center", padding: spacing.lg, fontSize: fontSize.sm },
  });
