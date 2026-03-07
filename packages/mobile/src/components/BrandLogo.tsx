import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "../utils/theme";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  color?: "light" | "dark";
  showTagline?: boolean;
}

export function BrandLogo({ size = "lg", color = "light", showTagline = true }: BrandLogoProps) {
  const isLight = color === "light";
  const logoSize = size === "lg" ? 48 : size === "md" ? 36 : 24;
  const titleSize = size === "lg" ? 44 : size === "md" ? 32 : 22;
  const iconSize = size === "lg" ? 32 : size === "md" ? 24 : 16;
  const iconContainerSize = size === "lg" ? 52 : size === "md" ? 40 : 28;

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={[styles.iconContainer, { width: iconContainerSize, height: iconContainerSize, borderRadius: iconContainerSize * 0.28 }]}>
          <Ionicons name="leaf" size={iconSize} color="#fff" />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { fontSize: titleSize }]}>
            <Text style={[styles.titleFood, { color: isLight ? "#fff" : "#0f172a" }]}>Food</Text>
            <Text style={styles.titleWise}>Wise</Text>
          </Text>
        </View>
      </View>
      {showTagline && (
        <Text style={[styles.tagline, { color: isLight ? "rgba(255,255,255,0.6)" : "#64748b" }]}>
          Smart Food Service Management
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  iconContainer: {
    backgroundColor: "#2c5282",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(44, 82, 130, 0.35)" }
      : { shadowColor: "#2c5282", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }),
  } as any,
  textWrap: {
    flexDirection: "row",
  },
  title: {
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  titleFood: {},
  titleWise: {
    color: "#4299e1",
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
});
