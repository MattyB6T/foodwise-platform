import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  status?: "green" | "yellow" | "red";
}

export function MetricCard({ title, value, subtitle, status }: MetricCardProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, status && { borderLeftColor: colors[status], borderLeftWidth: 3 }]}>
      <Text style={[s.title, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[s.value, { color: colors.text }]}>{value}</Text>
      {subtitle && <Text style={[s.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
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
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    value: {
      fontSize: fontSize.xl,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
  });
