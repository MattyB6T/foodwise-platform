export type ColorScheme = typeof lightColors;

export const lightColors = {
  // Brand — original blue
  primary: "#2c5282",
  primaryLight: "#4299e1",
  primaryDark: "#1a365d",
  secondary: "#38a169",
  secondaryLight: "#68d391",

  // Semantic
  danger: "#e53e3e",
  dangerLight: "#fed7d7",
  warning: "#d69e2e",
  warningLight: "#fefcbf",
  success: "#38a169",
  successLight: "#c6f6d5",

  // Surfaces
  background: "#f7fafc",
  surface: "#ffffff",
  surfaceHover: "#edf2f7",
  card: "#ffffff",

  // Text
  text: "#1a202c",
  textSecondary: "#718096",
  textMuted: "#a0aec0",

  // Borders & Dividers
  border: "#e2e8f0",
  borderLight: "#edf2f7",
  divider: "#e2e8f0",

  // Status colors (kept for StatusBadge compat)
  green: "#38a169",
  yellow: "#d69e2e",
  red: "#e53e3e",
};

export const darkColors: ColorScheme = {
  // Brand
  primary: "#4299e1",
  primaryLight: "#63b3ed",
  primaryDark: "#2c5282",
  secondary: "#48bb78",
  secondaryLight: "#68d391",

  // Semantic
  danger: "#fc8181",
  dangerLight: "#1a0a0a",
  warning: "#f6e05e",
  warningLight: "#1a1503",
  success: "#48bb78",
  successLight: "#0a1a10",

  // Surfaces
  background: "#1A1A2E",
  surface: "#16213E",
  surfaceHover: "#1a2744",
  card: "#16213E",

  // Text
  text: "#E0E0E0",
  textSecondary: "#A0AEC0",
  textMuted: "#718096",

  // Borders & Dividers
  border: "#2A2A4A",
  borderLight: "#1e2d4a",
  divider: "#2A2A4A",

  // Status colors
  green: "#48bb78",
  yellow: "#f6e05e",
  red: "#fc8181",
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
