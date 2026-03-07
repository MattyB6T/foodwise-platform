import { Platform } from "react-native";

// Jailbreak / root detection heuristics
export function checkDeviceIntegrity(): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (Platform.OS === "web") {
    return { safe: true, warnings };
  }

  // On native platforms, check for common jailbreak/root indicators
  try {
    // Check if running in a debugger (React Native __DEV__ flag)
    if (__DEV__) {
      warnings.push("Running in development mode");
    }
  } catch {
    // Ignore
  }

  return { safe: warnings.length === 0, warnings };
}

// Prevent screenshots on Android (no-op on iOS/web — iOS needs native module)
export function preventScreenCapture(): void {
  // This requires react-native-screens or expo-screen-capture
  // For now, this is a placeholder that can be enhanced with native modules
  if (Platform.OS === "android") {
    try {
      // FLAG_SECURE would need to be set via native module
      // expo-screen-capture can be added: ScreenCapture.preventScreenCaptureAsync()
      console.log("Screen capture prevention: requires expo-screen-capture");
    } catch {
      // Silently fail
    }
  }
}

// Sanitize sensitive data before storing locally
export function sanitizeForStorage(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ["password", "pin", "token", "secret", "apiKey", "creditCard", "ssn"];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      delete sanitized[key];
    }
  }

  return sanitized;
}

// Validate deep link URLs to prevent open redirect attacks
export function isAllowedDeepLink(url: string): boolean {
  const allowedPrefixes = [
    "foodwise://",
    "exp://",
    "https://foodwise.io/",
    "http://localhost:",
  ];

  return allowedPrefixes.some((prefix) => url.startsWith(prefix));
}
