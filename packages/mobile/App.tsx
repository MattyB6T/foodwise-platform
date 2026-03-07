import React, { useEffect, useState } from "react";
import { Platform, Text, ActivityIndicator, View, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { StoreProvider } from "./src/contexts/StoreContext";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { StoreDetailScreen } from "./src/screens/StoreDetailScreen";
import { BarcodeScannerScreen } from "./src/screens/BarcodeScannerScreen";
import { WasteLogScreen } from "./src/screens/WasteLogScreen";
import { OrderReviewScreen } from "./src/screens/OrderReviewScreen";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { SecurityScreen } from "./src/screens/SecurityScreen";
import { TransactionDetailScreen } from "./src/screens/TransactionDetailScreen";
import { CountScreen } from "./src/screens/CountScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { ExpirationScreen } from "./src/screens/ExpirationScreen";
import { ScheduleScreen } from "./src/screens/ScheduleScreen";
import { TempLogScreen } from "./src/screens/TempLogScreen";
import { ForecastScreen } from "./src/screens/ForecastScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ModeSelectionScreen } from "./src/screens/ModeSelectionScreen";
import { KioskScreen } from "./src/screens/KioskScreen";
import { TimesheetScreen } from "./src/screens/TimesheetScreen";
import { TimeEntryDetailScreen } from "./src/screens/TimeEntryDetailScreen";
import { LiveStaffScreen } from "./src/screens/LiveStaffScreen";
import { IntegrationsScreen } from "./src/screens/IntegrationsScreen";
import { MappingScreen } from "./src/screens/MappingScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import type { RootStackParamList, TabParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const linking: any = {
  prefixes: [],
  config: {
    screens: {
      ModeSelection: "mode",
      Kiosk: "kiosk",
      Login: "login",
      Onboarding: "onboarding",
      MainTabs: {
        screens: {
          DashboardTab: "",
          ScannerTab: "scan",
          CountTab: "count",
          WasteTab: "waste",
          OrdersTab: "orders",
          SecurityTab: "security",
          AssistantTab: "assistant",
          SettingsTab: "settings",
        },
      },
      StoreDetail: "store",
      BarcodeScanner: "scanner",
      WasteLog: "waste-log",
      OrderReview: "order-review",
      Assistant: "ask",
      Security: "security-detail",
      TransactionDetail: "transaction",
      Dashboard: "dashboard",
      Reports: "reports",
      Expiration: "expiration",
      Schedule: "schedule",
      TempLog: "temp-log",
      Forecast: "forecast",
      Timesheet: "timesheet",
      TimeEntryDetail: "time-entry",
      LiveStaff: "live-staff",
    },
  },
};

