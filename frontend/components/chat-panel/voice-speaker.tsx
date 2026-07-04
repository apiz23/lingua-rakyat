"use client"

import { Loader2, Square, Volume2 } from "lucide-react"
import { useTTS } from "@/hooks/useTTS"

interface VoiceSpeakerProps {
  text: string
  language: string
}

const TTS_COPY = {
  ms: { loading: "Memuatkan audio…", stop: "Henti", retry: "Cuba semula", listen: "Dengar Jawapan" },
  en: { loading: "Loading audio…",   stop: "Stop",  retry: "Retry",       listen: "Listen" },
  zh: { loading: "加载音频中…",       stop: "停止",  retry: "重试",         listen: "朗读回答" },
}

export function VoiceSpeaker({ text, language }: VoiceSpeakerProps) {
  const { play, stop, state } = useTTS()
  // language is the detected answer language (may be "zh-cn", "id", …)
  const t = TTS_COPY[
    language.startsWith("zh")
      ? "zh"
      : language.startsWith("ms") || language.startsWith("id")
        ? "ms"
        : "en"
  ]

  const handleClick = () => {
    if (state === "playing") {
      stop()
    } else {
      play(text, language) // also handles "error" state — retries
    }
  }

  const label =
    state === "loading" ? t.loading :
    state === "playing" ? t.stop :
    state === "error"   ? t.retry :
    t.listen

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      title={label}
      aria-label={label}
    >
      {state === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "playing" && <Square className="h-3 w-3 fill-current" />}
      {(state === "idle" || state === "error") && <Volume2 className="h-3 w-3" />}
      {label}
    </button>
  )
}
