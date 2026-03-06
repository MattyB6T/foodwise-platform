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
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

export function TempLogScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [location, setLocation] = useState("");
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const s = makeStyles(colors);

  const loadLogs = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const result = await api.getTempLogs(selectedStoreId);
      setLogs(result.logs || []);
      setAlerts(result.alerts || []);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const submitLog = async () => {
    if (!selectedStoreId || !location || !temperature) return;
    setSubmitting(true);
    try {
      await api.recordTempLog(selectedStoreId, {
        location,
        temperature: parseFloat(temperature),
        unit: "F",
        notes: notes || undefined,
      });
      setLocation("");
      setTemperature("");
      setNotes("");
      setShowForm(false);
      loadLogs();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
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
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Temperature Logs</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={s.addBtnText}>{showForm ? "Cancel" : "+ Log Temp"}</Text>
        </TouchableOpacity>
      </View>

      {alerts.length > 0 && (
        <View style={[s.alertBanner, { backgroundColor: colors.danger + "15" }]}>
          <Text style={[s.alertText, { color: colors.danger }]}>
            {alerts.length} out-of-range reading{alerts.length > 1 ? "s" : ""} detected
          </Text>
        </View>
      )}

      {showForm && (
        <View style={[s.formCard, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Location (e.g., Walk-in Cooler)"
            placeholderTextColor={colors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Temperature (°F)"
            placeholderTextColor={colors.textSecondary}
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="numeric"
          />
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.secondary }, submitting && { opacity: 0.6 }]}
            onPress={submitLog}
            disabled={submitting || !location || !temperature}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Record Temperature</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.logId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={[
              s.logCard,
              { backgroundColor: colors.surface },
              !item.inRange && { borderLeftWidth: 3, borderLeftColor: colors.danger },
            ]}>
              <View style={s.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.logLocation, { color: colors.text }]}>{item.location}</Text>
                  <Text style={[s.logMeta, { color: colors.textSecondary }]}>
                    {new Date(item.timestamp).toLocaleString()} | By: {item.recordedBy}
                  </Text>
                  {item.rangeNote ? (
                    <Text style={[s.rangeNote, { color: colors.danger }]}>{item.rangeNote}</Text>
                  ) : null}
                </View>
                <Text style={[s.tempText, { color: item.inRange ? colors.secondary : colors.danger }]}>
                  {item.temperature}°{item.unit}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>No temperature logs yet</Text>
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
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: "700" },
    addBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    addBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    alertBanner: { marginHorizontal: spacing.lg, padding: spacing.sm, borderRadius: 8, marginBottom: spacing.sm },
    alertText: { fontWeight: "600", fontSize: fontSize.sm, textAlign: "center" },
    formCard: { marginHorizontal: spacing.lg, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
    input: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, fontSize: fontSize.md, marginBottom: spacing.sm },
    submitBtn: { padding: spacing.md, borderRadius: 10, alignItems: "center" },
    submitBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    logCard: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
    logRow: { flexDirection: "row", alignItems: "center" },
    logLocation: { fontSize: fontSize.md, fontWeight: "600" },
    logMeta: { fontSize: fontSize.xs, marginTop: 2 },
    rangeNote: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
    tempText: { fontSize: fontSize.xl, fontWeight: "700" },
    emptyText: { textAlign: "center", padding: spacing.lg, fontSize: fontSize.sm },
  });
