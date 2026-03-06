import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { spacing } from "../utils/theme";

interface ModeSelectionScreenProps {
  onManagerLogin: () => void;
  onKioskMode: () => void;
}

export function ModeSelectionScreen({ onManagerLogin, onKioskMode }: ModeSelectionScreenProps) {
  return (
    <View style={s.container}>
      <View style={s.brandSection}>
        <Text style={s.logo}>FoodWise</Text>
        <Text style={s.tagline}>Complete Food Service Management</Text>
      </View>

      <View style={s.buttonSection}>
        <TouchableOpacity style={s.managerBtn} onPress={onManagerLogin}>
          <Text style={s.managerIcon}>👔</Text>
          <Text style={s.managerTitle}>Manager Login</Text>
          <Text style={s.managerSub}>Full access to all features</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.kioskBtn} onPress={onKioskMode}>
          <Text style={s.kioskIcon}>⏱</Text>
          <Text style={s.kioskTitle}>Employee Kiosk</Text>
          <Text style={s.kioskSub}>Clock in / Clock out with PIN</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>v1.0.0</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "space-between",
    padding: spacing.xl,
  },
  brandSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    fontSize: 42,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: spacing.sm,
  },
  buttonSection: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  managerBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  managerIcon: { fontSize: 36, marginBottom: spacing.sm },
  managerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  managerSub: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  kioskBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  kioskIcon: { fontSize: 36, marginBottom: spacing.sm },
  kioskTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  kioskSub: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  footer: { textAlign: "center", color: "#475569", fontSize: 12, paddingBottom: spacing.md },
});
