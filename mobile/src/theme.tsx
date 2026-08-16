// Civic-green theme — exact sRGB hex of the web app's oklch tokens
// (frontend/app/globals.css), light and dark. Follows the system scheme
// by default, with an in-app toggle override via ThemeContext.

import React, { createContext, useContext } from "react"
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

export type ThemeMode = "light" | "dark" | "system"

export const lightPalette: Palette = {
  background: "#FBF6EC",       // --background oklch(0.975 0.015 85) warm paper
  foreground: "#1D271F",       // --foreground oklch(0.26 0.02 152)
  card: "#FFFFFF",             // --card oklch(1 0 0)
  primary: "#135C30",          // --primary oklch(0.42 0.10 152) deep civic green
  primaryForeground: "#FFFFFF", // --primary-foreground oklch(1 0 0)
  muted: "#F0EBE0",            // --muted oklch(0.94 0.015 85)
  mutedForeground: "#495A4D",  // --muted-foreground oklch(0.45 0.03 152)
  border: "#E3DDD3",           // --border oklch(0.90 0.015 85)
  destructive: "#C5372F",      // --destructive oklch(0.55 0.18 28)
  overlay: "rgba(251, 246, 236, 0.45)", // bg-background/45 landing overlay
  high: "#278733",             // --success oklch(0.55 0.15 145)
  highBg: "#E9F3EB",           // success 10% over card
  medium: "#C96900",           // --warning oklch(0.62 0.16 60)
  mediumBg: "#FAF0E6",         // warning 10% over card
  low: "#C5372F",              // --destructive
  lowBg: "#F9EBEA",            // destructive 10% over card
}

export const darkPalette: Palette = {
  background: "#080A08",       // --background oklch(0.14 0.006 145) ink
  foreground: "#EBE7E0",       // --foreground oklch(0.93 0.01 85)
  card: "#131613",             // --card oklch(0.195 0.007 145)
  primary: "#5DC47E",          // --primary oklch(0.74 0.14 152) bright civic green
  primaryForeground: "#071009", // --primary-foreground oklch(0.16 0.02 152)
  muted: "#161916",            // --muted oklch(0.21 0.007 145)
  mutedForeground: "#878F87",  // --muted-foreground oklch(0.64 0.015 145)
  border: "#242724",           // --border oklch(0.27 0.008 145)
  destructive: "#ED5350",      // --destructive oklch(0.65 0.19 25)
  overlay: "rgba(8, 10, 8, 0.75)", // bg-background/75 landing overlay
  high: "#54B85B",             // --success oklch(0.70 0.16 145)
  highBg: "#1A261A",           // success 10% over card
  medium: "#EE9733",           // --warning oklch(0.75 0.15 65)
  mediumBg: "#292316",         // warning 10% over card
  low: "#ED5350",              // --destructive
  lowBg: "#291C19",            // destructive 10% over card
}

// Resolve palette from the user's chosen mode + system fallback.
export function resolvePalette(
  mode: ThemeMode,
  systemScheme: "light" | "dark" | null | undefined,
): Palette {
  const effective =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode
  return effective === "dark" ? darkPalette : lightPalette
}

// Whether the resolved palette is dark (for StatusBar, etc.).
export function isDarkPalette(palette: Palette): boolean {
  return palette === darkPalette
}

// ---------- Context ----------

const ThemeCtx = createContext<Palette>(lightPalette)

/** Wrap the app tree so all useTheme() calls receive the resolved palette. */
export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode
  children: React.ReactNode
}) {
  const scheme = useColorScheme()
  const palette = resolvePalette(mode, scheme)
  return <ThemeCtx.Provider value={palette}>{children}</ThemeCtx.Provider>
}

// All components import this — reads from ThemeContext (no useColorScheme).
export function useTheme(): Palette {
  return useContext(ThemeCtx)
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

// Zero border-radius — matches frontend/app/globals.css (--radius: 0px).
export const radius = 0
