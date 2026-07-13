"use client"

import { useEffect } from "react"
import { Check, Loader2, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder"

interface VoiceMicButtonProps {
  onTranscript: (text: string, language: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  titleIdle?: string
  titleRecording?: string
  titleTranscribing?: string
  uiLanguage?: string
}

export function VoiceMicButton({ onTranscript, onError, disabled, titleIdle, titleRecording, titleTranscribing, uiLanguage = "en" }: VoiceMicButtonProps) {
  const { state, transcript, language, errorMessage, startRecording, stopRecording, reset } =
    useVoiceRecorder(uiLanguage)

  // Fire callback when transcription is done, then reset after 1.5s
  useEffect(() => {
    if (state === "done" && transcript) {
      onTranscript(transcript, language)
      const timer = setTimeout(() => reset(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state, transcript, language, onTranscript, reset])

  // Surface errors via onError callback
  useEffect(() => {
    if (state === "error" && errorMessage) {
      onError?.(errorMessage)
      const timer = setTimeout(() => reset(), 100)
      return () => clearTimeout(timer)
    }
  }, [state, errorMessage, onError, reset])

  const handleClick = () => {
    if (state === "recording") {
      stopRecording()
    } else if (state === "idle" || state === "error") {
      startRecording()
    }
  }

  const isRecording = state === "recording"
  const isTranscribing = state === "transcribing"
  const isDone = state === "done"

  const ariaLabel = isRecording
    ? (titleRecording ?? "Ketuk untuk berhenti")
    : isTranscribing
    ? (titleTranscribing ?? "Mentranskrip…")
    : (titleIdle ?? "Rakam soalan")

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        // idle
        !isRecording && !isTranscribing && !isDone &&
          "border-border/50 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
        // recording — destructive pulse
        isRecording &&
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
        // transcribing — warning
        isTranscribing &&
          "border-warning/40 bg-warning/10 text-warning cursor-wait",
        // done — green
        isDone &&
          "border-success/30 bg-success/10 text-success",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {/* Pulsing ring while recording */}
      {isRecording && (
        <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
      )}

      {isDone && <Check className="h-3.5 w-3.5" />}
      {isTranscribing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {(state === "idle" || state === "error" || isRecording) && (
        <Mic className={cn("h-3.5 w-3.5", isRecording && "fill-current")} />
      )}
    </button>
  )
}
