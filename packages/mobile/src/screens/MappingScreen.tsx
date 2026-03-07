import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "MappingScreen">;

interface Mapping {
  storeId: string;
  posItemKey: string;
  posSystem: string;
  posItemId: string;
  posItemName: string;
  recipeId: string | null;
  ingredientId: string | null;
  quantityPerUnit: number;
  confidence: number;
  mappingSource: string;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return "#4CAF50";
  if (confidence >= 0.6) return "#FF9800";
  return "#F44336";
}

function getConfidenceLabel(confidence: number, source: string): string {
  if (source === "manual") return "Manual";
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.6) return "Low";
  return "Unmatched";
}

export function MappingScreen({ route }: Props) {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unmatched" | "low" | "high">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const styles = createStyles(colors);

  const loadData = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const [mappingResult, recipeResult] = await Promise.all([
        api.listPosMappings(selectedStoreId),
        api.listStores(), // recipes would come from a different endpoint
      ]);
      setMappings(mappingResult.mappings || []);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMappings = mappings.filter((m) => {
    if (filter === "unmatched" && m.confidence >= 0.6) return false;
    if (filter === "low" && (m.confidence < 0.6 || m.confidence >= 0.85)) return false;
    if (filter === "high" && m.confidence < 0.85) return false;
    if (searchQuery && !m.posItemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleApproveMapping = async (mapping: Mapping) => {
    if (!selectedStoreId) return;
    try {
      await api.updatePosMapping(selectedStoreId, {
        posItemKey: mapping.posItemKey,
        recipeId: mapping.recipeId || undefined,
        ingredientId: mapping.ingredientId || undefined,
        quantityPerUnit: mapping.quantityPerUnit,
        confidence: 1.0,
      });
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleRejectMapping = async (mapping: Mapping) => {
    if (!selectedStoreId) return;
    try {
      await api.updatePosMapping(selectedStoreId, {
        posItemKey: mapping.posItemKey,
        recipeId: undefined,
        ingredientId: undefined,
        quantityPerUnit: 1,
        confidence: 0,
      });
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const renderMapping = ({ item }: { item: Mapping }) => {
    const confColor = getConfidenceColor(item.confidence);
    const confLabel = getConfidenceLabel(item.confidence, item.mappingSource);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemName}>{item.posItemName}</Text>
          <View style={[styles.badge, { backgroundColor: confColor }]}>
            <Text style={styles.badgeText}>{confLabel}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          {item.posSystem.toUpperCase()} - {item.posItemId}
        </Text>

        {item.recipeId && (
          <Text style={styles.mappedTo}>
            Mapped to: {item.recipeId}
          </Text>
        )}

        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${Math.round(item.confidence * 100)}%`,
                backgroundColor: confColor,
              },
            ]}
          />
        </View>
        <Text style={styles.confidenceText}>
          {Math.round(item.confidence * 100)}% confidence
        </Text>

        {item.mappingSource !== "manual" && item.confidence < 1.0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApproveMapping(item)}
            >
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleRejectMapping(item)}
            >
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const counts = {
    all: mappings.length,
    high: mappings.filter((m) => m.confidence >= 0.85).length,
    low: mappings.filter((m) => m.confidence >= 0.6 && m.confidence < 0.85).length,
    unmatched: mappings.filter((m) => m.confidence < 0.6).length,
  };

  return (
    <View style={styles.container}>
      <StorePicker />

      <TextInput
        style={styles.searchInput}
        placeholder="Search items..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.filterRow}>
        {(["all", "unmatched", "low", "high"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredMappings}
          keyExtractor={(item) => item.posItemKey}
          renderItem={renderMapping}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {mappings.length === 0
                ? "No POS item mappings yet. Connect a POS system to get started."
                : "No items match the current filter."}
            </Text>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchInput: {
      margin: spacing.md,
      padding: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: fontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    filterBtn: {
      flex: 1,
      paddingVertical: spacing.xs,
      borderRadius: 6,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    filterBtnActive: { backgroundColor: colors.primary },
    filterText: { fontSize: fontSize.xs, color: colors.textSecondary },
    filterTextActive: { color: "#fff", fontWeight: "600" },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    itemName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
    subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
    mappedTo: { fontSize: fontSize.sm, color: colors.primary, marginBottom: 6 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    badgeText: { fontSize: fontSize.xs, color: "#fff", fontWeight: "600" },
    confidenceBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: 4,
    },
    confidenceFill: { height: 4, borderRadius: 2 },
    confidenceText: { fontSize: fontSize.xs, color: colors.textSecondary },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: spacing.xs,
      borderRadius: 6,
      alignItems: "center",
    },
    approveBtn: { backgroundColor: "#4CAF50" },
    rejectBtn: { backgroundColor: "#F44336" },
    actionBtnText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    loader: { marginTop: spacing.xl },
    empty: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: fontSize.md,
      marginTop: spacing.xl,
    },
  });
