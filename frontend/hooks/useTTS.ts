"use client"

import { useCallback, useRef, useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type TTSState = "idle" | "loading" | "playing" | "error"

export interface UseTTSReturn {
  play: (text: string, language: string) => Promise<void>
  stop: () => void
  state: TTSState
}

/** Map Groq/langdetect language codes to BCP-47 for speechSynthesis fallback. */
function toBCP47(language: string): string {
  switch (language) {
    case "ms":
    case "id":
      return "ms-MY"
    case "zh":
    case "zh-cn":
      return "zh-CN"
    case "zh-tw":
      return "zh-TW"
    default:
      return "en-MY"
  }
}

function speakFallback(text: string, language: string): void {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = toBCP47(language)
  window.speechSynthesis.speak(utterance)
}

export function useTTS(): UseTTSReturn {
  const [state, setState] = useState<TTSState>("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setState("idle")
  }, [])

  const play = useCallback(async (text: string, language: string) => {
    stop()
    setState("loading")

    try {
      const res = await fetch(`${API_URL}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const contentType = res.headers.get("content-type") ?? ""

      if (contentType.includes("audio/mpeg")) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
          audioRef.current = null
          setState("idle")
        }
        audio.onerror = () => setState("idle")

        await audio.play()
        setState("playing")
      } else {
        // Backend returned { fallback: true } — quota exceeded
        speakFallback(text, language)
        setState("playing")
        // speechSynthesis has no reliable onend — reset after estimated duration
        const estimatedMs = Math.max(2000, text.length * 60)
        setTimeout(() => setState("idle"), estimatedMs)
      }
    } catch {
      // Network error — best-effort fallback
      speakFallback(text, language)
      setState("idle")
    }
  }, [stop])

  return { play, stop, state }
}
