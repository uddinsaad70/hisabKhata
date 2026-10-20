/**
 * Design system color tokens from Specification Section 1.2.
 */
export const COLORS = {
  primaryBlue: "#1355A3",
  darkHeaderAccent: "#0D3F7A",
  activeTabIndicator: "#FFC107",
  primaryRed: "#C91C42",
  lightPinkColumnTint: "#FFF5F6",
  primaryGreen: "#108944",
  lightGreenBadgeTint: "#E8F5E9",
  fabMagenta: "#B8144D",
  pageBackgroundGrey: "#F1F3F6",
  cardSurface: "#FFFFFF",
  primaryTextDark: "#1F2937",
  secondaryMutedText: "#6B7280",
  borderDivider: "#E5E7EB",
} as const;

export type ThemeMode = "light" | "dark";

export const LIGHT_THEME = {
  ...COLORS,
};

export const DARK_THEME: Record<keyof typeof COLORS, string> = {
  primaryBlue: "#0F4382",
  darkHeaderAccent: "#092B54",
  activeTabIndicator: "#FFC107",
  primaryRed: "#F43F5E",
  lightPinkColumnTint: "#2A181E",
  primaryGreen: "#22C55E",
  lightGreenBadgeTint: "#132A1C",
  fabMagenta: "#E11D48",
  pageBackgroundGrey: "#0F172A",
  cardSurface: "#1E293B",
  primaryTextDark: "#F8FAFC",
  secondaryMutedText: "#94A3B8",
  borderDivider: "#334155",
};

export function getThemeColors(mode: ThemeMode = "light") {
  return mode === "dark" ? DARK_THEME : LIGHT_THEME;
}
