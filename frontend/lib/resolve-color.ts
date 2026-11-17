import type { ColorTokens } from "@/components/pdf/theme-types";

export const THEME_COLOR_KEYS = [
  "foreground",
  "background",
  "muted",
  "mutedForeground",
  "primary",
  "primaryForeground",
  "border",
  "accent",
  "destructive",
  "success",
  "warning",
  "info",
] as const satisfies (keyof ColorTokens)[];

export const resolveColor = (value: string, colors: ColorTokens): string => {
  const key = THEME_COLOR_KEYS.find((candidate) => candidate === value)
  return key ? colors[key] : value
};
