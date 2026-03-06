import React, { useEffect } from "react";
import { Platform, Text, ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { StoreProvider } from "./src/contexts/StoreContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { StoreDetailScreen } from "./src/screens/StoreDetailScreen";
import { BarcodeScannerScreen } from "./src/screens/BarcodeScannerScreen";
import { WasteLogScreen } from "./src/screens/WasteLogScreen";
import { OrderReviewScreen } from "./src/screens/OrderReviewScreen";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { SecurityScreen } from "./src/screens/SecurityScreen";
import { TransactionDetailScreen } from "./src/screens/TransactionDetailScreen";
import { colors } from "./src/utils/theme";
import type { RootStackParamList, TabParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const linking = {
  prefixes: [],
  config: {
    screens: {
      Login: "login",
      MainTabs: {
        screens: {
          DashboardTab: "",
          ScannerTab: "scan",
          WasteTab: "waste",
          OrdersTab: "orders",
          SecurityTab: "security",
          AssistantTab: "assistant",
        },
      },
      StoreDetail: "store",
      BarcodeScanner: "scanner",
      WasteLog: "waste-log",
      OrderReview: "order-review",
      Assistant: "ask",
      Security: "security-detail",
      TransactionDetail: "transaction",
    },
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" as const },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";
          if (route.name === "DashboardTab") iconName = "grid";
          else if (route.name === "ScannerTab") iconName = "scan";
          else if (route.name === "WasteTab") iconName = "trash";
          else if (route.name === "OrdersTab") iconName = "clipboard";
          else if (route.name === "SecurityTab") iconName = "shield-checkmark";
          else if (route.name === "AssistantTab") iconName = "chatbubble-ellipses";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ title: "Dashboard", headerTitle: "FoodWise" }}
      />
      <Tab.Screen
        name="ScannerTab"
        component={BarcodeScannerScreen}
        options={{ title: "Scanner", headerTitle: "Receive Shipment" }}
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
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="StoreDetail"
            component={StoreDetailScreen}
            options={{ title: "Store Details" }}
          />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{ title: "Receive Shipment" }}
          />
          <Stack.Screen
            name="WasteLog"
            component={WasteLogScreen}
            options={{ title: "Log Waste" }}
          />
          <Stack.Screen
            name="OrderReview"
            component={OrderReviewScreen}
            options={{ title: "Purchase Orders" }}
          />
          <Stack.Screen
            name="Assistant"
            component={AssistantScreen}
            options={{ title: "AI Assistant" }}
          />
          <Stack.Screen
            name="Security"
            component={SecurityScreen}
            options={{ title: "Security" }}
          />
          <Stack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
            options={{ title: "Transaction Detail" }}
          />
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
    <AuthProvider>
      <StoreProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </StoreProvider>
    </AuthProvider>
  );
}
