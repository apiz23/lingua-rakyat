// Civic-green theme — hex approximations of the web app's oklch tokens
// (frontend/app/globals.css), light and dark. Follows the system scheme.

import { useColorScheme } from "react-native"

export type Palette = {
  background: string
  foreground: string
  card: string
  primary: string
  primaryForeground: string
  muted: string
  mutedForeground: string
  border: string
  destructive: string
  overlay: string
  high: string
  highBg: string
  medium: string
  mediumBg: string
  low: string
  lowBg: string
}

export const lightPalette: Palette = {
  background: "#FAF7F0",       // oklch(0.975 0.015 85) warm off-white
  foreground: "#22302A",       // oklch(0.26 0.02 152)
  card: "#FFFFFF",
  primary: "#276B4B",          // oklch(0.42 0.10 152) deep civic green
  primaryForeground: "#FFFFFF",
  muted: "#F0EDE4",            // oklch(0.94 0.015 85)
  mutedForeground: "#5C6E64",  // oklch(0.45 0.03 152)
  border: "#E4E0D4",           // oklch(0.90 0.015 85)
  destructive: "#B3261E",
  overlay: "rgba(20, 28, 24, 0.45)",
  high: "#276B4B",
  highBg: "#E3EFE8",
  medium: "#8A6D1A",
  mediumBg: "#F6EED9",
  low: "#B3261E",
  lowBg: "#F9E3E1",
}

export const darkPalette: Palette = {
  background: "#121714",       // oklch(0.16 0.006 145)
  foreground: "#ECEAE2",       // oklch(0.93 0.01 85)
  card: "#191F1B",
  primary: "#62B98A",          // oklch(0.74 0.14 152) bright civic green
  primaryForeground: "#0F1F17",
  muted: "#1B221E",            // oklch(0.21 0.007 145)
  mutedForeground: "#97A29A",  // oklch(0.64 0.015 145)
  border: "#2A322D",           // oklch(0.27 0.008 145)
  destructive: "#E5726A",
  overlay: "rgba(0, 0, 0, 0.55)",
  high: "#62B98A",
  highBg: "#1C2B22",
  medium: "#D2A94E",
  mediumBg: "#2B2416",
  low: "#E5726A",
  lowBg: "#2E1B19",
}

// System scheme decides; light is the fallback (primary design target).
export function useTheme(): Palette {
  return useColorScheme() === "dark" ? darkPalette : lightPalette
}

export const fonts = {
  display: "BricolageGrotesque_700Bold",
  body: "AtkinsonHyperlegible_400Regular",
  bodyBold: "AtkinsonHyperlegible_700Bold",
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}
