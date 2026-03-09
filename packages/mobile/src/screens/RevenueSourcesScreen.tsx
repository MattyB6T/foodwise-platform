import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";
type OperatorType = "qsr" | "cafe" | "bar" | "hybrid" | "restaurant";

type RevenueSourceType =
  | "pool_tables"
  | "darts"
  | "arcade"
  | "cover_charge"
  | "live_music"
  | "private_events"
  | "trivia"
  | "catering"
  | "merchandise"
  | "custom";

const REVENUE_SOURCE_LABELS: Record<RevenueSourceType, string> = {
  pool_tables: "Pool / Billiards",
  darts: "Dart Boards",
  arcade: "Arcade Machines",
  cover_charge: "Cover Charge / Door Fees",
  live_music: "Live Music",
  private_events: "Private Events / Bookings",
  trivia: "Trivia Night",
  catering: "Catering",
  merchandise: "Merchandise / Retail",
  custom: "Custom",
};

const DEFAULT_REVENUE_SOURCES: Record<OperatorType, RevenueSourceType[]> = {
  bar: ["pool_tables", "darts", "cover_charge", "live_music", "trivia", "private_events"],
  hybrid: ["pool_tables", "live_music", "private_events", "catering", "trivia"],
  cafe: ["catering", "merchandise", "private_events"],
  restaurant: ["private_events", "catering", "merchandise"],
  qsr: ["catering"],
};

const ALL_TYPES: { key: RevenueSourceType; label: string }[] = Object.entries(
  REVENUE_SOURCE_LABELS
).map(([key, label]) => ({ key: key as RevenueSourceType, label }));

export function RevenueSourcesScreen() {
  const { selectedStoreId, selectedOperatorType } = useStore();
  const { colors } = useTheme();
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<RevenueSourceType>("custom");
  const [saving, setSaving] = useState(false);
  const s = makeStyles(colors);

  const opType = (selectedOperatorType || "qsr") as OperatorType;
  const suggestions = DEFAULT_REVENUE_SOURCES[opType] || [];

  const loadSources = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await api.listRevenueSources(selectedStoreId);
      setSources(res.sources || []);
    } catch (err) {
      console.error("Failed to load revenue sources:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleAdd = async () => {
    if (!selectedStoreId || !newName.trim()) return;
    setSaving(true);
    try {
      await api.createRevenueSource(selectedStoreId, {
        name: newName.trim(),
        type: newType,
      });
      setNewName("");
      setNewType("custom");
      setShowAdd(false);
      loadSources();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (source: any) => {
    if (!selectedStoreId) return;
    try {
      await api.updateRevenueSource(selectedStoreId, source.sourceId, {
        isActive: !source.isActive,
      });
      loadSources();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleQuickAdd = async (type: RevenueSourceType) => {
    if (!selectedStoreId) return;
    const label = REVENUE_SOURCE_LABELS[type];
    setSaving(true);
    try {
      await api.createRevenueSource(selectedStoreId, { name: label, type });
      loadSources();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter suggestions that aren't already added
  const existingTypes = new Set(sources.map((s: any) => s.type));
  const availableSuggestions = suggestions.filter((t) => !existingTypes.has(t));

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <StorePicker />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />
      <Text style={[s.heading, { color: colors.text }]}>Revenue Sources</Text>
      <Text style={[s.subheading, { color: colors.textSecondary }]}>
        Manage income sources beyond food & beverage sales
      </Text>

      {/* Suggestions for operator type */}
      {availableSuggestions.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>
            Suggested for your business
          </Text>
          <View style={s.chipRow}>
            {availableSuggestions.map((type) => (
              <TouchableOpacity
                key={type}
                style={[s.chip, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}
                onPress={() => handleQuickAdd(type)}
              >
                <Text style={[s.chipText, { color: colors.primary }]}>
                  + {REVENUE_SOURCE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Existing sources */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>
          Active Sources ({sources.length})
        </Text>
        {sources.length === 0 && (
          <Text style={[s.emptyText, { color: colors.textMuted }]}>
            No revenue sources yet. Add one above or tap the + button.
          </Text>
        )}
        {sources.map((source: any) => (
          <View
            key={source.sourceId}
            style={[s.sourceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.sourceName, { color: colors.text }]}>{source.name}</Text>
              <Text style={[s.sourceType, { color: colors.textSecondary }]}>
                {REVENUE_SOURCE_LABELS[source.type as RevenueSourceType] || source.type}
              </Text>
            </View>
            <Switch
              value={source.isActive !== false}
              onValueChange={() => handleToggle(source)}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={source.isActive !== false ? colors.primary : colors.textMuted}
            />
          </View>
        ))}
      </View>

      {/* Add custom source */}
      {!showAdd ? (
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAdd(true)}
        >
          <Text style={s.addBtnText}>+ Add Custom Source</Text>
        </TouchableOpacity>
      ) : (
        <View style={[s.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[s.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Source name (e.g. Jukebox)"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
          <Text style={[s.label, { color: colors.textSecondary }]}>Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll}>
            {ALL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  s.typeChip,
                  {
                    backgroundColor: newType === t.key ? colors.primary : colors.surfaceHover,
                    borderColor: newType === t.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setNewType(t.key)}
              >
                <Text
                  style={{
                    color: newType === t.key ? "#fff" : colors.text,
                    fontSize: fontSize.sm,
                    fontWeight: "600",
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.formActions}>
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowAdd(false)}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
              onPress={handleAdd}
              disabled={saving || !newName.trim()}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.md },
    heading: { fontSize: 22, fontWeight: "700", marginTop: spacing.md },
    subheading: { fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md },
    section: { marginBottom: spacing.lg },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: fontSize.sm, fontWeight: "600" },
    sourceRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    sourceName: { fontSize: fontSize.md, fontWeight: "600" },
    sourceType: { fontSize: fontSize.sm, marginTop: 2 },
    emptyText: { fontSize: fontSize.sm, fontStyle: "italic", paddingVertical: spacing.md },
    addBtn: { paddingVertical: spacing.md, borderRadius: 12, alignItems: "center" },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    addForm: { padding: spacing.md, borderRadius: 12, borderWidth: 1, gap: spacing.sm },
    input: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, fontSize: fontSize.md },
    label: { fontSize: fontSize.sm, fontWeight: "600" },
    typeScroll: { maxHeight: 40, marginBottom: spacing.sm },
    typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 8 },
    formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, alignItems: "center" },
    saveBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: "center" },
  });
