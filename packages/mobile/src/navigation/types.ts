import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  DashboardTab: undefined;
  ScannerTab: undefined;
  CountTab: undefined;
  WasteTab: undefined;
  OrdersTab: undefined;
  SecurityTab: undefined;
  AssistantTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  StoreDetail: undefined;
  BarcodeScanner: undefined;
  WasteLog: undefined;
  OrderReview: undefined;
  Assistant: undefined;
  Security: undefined;
  TransactionDetail: {
    transaction: any;
    storeId: string;
    cameras: any[];
  };
  Dashboard: undefined;
  Reports: undefined;
  Expiration: undefined;
};
