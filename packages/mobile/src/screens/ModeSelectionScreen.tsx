import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BrandLogo } from "../components/BrandLogo";
import { spacing, borderRadius } from "../utils/theme";

interface ModeSelectionScreenProps {
  onManagerLogin: () => void;
  onKioskMode: () => void;
}

export function ModeSelectionScreen({ onManagerLogin, onKioskMode }: ModeSelectionScreenProps) {
  return (
    <View style={s.container}>
      <View style={s.brandSection}>
        <BrandLogo size="lg" color="light" />
      </View>

      <View style={s.buttonSection}>
        <TouchableOpacity style={s.managerBtn} onPress={onManagerLogin} activeOpacity={0.85}>
          <View style={s.btnIconWrap}>
            <Ionicons name="briefcase" size={28} color="#4299e1" />
          </View>
          <View style={s.btnTextWrap}>
            <Text style={s.btnTitle}>Manager Login</Text>
            <Text style={s.btnSub}>Full access to all features</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#475569" />
        </TouchableOpacity>

        <TouchableOpacity style={s.kioskBtn} onPress={onKioskMode} activeOpacity={0.85}>
          <View style={[s.btnIconWrap, { backgroundColor: "rgba(59,130,246,0.15)" }]}>
            <Ionicons name="time" size={28} color="#60a5fa" />
          </View>
          <View style={s.btnTextWrap}>
            <Text style={s.btnTitle}>Employee Kiosk</Text>
            <Text style={s.btnSub}>Clock in / Clock out with PIN</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#475569" />
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
  buttonSection: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  managerBtn: {
    backgroundColor: "#1e293b",
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  kioskBtn: {
    backgroundColor: "#1e293b",
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  btnIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: "rgba(66,153,225,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  btnTextWrap: {
    flex: 1,
  },
  btnTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 3,
  },
  btnSub: {
    fontSize: 13,
    color: "#94a3b8",
  },
  footer: {
    textAlign: "center",
    color: "#334155",
    fontSize: 12,
    paddingBottom: spacing.md,
  },
});
