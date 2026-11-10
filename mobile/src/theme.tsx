
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

export const palette: Palette = {
  background: "#F9F5EE",
  foreground: "#1D271F",
  card: "#FFFFFF",
  primary: "#1A6B3C",
  primaryForeground: "#FFFFFF",
  secondary: "#E8F5E9",
  secondaryForeground: "#1B5E3B",
  muted: "#F0EBE0",
  mutedForeground: "#495A4D",
  accent: "#E8F5E9",
  accentForeground: "#1B5E3B",
  border: "#E3DDD3",
  input: "#D4E8D8",
  ring: "#3A8F5C",
  destructive: "#C5372F",
  destructiveForeground: "#FFFFFF",
  overlay: "rgba(249, 245, 238, 0.45)",
  high: "#2D8A3E",
  highBg: "#EDF5EE",
  medium: "#C67A1A",
  mediumBg: "#FDF3E7",
  low: "#C5372F",
  lowBg: "#F9EBEA",
}


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

export const radius = 8
