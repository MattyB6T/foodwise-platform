import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, borderRadius } from "../utils/theme";

interface StatusBadgeProps {
  status: "green" | "yellow" | "red";
  label?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const { colors } = useTheme();
  const color = colors[status];

  const bgColor =
    status === "green"
      ? colors.successLight
      : status === "yellow"
        ? colors.warningLight
        : colors.dangerLight;

  const statusLabel =
    label || (status === "green" ? "Healthy" : status === "yellow" ? "Warning" : "Critical");

  const isSmall = size === "sm";

  return (
    <View style={[styles.pill, { backgroundColor: bgColor }, isSmall && styles.pillSm]}>
      <View style={[styles.dot, { backgroundColor: color }, isSmall && styles.dotSm]} />
      <Text
        style={[
          styles.label,
          { color },
          isSmall && styles.labelSm,
        ]}
        numberOfLines={1}
      >
        {statusLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs + 1,
  },
  pillSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotSm: {
    width: 6,
    height: 6,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  labelSm: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
