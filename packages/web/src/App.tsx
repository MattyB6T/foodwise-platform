import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { StoreProvider } from "./stores/StoreProvider";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./auth/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { CountsPage } from "./pages/counts/CountsPage";
import { ExpirationPage } from "./pages/expiration/ExpirationPage";
import { WastePage } from "./pages/waste/WastePage";
import { TempLogsPage } from "./pages/temp-logs/TempLogsPage";
import { OrdersPage } from "./pages/orders/OrdersPage";
import { PrepListsPage } from "./pages/prep-lists/PrepListsPage";
import { SchedulePage } from "./pages/schedule/SchedulePage";
import { StaffPage } from "./pages/staff/StaffPage";
import { TeamPage } from "./pages/team/TeamPage";
import { TimesheetsPage } from "./pages/timesheets/TimesheetsPage";
import { RevenuePage } from "./pages/revenue/RevenuePage";
import { IntegrationsPage } from "./pages/integrations/IntegrationsPage";
import { SecurityPage } from "./pages/security/SecurityPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { ForecastPage } from "./pages/forecast/ForecastPage";
import { AssistantPage } from "./pages/assistant/AssistantPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { RecipesPage } from "./pages/recipes/RecipesPage";
import { ImportPage } from "./pages/import/ImportPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { PageLoader } from "./components/LoadingSpinner";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthRoute />} />
            <Route
              element={
                <ProtectedRoute>
                  <StoreProvider>
                    <AppLayout />
                  </StoreProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="counts" element={<CountsPage />} />
              <Route path="expiration" element={<ExpirationPage />} />
              <Route path="waste" element={<WastePage />} />
              <Route path="temp-logs" element={<TempLogsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="recipes" element={<RecipesPage />} />
              <Route path="prep-lists" element={<PrepListsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="timesheets" element={<TimesheetsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="forecast" element={<ForecastPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
