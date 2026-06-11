"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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

const MALAY_LANGS = new Set(["ms", "id"])

function speakFallback(text: string, language: string): void {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = toBCP47(language)

  // Match backend gender rule: Malay = female, English/other = male
  const wantFemale = MALAY_LANGS.has(language)
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    const langPrefix = utterance.lang.split("-")[0].toLowerCase()
    // Score voices: prefer matching lang, then matching gender heuristic
    const femaleHints = ["female", "woman", "girl", "samantha", "victoria", "karen", "moira", "fiona", "tessa", "zira", "hazel"]
    const maleHints   = ["male", "man", "daniel", "alex", "fred", "jorge", "arthur", "mark", "thomas", "david"]
    const genderHints = wantFemale ? femaleHints : maleHints
    const matched = voices.find((v) => {
      const name = v.name.toLowerCase()
      return v.lang.toLowerCase().startsWith(langPrefix) && genderHints.some((h) => name.includes(h))
    }) ?? voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
    if (matched) utterance.voice = matched
  }

  window.speechSynthesis.speak(utterance)
}

export function useTTS(): UseTTSReturn {
  const [state, setState] = useState<TTSState>("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortCtrlRef = useRef<AbortController | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    // Cancel fallback timer if running
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    // Cancel any in-flight fetch
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
      abortCtrlRef.current = null
    }
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
    stop()  // this now also aborts previous in-flight fetch
    setState("loading")

    const ctrl = new AbortController()
    abortCtrlRef.current = ctrl

    try {
      const res = await fetch(`${API_URL}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
        signal: ctrl.signal,
      })
      abortCtrlRef.current = null

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
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
          audioRef.current = null
          setState("error")
        }

        setState("playing")
        await audio.play()
      } else {
        // Backend returned { fallback: true } — quota exceeded
        speakFallback(text, language)
        setState("playing")
        // speechSynthesis has no reliable onend — reset after estimated duration
        const estimatedMs = Math.max(2000, text.length * 60)
        fallbackTimerRef.current = setTimeout(() => {
          fallbackTimerRef.current = null
          setState("idle")
        }, estimatedMs)
      }
    } catch (err) {
      // Don't fallback if request was intentionally aborted
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      // Network error — best-effort fallback
      speakFallback(text, language)
      setState("playing")
      const estimatedMs = Math.max(2000, text.length * 60)
      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null
        setState("idle")
      }, estimatedMs)
    }
  }, [stop])

  // Cleanup on unmount — stop audio, clear timers, cancel speech
  useEffect(() => () => { stop() }, [stop])

  return { play, stop, state }
}
