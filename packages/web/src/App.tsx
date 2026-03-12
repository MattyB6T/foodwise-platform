import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { StoreProvider } from "./stores/StoreProvider";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./auth/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { InventoryHub } from "./pages/inventory/InventoryHub";
import { WastePage } from "./pages/waste/WastePage";
import { OrdersPage } from "./pages/orders/OrdersPage";
import { RecipesHub } from "./pages/recipes/RecipesHub";
import { ScheduleHub } from "./pages/schedule/ScheduleHub";
import { StaffPage } from "./pages/staff/StaffPage";
import { TeamPage } from "./pages/team/TeamPage";
import { RevenuePage } from "./pages/revenue/RevenuePage";
import { IntegrationsPage } from "./pages/integrations/IntegrationsPage";
import { SecurityPage } from "./pages/security/SecurityPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { ForecastPage } from "./pages/forecast/ForecastPage";
import { AssistantPage } from "./pages/assistant/AssistantPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
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
              <Route path="inventory" element={<InventoryHub />} />
              <Route path="waste" element={<WastePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="recipes" element={<RecipesHub />} />
              <Route path="schedule" element={<ScheduleHub />} />
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
              {/* Redirects for old standalone routes */}
              <Route path="counts" element={<Navigate to="/inventory?tab=counts" replace />} />
              <Route path="expiration" element={<Navigate to="/inventory?tab=expiration" replace />} />
              <Route path="temp-logs" element={<Navigate to="/inventory?tab=temp-logs" replace />} />
              <Route path="prep-lists" element={<Navigate to="/recipes?tab=prep-lists" replace />} />
              <Route path="timesheets" element={<Navigate to="/schedule?tab=timesheets" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
