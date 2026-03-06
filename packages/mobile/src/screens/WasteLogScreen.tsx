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
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
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
  const { colors } = useTheme();
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const s = makeStyles(colors);

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
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <StorePicker />
      <Text style={[s.title, { color: colors.text }]}>Log Waste</Text>

      <Text style={[s.label, { color: colors.text }]}>Ingredient</Text>
      {selectedItem ? (
        <TouchableOpacity
          style={[s.selectedItem, { borderColor: colors.primaryLight }]}
          onPress={() => setSelectedItem(null)}
        >
          <Text style={[s.selectedName, { color: colors.primary }]}>{selectedItem.name}</Text>
          <Text style={[s.selectedDetail, { color: colors.textSecondary }]}>
            {selectedItem.quantity} {selectedItem.unit} in stock | Tap to change
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <TextInput
            style={[s.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Search ingredients..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={s.itemList}>
            {filteredItems.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={item.itemId}
                style={[s.itemOption, { backgroundColor: colors.surface }]}
                onPress={() => {
                  setSelectedItem(item);
                  setSearchQuery("");
                }}
              >
                <Text style={[s.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[s.itemStock, { color: colors.textSecondary }]}>
                  {item.quantity} {item.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={[s.label, { color: colors.text }]}>Quantity</Text>
      <View style={s.qtyRow}>
        <TextInput
          style={[s.qtyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
        />
        {selectedItem && (
          <Text style={[s.unitLabel, { color: colors.textSecondary }]}>{selectedItem.unit}</Text>
        )}
      </View>

      <Text style={[s.label, { color: colors.text }]}>Reason</Text>
      <View style={s.reasonGrid}>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[
              s.reasonBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              reason === r.key && { borderColor: colors.primary },
            ]}
            onPress={() => setReason(r.key)}
          >
            <Text style={s.reasonIcon}>{r.icon}</Text>
            <Text
              style={[
                s.reasonLabel,
                { color: colors.textSecondary },
                reason === r.key && { color: colors.primary },
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.label, { color: colors.text }]}>Notes (optional)</Text>
      <TextInput
        style={[s.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Add details..."
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[
          s.submitBtn,
          { backgroundColor: colors.danger },
          (!selectedItem || !quantity || !reason || submitting) && s.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedItem || !quantity || !reason || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.submitText}>Log Waste</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.lg },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    title: { fontSize: fontSize.xl, fontWeight: "800", marginBottom: spacing.lg },
    label: { fontSize: fontSize.sm, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.sm },
    searchInput: { borderRadius: 10, padding: spacing.md, fontSize: fontSize.md, borderWidth: 1 },
    itemList: { marginTop: spacing.sm },
    itemOption: { padding: spacing.md, borderRadius: 8, marginBottom: spacing.xs, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    itemName: { fontSize: fontSize.md },
    itemStock: { fontSize: fontSize.sm },
    selectedItem: { borderRadius: 10, padding: spacing.md, borderWidth: 1, backgroundColor: "rgba(66,153,225,0.1)" },
    selectedName: { fontSize: fontSize.md, fontWeight: "700" },
    selectedDetail: { fontSize: fontSize.sm, marginTop: 2 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    qtyInput: { borderRadius: 10, padding: spacing.md, fontSize: fontSize.xl, fontWeight: "700", width: 120, textAlign: "center", borderWidth: 1 },
    unitLabel: { fontSize: fontSize.md },
    reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    reasonBtn: { borderRadius: 10, padding: spacing.md, alignItems: "center", width: "30%", borderWidth: 1 },
    reasonIcon: { fontSize: 24, marginBottom: spacing.xs },
    reasonLabel: { fontSize: fontSize.xs, fontWeight: "600" },
    notesInput: { borderRadius: 10, padding: spacing.md, fontSize: fontSize.md, borderWidth: 1, textAlignVertical: "top", minHeight: 80 },
    submitBtn: { padding: spacing.md, borderRadius: 12, alignItems: "center", marginTop: spacing.lg },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
