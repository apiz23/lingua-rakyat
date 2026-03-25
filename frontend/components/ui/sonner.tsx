"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
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
          "--border-radius": "var(--radius)",
          // Toast specific styling to match brutalist theme
          "--toast-bg": "var(--popover)",
          "--toast-color": "var(--popover-foreground)",
          "--toast-border": "var(--border)",
          "--toast-shadow": "var(--shadow)",
          "--toast-close-button-color": "var(--muted-foreground)",
          "--toast-close-button-hover-bg": "var(--muted)",
        } as React.CSSProperties
      }
      toastOptions={{
        className:
          "font-mono text-sm border border-border shadow-[var(--shadow)]",
        duration: 4000,
        style: {
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          backgroundColor: "var(--popover)",
          color: "var(--popover-foreground)",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
