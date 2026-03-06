import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSize, spacing } from "../utils/theme";

interface StatusBadgeProps {
  status: "green" | "yellow" | "red";
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const color = colors[status];
  const dotSize = size === "sm" ? 8 : 10;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.dot,
          { backgroundColor: color, width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
        ]}
      />
      {label && (
        <Text style={[styles.label, size === "sm" && styles.labelSm]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {},
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  labelSm: {
    fontSize: fontSize.xs,
  },
});
