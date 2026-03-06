export type ColorScheme = typeof lightColors;

export const lightColors = {
  primary: "#2c5282",
  primaryLight: "#4299e1",
  secondary: "#38a169",
  danger: "#e53e3e",
  warning: "#d69e2e",
  background: "#f7fafc",
  surface: "#ffffff",
  text: "#1a202c",
  textSecondary: "#718096",
  border: "#e2e8f0",
  green: "#38a169",
  yellow: "#d69e2e",
  red: "#e53e3e",
};

export const darkColors: ColorScheme = {
  primary: "#4299e1",
  primaryLight: "#63b3ed",
  secondary: "#48bb78",
  danger: "#fc8181",
  warning: "#f6e05e",
  background: "#1A1A2E",
  surface: "#16213E",
  text: "#E0E0E0",
  textSecondary: "#A0AEC0",
  border: "#2A2A4A",
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
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};
