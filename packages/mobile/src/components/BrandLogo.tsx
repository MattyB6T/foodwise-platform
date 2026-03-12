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
  const titleSize = size === "lg" ? 44 : size === "md" ? 32 : 22;
  const iconSize = size === "lg" ? 28 : size === "md" ? 20 : 14;
  const iconContainerSize = size === "lg" ? 52 : size === "md" ? 40 : 28;

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={[styles.iconContainer, { width: iconContainerSize, height: iconContainerSize, borderRadius: iconContainerSize * 0.28 }]}>
          <Ionicons name="restaurant-outline" size={iconSize} color="#fff" />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { fontSize: titleSize }]}>
            <Text style={[styles.titleFood, { color: isLight ? "#fff" : "#0f172a" }]}>Lean</Text>
            <Text style={styles.titleWise}>Table</Text>
          </Text>
        </View>
      </View>
      {showTagline && (
        <Text style={[styles.tagline, { color: isLight ? "rgba(255,255,255,0.6)" : "#64748b" }]}>
          Smarter Restaurant Operations
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
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(37, 99, 235, 0.35)" }
      : { shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }),
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
    color: "#60a5fa",
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
});
