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
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { fontSize, spacing, borderRadius } from "../utils/theme";

export function LoginScreen() {
  const { login, loginDemo, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.header}>
        <BrandLogo size="md" color="light" showTagline={false} />
      </View>

      <View style={s.form}>
        <Text style={s.formTitle}>Sign in to your account</Text>

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Text style={s.label}>Email</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={18} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>

        <Text style={s.label}>Password</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#475569"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.button, isLoading && s.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity
          style={s.demoButton}
          onPress={loginDemo}
          activeOpacity={0.85}
        >
          <Ionicons name="play-circle-outline" size={18} color="#94a3b8" />
          <Text style={s.demoText}>Enter Demo Mode</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  form: {
    backgroundColor: "#1e293b",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#334155",
  },
  formTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.xs + 2,
    marginTop: spacing.md,
    color: "#94a3b8",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: "#334155",
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: "#f1f5f9",
  },
  eyeBtn: {
    padding: spacing.md,
  },
  button: {
    backgroundColor: "#16a34a",
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  errorText: {
    fontSize: fontSize.sm,
    color: "#f87171",
    flex: 1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#334155",
  },
  dividerText: {
    color: "#475569",
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  demoButton: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  demoText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#94a3b8",
  },
});
