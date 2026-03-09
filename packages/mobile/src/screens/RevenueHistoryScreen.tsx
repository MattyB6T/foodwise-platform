import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function RevenueHistoryScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [entries, setEntries] = useState<any[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const s = makeStyles(colors);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [entriesRes, sourcesRes] = await Promise.all([
        api.listRevenueEntries(selectedStoreId, { startDate: daysAgo(period) }),
        api.listRevenueSources(selectedStoreId),
      ]);
      setEntries(entriesRes.entries || []);
      const map: Record<string, string> = {};
      for (const s of sourcesRes.sources || []) {
        map[s.sourceId] = s.name;
      }
      setSources(map);
    } catch (err) {
      console.error("Failed to load revenue history:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (entry: any) => {
    Alert.alert("Delete Entry", `Remove ${formatCents(entry.amount)} from ${sources[entry.sourceId] || "Unknown"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteRevenueEntry(selectedStoreId!, entry.entryId);
            load();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  // Group entries by date
  const grouped: Record<string, any[]> = {};
  for (const entry of entries) {
    const d = entry.date || "Unknown";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(entry);
  }
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Totals
  const totalCents = entries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const bySource: Record<string, number> = {};
  for (const e of entries) {
    const name = sources[e.sourceId] || "Unknown";
    bySource[name] = (bySource[name] || 0) + (e.amount || 0);
  }
  const topSources = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />
      <Text style={[s.heading, { color: colors.text }]}>Revenue History</Text>

      {/* Period selector */}
      <View style={s.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.days}
            style={[
              s.periodBtn,
              {
                backgroundColor: period === p.days ? colors.primary : colors.surface,
                borderColor: period === p.days ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setPeriod(p.days)}
          >
            <Text style={{ color: period === p.days ? "#fff" : colors.text, fontWeight: "600" }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Summary card */}
          <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>
              Total Other Revenue ({period}d)
            </Text>
            <Text style={[s.summaryAmount, { color: colors.primary }]}>
              {formatCents(totalCents)}
            </Text>
            {topSources.length > 0 && (
              <View style={s.topSourcesList}>
                {topSources.map(([name, cents]) => (
                  <View key={name} style={s.topSourceRow}>
                    <Text style={[s.topSourceName, { color: colors.text }]}>{name}</Text>
                    <Text style={[s.topSourceAmt, { color: colors.textSecondary }]}>
                      {formatCents(cents)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Entries by date */}
          {dates.length === 0 && (
            <Text style={[s.emptyText, { color: colors.textMuted }]}>
              No revenue entries in this period.
            </Text>
          )}
          {dates.map((date) => (
            <View key={date} style={s.dateGroup}>
              <Text style={[s.dateHeader, { color: colors.textSecondary }]}>
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              {grouped[date].map((entry: any) => (
                <TouchableOpacity
                  key={entry.entryId}
                  style={[s.entryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onLongPress={() => handleDelete(entry)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.entrySource, { color: colors.text }]}>
                      {sources[entry.sourceId] || "Unknown Source"}
                    </Text>
                    {entry.note && (
                      <Text style={[s.entryNote, { color: colors.textSecondary }]}>
                        {entry.note}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.entryAmount, { color: colors.primary }]}>
                    {formatCents(entry.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.md },
    heading: { fontSize: 22, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.md },
    periodRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    summaryCard: { padding: spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: spacing.lg },
    summaryLabel: { fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase" },
    summaryAmount: { fontSize: 32, fontWeight: "700", marginVertical: spacing.sm },
    topSourcesList: { marginTop: spacing.sm, gap: 4 },
    topSourceRow: { flexDirection: "row", justifyContent: "space-between" },
    topSourceName: { fontSize: fontSize.sm, fontWeight: "600" },
    topSourceAmt: { fontSize: fontSize.sm },
    dateGroup: { marginBottom: spacing.md },
    dateHeader: { fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing.sm },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    entrySource: { fontSize: fontSize.md, fontWeight: "600" },
    entryNote: { fontSize: fontSize.sm, marginTop: 2 },
    entryAmount: { fontSize: fontSize.md, fontWeight: "700" },
    emptyText: { fontSize: fontSize.md, textAlign: "center", paddingVertical: spacing.xl, fontStyle: "italic" },
  });
