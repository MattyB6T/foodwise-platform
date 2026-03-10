import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

export function LogRevenueScreen({ navigation }: any) {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const s = makeStyles(colors);

  useEffect(() => {
    if (!selectedStoreId) return;
    setLoading(true);
    api
      .listRevenueSources(selectedStoreId)
      .then((res) => {
        const active = (res.sources || []).filter((s: any) => s.isActive !== false);
        setSources(active);
        if (active.length > 0 && !selectedSource) setSelectedSource(active[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedSource || !amount) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert("Invalid Amount", "Please enter a positive dollar amount.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createRevenueEntry(selectedStoreId, {
        sourceId: selectedSource.sourceId,
        amount: Math.round(parsed * 100), // cents
        date,
        note: note.trim() || undefined,
      });
      Alert.alert("Logged", `$${parsed.toFixed(2)} from ${selectedSource.name} recorded.`);
      setAmount("");
      setNote("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, padding: spacing.md, alignItems: "stretch" }]}>
        <StorePicker />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (sources.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, padding: spacing.md }]}>
        <StorePicker />
        <View style={s.emptyContainer}>
          <Text style={[s.emptyIcon]}>{"$"}</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No Revenue Sources</Text>
          <Text style={[s.emptyText, { color: colors.textSecondary }]}>
            Set up revenue sources first so you can start logging income.
          </Text>
          <TouchableOpacity
            style={[s.setupBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("RevenueSources")}
          >
            <Text style={s.setupBtnText}>Set Up Sources</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]} contentContainerStyle={s.contentContainer}>
      <StorePicker />
      <Text style={[s.heading, { color: colors.text }]}>Log Revenue</Text>

      {/* Source picker */}
      <Text style={[s.label, { color: colors.textSecondary }]}>Source</Text>
      <View style={s.sourceScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xs }}>
          {sources.map((src: any) => (
            <TouchableOpacity
              key={src.sourceId}
              style={[
                s.sourceChip,
                {
                  backgroundColor: selectedSource?.sourceId === src.sourceId ? colors.primary : colors.surface,
                  borderColor: selectedSource?.sourceId === src.sourceId ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedSource(src)}
            >
              <Text
                style={{
                  color: selectedSource?.sourceId === src.sourceId ? "#fff" : colors.text,
                  fontWeight: "600",
                  fontSize: fontSize.sm,
                }}
              >
                {src.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Amount */}
      <Text style={[s.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>Amount ($)</Text>
      <View style={[s.amountRow, { borderColor: colors.border }]}>
        <Text style={[s.dollarSign, { color: colors.textMuted }]}>$</Text>
        <TextInput
          style={[s.amountInput, { color: colors.text }]}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          autoFocus
        />
      </View>

      {/* Date */}
      <Text style={[s.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Date</Text>
      <TextInput
        style={[s.input, { color: colors.text, borderColor: colors.border }]}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
      />

      {/* Note */}
      <Text style={[s.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Note (optional)</Text>
      <TextInput
        style={[s.input, s.noteInput, { color: colors.text, borderColor: colors.border }]}
        placeholder="e.g. Friday trivia night"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
      />

      {/* Submit */}
      <TouchableOpacity
        style={[s.submitBtn, { backgroundColor: colors.primary, opacity: submitting || !amount ? 0.5 : 1 }]}
        onPress={handleSubmit}
        disabled={submitting || !amount}
      >
        <Text style={s.submitBtnText}>{submitting ? "Logging..." : "Log Revenue"}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      ...(Platform.OS === "web" ? { overflow: "hidden" as const } : {}),
    },
    contentContainer: {
      padding: spacing.md,
      flexGrow: 1,
      ...(Platform.OS === "web" ? { maxWidth: "100%" as any } : {}),
    },
    sourceScrollWrap: {
      marginBottom: spacing.sm,
      overflow: "hidden" as const,
      ...(Platform.OS === "web" ? { maxWidth: "100%" as any, alignSelf: "stretch" as const } : {}),
    },
    heading: { fontSize: 22, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.md },
    label: { fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing.sm },
    sourceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8 },
    amountRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md },
    dollarSign: { fontSize: 28, fontWeight: "700", marginRight: 4 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: "700", paddingVertical: spacing.md },
    input: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, fontSize: fontSize.md },
    noteInput: { minHeight: 60, textAlignVertical: "top" },
    submitBtn: { paddingVertical: spacing.md, borderRadius: 12, alignItems: "center", marginTop: spacing.lg },
    submitBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: 80 },
    emptyIcon: { fontSize: 48, fontWeight: "700", opacity: 0.3, marginBottom: spacing.md },
    emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: spacing.sm },
    emptyText: { fontSize: fontSize.md, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg },
    setupBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12 },
    setupBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
  });
