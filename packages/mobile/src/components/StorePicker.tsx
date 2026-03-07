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
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

export function StorePicker() {
  const { selectedStoreId, selectedStoreName, stores, setSelectedStore } = useStore();
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const s = makeStyles(colors);

  if (stores.length <= 1) {
    return selectedStoreName ? (
      <View style={[s.bar, { backgroundColor: colors.primary }]}>
        <Text style={s.storeName}>{selectedStoreName}</Text>
      </View>
    ) : null;
  }

  return (
    <>
      <TouchableOpacity style={[s.bar, { backgroundColor: colors.primary }]} onPress={() => setShowPicker(true)}>
        <Text style={s.storeName}>{selectedStoreName || "Select Store"}</Text>
        <Text style={s.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={[s.dropdown, { backgroundColor: colors.surface }]}>
            <Text style={[s.dropdownTitle, { color: colors.text, borderBottomColor: colors.border }]}>Select Store</Text>
            <FlatList
              data={stores}
              keyExtractor={(item) => item.storeId}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.option,
                    { borderBottomColor: colors.border },
                    item.storeId === selectedStoreId && { backgroundColor: colors.primary + "15" },
                  ]}
                  onPress={() => {
                    setSelectedStore(item.storeId, item.name);
                    setShowPicker(false);
                  }}
                >
                  <Text
                    style={[
                      s.optionText,
                      { color: colors.text },
                      item.storeId === selectedStoreId && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.storeId === selectedStoreId && (
                    <Text style={[s.check, { color: colors.primary }]}>✓</Text>
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

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
    },
    storeName: { color: "rgba(255,255,255,0.9)", fontSize: fontSize.xs, fontWeight: "600", letterSpacing: 0.3 },
    arrow: { color: "rgba(255,255,255,0.5)", fontSize: 8 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.xl },
    dropdown: { borderRadius: 16, maxHeight: 400, overflow: "hidden" },
    dropdownTitle: { fontSize: fontSize.lg, fontWeight: "700", padding: spacing.lg, borderBottomWidth: 1 },
    option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomWidth: 1 },
    optionText: { fontSize: fontSize.md },
    check: { fontSize: fontSize.lg, fontWeight: "700" },
  });
