"use client"

import React, { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ChatHistoryMessage,
  DEFAULT_CHAT_MODEL_ID,
  Document,
  GROQ_MODELS,
  askQuestionStream,
  clearChatHistory,
  getChatHistory,
} from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"
import AgentAvatar from "@/components/smoothui/agent-avatar"
import {
  AiChat,
  AiChatBody,
  AiChatFooter,
} from "@/components/elements/ai-elements/chat/ai-chat"
import { ChatInput } from "@/components/elements/ai-elements/chat/chat-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Download,
  FileText,
  History,
  Languages,
  MessageSquare,
  Mic,
  MicOff,
  MoreVertical,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import {
  AIMessageCard,
  Message,
  TypingIndicator,
  UserMessageBubble,
} from "./message-cards"

interface ChatPanelProps {
  selectedDoc: Document | null
  onBack?: () => void
  composerTop?: React.ReactNode
  emptyState?: React.ReactNode
}

interface ChatThread {
  sessionId: string
  lastUpdated: string
  previewQuestion: string
  messageCount: number
}

interface SpeechRecognitionAlternative {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternative
  length: number
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((event: Event) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const SUGGESTIONS = [
  {
    icon: BookOpen,
    text: "Summarize this document",
    description:
      "Ringkasan dalam 3-5 mata peluru / Summary in 3-5 bullet points",
  },
  {
    icon: Sparkles,
    text: "Siapa yang layak memohon?",
    description: "Who is eligible to apply? - Malay",
  },
  {
    icon: FileText,
    text: "What documents do I need?",
    description: "Dokumen apa yang diperlukan? / What documents are needed?",
  },
  {
    icon: MessageSquare,
    text: "Bagaimana cara memohon langkah demi langkah?",
    description: "How do I apply step by step?",
  },
]

function mapHistoryRowToMessage(row: ChatHistoryMessage): Message {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sources: row.sources ?? [],
    timestamp: row.timestamp,
    language: row.language,
    confidence: row.confidence ?? 0,
    confidence_label: row.confidence_label,
    latency_ms: row.latency_ms ?? 0,
    cached: true,
    model_used: row.model_used,
    sufficient_evidence: row.sufficient_evidence ?? true,
  }
}

function buildThreads(history: ChatHistoryMessage[]): ChatThread[] {
  const bySession = new Map<string, ChatThread>()

  for (const row of history) {
    const existing = bySession.get(row.session_id)

    if (!existing) {
      bySession.set(row.session_id, {
        sessionId: row.session_id,
        lastUpdated: row.timestamp,
        previewQuestion: row.question,
        messageCount: 1,
      })
      continue
    }

    existing.messageCount += 1
    if (
      new Date(row.timestamp).getTime() >
      new Date(existing.lastUpdated).getTime()
    ) {
      existing.lastUpdated = row.timestamp
      existing.previewQuestion = row.question
    }
  }

  return Array.from(bySession.values()).sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  )
}

