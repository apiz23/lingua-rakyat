"use client"

import { useCallback, useRef, useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const MIN_DURATION_MS = 500  // reject recordings shorter than 500ms

export type RecorderState = "idle" | "recording" | "transcribing" | "done" | "error"

export interface UseVoiceRecorderReturn {
  state: RecorderState
  transcript: string
  language: string
  errorMessage: string
  startRecording: () => Promise<void>
  stopRecording: () => void
  reset: () => void
}

const ERRORS = {
  micBlocked: {
    ms: "Benarkan akses mikrofon dalam tetapan pelayar",
    en: "Allow microphone access in your browser settings",
  },
  tooShort: {
    ms: "Rakaman terlalu pendek — cuba lagi",
    en: "Recording too short — try again",
  },
  transcribeFailed: {
    ms: "Gagal mentranskrip — taip soalan anda",
    en: "Transcription failed — type your question instead",
  },
}

function voiceError(key: keyof typeof ERRORS, uiLang: string): string {
  return uiLang === "ms" ? ERRORS[key].ms : ERRORS[key].en
}

export function useVoiceRecorder(uiLanguage = "en"): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle")
  const [transcript, setTranscript] = useState("")
  const [language, setLanguage] = useState("en")
  const [errorMessage, setErrorMessage] = useState("")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)

  const setError = (msg: string) => {
    setErrorMessage(msg)
    setState("error")
  }

  const startRecording = useCallback(async () => {
    if (state === "recording") return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(voiceError("micBlocked", uiLanguage))
      return
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm"

    const recorder = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []
    startTimeRef.current = Date.now()

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all mic tracks
      stream.getTracks().forEach((t) => t.stop())

      const durationMs = Date.now() - startTimeRef.current
      if (durationMs < MIN_DURATION_MS) {
        setError(voiceError("tooShort", uiLanguage))
        return
      }

      const blob = new Blob(chunksRef.current, { type: mimeType })
      setState("transcribing")

      try {
        const formData = new FormData()
        formData.append("audio", blob, "recording.webm")

        const res = await fetch(`${API_URL}/api/voice/transcribe`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        setTranscript(data.transcript)
        setLanguage(data.language || "en")
        setState("done")
      } catch {
        setError(voiceError("transcribeFailed", uiLanguage))
      }
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setState("recording")
  }, [state])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    setTranscript("")
    setLanguage("en")
    setErrorMessage("")
    setState("idle")
  }, [])

  return { state, transcript, language, errorMessage, startRecording, stopRecording, reset }
}
