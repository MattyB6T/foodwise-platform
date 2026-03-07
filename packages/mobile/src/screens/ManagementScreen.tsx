import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../contexts/StoreContext";
import { fontSize, spacing, borderRadius, type ColorScheme } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface ManagementItem {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  screen: keyof RootStackParamList;
}

export function ManagementScreen() {
  const { colors } = useTheme();
  const { selectedStoreId } = useStore();
  const navigation = useNavigation<NavProp>();
  const s = makeStyles(colors);

  const items: ManagementItem[] = [
    {
      title: "Security",
      subtitle: "Cameras, transactions & incidents",
      icon: "shield-checkmark",
      iconColor: "#e53e3e",
      bgColor: "#fed7d7",
      screen: "Security",
    },
    {
      title: "Purchase Orders",
      subtitle: "Create, review & send to suppliers",
      icon: "cart",
      iconColor: "#2c5282",
      bgColor: "#bee3f8",
      screen: "OrderReview",
    },
    {
      title: "Timesheets",
      subtitle: "Approve hours & review labor costs",
      icon: "time",
      iconColor: "#38a169",
      bgColor: "#c6f6d5",
      screen: "Timesheet",
    },
    {
      title: "Staff Schedule",
      subtitle: "Manage shifts & coverage",
      icon: "calendar",
      iconColor: "#805ad5",
      bgColor: "#e9d8fd",
      screen: "Schedule",
    },
    {
      title: "Staff Management",
      subtitle: "Employees, roles & pay rates",
      icon: "people",
      iconColor: "#d69e2e",
      bgColor: "#fefcbf",
      screen: "LiveStaff",
    },
    {
      title: "Weekly Plan",
      subtitle: "AI-powered staffing, ordering & waste plan",
      icon: "analytics",
      iconColor: "#dd6b20",
      bgColor: "#feebc8",
      screen: "WeeklyPlan",
    },
    {
      title: "Reports",
      subtitle: "Weekly reports & data exports",
      icon: "bar-chart",
      iconColor: "#319795",
      bgColor: "#b2f5ea",
      screen: "Reports",
    },
  ];

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.headerSection}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Management</Text>
        <Text style={[s.headerSubtitle, { color: colors.textSecondary }]}>
          Admin tools & oversight
        </Text>
      </View>

      <View style={s.grid}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            onPress={() => navigation.navigate(item.screen as any)}
            activeOpacity={0.7}
          >
            <View style={[s.iconContainer, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon} size={24} color={item.iconColor} />
            </View>
            <Text style={[s.cardTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[s.cardSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
            <View style={s.arrowRow}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    headerSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: fontSize.sm,
      marginTop: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing.lg - spacing.xs,
      gap: spacing.sm,
    },
    card: {
      width: "47.5%",
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
      minHeight: 140,
      justifyContent: "space-between",
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: "700",
    },
    cardSubtitle: {
      fontSize: fontSize.xs,
      marginTop: 2,
      lineHeight: 16,
    },
    arrowRow: {
      alignItems: "flex-end",
      marginTop: spacing.sm,
    },
  });
