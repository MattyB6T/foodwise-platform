import Constants from "expo-constants";

// Environment-based configuration
// In production, these come from EAS Build environment variables
// In development, they fall back to the hardcoded defaults

const extra = Constants.expoConfig?.extra || {};

export const CONFIG = {
  API_URL:
    extra.API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "https://l0mnegjjp2.execute-api.us-east-1.amazonaws.com/v1",
  COGNITO_USER_POOL_ID:
    extra.COGNITO_USER_POOL_ID ||
    process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID ||
    "us-east-1_Oc2LSrhWb",
  COGNITO_CLIENT_ID:
    extra.COGNITO_CLIENT_ID ||
    process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ||
    "585k9dd1v7gir4ul3g3k06a5k2",
  COGNITO_REGION:
    extra.COGNITO_REGION ||
    process.env.EXPO_PUBLIC_COGNITO_REGION ||
    "us-east-1",
  SENTRY_DSN:
    extra.SENTRY_DSN ||
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    "",
};
