import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

const { width } = Dimensions.get("window");

const STEPS = [
  {
    title: "Welcome to FoodWise",
    description: "Your complete food service management platform. Track inventory, reduce waste, and optimize operations — all in one place.",
    icon: "🍽️",
  },
  {
    title: "Real-Time Inventory",
    description: "Scan barcodes to receive shipments, track stock levels automatically, and get low-stock alerts before you run out.",
    icon: "📦",
  },
  {
    title: "Waste & Cost Tracking",
    description: "Log waste, track food costs per dish, and see exactly where your money goes with detailed analytics.",
    icon: "📊",
  },
  {
    title: "Smart Ordering",
    description: "Auto-generated purchase orders based on forecasts, vendor price comparisons, and one-tap email to suppliers.",
    icon: "🛒",
  },
  {
    title: "Team Management",
    description: "Schedule staff, track time clock entries, assign roles, and keep everyone on the same page.",
    icon: "👥",
  },
  {
    title: "AI Assistant",
    description: "Ask questions about your business in plain English. Get insights on trends, suggestions for improvement, and more.",
    icon: "🤖",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const s = makeStyles(colors);

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.skipContainer}>
        <TouchableOpacity onPress={onComplete}>
          <Text style={[s.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        <Text style={s.icon}>{step.icon}</Text>
        <Text style={[s.title, { color: colors.text }]}>{step.title}</Text>
        <Text style={[s.description, { color: colors.textSecondary }]}>{step.description}</Text>
      </View>

      {/* Dots */}
      <View style={s.dotsContainer}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              { backgroundColor: i === currentStep ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      <View style={s.buttonContainer}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={[s.backBtn, { borderColor: colors.border }]}
            onPress={() => setCurrentStep((prev) => prev - 1)}
          >
            <Text style={[s.backBtnText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: colors.primary, flex: currentStep === 0 ? 1 : undefined }]}
          onPress={() => {
            if (isLast) {
              onComplete();
            } else {
              setCurrentStep((prev) => prev + 1);
            }
          }}
        >
          <Text style={s.nextBtnText}>{isLast ? "Get Started" : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: "space-between", padding: spacing.lg },
    skipContainer: { alignItems: "flex-end", paddingTop: spacing.lg },
    skipText: { fontSize: fontSize.md, fontWeight: "600" },
    content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.lg },
    icon: { fontSize: 64, marginBottom: spacing.lg },
    title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: spacing.md },
    description: { fontSize: fontSize.md, textAlign: "center", lineHeight: 24, paddingHorizontal: spacing.md },
    dotsContainer: { flexDirection: "row", justifyContent: "center", marginBottom: spacing.lg, gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    buttonContainer: { flexDirection: "row", gap: spacing.md, paddingBottom: spacing.lg },
    backBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12, borderWidth: 1 },
    backBtnText: { fontSize: fontSize.md, fontWeight: "600" },
    nextBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  });
