import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { StoreProvider } from "./stores/StoreProvider";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./auth/LoginPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { PageLoader } from "./components/LoadingSpinner";
import type { ReactNode } from "react";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const InventoryHub = lazy(() => import("./pages/inventory/InventoryHub").then(m => ({ default: m.InventoryHub })));
const WastePage = lazy(() => import("./pages/waste/WastePage").then(m => ({ default: m.WastePage })));
const OrdersPage = lazy(() => import("./pages/orders/OrdersPage").then(m => ({ default: m.OrdersPage })));
const RecipesHub = lazy(() => import("./pages/recipes/RecipesHub").then(m => ({ default: m.RecipesHub })));
const ScheduleHub = lazy(() => import("./pages/schedule/ScheduleHub").then(m => ({ default: m.ScheduleHub })));
const StaffPage = lazy(() => import("./pages/staff/StaffPage").then(m => ({ default: m.StaffPage })));
const TeamPage = lazy(() => import("./pages/team/TeamPage").then(m => ({ default: m.TeamPage })));
const RevenuePage = lazy(() => import("./pages/revenue/RevenuePage").then(m => ({ default: m.RevenuePage })));
const IntegrationsPage = lazy(() => import("./pages/integrations/IntegrationsPage").then(m => ({ default: m.IntegrationsPage })));
const SecurityPage = lazy(() => import("./pages/security/SecurityPage").then(m => ({ default: m.SecurityPage })));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage").then(m => ({ default: m.ReportsPage })));
const ForecastPage = lazy(() => import("./pages/forecast/ForecastPage").then(m => ({ default: m.ForecastPage })));
const AssistantPage = lazy(() => import("./pages/assistant/AssistantPage").then(m => ({ default: m.AssistantPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const ImportPage = lazy(() => import("./pages/import/ImportPage").then(m => ({ default: m.ImportPage })));
const BillingPage = lazy(() => import("./pages/settings/BillingPage").then(m => ({ default: m.BillingPage })));

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
              <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
              <Route path="inventory" element={<Suspense fallback={<PageLoader />}><InventoryHub /></Suspense>} />
              <Route path="waste" element={<Suspense fallback={<PageLoader />}><WastePage /></Suspense>} />
              <Route path="orders" element={<Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>} />
              <Route path="recipes" element={<Suspense fallback={<PageLoader />}><RecipesHub /></Suspense>} />
              <Route path="schedule" element={<Suspense fallback={<PageLoader />}><ScheduleHub /></Suspense>} />
              <Route path="team" element={<Suspense fallback={<PageLoader />}><TeamPage /></Suspense>} />
              <Route path="staff" element={<Suspense fallback={<PageLoader />}><StaffPage /></Suspense>} />
              <Route path="revenue" element={<Suspense fallback={<PageLoader />}><RevenuePage /></Suspense>} />
              <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
              <Route path="security" element={<Suspense fallback={<PageLoader />}><SecurityPage /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
              <Route path="forecast" element={<Suspense fallback={<PageLoader />}><ForecastPage /></Suspense>} />
              <Route path="assistant" element={<Suspense fallback={<PageLoader />}><AssistantPage /></Suspense>} />
              <Route path="import" element={<Suspense fallback={<PageLoader />}><ImportPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              <Route path="settings/billing" element={<Suspense fallback={<PageLoader />}><BillingPage /></Suspense>} />
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