export default function ChatPanel({
  selectedDoc,
  onBack,
  composerTop,
  emptyState,
}: ChatPanelProps) {
  const { language, toggleLanguage } = useLanguage()
  const shouldReduce = useReducedMotion()

  const createSessionId = (documentId: string) =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `lr-session-${documentId}-${Date.now()}`

  const persistSessionId = (documentId: string, nextSessionId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `lr-chat-session-id:${documentId}`,
        nextSessionId
      )
    }
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedPopoverModel, setSelectedPopoverModel] = useState(
    DEFAULT_CHAT_MODEL_ID
  )
  const [userId, setUserId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [enableQueryAugmentation, setEnableQueryAugmentation] = useState(true)
  const settingsLoadedRef = useRef(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [documentHistory, setDocumentHistory] = useState<ChatHistoryMessage[]>(
    []
  )
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const copy =
    language === "ms"
      ? {
          historyLoadError: "Gagal memuatkan sejarah sembang",
          retryLater: "Sila cuba lagi sebentar nanti.",
          noDoc: "Tiada dokumen dipilih",
          noDocDesc:
            "Pilih dokumen dari panel kiri untuk mula bertanya dan dapatkan jawapan berasaskan AI.",
          ready: "Sedia",
          autoServer: "Auto (lalai pelayan)",
          newChat: "Sembang baharu",
          smartOn: "Carian Pintar On",
          smartOff: "Carian Pintar Off",
          clearThread: "Padam thread semasa",
          history: "Sejarah sembang",
          threadList: "Thread Sembang",
          threadDesc: "Tukar antara thread yang disimpan untuk dokumen ini.",
          noSavedThreads: "Belum ada thread disimpan untuk dokumen ini.",
          messages: "mesej",
          askAbout: "Tanya apa sahaja tentang",
          answerDesc:
            "dan dapatkan jawapan yang ringkas, jelas, serta bersumber.",
          suggestions: "Cuba tanya tentang:",
          askPlaceholder: "Tanya soalan...",
          send: "Hantar",
          newLine: "Baris baharu",
          voiceStart: "Mulakan input suara",
          voiceStop: "Hentikan input suara",
          voiceUnsupported:
            "Pelayar ini tidak menyokong input suara secara langsung.",
          voiceBlocked:
            "Akses mikrofon disekat. Sila benarkan mikrofon dan cuba semula.",
          voiceUnavailable:
            "Input suara tidak tersedia sekarang. Sila cuba lagi.",
          thread: "Thread",
          tooManyQuestions: "Terlalu banyak soalan dihantar",
          waitAgain: "Sila tunggu",
          seconds: "saat sebelum bertanya semula.",
          copied: "Berjaya disalin",
          newChatStarted: "Sembang baharu dimulakan",
          cleared: "Thread semasa dipadam",
          nothingToClear: "Tiada apa untuk dipadam",
          clearError: "Gagal memadam thread semasa",
          currentThread: "Thread semasa",
          language: "Tukar bahasa",
          options: "Pilihan",
          back: "Kembali",
          answerError: "Gagal mendapatkan jawapan",
        }
      : {
          historyLoadError: "Failed to load chat history",
          retryLater: "Please try again later.",
          noDoc: "No document selected",
          noDocDesc:
            "Select a document from the left panel to start asking questions and get AI-powered answers.",
          ready: "Ready",
          autoServer: "Auto (server default)",
          newChat: "New chat",
          smartOn: "Smart Retrieval On",
          smartOff: "Smart Retrieval Off",
          clearThread: "Clear current thread",
          history: "Chat history",
          threadList: "Chat Threads",
          threadDesc: "Switch between saved chats for this document.",
          noSavedThreads: "No saved chats for this document yet.",
          messages: "messages",
          askAbout: "Ask anything about",
          answerDesc: "and get simple, clear answers with sources.",
          suggestions: "Try asking about:",
          askPlaceholder: "Ask a question...",
          send: "Send",
          newLine: "New line",
          voiceStart: "Start voice input",
          voiceStop: "Stop voice input",
          voiceUnsupported:
            "This browser does not support built-in voice input.",
          voiceBlocked:
            "Microphone access was blocked. Please allow it and try again.",
          voiceUnavailable:
            "Voice input is unavailable right now. Please try again.",
          thread: "Thread",
          tooManyQuestions: "Too many questions sent",
          waitAgain: "Please wait",
          seconds: "seconds before asking again.",
          copied: "Copied to clipboard",
          newChatStarted: "Started a new chat",
          cleared: "Current chat cleared",
          nothingToClear: "Nothing to clear",
          clearError: "Failed to clear current chat",
          currentThread: "Current chat",
          language: "Toggle language",
          options: "Options",
          back: "Back",
          answerError: "Failed to get answer",
        }

  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechCtorRef = useRef<SpeechRecognitionCtor | null>(null)
  const dictationBaseRef = useRef("")
  const isMountedRef = useRef(true)
  const historyAbortRef = useRef<AbortController | null>(null)

  const getSpeechLocale = (lang: string) => {
    switch (lang) {
      case "ms":
      case "id":
        return "ms-MY"
      case "zh":
      case "zh-cn":
        return "zh-CN"
      case "zh-tw":
        return "zh-TW"
      default:
        return "en-US"
    }
  }

  const mergeVoiceTranscript = (
    baseText: string,
    finalTranscript: string,
    interimTranscript: string
  ) => {
    const normalizedBase = baseText.trim()
    const spokenText = `${finalTranscript} ${interimTranscript}`.trim()
    if (!spokenText) return baseText
    return normalizedBase ? `${normalizedBase} ${spokenText}` : spokenText
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  useEffect(() => {
    const storedModel = window.localStorage.getItem("lr-chat-model")
    if (storedModel !== null) setSelectedPopoverModel(storedModel)
    const storedAug = window.localStorage.getItem("lr-augmentation")
    if (storedAug !== null) setEnableQueryAugmentation(storedAug === "true")
    settingsLoadedRef.current = true
  }, [])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    window.localStorage.setItem("lr-chat-model", selectedPopoverModel)
  }, [selectedPopoverModel])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    window.localStorage.setItem("lr-augmentation", String(enableQueryAugmentation))
  }, [enableQueryAugmentation])

  useEffect(() => {
    if (!rateLimitedUntil) return
    const interval = setInterval(() => {
      const left = Math.ceil((rateLimitedUntil - Date.now()) / 1000)
      if (left <= 0) {
        setRateLimitedUntil(null)
        setRateLimitSecondsLeft(0)
      } else {
        setRateLimitSecondsLeft(left)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [rateLimitedUntil])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [input])

  useEffect(() => {
    if (typeof window === "undefined") return

    const speechCtor =
      (
        window as Window & {
          SpeechRecognition?: SpeechRecognitionCtor
          webkitSpeechRecognition?: SpeechRecognitionCtor
        }
      ).SpeechRecognition ??
      (
        window as Window & {
          webkitSpeechRecognition?: SpeechRecognitionCtor
        }
      ).webkitSpeechRecognition ??
      null

    speechCtorRef.current = speechCtor
    setSpeechSupported(Boolean(speechCtor))

    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const userStorageKey = "lr-user-id"
    const existingUser =
      typeof window !== "undefined"
        ? window.localStorage.getItem(userStorageKey)
        : null

    if (existingUser) {
      setUserId(existingUser)
      return
    }

    const nextUserId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `lr-user-${Date.now()}`

    if (typeof window !== "undefined") {
      window.localStorage.setItem(userStorageKey, nextUserId)
    }

    setUserId(nextUserId)
  }, [])

  useEffect(() => {
    if (!selectedDoc) {
      setMessages([])
      setExpandedSources(new Set())
      setSessionId("")
      setDocumentHistory([])
      setShowHistory(false)
      return
    }

    if (typeof window === "undefined") return

    const storageKey = `lr-chat-session-id:${selectedDoc.id}`
    const existingSession = window.localStorage.getItem(storageKey)

    if (existingSession) {
      setSessionId(existingSession)
      return
    }

    const nextSessionId = createSessionId(selectedDoc.id)
    window.localStorage.setItem(storageKey, nextSessionId)
    setSessionId(nextSessionId)
  }, [selectedDoc])

  useEffect(() => {
    if (!selectedDoc || !userId || !sessionId) return

    historyAbortRef.current?.abort()
    const controller = new AbortController()
    historyAbortRef.current = controller
    let active = true
    setHistoryLoading(true)

    getChatHistory({
      userId,
      documentId: selectedDoc.id,
      signal: controller.signal,
    })
      .then((history) => {
        if (!active) return
        setDocumentHistory(history)
        const ordered = [...history]
          .filter((row) => row.session_id === sessionId)
          .reverse()
          .map(mapHistoryRowToMessage)
        setMessages(ordered)
        setExpandedSources(new Set())
      })
      .catch((error) => {
        if (!active) return
        if (error instanceof Error && error.name === "AbortError") return
        setMessages([])
        toast.error(copy.historyLoadError, {
          description: error instanceof Error ? error.message : copy.retryLater,
        })
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [copy.historyLoadError, copy.retryLater, selectedDoc, sessionId, userId])

  const submitQuestion = async (questionOverride?: string) => {
    if (!selectedDoc) {
      toast.error("Please select a document first")
      return
    }

    if (!userId) {
      toast.error("User identity not ready yet")
      return
    }

    if (!sessionId) {
      toast.error("Session not ready yet")
      return
    }

    const question = (questionOverride ?? input).trim()
    if (!question || loading) return

    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      toast.error(copy.tooManyQuestions, {
        description: `${copy.waitAgain} ${rateLimitSecondsLeft} ${copy.seconds}`,
      })
      return
    }

    if (isListening) stopVoiceInput()

    setInput("")
    setLoading(true)

    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }

    const timestamp = new Date().toISOString()
    const msgId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    let messageAdded = false

    try {
      await askQuestionStream(
        userId,
        selectedDoc.id,
        selectedDoc.name,
        sessionId,
        question,
        selectedPopoverModel,
        enableQueryAugmentation,
        false,
        (event) => {
          if (event.type === "retrieval") {
            if (!messageAdded) {
              messageAdded = true
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  question,
                  answer: "",
                  sources: [],
                  timestamp,
                  language: event.language,
                  confidence: 0,
                  latency_ms: 0,
                  cached: false,
                  sufficient_evidence: event.sufficient_evidence ?? true,
                  isStreaming: true,
                },
              ])
              return
            }

            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (!last || last.id !== msgId) return prev

              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  language: event.language,
                  sufficient_evidence:
                    event.sufficient_evidence ?? last.sufficient_evidence,
                },
              ]
            })
            return
          }

          if (event.type === "token") {
            if (!messageAdded) {
              messageAdded = true
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  question,
                  answer: event.text,
                  sources: [],
                  timestamp,
                  language: "en",
                  confidence: 0,
                  latency_ms: 0,
                  cached: false,
                  sufficient_evidence: true,
                  isStreaming: true,
                },
              ])
              return
            }

            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (!last || last.id !== msgId) return prev
              return [
                ...prev.slice(0, -1),
                { ...last, answer: last.answer + event.text },
              ]
            })
            return
          }

          if (event.type === "complete") {
            const completedMessage: Message = {
              id: msgId,
              question,
              answer: event.answer,
              sources: event.sources ?? [],
              timestamp,
              language: event.language,
              confidence: event.confidence ?? 0,
              confidence_label: event.confidence_label,
              latency_ms: event.latency_ms ?? 0,
              cached: event.cached ?? false,
              model_used: event.model_used,
              sufficient_evidence: event.sufficient_evidence ?? true,
              isStreaming: false,
            }

            setMessages((prev) => {
              if (!messageAdded) return [...prev, completedMessage]

              let index = -1
              for (let i = prev.length - 1; i >= 0; i -= 1) {
                if (prev[i].id === msgId) {
                  index = i
                  break
                }
              }

              if (index === -1) return [...prev, completedMessage]

              return [
                ...prev.slice(0, index),
                completedMessage,
                ...prev.slice(index + 1),
              ]
            })

            setDocumentHistory((prev) => [
              {
                id: `${sessionId}-${timestamp}`,
                user_id: userId,
                session_id: sessionId,
                document_id: selectedDoc.id,
                question,
                answer: event.answer,
                language: event.language,
                sources: event.sources ?? [],
                timestamp,
                confidence: event.confidence ?? 0,
                confidence_label: event.confidence_label,
                latency_ms: event.latency_ms ?? 0,
                model_used: event.model_used,
                sufficient_evidence: event.sufficient_evidence ?? true,
              },
              ...prev,
            ])
            return
          }

          if (event.type === "error") {
            if (messageAdded) {
              setMessages((prev) =>
                prev.filter((message) => message.id !== msgId)
              )
            }

            const detail = event.detail ?? ""
            const isRateLimit =
              detail.toLowerCase().includes("rate limit") ||
              detail.toLowerCase().includes("too many") ||
              detail.includes("429")

            if (isRateLimit) {
              const match = detail.match(/(\d+(?:\.\d+)?)\s*s\b/)
              const waitSeconds = match ? Math.ceil(parseFloat(match[1])) : 30
              setRateLimitedUntil(Date.now() + waitSeconds * 1000)
              setRateLimitSecondsLeft(waitSeconds)

              toast.error(copy.tooManyQuestions, {
                description: `${copy.waitAgain} ${waitSeconds} ${copy.seconds}`,
                duration: 8000,
              })
              return
            }

            toast.error(copy.answerError, {
              description: detail || copy.retryLater,
            })
          }
        }
      )
    } catch (error) {
      if (messageAdded) {
        setMessages((prev) =>
          prev.filter((message) => message.id !== msgId)
        )
      }

      const message = error instanceof Error ? error.message : "Please try again"

      if (message.toLowerCase().includes("too many requests")) {
        const waitSeconds = parseInt(message.match(/\d+/)?.[0] ?? "60", 10)
        setRateLimitedUntil(Date.now() + waitSeconds * 1000)
        setRateLimitSecondsLeft(waitSeconds)
        toast.error(copy.tooManyQuestions, {
          description: `${copy.waitAgain} ${waitSeconds} ${copy.seconds}`,
          duration: 6000,
        })
      } else {
        toast.error(copy.answerError, { description: message })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  const toggleSources = (messageIndex: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)

      if (next.has(messageIndex)) {
        next.delete(messageIndex)
      } else {
        next.add(messageIndex)
      }

      return next
    })
  }

  const stopVoiceInput = () => {
    recognitionRef.current?.stop()
  }

  const startVoiceInput = () => {
    const SpeechRecognitionImpl = speechCtorRef.current

    if (!SpeechRecognitionImpl) {
      toast.error(copy.voiceUnsupported)
      return
    }

    try {
      recognitionRef.current?.stop()

      const recognition = new SpeechRecognitionImpl()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = getSpeechLocale(language)

      dictationBaseRef.current = input.trim()

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index]
          const transcript = result[0]?.transcript?.trim() ?? ""

          if (!transcript) continue

          if (result.isFinal) {
            finalTranscript += `${transcript} `
          } else {
            interimTranscript += `${transcript} `
          }
        }

        setInput(
          mergeVoiceTranscript(
            dictationBaseRef.current,
            finalTranscript.trim(),
            interimTranscript.trim()
          )
        )
      }

      recognition.onerror = (event) => {
        if (isMountedRef.current) setIsListening(false)

        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          toast.error(copy.voiceBlocked)
          return
        }

        if (event.error === "no-speech" || event.error === "aborted") return
        toast.error(copy.voiceUnavailable)
      }

      recognition.onend = () => {
        if (isMountedRef.current) setIsListening(false)
        recognitionRef.current = null
      }

      recognitionRef.current = recognition
      recognition.start()
      inputRef.current?.focus()
    } catch {
      setIsListening(false)
      toast.error(copy.voiceUnavailable)
    }
  }

  const toggleVoiceInput = () => {
    if (isListening) {
      stopVoiceInput()
      return
    }

    startVoiceInput()
  }

  const exportChatHistory = () => {
    if (!messages.length) return
    const lines: string[] = [
      `# Chat History — ${selectedDoc?.name ?? "Document"}`,
      `# Session: ${sessionId}`,
      `# Exported: ${new Date().toLocaleString()}`,
      `# Messages: ${messages.length}`,
      ``,
    ]
    messages.forEach((msg, i) => {
      lines.push(`## ${i + 1}. ${msg.question}`)
      lines.push(``)
      lines.push(msg.answer)
      if (msg.sources.length > 0) {
        lines.push(``)
        lines.push(`**Sources:**`)
        msg.sources.forEach((src, si) => {
          lines.push(
            `  ${si + 1}. Page ${src.page_start ?? "?"} — ${src.section_title || "Unknown section"} (score: ${src.score.toFixed(2)})`
          )
        })
      }
      lines.push(``)
      lines.push(`---`)
      lines.push(``)
    })
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-${(selectedDoc?.name ?? "history").replace(/\.pdf$/i, "")}-${new Date().toISOString().split("T")[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 2000)
    toast.success(copy.copied)
  }

  const handleSelectThread = (nextSessionId: string) => {
    if (!selectedDoc) return
    persistSessionId(selectedDoc.id, nextSessionId)
    setSessionId(nextSessionId)
    setShowHistory(false)
  }

  const handleNewChat = () => {
    if (!selectedDoc) return

    const nextSessionId = createSessionId(selectedDoc.id)
    persistSessionId(selectedDoc.id, nextSessionId)
    setSessionId(nextSessionId)
    setMessages([])
    setExpandedSources(new Set())
    setInput("")
    setShowHistory(false)
    toast.success(copy.newChatStarted)
  }

  const clearChat = async () => {
    if (!selectedDoc || !userId || !sessionId) return

    try {
      const result = await clearChatHistory({
        documentId: selectedDoc.id,
        userId,
        sessionId,
      })

      setDocumentHistory((prev) =>
        prev.filter(
          (row) =>
            !(
              row.document_id === selectedDoc.id && row.session_id === sessionId
            )
        )
      )

      setMessages([])
      setExpandedSources(new Set())

      toast.success(
        result.deleted_rows > 0 ? copy.cleared : copy.nothingToClear
      )
    } catch (error) {
      toast.error(copy.clearError, {
        description: error instanceof Error ? error.message : copy.retryLater,
      })
    }
  }

  const threads = buildThreads(documentHistory)
  const activeThreadLabel =
    threads.find((thread) => thread.sessionId === sessionId)?.previewQuestion ||
    copy.currentThread

  const chatStatus = loading ? "streaming" : "ready"

  return (
    <AiChat
      status={chatStatus}
      className="h-full min-h-0 bg-background font-sans"
    >
      <AiChatBody className="min-h-0">
        <div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
            <AnimatePresence>
              {selectedDoc && showHistory ? (
                <motion.div
                  key="history-panel"
                  initial={{
                    opacity: 0,
                    height: 0,
                    filter: shouldReduce ? "blur(0px)" : "blur(8px)",
                  }}
                  animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    filter: shouldReduce ? "blur(0px)" : "blur(8px)",
                  }}
                  transition={{
                    duration: shouldReduce ? 0.01 : 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="overflow-hidden"
                >
                  <div className="mb-4 border border-border/50 bg-card p-4 shadow-sm sm:mb-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {copy.threadList}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {copy.threadDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleNewChat}
                        className="inline-flex items-center gap-2 border border-border/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {copy.newChat}
                      </button>
                    </div>

                    {threads.length === 0 ? (
                      <div className="border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                        {copy.noSavedThreads}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {threads.map((thread) => {
                          const isActive = thread.sessionId === sessionId

                          return (
                            <button
                              key={thread.sessionId}
                              type="button"
                              onClick={() =>
                                handleSelectThread(thread.sessionId)
                              }
                              className={[
                                "w-full border p-3 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border/50 bg-background hover:bg-muted/40",
                              ].join(" ")}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium text-foreground">
                                    {new Date(
                                      thread.lastUpdated
                                    ).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>

                                <span className="text-[11px] text-muted-foreground">
                                  {thread.messageCount} {copy.messages}
                                </span>
                              </div>

                              <p className="line-clamp-1 text-sm font-medium text-foreground">
                                {thread.previewQuestion}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!selectedDoc ? (
              emptyState ?? (
                <div className="flex min-h-[60vh] flex-col items-center justify-center">
                  <div className="max-w-md p-8 text-center">
                    <div className="mx-auto mb-6 inline-flex">
                      <div className="border border-border/50 bg-muted/20 p-8">
                        <FileText className="mx-auto h-16 w-16 text-primary/60" />
                      </div>
                    </div>
                    <h3 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
                      {copy.noDoc}
                    </h3>
                    <p className="text-muted-foreground">{copy.noDocDesc}</p>
                  </div>
                </div>
              )
            ) : historyLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <TypingIndicator />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
                  <div className="text-center">
                    <div className="relative mx-auto mb-5 h-20 w-20 sm:mb-6 sm:h-24 sm:w-24">
                      <div className="relative hidden h-full w-full items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 sm:flex">
                        <AgentAvatar seed="Charlotte" size={44} />
                      </div>
                    </div>

                    <h3 className="mb-2 text-xl font-semibold text-foreground sm:text-2xl">
                      {language === "ms"
                        ? "Sembang dengan dokumen anda"
                        : "Chat with your document"}
                    </h3>

                    <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
                      {copy.askAbout}{" "}
                      <span className="font-medium text-foreground">
                        {selectedDoc.name}
                      </span>{" "}
                      {copy.answerDesc}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                      {copy.suggestions}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {SUGGESTIONS.map((suggestion, index) => {
                        const Icon = suggestion.icon

                        return (
                          <motion.button
                            key={index}
                            type="button"
                            onClick={() =>
                              handleSuggestionClick(suggestion.text)
                            }
                            whileHover={
                              shouldReduce ? {} : { y: -4, scale: 1.015 }
                            }
                            whileTap={shouldReduce ? {} : { scale: 0.97 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 22,
                            }}
                            className="border border-border/50 bg-card p-3.5 text-left hover:border-primary/30 hover:bg-card/60 sm:p-4"
                          >
                            <Icon className="mb-3 h-5 w-5 text-primary" />
                            <p className="mb-1 text-sm font-medium">
                              {suggestion.text}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.description}
                            </p>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-200 sm:space-y-4"
                  >
                    <UserMessageBubble
                      message={message}
                      copiedId={copiedId}
                      copyToClipboard={copyToClipboard}
                    />
                    <AIMessageCard
                      message={message}
                      index={index}
                      isLatest={index === messages.length - 1}
                      expandedSources={expandedSources}
                      toggleSources={toggleSources}
                      copiedId={copiedId}
                      copyToClipboard={copyToClipboard}
                    />
                  </div>
                ))}

                {loading && !messages.some((message) => message.isStreaming) ? (
                  <TypingIndicator />
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </AiChatBody>

      <AiChatFooter className="bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 p-2 hover:bg-muted"
                  title={copy.back}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}

              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {selectedDoc?.name ?? copy.noDoc}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {selectedDoc ? (
                    <>
                      <span>PDF</span>
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      <span>{copy.ready}</span>
                      <span className="hidden min-w-0 items-center gap-2 sm:inline-flex">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <span className="truncate">
                          {copy.thread}: {activeThreadLabel.slice(0, 20)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="truncate">{copy.noDocDesc}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleLanguage}
                className="border border-border/50 px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:border-primary/30 hover:text-primary active:scale-[0.95]"
                title={copy.language}
              >
                {language === "ms" ? "EN" : "MS"}
              </button>

              <button
                type="button"
                onClick={handleNewChat}
                className="p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={copy.newChat}
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className={cn(
                  "p-2 transition-colors hover:bg-muted",
                  showHistory
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={copy.history}
              >
                <History className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={copy.options}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{copy.options}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() =>
                      setEnableQueryAugmentation((prev) => !prev)
                    }
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {enableQueryAugmentation ? copy.smartOff : copy.smartOn}
                  </DropdownMenuItem>

                  {messages.length > 0 ? (
                    <DropdownMenuItem onClick={exportChatHistory}>
                      <Download className="mr-2 h-4 w-4" />
                      {language === "ms" ? "Eksport sejarah" : "Export history"}
                    </DropdownMenuItem>
                  ) : null}

                  {messages.length > 0 ? (
                    <DropdownMenuItem
                      onClick={clearChat}
                      variant="destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {copy.clearThread}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {composerTop ? <div className="mb-2">{composerTop}</div> : null}

          <ChatInput
            value={input}
            onChange={setInput}
            ref={inputRef}
            onSubmit={submitQuestion}
            loading={loading}
            disabled={!selectedDoc || !sessionId || !userId || rateLimitedUntil !== null}
            placeholder={
              rateLimitedUntil !== null
                ? `${copy.waitAgain} ${rateLimitSecondsLeft}s...`
                : selectedDoc
                  ? copy.askPlaceholder
                  : "Select a document to start..."
            }
            className="bg-card"
          >
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-fit border border-border/50 bg-background/80 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {selectedPopoverModel
                    ? (GROQ_MODELS.find((model) => model.id === selectedPopoverModel)
                        ?.label ?? selectedPopoverModel)
                    : copy.autoServer}
                </button>
              </PopoverTrigger>

              <PopoverContent align="start" className="w-56 p-1">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPopoverModel("")}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                      !selectedPopoverModel && "bg-muted"
                    )}
                  >
                    {copy.autoServer}
                  </button>

                  {GROQ_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedPopoverModel(model.id)}
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                        selectedPopoverModel === model.id && "bg-muted"
                      )}
                    >
                      {model.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!speechSupported || loading}
              className={cn(
                "border border-border/50 bg-background/80 p-2 text-muted-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                isListening &&
                  "border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/15"
              )}
              title={isListening ? copy.voiceStop : copy.voiceStart}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </ChatInput>

          <div className="mt-2 hidden justify-between px-2 sm:mt-3 sm:flex">
            <p className="text-xs text-muted-foreground">Enter {copy.send}</p>
            <p className="text-xs text-muted-foreground">
              Shift + Enter {copy.newLine}
            </p>
          </div>
        </div>
      </AiChatFooter>
    </AiChat>
  )
}
