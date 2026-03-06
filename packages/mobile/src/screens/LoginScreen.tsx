import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

export function LoginScreen() {
  const { login, loginDemo, isLoading, error } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const s = makeStyles(colors);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await login(email.trim(), password);
    } catch {
      // Error is handled in context
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.header}>
        <Text style={s.logo}>FoodWise</Text>
        <Text style={s.tagline}>Smart Inventory Management</Text>
      </View>

      <View style={[s.form, { backgroundColor: colors.surface }]}>
        {error && (
          <View style={s.errorBox}>
            <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <Text style={[s.label, { color: colors.text }]}>Email</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={[s.label, { color: colors.text }]}>Password</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
        />

        <TouchableOpacity
          style={[s.button, { backgroundColor: colors.primary }, isLoading && s.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.demoButton, { borderColor: colors.border }]}
          onPress={loginDemo}
        >
          <Text style={[s.demoText, { color: colors.textSecondary }]}>Enter Demo Mode</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: spacing.xl },
    header: { alignItems: "center", marginBottom: spacing.xl * 2 },
    logo: { fontSize: 42, fontWeight: "800", color: "#fff", letterSpacing: -1 },
    tagline: { fontSize: fontSize.md, color: "rgba(255,255,255,0.7)", marginTop: spacing.xs },
    form: { borderRadius: 16, padding: spacing.lg },
    label: { fontSize: fontSize.sm, fontWeight: "600", marginBottom: spacing.xs, marginTop: spacing.md },
    input: { borderRadius: 10, padding: spacing.md, fontSize: fontSize.md, borderWidth: 1 },
    button: { borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.lg },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
    errorBox: { backgroundColor: colors.danger + "20", borderRadius: 8, padding: spacing.sm },
    errorText: { fontSize: fontSize.sm },
    demoButton: { borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.sm, borderWidth: 1 },
    demoText: { fontSize: fontSize.sm, fontWeight: "600" },
  });
