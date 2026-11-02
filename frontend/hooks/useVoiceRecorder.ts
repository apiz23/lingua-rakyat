"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { API_URL } from "@/lib/config"
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
  const generationRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    const recorder = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      try {
        if (recorder.state !== "inactive") recorder.stop()
      } catch {
        // Tracks must still be stopped if the browser already closed the recorder.
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const setError = (msg: string) => {
    setErrorMessage(msg)
    setState("error")
  }

  const startRecording = useCallback(async () => {
    if (state === "recording") return
    cancel()
    const generation = generationRef.current
    const current = () => generationRef.current === generation
    const abort = new AbortController()
    abortRef.current = abort

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (current()) setError(voiceError("micBlocked", uiLanguage))
      return
    }
    if (!current()) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = stream

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm"

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (current()) setError(voiceError("micBlocked", uiLanguage))
      return
    }
    chunksRef.current = []
    startTimeRef.current = Date.now()

    recorder.ondataavailable = (e) => {
      if (current() && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all mic tracks
      stream.getTracks().forEach((t) => t.stop())
      if (!current()) return
      streamRef.current = null
      mediaRecorderRef.current = null

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

        const res = await fetch(`${API_URL}/api/v1/public/voice/transcriptions`, {
          method: "POST",
          body: formData,
          signal: abort.signal,
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        if (!current() || abort.signal.aborted) return
        setTranscript(data.transcript)
        setLanguage(data.language || "en")
        setState("done")
      } catch {
        if (current() && !abort.signal.aborted) setError(voiceError("transcribeFailed", uiLanguage))
      }
    }

    mediaRecorderRef.current = recorder
    try {
      recorder.start()
    } catch {
      cancel()
      setError(voiceError("micBlocked", uiLanguage))
      return
    }
    setState("recording")
  }, [state, uiLanguage, cancel])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    cancel()
    setTranscript("")
    setLanguage("en")
    setErrorMessage("")
    setState("idle")
  }, [cancel])

  return { state, transcript, language, errorMessage, startRecording, stopRecording, reset }
}
