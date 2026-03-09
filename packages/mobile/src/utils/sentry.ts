import * as Sentry from "@sentry/react-native";
import { CONFIG } from "./config";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!CONFIG.SENTRY_DSN) return; // Skip if no DSN configured

  Sentry.init({
    dsn: CONFIG.SENTRY_DSN,
    tracesSampleRate: 0.2, // 20% of transactions for performance monitoring
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    // Don't send PII by default
    sendDefaultPii: false,
    // Only report errors in production
    enabled: !__DEV__,
  });

  initialized = true;
}

/** Tag the current Sentry scope with user info (call after login) */
export function setSentryUser(email: string, storeId?: string) {
  if (!CONFIG.SENTRY_DSN) return;
  Sentry.setUser({ email });
  if (storeId) {
    Sentry.setTag("storeId", storeId);
  }
}

/** Clear user info from Sentry (call on logout) */
export function clearSentryUser() {
  if (!CONFIG.SENTRY_DSN) return;
  Sentry.setUser(null);
}

/** Wrap the root App component with Sentry error boundary */
export const sentryWrap = CONFIG.SENTRY_DSN ? Sentry.wrap : (component: any) => component;
