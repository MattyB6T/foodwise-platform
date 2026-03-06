import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

export function LiveStaffScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [live, setLive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const s = makeStyles(colors);

  const loadLive = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const data = await api.getTimesheetLive(selectedStoreId);
      setLive(data.live || []);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadLive();
    const iv = setInterval(loadLive, 30000);
    return () => clearInterval(iv);
  }, [loadLive]);

  const handleMessage = (phone: string) => {
    if (phone) {
      Linking.openURL(`sms:${phone}`);
    } else {
      Alert.alert("No Phone", "No phone number on file for this employee.");
    }
  };

  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Select a store first</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Who's In</Text>
        <Text style={[s.count, { color: colors.primary }]}>{live.length} on shift</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={live}
          keyExtractor={(item) => item.entryId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const hrs = Math.floor(item.minutesOnShift / 60);
            const mins = item.minutesOnShift % 60;
            return (
              <View style={[s.card, { backgroundColor: colors.surface }]}>
                <View style={s.cardRow}>
                  <View style={[s.statusDot, { backgroundColor: item.onBreak ? colors.warning : colors.secondary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: colors.text }]}>{item.staffName}</Text>
                    <Text style={[s.detail, { color: colors.textSecondary }]}>
                      Since {new Date(item.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {item.onBreak ? " · On Break" : ""}
                    </Text>
                  </View>
                  <View style={s.rightCol}>
                    <Text style={[s.duration, { color: colors.primary }]}>{hrs}h {mins}m</Text>
                    <TouchableOpacity onPress={() => handleMessage(item.phone)}>
                      <Text style={[s.msgBtn, { color: colors.primary }]}>Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {item.flagged && (
                  <Text style={[s.flag, { color: colors.danger }]}>⚠️ Flagged entry</Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: colors.textSecondary }]}>No employees currently on shift</Text>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    count: { fontSize: fontSize.md, fontWeight: "600" },
    card: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    cardRow: { flexDirection: "row", alignItems: "center" },
    statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm },
    name: { fontSize: fontSize.md, fontWeight: "600" },
    detail: { fontSize: fontSize.xs, marginTop: 2 },
    rightCol: { alignItems: "flex-end" },
    duration: { fontSize: fontSize.md, fontWeight: "700" },
    msgBtn: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 4 },
    flag: { fontSize: fontSize.xs, marginTop: spacing.xs },
    empty: { textAlign: "center", padding: spacing.xl },
  });
