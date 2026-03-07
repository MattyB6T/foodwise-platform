export type ColorScheme = typeof lightColors;

export const lightColors = {
  // Brand
  primary: "#16a34a",
  primaryLight: "#22c55e",
  primaryDark: "#15803d",
  secondary: "#3b82f6",
  secondaryLight: "#60a5fa",

  // Semantic
  danger: "#ef4444",
  dangerLight: "#fecaca",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  success: "#16a34a",
  successLight: "#dcfce7",

  // Surfaces
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  card: "#ffffff",

  // Text
  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",

  // Borders & Dividers
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  divider: "#e2e8f0",

  // Status colors (kept for StatusBadge compat)
  green: "#16a34a",
  yellow: "#f59e0b",
  red: "#ef4444",
};

export const darkColors: ColorScheme = {
  // Brand
  primary: "#22c55e",
  primaryLight: "#4ade80",
  primaryDark: "#16a34a",
  secondary: "#60a5fa",
  secondaryLight: "#93c5fd",

  // Semantic
  danger: "#f87171",
  dangerLight: "#450a0a",
  warning: "#fbbf24",
  warningLight: "#451a03",
  success: "#4ade80",
  successLight: "#052e16",

  // Surfaces
  background: "#0f172a",
  surface: "#1e293b",
  surfaceHover: "#334155",
  card: "#1e293b",

  // Text
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  // Borders & Dividers
  border: "#334155",
  borderLight: "#1e293b",
  divider: "#334155",

  // Status colors
  green: "#4ade80",
  yellow: "#fbbf24",
  red: "#f87171",
};

// Default export for backward compat — screens that haven't migrated yet
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 42,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};
