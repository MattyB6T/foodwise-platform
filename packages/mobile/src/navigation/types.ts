import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  DashboardTab: undefined;
  ScannerTab: undefined;
  WasteTab: undefined;
  OrdersTab: undefined;
  AssistantTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  StoreDetail: undefined;
  BarcodeScanner: undefined;
  WasteLog: undefined;
  OrderReview: undefined;
  Assistant: undefined;
  Dashboard: undefined;
};
