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
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import type { RootStackParamList } from "../navigation/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;
const APP_VERSION = "1.0.0";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { stores, selectedStoreId, refreshStores } = useStore();
  const { colors, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<NavProp>();
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

  // Add store
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [addingStore, setAddingStore] = useState(false);

  // Kiosk mode
  const [showKioskSetup, setShowKioskSetup] = useState(false);
  const [kioskStoreId, setKioskStoreId] = useState(selectedStoreId || "");
  const [kioskDeviceName, setKioskDeviceName] = useState("Front Counter Tablet");
  const [kioskHoursOpen, setKioskHoursOpen] = useState("06:00");
  const [kioskHoursClose, setKioskHoursClose] = useState("23:00");
  const [kioskAddress, setKioskAddress] = useState("");
  const [kioskManagerPin, setKioskManagerPin] = useState("");
  const [kioskEnabling, setKioskEnabling] = useState(false);

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

  const handleAddStore = async () => {
    const name = newStoreName.trim();
    const address = newStoreAddress.trim();
    if (!name) {
      Alert.alert("Required", "Enter a store name.");
      return;
    }
    if (!address) {
      Alert.alert("Required", "Enter a store address.");
      return;
    }
    setAddingStore(true);
    try {
      await api.createStore({ name, address });
      Alert.alert("Store Added", `"${name}" has been created.`);
      setShowAddStore(false);
      setNewStoreName("");
      setNewStoreAddress("");
      refreshStores();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create store");
    } finally {
      setAddingStore(false);
    }
  };

  const handleEnableKiosk = async () => {
    if (!kioskStoreId) {
      Alert.alert("Required", "Select a store for this kiosk.");
      return;
    }
    if (!kioskManagerPin || kioskManagerPin.length !== 6 || !/^\d+$/.test(kioskManagerPin)) {
      Alert.alert("Required", "Manager exit PIN must be exactly 6 digits.");
      return;
    }

    Alert.alert(
      "Enable Kiosk Mode",
      "Once kiosk mode is enabled on this device, employees will only see the clock-in screen. To exit kiosk mode, tap the logo 5 times and enter your manager PIN.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Enable",
          style: "destructive",
          onPress: async () => {
            setKioskEnabling(true);
            try {
              const storeName = stores.find(s => s.storeId === kioskStoreId)?.name || "Store";
              const data = await api.registerKioskDevice({
                storeId: kioskStoreId,
                deviceName: kioskDeviceName,
                storeHoursOpen: kioskHoursOpen,
                storeHoursClose: kioskHoursClose,
                storeAddress: kioskAddress,
                managerExitPin: kioskManagerPin,
              });

              await AsyncStorage.setItem("kiosk_enabled", "true");
              await AsyncStorage.setItem("kiosk_device_id", data.deviceId);
              await AsyncStorage.setItem("kiosk_api_key", data.apiKey);
              await AsyncStorage.setItem("kiosk_store_id", kioskStoreId);
              await AsyncStorage.setItem("kiosk_store_name", storeName);
              await AsyncStorage.setItem("kiosk_manager_pin", kioskManagerPin);

              Alert.alert("Kiosk Mode Enabled", "Device is now in kiosk mode. App will switch to the employee clock-in screen.");
              // Force reload by navigating to ModeSelection which will detect kiosk_enabled
              navigation.reset({ index: 0, routes: [{ name: "ModeSelection" as any }] });
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to register kiosk device");
            } finally {
              setKioskEnabling(false);
            }
          },
        },
      ]
    );
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
        {!showAddStore ? (
          <TouchableOpacity style={s.row} onPress={() => setShowAddStore(true)}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>➕</Text>
              <Text style={[s.rowLabel, { color: colors.primary }]}>Add Store</Text>
            </View>
            <Text style={[s.rowArrow, { color: colors.textSecondary }]}>→</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.passwordForm}>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Store Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={newStoreName}
              onChangeText={setNewStoreName}
              placeholder="e.g. Downtown Location"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Address</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={newStoreAddress}
              onChangeText={setNewStoreAddress}
              placeholder="123 Main St, City, State"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={s.passwordActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowAddStore(false); setNewStoreName(""); setNewStoreAddress(""); }}
              >
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddStore}
                disabled={addingStore}
              >
                <Text style={s.saveText}>{addingStore ? "Adding..." : "Add Store"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Kiosk Mode */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Kiosk Mode</Text>
        {!showKioskSetup ? (
          <TouchableOpacity style={s.row} onPress={() => setShowKioskSetup(true)}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>⏱</Text>
              <View>
                <Text style={[s.rowLabel, { color: colors.primary }]}>Enable Kiosk Mode</Text>
                <Text style={[s.rowSub, { color: colors.textSecondary }]}>Turn this device into an employee time clock</Text>
              </View>
            </View>
            <Text style={[s.rowArrow, { color: colors.textSecondary }]}>→</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.passwordForm}>
            <Text style={[s.kioskWarning, { color: colors.warning }]}>
              This will lock the device to the clock-in screen. Only a manager PIN can exit kiosk mode.
            </Text>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Select Store</Text>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.storeId}
                style={[s.storeOption, { borderColor: kioskStoreId === store.storeId ? colors.primary : colors.border }]}
                onPress={() => setKioskStoreId(store.storeId)}
              >
                <Text style={[s.storeOptionText, { color: kioskStoreId === store.storeId ? colors.primary : colors.text }]}>
                  {kioskStoreId === store.storeId ? "● " : "○ "}{store.name}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Device Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={kioskDeviceName}
              onChangeText={setKioskDeviceName}
              placeholder="e.g. Front Counter Tablet"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Store Hours</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                style={[s.input, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={kioskHoursOpen}
                onChangeText={setKioskHoursOpen}
                placeholder="Open (HH:MM)"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={[s.input, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={kioskHoursClose}
                onChangeText={setKioskHoursClose}
                placeholder="Close (HH:MM)"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Store Address (for GPS verification)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={kioskAddress}
              onChangeText={setKioskAddress}
              placeholder="123 Main St, City, State"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Manager Exit PIN (6 digits)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={kioskManagerPin}
              onChangeText={(t) => setKioskManagerPin(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="6-digit PIN"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />

            <Text style={[s.kioskNote, { color: colors.textSecondary }]}>
              Camera: Used for fraud prevention — captures a photo on every clock-in.{"\n"}
              Location: Captures GPS to verify clock-in happens at the store.
            </Text>

            <View style={s.passwordActions}>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowKioskSetup(false)}
              >
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.danger }]}
                onPress={handleEnableKiosk}
                disabled={kioskEnabling}
              >
                <Text style={s.saveText}>{kioskEnabling ? "Enabling..." : "Enable Kiosk"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Timesheets */}
      <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Timesheets</Text>
        <TouchableOpacity style={s.row} onPress={() => navigation.navigate("Timesheet" as any)}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📋</Text>
            <Text style={[s.rowLabel, { color: colors.primary }]}>View Timesheets</Text>
          </View>
          <Text style={[s.rowArrow, { color: colors.textSecondary }]}>→</Text>
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

    kioskWarning: { fontSize: fontSize.sm, marginBottom: spacing.md, lineHeight: 20 },
    kioskNote: { fontSize: fontSize.xs, marginBottom: spacing.md, lineHeight: 18 },
    fieldLabel: { fontSize: fontSize.xs, fontWeight: "600", marginBottom: 4, marginTop: spacing.xs },
    storeOption: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
    storeOptionText: { fontSize: fontSize.sm, fontWeight: "600" },

    logoutBtn: {
      margin: spacing.md,
      padding: spacing.md,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 2,
    },
    logoutText: { fontSize: fontSize.md, fontWeight: "700" },
  });
