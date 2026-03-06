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
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { api } from "../utils/api";
import { colors, fontSize, spacing } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

const REASONS = [
  { key: "expired", label: "Expired", icon: "⏰" },
  { key: "damaged", label: "Damaged", icon: "💔" },
  { key: "over-prep", label: "Over-Prep", icon: "📏" },
  { key: "dropped", label: "Dropped", icon: "💧" },
  { key: "other", label: "Other", icon: "❓" },
];

export function WasteLogScreen() {
  const { selectedStoreId } = useStore();
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!selectedStoreId) return;
    api
      .getInventory(selectedStoreId)
      .then((res) => setInventory(res.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  const filteredItems = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedStoreId || !selectedItem || !quantity || !reason) {
      Alert.alert("Missing Info", "Select an ingredient, quantity, and reason.");
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Enter a number greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      await api.recordWaste(selectedStoreId, {
        ingredientId: selectedItem.itemId,
        quantity: qty,
        reason,
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        "Waste Logged",
        `${qty} ${selectedItem.unit} of ${selectedItem.name} logged as ${reason}.`
      );

      // Reset form
      setSelectedItem(null);
      setQuantity("");
      setReason("");
      setNotes("");
      setSearchQuery("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log waste");
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedStoreId) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <StorePicker />
      <Text style={styles.title}>Log Waste</Text>

      {/* Ingredient Selection */}
      <Text style={styles.label}>Ingredient</Text>
      {selectedItem ? (
        <TouchableOpacity
          style={styles.selectedItem}
          onPress={() => setSelectedItem(null)}
        >
          <Text style={styles.selectedName}>{selectedItem.name}</Text>
          <Text style={styles.selectedDetail}>
            {selectedItem.quantity} {selectedItem.unit} in stock | Tap to change
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.itemList}>
            {filteredItems.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={item.itemId}
                style={styles.itemOption}
                onPress={() => {
                  setSelectedItem(item);
                  setSearchQuery("");
                }}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemStock}>
                  {item.quantity} {item.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Quantity */}
      <Text style={styles.label}>Quantity</Text>
      <View style={styles.qtyRow}>
        <TextInput
          style={styles.qtyInput}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
        />
        {selectedItem && (
          <Text style={styles.unitLabel}>{selectedItem.unit}</Text>
        )}
      </View>

      {/* Reason */}
      <Text style={styles.label}>Reason</Text>
      <View style={styles.reasonGrid}>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[
              styles.reasonBtn,
              reason === r.key && styles.reasonBtnActive,
            ]}
            onPress={() => setReason(r.key)}
          >
            <Text style={styles.reasonIcon}>{r.icon}</Text>
            <Text
              style={[
                styles.reasonLabel,
                reason === r.key && styles.reasonLabelActive,
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notes */}
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Add details..."
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!selectedItem || !quantity || !reason || submitting) &&
            styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedItem || !quantity || !reason || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Log Waste</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemList: { marginTop: spacing.sm },
  itemOption: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: { fontSize: fontSize.md, color: colors.text },
  itemStock: { fontSize: fontSize.sm, color: colors.textSecondary },
  selectedItem: {
    backgroundColor: "#EBF8FF",
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  selectedName: { fontSize: fontSize.md, fontWeight: "700", color: colors.primary },
  selectedDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  qtyInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: "700",
    width: 120,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  reasonBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    width: "30%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "#EBF8FF",
  },
  reasonIcon: { fontSize: 24, marginBottom: spacing.xs },
  reasonLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "600" },
  reasonLabelActive: { color: colors.primary },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: "top",
    minHeight: 80,
  },
  submitBtn: {
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
});
