"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type StreamingMode = "char" | "word"

interface StreamingTextProps {
  text: string
  speed?: number
  mode?: StreamingMode
  showCursor?: boolean
  onComplete?: () => void
  className?: string
}

function tokenize(text: string, mode: StreamingMode): string[] {
  if (mode === "word") {
    return text.split(/(\s+)/).filter((token) => token.length > 0)
  }
  return Array.from(text)
}

function StreamingText({
  text,
  speed = 30,
  mode = "char",
  showCursor = true,
  onComplete,
  className,
}: StreamingTextProps) {
  const tokens = React.useMemo(() => tokenize(text, mode), [mode, text])
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    setCount(0)
  }, [text, mode])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    if (reduced) {
      setCount(tokens.length)
      onComplete?.()
      return
    }

    if (tokens.length === 0) {
      onComplete?.()
      return
    }

    let cancelled = false
    let timer: number | null = null

    const tick = () => {
      if (cancelled) return

      setCount((prev) => {
        const next = Math.min(prev + 1, tokens.length)
        if (next >= tokens.length) {
          queueMicrotask(() => onComplete?.())
          if (timer) window.clearInterval(timer)
        }
        return next
      })
    }

    timer = window.setInterval(tick, Math.max(5, speed))
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
    }
  }, [onComplete, speed, tokens.length])

  const visible = tokens.slice(0, count).join("")
  const done = count >= tokens.length

  return (
    <span data-slot="streaming-text" className={cn("whitespace-pre-wrap", className)}>
      {visible}
      {showCursor && !done && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-1 animate-pulse rounded-sm bg-foreground/60 align-[-0.15em]"
        />
      )}
    </span>
  )
}

export { StreamingText }
export type { StreamingTextProps }

