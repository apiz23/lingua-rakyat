"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-mono"
      icons={{
        success: <CircleCheckIcon className="size-6" />,
        info: <InfoIcon className="size-6" />,
        warning: <TriangleAlertIcon className="size-6" />,
        error: <OctagonXIcon className="size-6" />,
        loading: <Loader2Icon className="size-6 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Sonner supports per-variant CSS variables. Without these, `toast.error()`
          // looks the same as the normal toast.
          "--success-bg":
            "color-mix(in oklch, var(--primary) 14%, var(--popover))",
          "--success-text": "var(--popover-foreground)",
          "--success-border":
            "color-mix(in oklch, var(--primary) 32%, var(--border))",
          "--info-bg": "color-mix(in oklch, var(--accent) 12%, var(--popover))",
          "--info-text": "var(--popover-foreground)",
          "--info-border":
            "color-mix(in oklch, var(--accent) 30%, var(--border))",
          "--warning-bg":
            "color-mix(in oklch, oklch(0.82 0.16 85) 14%, var(--popover))",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border":
            "color-mix(in oklch, oklch(0.82 0.16 85) 32%, var(--border))",
          "--error-bg":
            "color-mix(in oklch, oklch(0.62 0.22 25) 16%, var(--popover))",
          "--error-text": "var(--popover-foreground)",
          "--error-border":
            "color-mix(in oklch, oklch(0.62 0.22 25) 34%, var(--border))",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        className: "font-mono text-sm shadow-[var(--shadow)]",
        duration: 4000,
        style: {
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
