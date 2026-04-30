"use client"

import * as React from "react"
import { Moon, Sun, Laptop, Monitor, Sparkles } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = React.useCallback(
    (newTheme: string) => {
      setIsAnimating(true)
      setTheme(newTheme)
      setTimeout(() => setIsAnimating(false), 300)
    },
    [setTheme]
  )

  if (!mounted) return null

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              handleThemeChange(theme === "light" ? "dark" : "light")
            }
            className={cn(
              "relative h-8 w-8 overflow-hidden rounded-md border-border/50 bg-background/40 backdrop-blur-sm transition-all duration-300",
              "hover:border-primary/30 hover:bg-primary/5 hover:shadow-md",
              isAnimating && "scale-95"
            )}
            aria-label="Toggle theme"
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />

            {/* Icons with improved animations */}
            <div className="relative flex items-center justify-center">
              <Sun
                className={cn(
                  "absolute h-3.5 w-3.5 transition-all duration-300",
                  theme === "dark"
                    ? "scale-0 rotate-90 opacity-0"
                    : "scale-100 rotate-0 opacity-100"
                )}
              />
              <Moon
                className={cn(
                  "absolute h-3.5 w-3.5 transition-all duration-300",
                  theme === "dark"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-0 -rotate-90 opacity-0"
                )}
              />
            </div>

            <span className="sr-only">
              {theme === "light"
                ? "Switch to dark mode"
                : "Switch to light mode"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-2 py-1 text-xs">
          <p>{theme === "light" ? "Dark mode" : "Light mode"} (⌘+⇧+D)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Alternative: Dropdown version with system theme support
export function ModeToggleDropdown() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const currentTheme = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-8 w-8 rounded-md border-border/50 bg-background/40 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-primary/5"
        >
          <Sun className="h-3.5 w-3.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-3.5 w-3.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>

          {/* Indicator dot for system theme */}
          {theme === "system" && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(
            "flex cursor-pointer items-center gap-2 transition-colors",
            theme === "light" && "bg-primary/10 text-primary"
          )}
        >
          <Sun className="h-3.5 w-3.5" />
          <span>Light</span>
          {theme === "light" && (
            <span className="ml-auto text-xs text-primary">✓</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(
            "flex cursor-pointer items-center gap-2 transition-colors",
            theme === "dark" && "bg-primary/10 text-primary"
          )}
        >
          <Moon className="h-3.5 w-3.5" />
          <span>Dark</span>
          {theme === "dark" && (
            <span className="ml-auto text-xs text-primary">✓</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(
            "flex cursor-pointer items-center gap-2 transition-colors",
            theme === "system" && "bg-primary/10 text-primary"
          )}
        >
          <Laptop className="h-3.5 w-3.5" />
          <span>System</span>
          {theme === "system" && (
            <span className="ml-auto text-xs text-primary">
              {resolvedTheme === "dark" ? "🌙" : "☀️"}
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Minimal version for navigation bars
export function ModeToggleMinimal() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="gap-1.5 px-2 text-xs font-medium text-muted-foreground transition-all hover:bg-primary/5 hover:text-primary"
    >
      <Sun className="h-3 w-3 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-3 w-3 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span>{theme === "light" ? "Dark" : "Light"}</span>
    </Button>
  )
}

// Animated toggle switch version
export function ModeToggleSwitch() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = theme === "dark"

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300",
              "border border-border/50 bg-muted/50 backdrop-blur-sm",
              "focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
            )}
            aria-label="Toggle theme"
          >
            {/* Track background */}
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-all duration-300",
                isDark && "bg-primary/20"
              )}
            />

            {/* Thumb */}
            <span
              className={cn(
                "relative inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-background shadow-md transition-all duration-300",
                isDark ? "translate-x-[1.375rem]" : "translate-x-0.5"
              )}
            >
              {isDark ? (
                <Moon className="h-2.5 w-2.5 text-primary" />
              ) : (
                <Sun className="h-2.5 w-2.5 text-amber-500" />
              )}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-2 py-1 text-xs">
          <p>{isDark ? "Light mode" : "Dark mode"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Theme selector with preview
export function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const themes = [
    {
      name: "Light",
      value: "light",
      icon: Sun,
      color: "bg-amber-100 dark:bg-amber-900",
    },
    { name: "Dark", value: "dark", icon: Moon, color: "bg-slate-800" },
    {
      name: "System",
      value: "system",
      icon: Monitor,
      color: "bg-gradient-to-r from-amber-100 to-slate-800",
    },
  ]

  return (
    <div className="flex gap-1 rounded-lg border border-border/50 bg-card/30 p-1 backdrop-blur-sm">
      {themes.map((t) => {
        const Icon = t.icon
        const isActive = theme === t.value

        return (
          <TooltipProvider key={t.value}>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "relative flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200",
                    "hover:bg-primary/10",
                    isActive && "bg-primary/20 ring-1 ring-primary/50"
                  )}
                  aria-label={`${t.name} theme`}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-all",
                      isActive
                        ? "scale-110 text-primary"
                        : "text-muted-foreground"
                    )}
                  />

                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1 text-xs">
                <p>{t.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
