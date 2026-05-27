"use client"

import { Loader2, Square, Volume2 } from "lucide-react"
import { useTTS } from "@/hooks/useTTS"

interface VoiceSpeakerProps {
  text: string
  language: string
}

export function VoiceSpeaker({ text, language }: VoiceSpeakerProps) {
  const { play, stop, state } = useTTS()

  const handleClick = () => {
    if (state === "playing") {
      stop()
    } else {
      play(text, language)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      title={state === "playing" ? "Henti" : "Dengar jawapan"}
      aria-label={state === "playing" ? "Henti" : "Dengar jawapan"}
    >
      {state === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "playing" && <Square className="h-3 w-3 fill-current" />}
      {(state === "idle" || state === "error") && <Volume2 className="h-3 w-3" />}
      {state === "loading" && "Memuatkan…"}
      {state === "playing" && "Henti"}
      {(state === "idle" || state === "error") && "Dengar Jawapan"}
    </button>
  )
}
