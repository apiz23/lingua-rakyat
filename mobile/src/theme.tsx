// Civic-green theme — exact sRGB hex of the web app's oklch tokens
// (frontend/app/globals.css). Light only.

import React, { createContext, useContext } from "react"

export type Palette = {
  background: string
  foreground: string
  card: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  destructive: string
  destructiveForeground: string
  overlay: string
  high: string
  highBg: string
  medium: string
  mediumBg: string
  low: string
  lowBg: string
}

// ── Light ──────────────────────────────────────────────────────────────────
// Converted from frontend/app/globals.css :root oklch tokens.
export const palette: Palette = {
  // oklch(0.975 0.015 85) — warm paper
  background: "#F9F5EE",
  // oklch(0.26 0.02 152)
  foreground: "#1D271F",
  // oklch(1 0 0) — white
  card: "#FFFFFF",
  // oklch(0.42 0.1 152) — deep civic green
  primary: "#1A6B3C",
  // oklch(1 0 0)
  primaryForeground: "#FFFFFF",
  // oklch(0.94 0.04 152) — soft green tint surface
  secondary: "#E8F5E9",
  // oklch(0.35 0.1 152)
  secondaryForeground: "#1B5E3B",
  // oklch(0.94 0.015 85)
  muted: "#F0EBE0",
  // oklch(0.45 0.03 152)
  mutedForeground: "#495A4D",
  // oklch(0.94 0.04 152) — same as secondary
  accent: "#E8F5E9",
  // oklch(0.35 0.1 152)
  accentForeground: "#1B5E3B",
  // oklch(0.9 0.015 85)
  border: "#E3DDD3",
  // oklch(0.88 0.02 152)
  input: "#D4E8D8",
  // oklch(0.55 0.1 152)
  ring: "#3A8F5C",
  // oklch(0.55 0.18 28)
  destructive: "#C5372F",
  // oklch(1 0 0)
  destructiveForeground: "#FFFFFF",
  // bg-background/45 landing overlay
  overlay: "rgba(249, 245, 238, 0.45)",
  // oklch(0.55 0.15 145) — success
  high: "#2D8A3E",
  // success 10% over card
  highBg: "#EDF5EE",
  // oklch(0.62 0.16 60) — warning
  medium: "#C67A1A",
  // warning 10% over card
  mediumBg: "#FDF3E7",
  // oklch(0.55 0.18 28) — destructive
  low: "#C5372F",
  // destructive 10% over card
  lowBg: "#F9EBEA",
}

// ---------- Context ----------

const ThemeCtx = createContext<Palette>(palette)

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <ThemeCtx.Provider value={palette}>{children}</ThemeCtx.Provider>
}

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

// frontend/app/globals.css --radius: 8px
export const radius = 8
