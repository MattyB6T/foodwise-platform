import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { StoreProvider } from "./src/contexts/StoreContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { StoreDetailScreen } from "./src/screens/StoreDetailScreen";
import { BarcodeScannerScreen } from "./src/screens/BarcodeScannerScreen";
import { WasteLogScreen } from "./src/screens/WasteLogScreen";
import { OrderReviewScreen } from "./src/screens/OrderReviewScreen";
import { AssistantScreen } from "./src/screens/AssistantScreen";
import { colors } from "./src/utils/theme";
import type { RootStackParamList } from "./src/navigation/types";
import { ActivityIndicator, View } from "react-native";

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [],
  config: {
    screens: {
      Login: "login",
      Dashboard: "",
      StoreDetail: "store",
      BarcodeScanner: "scan",
      WasteLog: "waste",
      OrderReview: "orders",
      Assistant: "assistant",
    },
  },
};

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
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: "FoodWise", headerBackVisible: false }}
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
