import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { colors, fontSize, spacing } from "../utils/theme";

export function StorePicker() {
  const { selectedStoreId, selectedStoreName, stores, setSelectedStore } = useStore();
  const [showPicker, setShowPicker] = useState(false);

  if (stores.length <= 1) {
    return selectedStoreName ? (
      <View style={styles.bar}>
        <Text style={styles.storeName}>{selectedStoreName}</Text>
      </View>
    ) : null;
  }

  return (
    <>
      <TouchableOpacity style={styles.bar} onPress={() => setShowPicker(true)}>
        <Text style={styles.storeName}>{selectedStoreName || "Select Store"}</Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Select Store</Text>
            <FlatList
              data={stores}
              keyExtractor={(item) => item.storeId}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.storeId === selectedStoreId && styles.optionActive,
                  ]}
                  onPress={() => {
                    setSelectedStore(item.storeId, item.name);
                    setShowPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.storeId === selectedStoreId && styles.optionTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.storeId === selectedStoreId && (
                    <Text style={styles.check}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  storeName: {
    color: "#fff",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  arrow: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: 400,
    overflow: "hidden",
  },
  dropdownTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: "#EBF8FF" },
  optionText: { fontSize: fontSize.md, color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: "700" },
  check: { color: colors.primary, fontSize: fontSize.lg, fontWeight: "700" },
});
