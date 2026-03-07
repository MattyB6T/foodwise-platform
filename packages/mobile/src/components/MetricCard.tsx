import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  status?: "green" | "yellow" | "red";
  icon?: keyof typeof Ionicons.glyphMap;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
}

export function MetricCard({ title, value, subtitle, status, icon, trend, trendLabel }: MetricCardProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const accentColor = status ? colors[status] : colors.primary;
  const accentBg = status === "red"
    ? colors.dangerLight
    : status === "yellow"
      ? colors.warningLight
      : colors.successLight;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
      <View style={[s.accentStripe, { backgroundColor: accentColor }]} />
      <View style={s.content}>
        <View style={s.headerRow}>
          {icon && (
            <View style={[s.iconWrap, { backgroundColor: accentBg }]}>
              <Ionicons name={icon} size={14} color={accentColor} />
            </View>
          )}
          <Text style={[s.title, { color: colors.textSecondary }]} numberOfLines={1}>{title}</Text>
        </View>
        <Text style={[s.value, { color: colors.text }]}>{value}</Text>
        {(subtitle || trend) && (
          <View style={s.footerRow}>
            {trend && (
              <View style={[s.trendPill, { backgroundColor: trend === "up" ? colors.successLight : trend === "down" ? colors.dangerLight : colors.borderLight }]}>
                <Ionicons
                  name={trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "remove"}
                  size={12}
                  color={trend === "up" ? colors.green : trend === "down" ? colors.red : colors.textMuted}
                />
                {trendLabel && (
                  <Text style={[s.trendText, { color: trend === "up" ? colors.green : trend === "down" ? colors.red : colors.textMuted }]}>
                    {trendLabel}
                  </Text>
                )}
              </View>
            )}
            {subtitle && <Text style={[s.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      overflow: "hidden",
      flexDirection: "row",
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    accentStripe: {
      width: 4,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    iconWrap: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.xs + 2,
    },
    title: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      flex: 1,
    },
    value: {
      fontSize: fontSize.xl,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginTop: 2,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    trendPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      gap: 3,
    },
    trendText: {
      fontSize: fontSize.xs,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: fontSize.xs,
      flex: 1,
    },
  });
