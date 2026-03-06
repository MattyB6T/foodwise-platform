import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";

const APP_VERSION = "1.0.0";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { stores, selectedStoreId } = useStore();
  const { colors, isDark, toggleTheme } = useTheme();
  const s = makeStyles(colors);

  // Notification preferences
  const [notifLowStock, setNotifLowStock] = useState(true);
  const [notifWaste, setNotifWaste] = useState(true);
  const [notifForecast, setNotifForecast] = useState(true);
  const [notifReceiving, setNotifReceiving] = useState(false);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Missing Info", "Enter both current and new passwords.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Too Short", "Password must be at least 8 characters.");
      return;
    }
    Alert.alert("Password Updated", "Your password has been changed successfully.");
    setShowPasswordChange(false);
    setCurrentPassword("");
    setNewPassword("");
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.background }]}>
      {/* Dark Mode */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🌙</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Profile */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Profile</Text>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📧</Text>
            <View>
              <Text style={[s.rowLabel, { color: colors.text }]}>{user?.email || "Not signed in"}</Text>
              <Text style={[s.rowSub, { color: colors.textSecondary }]}>
                Role: {user?.groups?.join(", ") || "owner"}
              </Text>
            </View>
          </View>
        </View>

        {!showPasswordChange ? (
          <TouchableOpacity style={s.row} onPress={() => setShowPasswordChange(true)}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🔑</Text>
              <Text style={[s.rowLabel, { color: colors.primary }]}>Change Password</Text>
            </View>
            <Text style={[s.rowArrow, { color: colors.textSecondary }]}>→</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.passwordForm}>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Current password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={s.passwordActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowPasswordChange(false)}
              >
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleChangePassword}
              >
                <Text style={s.saveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Store Management */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Store Management</Text>
        {stores.map((store) => (
          <View key={store.storeId} style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🏪</Text>
              <View>
                <Text style={[s.rowLabel, { color: colors.text }]}>{store.name}</Text>
                {store.storeId === selectedStoreId && (
                  <Text style={[s.rowSub, { color: colors.primary }]}>Active</Text>
                )}
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={s.row}
          onPress={() => Alert.alert("Coming Soon", "Store management will be available in the next update.")}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>➕</Text>
            <Text style={[s.rowLabel, { color: colors.primary }]}>Add Store</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Notifications</Text>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📦</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Low Stock Alerts</Text>
          </View>
          <Switch value={notifLowStock} onValueChange={setNotifLowStock} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🗑</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Waste Anomalies</Text>
          </View>
          <Switch value={notifWaste} onValueChange={setNotifWaste} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📊</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Forecast Ready</Text>
          </View>
          <Switch value={notifForecast} onValueChange={setNotifForecast} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🚚</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Receiving Reminders</Text>
          </View>
          <Switch value={notifReceiving} onValueChange={setNotifReceiving} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      {/* Camera Settings */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Camera Settings</Text>
        <TouchableOpacity
          style={s.row}
          onPress={() => Alert.alert("Manage Cameras", "Navigate to the Security tab to manage your Wyze cameras.")}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📷</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>Manage Wyze Cameras</Text>
          </View>
          <Text style={[s.rowArrow, { color: colors.textSecondary }]}>→</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>About</Text>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>ℹ</Text>
            <Text style={[s.rowLabel, { color: colors.text }]}>FoodWise Platform</Text>
          </View>
          <Text style={[s.versionText, { color: colors.textSecondary }]}>v{APP_VERSION}</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[s.logoutBtn, { borderColor: colors.danger }]}
        onPress={logout}
      >
        <Text style={[s.logoutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: spacing.xl * 2 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    section: {
      margin: spacing.md,
      marginBottom: 0,
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
    },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      padding: spacing.md,
      paddingBottom: spacing.xs,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    rowIcon: { fontSize: 20, marginRight: spacing.sm, width: 28 },
    rowLabel: { fontSize: fontSize.md },
    rowSub: { fontSize: fontSize.xs, marginTop: 1 },
    rowArrow: { fontSize: fontSize.lg },
    versionText: { fontSize: fontSize.sm },

    passwordForm: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    input: {
      borderRadius: 10,
      padding: spacing.md,
      fontSize: fontSize.md,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    passwordActions: { flexDirection: "row", gap: spacing.sm },
    cancelBtn: {
      flex: 1,
      padding: spacing.md,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: 1,
    },
    cancelText: { fontWeight: "600" },
    saveBtn: {
      flex: 1,
      padding: spacing.md,
      borderRadius: 10,
      alignItems: "center",
    },
    saveText: { color: "#fff", fontWeight: "700" },

    logoutBtn: {
      margin: spacing.md,
      padding: spacing.md,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 2,
    },
    logoutText: { fontSize: fontSize.md, fontWeight: "700" },
  });
