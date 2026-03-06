import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSize, spacing } from "../utils/theme";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  status?: "green" | "yellow" | "red";
}

export function MetricCard({ title, value, subtitle, status }: MetricCardProps) {
  return (
    <View style={[styles.card, status && { borderLeftColor: colors[status], borderLeftWidth: 3 }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
