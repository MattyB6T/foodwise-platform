import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  DashboardTab: undefined;
  ScannerTab: undefined;
  CountTab: undefined;
  WasteTab: undefined;
  AssistantTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  ModeSelection: undefined;
  Kiosk: undefined;
  Login: undefined;
  Onboarding: undefined;
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
  Schedule: undefined;
  TempLog: undefined;
  Forecast: undefined;
  Timesheet: undefined;
  TimeEntryDetail: {
    staffId: string;
    staffName: string;
    storeId: string;
    week: string;
  };
  LiveStaff: undefined;
  Management: undefined;
  WeeklyPlan: undefined;
  Integrations: undefined;
  MappingScreen: { connectionId?: string; posSystem?: string };
};