function MainTabs() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: {
          backgroundColor: colors.primary,
          shadowColor: "transparent",
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800", fontSize: 18, letterSpacing: -0.3 },
        headerLeft: route.name !== "DashboardTab"
          ? () => (
              <TouchableOpacity
                onPress={() => navigation.navigate("DashboardTab")}
                style={{ marginLeft: 14, padding: 4 }}
              >
                <Ionicons name="home-outline" size={21} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            )
          : undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === "ios" ? 20 : 6,
          paddingTop: 6,
          height: Platform.OS === "ios" ? 80 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
          marginTop: 1,
        },
        tabBarIcon: ({ color, focused, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";
          if (route.name === "DashboardTab") iconName = focused ? "grid" : "grid-outline";
          else if (route.name === "ScannerTab") iconName = focused ? "scan" : "scan-outline";
          else if (route.name === "CountTab") iconName = focused ? "cube" : "cube-outline";
          else if (route.name === "WasteTab") iconName = focused ? "trash" : "trash-outline";
          else if (route.name === "OrdersTab") iconName = focused ? "cart" : "cart-outline";
          else if (route.name === "SecurityTab") iconName = focused ? "shield-checkmark" : "shield-checkmark-outline";
          else if (route.name === "AssistantTab") iconName = focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline";
          else if (route.name === "SettingsTab") iconName = focused ? "settings" : "settings-outline";
          return <Ionicons name={iconName} size={focused ? 22 : 20} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: "Home",
          headerTitle: "FoodWise",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SettingsTab")}
              style={{ marginRight: 14, padding: 4 }}
            >
              <Ionicons name="settings-outline" size={21} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="ScannerTab"
        component={BarcodeScannerScreen}
        options={{ title: "Scanner", headerTitle: "Receive Shipment" }}
      />
      <Tab.Screen
        name="CountTab"
        component={CountScreen}
        options={{ title: "Inventory", headerTitle: "Inventory" }}
      />
      <Tab.Screen
        name="WasteTab"
        component={WasteLogScreen}
        options={{ title: "Waste", headerTitle: "Log Waste" }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrderReviewScreen}
        options={{ title: "Orders", headerTitle: "Purchase Orders" }}
      />
      <Tab.Screen
        name="SecurityTab"
        component={SecurityScreen}
        options={{ title: "Security", headerTitle: "Security" }}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantScreen}
        options={{ title: "Assistant", headerTitle: "AI Assistant" }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ title: "Settings", headerTitle: "Settings" }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const [kioskEnabled, setKioskEnabled] = useState<boolean | null>(null);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [pendingKiosk, setPendingKiosk] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [enabled, onboarded] = await Promise.all([
        AsyncStorage.getItem("kiosk_enabled"),
        AsyncStorage.getItem("onboarding_complete"),
      ]);
      setKioskEnabled(enabled === "true");
      setOnboardingComplete(onboarded === "true");
    })();
  }, []);

  // When user logs in after tapping "Employee Kiosk", activate kiosk mode
  useEffect(() => {
    if (isAuthenticated && pendingKiosk) {
      setPendingKiosk(false);
      AsyncStorage.setItem("kiosk_enabled", "true");
      setKioskEnabled(true);
    }
  }, [isAuthenticated, pendingKiosk]);

  const stackScreenOptions = ({ navigation }: { navigation: any }) => ({
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: "#fff",
    headerTitleStyle: { fontWeight: "700" as const },
    headerRight: () => (
      <TouchableOpacity
        onPress={() => navigation.navigate("MainTabs", { screen: "SettingsTab" })}
        style={{ marginRight: 8 }}
      >
        <Ionicons name="settings-outline" size={22} color="#fff" />
      </TouchableOpacity>
    ),
  });

  if (isLoading || kioskEnabled === null || onboardingComplete === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Kiosk mode: go straight to kiosk screen
  if (kioskEnabled) {
    return (
      <KioskScreen
        onExitKiosk={() => {
          setKioskEnabled(false);
          setShowModeSelection(true);
        }}
      />
    );
  }

  // Mode selection (shown when exiting kiosk or first open before auth)
  if (!isAuthenticated && showModeSelection) {
    return (
      <ModeSelectionScreen
        onManagerLogin={() => setShowModeSelection(false)}
        onKioskMode={async () => {
          // Can't enter kiosk without registering — go to login first, then settings
          setShowModeSelection(false);
        }}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="ModeSelection"
            options={{ headerShown: false }}
          >
            {({ navigation }: any) => (
              <ModeSelectionScreen
                onManagerLogin={() => navigation.navigate("Login")}
                onKioskMode={() => {
                  setPendingKiosk(true);
                  navigation.navigate("Login");
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          {!onboardingComplete && (
            <Stack.Screen
              name="Onboarding"
              options={{ headerShown: false }}
            >
              {() => (
                <OnboardingScreen
                  onComplete={async () => {
                    await AsyncStorage.setItem("onboarding_complete", "true");
                    setOnboardingComplete(true);
                  }}
                />
              )}
            </Stack.Screen>
          )}
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ title: "Store Details" }} />
          <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ title: "Receive Shipment" }} />
          <Stack.Screen name="WasteLog" component={WasteLogScreen} options={{ title: "Log Waste" }} />
          <Stack.Screen name="OrderReview" component={OrderReviewScreen} options={{ title: "Purchase Orders" }} />
          <Stack.Screen name="Assistant" component={AssistantScreen} options={{ title: "AI Assistant" }} />
          <Stack.Screen name="Security" component={SecurityScreen} options={{ title: "Security" }} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: "Transaction Detail" }} />
          <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: "Reports" }} />
          <Stack.Screen name="Expiration" component={ExpirationScreen} options={{ title: "Expiration Tracking" }} />
          <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: "Staff Schedule" }} />
          <Stack.Screen name="TempLog" component={TempLogScreen} options={{ title: "Temperature Logs" }} />
          <Stack.Screen name="Forecast" component={ForecastScreen} options={{ title: "Demand Forecasts" }} />
          <Stack.Screen name="Timesheet" component={TimesheetScreen} options={{ title: "Timesheets" }} />
          <Stack.Screen name="TimeEntryDetail" component={TimeEntryDetailScreen} options={{ title: "Entry Detail" }} />
          <Stack.Screen name="LiveStaff" component={LiveStaffScreen} options={{ title: "Who's In" }} />
          <Stack.Screen name="Integrations" component={IntegrationsScreen} options={{ title: "POS Integrations" }} />
          <Stack.Screen name="MappingScreen" component={MappingScreen} options={{ title: "Item Mappings" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = "html,body,#root{height:100%;margin:0;padding:0;overflow:hidden}";
      document.head.appendChild(style);
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <NavigationContainer linking={linking}>
            <AppNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
