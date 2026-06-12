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
  listDocuments,
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
  Clock3,
  Download,
  FileText,
  History,
  Languages,
  Library,
  MoreVertical,
  Plus,
  Volume2,
  X,
} from "lucide-react"
import dynamic from "next/dynamic"
import {
  AIMessageCard,
  Message,
  TypingIndicator,
  UserMessageBubble,
} from "./message-cards"
import { VoiceMicButton } from "./voice-mic-button"
import { EmptyState } from "./empty-state"

// react-pdf (pdf.js) touches browser-only DOMMatrix at module load — never SSR it
const PdfPanel = dynamic(() => import("./pdf-panel"), { ssr: false })

function shortModelLabel(modelId: string): string {
  if (!modelId) return "Auto"
  // Prefer the full, human-readable label from the model registry (e.g.
  // "Llama 3.3 70B") instead of an abbreviated token like "70B".
  const known = GROQ_MODELS.find((m) => m.id === modelId)
  if (known) return known.label
  return modelId
}

interface ChatPanelProps {
  selectedDoc: Document | null
  sessionId?: string | null        // externally controlled session
  userId?: string                  // passed from workspace
  onBack?: () => void
  composerTop?: React.ReactNode
  emptyState?: React.ReactNode
  initialQuestion?: string
}

interface ChatThread {
  sessionId: string
  lastUpdated: string
  previewQuestion: string
  messageCount: number
}



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
    faithfulness: row.faithfulness ?? null,
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

interface PdfViewerState {
  page: number
  highlightText: string | null
}

export default function ChatPanel({
  selectedDoc,
  sessionId: externalSessionId,
  userId: externalUserId,
  onBack,
  composerTop,
  emptyState,
  initialQuestion,
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
  const [userId, setUserId] = useState(externalUserId ?? "")
  const [sessionId, setSessionId] = useState("")
  const [enableQueryAugmentation, setEnableQueryAugmentation] = useState(true)
  // Multi-document mode: query across every ready doc instead of just the
  // selected one ("no file picking"). selectedDoc stays the session anchor.
  // Default ON so citizens search their whole library without choosing a file;
  // the toggle below lets them narrow to the anchored doc when they want.
  const [askAllDocs, setAskAllDocs] = useState(true)
  const [largeText, setLargeText] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("lr-text-size") === "large"
  })
  const [readyDocIds, setReadyDocIds] = useState<string[]>([])
  const settingsLoadedRef = useRef(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [documentHistory, setDocumentHistory] = useState<ChatHistoryMessage[]>(
    []
  )
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("lingua-autospeak") === "true"
  })

  const [pdfViewerState, setPdfViewerState] = useState<PdfViewerState | null>(null)

  const toggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev
      localStorage.setItem("lingua-autospeak", String(next))
      return next
    })
  }

  const handleOpenPdf = React.useCallback(
    (page: number, text: string | null) => {
      setPdfViewerState({ page, highlightText: text })
    },
    []
  )

  const handleClosePdf = React.useCallback(() => {
    setPdfViewerState(null)
  }, [])

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
          askAll: "Tanya semua dokumen",
          askOne: "Tanya dokumen ini sahaja",
          allDocsBadge: "Semua dokumen",
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
          autoSpeakTitle: "Auto-baca jawapan",
          autoSpeakShort: "Auto-baca",
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
          askAll: "Ask all documents",
          askOne: "Ask this document only",
          allDocsBadge: "All documents",
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
          autoSpeakTitle: "Auto-read answers",
          autoSpeakShort: "Auto-read",
        }

  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isMountedRef = useRef(true)
  const historyAbortRef = useRef<AbortController | null>(null)


  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const storedModel = window.localStorage.getItem("lr-chat-model")
    if (storedModel !== null) setSelectedPopoverModel(storedModel)
    const storedAug = window.localStorage.getItem("lr-augmentation")
    if (storedAug !== null) setEnableQueryAugmentation(storedAug === "true")
    const storedAll = window.localStorage.getItem("lr-ask-all-docs")
    if (storedAll !== null) setAskAllDocs(storedAll === "true")
    settingsLoadedRef.current = true
  }, [])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    window.localStorage.setItem("lr-ask-all-docs", String(askAllDocs))
  }, [askAllDocs])

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-text-size",
      largeText ? "large" : "normal"
    )
    localStorage.setItem("lr-text-size", largeText ? "large" : "normal")
  }, [largeText])

  // Keep the list of ready docs fresh so multi-doc mode spans the whole library.
  useEffect(() => {
    let active = true
    listDocuments()
      .then((docs) => {
        if (!active) return
        setReadyDocIds(
          docs.filter((d) => d.status === "ready").map((d) => d.id)
        )
      })
      .catch(() => {
        /* offline / fetch failure — multi-doc simply stays single-doc */
      })
    return () => {
      active = false
    }
  }, [selectedDoc])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    window.localStorage.setItem("lr-chat-model", selectedPopoverModel)
  }, [selectedPopoverModel])

  useEffect(() => {
    if (!settingsLoadedRef.current) return
    window.localStorage.setItem(
      "lr-augmentation",
      String(enableQueryAugmentation)
    )
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
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [input])


  useEffect(() => {
    // Only self-manage userId when workspace doesn't provide one externally.
    if (externalUserId) return

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
  }, [externalUserId])

  useEffect(() => {
    setPdfViewerState(null)   // Close PDF panel when document changes

    if (externalSessionId !== undefined) {
      setSessionId(externalSessionId ?? "")
      if (!externalSessionId) {
        setMessages([])
        setExpandedSources(new Set())
        setDocumentHistory([])
        setShowHistory(false)
      }
      return
    }

    // existing doc-keyed session logic unchanged below:
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
  }, [selectedDoc, externalSessionId])

  const initialQuestionFiredRef = useRef(false)

  useEffect(() => {
    initialQuestionFiredRef.current = false
  }, [initialQuestion, selectedDoc?.id])

  useEffect(() => {
    if (!initialQuestion || !selectedDoc || !userId || !sessionId) return
    if (initialQuestionFiredRef.current) return
    initialQuestionFiredRef.current = true
    const timer = window.setTimeout(() => submitQuestion(initialQuestion), 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, selectedDoc, userId, sessionId])

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

    // Show the question + a streaming placeholder immediately, before the
    // first SSE event arrives — otherwise the user's question is invisible
    // during the retrieval gap.
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        question,
        answer: "",
        sources: [],
        timestamp,
        language: language === "ms" ? "ms" : "en",
        confidence: 0,
        latency_ms: 0,
        cached: false,
        sufficient_evidence: true,
        isStreaming: true,
      },
    ])
    messageAdded = true

    try {
      // Last 3 completed turns as multi-turn context
      const chatHistory = messages
        .filter(m => !m.isStreaming && m.answer)
        .slice(-3)
        .map(m => ({ question: m.question, answer: m.answer.slice(0, 400) }))

      // Multi-doc: span every ready doc (plus the selected one) when the user
      // opts into "ask all". Empty list = single-doc behaviour on the backend.
      const multiDocIds =
        askAllDocs && readyDocIds.length > 1
          ? Array.from(new Set([selectedDoc.id, ...readyDocIds]))
          : []

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
              faithfulness: event.faithfulness ?? null,
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
                faithfulness: event.faithfulness ?? null,
              },
              ...prev,
            ])
            return
          }

          if (event.type === "suggestions") {
            setMessages((prev) => {
              let idx = -1
              for (let i = prev.length - 1; i >= 0; i -= 1) {
                if (prev[i].id === msgId) { idx = i; break }
              }
              if (idx === -1) return prev
              return [
                ...prev.slice(0, idx),
                { ...prev[idx], suggestions: event.questions },
                ...prev.slice(idx + 1),
              ]
            })
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
        },
        undefined,    // signal — not used here
        chatHistory,  // multi-turn context
        multiDocIds,  // multi-document scope (empty = single doc)
      )
    } catch (error) {
      if (messageAdded) {
        setMessages((prev) => prev.filter((message) => message.id !== msgId))
      }

      const message =
        error instanceof Error ? error.message : "Please try again"

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
    submitQuestion(suggestion)
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
  const chatStatus = loading ? "streaming" : "ready"

  const docPublicUrl = selectedDoc?.public_url ?? null
  // PdfViewer always uses the backend proxy; docPublicUrl is not required.
  const pdfOpen = pdfViewerState !== null

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Chat column */}
      <AiChat
        status={chatStatus}
        className="h-full min-w-0 flex-1 font-sans"
      >
      <AiChatBody className="min-h-0">
        <div ref={scrollContainerRef} className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
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
              (emptyState ?? (
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
              ))
            ) : historyLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <TypingIndicator />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState onChipClick={(q) => submitQuestion(q)} />
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
                      docPublicUrl={selectedDoc?.public_url ?? undefined}
                      autoSpeak={autoSpeak}
                      onOpenPdf={handleOpenPdf}
                      onSuggestionClick={handleSuggestionClick}
                      sessionId={sessionId}
                      docId={selectedDoc?.id}
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
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
                      {askAllDocs && readyDocIds.length > 1 ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-primary" />
                          <span className="inline-flex items-center gap-1 font-medium text-primary">
                            <Library className="h-3 w-3" />
                            {copy.allDocsBadge} ({readyDocIds.length})
                          </span>
                        </>
                      ) : null}
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
                onClick={() => setLargeText((p) => !p)}
                aria-label={largeText ? "Switch to normal text size" : "Switch to large text size"}
                aria-pressed={largeText}
                className="border border-border/50 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.95]"
              >
                {largeText ? "A" : "A⁺"}
              </button>

              <button
                type="button"
                onClick={toggleLanguage}
                className="border border-border/50 px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.95]"
                title={copy.language}
              >
                {language === "ms" ? "EN" : language === "en" ? "中文" : "BM"}
              </button>

              <button
                type="button"
                onClick={handleNewChat}
                className="p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                title={copy.newChat}
              >
                <Plus className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                    title={copy.options}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{copy.options}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setShowHistory((prev) => !prev)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {showHistory
                      ? language === "ms"
                        ? "Sembunyikan sejarah"
                        : "Hide history"
                      : copy.history}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setEnableQueryAugmentation((prev) => !prev)}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {enableQueryAugmentation ? copy.smartOff : copy.smartOn}
                  </DropdownMenuItem>

                  {readyDocIds.length > 1 ? (
                    <DropdownMenuItem
                      onClick={() => setAskAllDocs((prev) => !prev)}
                    >
                      <Library className="mr-2 h-4 w-4" />
                      {askAllDocs ? copy.askOne : copy.askAll}
                    </DropdownMenuItem>
                  ) : null}

                  {messages.length > 0 ? (
                    <DropdownMenuItem onClick={exportChatHistory}>
                      <Download className="mr-2 h-4 w-4" />
                      {language === "ms" ? "Eksport sejarah" : "Export history"}
                    </DropdownMenuItem>
                  ) : null}

                  {messages.length > 0 ? (
                    <DropdownMenuItem onClick={clearChat} variant="destructive">
                      <X className="mr-2 h-4 w-4" />
                      {copy.clearThread}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {composerTop ? <div className="mb-1.5">{composerTop}</div> : null}

          <ChatInput
            value={input}
            onChange={setInput}
            ref={inputRef}
            onSubmit={submitQuestion}
            loading={loading}
            disabled={
              !selectedDoc || !sessionId || !userId || rateLimitedUntil !== null
            }
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
                  {shortModelLabel(selectedPopoverModel)}
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

            <VoiceMicButton
              disabled={loading}
              onTranscript={(text, _language) => setInput(text)}
              onError={(msg) => toast.error(msg)}
              titleIdle={copy.voiceStart}
              titleRecording={copy.voiceStop}
              uiLanguage={language}
            />

            <button
              type="button"
              onClick={toggleAutoSpeak}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                autoSpeak
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={copy.autoSpeakTitle}
              aria-label={copy.autoSpeakTitle}
              aria-pressed={autoSpeak}
            >
              <Volume2 className={cn("h-3 w-3", autoSpeak && "fill-current")} />
              <span className="hidden sm:inline">{copy.autoSpeakShort}</span>
            </button>
          </ChatInput>

          <p className="mt-1.5 hidden px-1 text-[10px] text-muted-foreground sm:block">
            Enter → {copy.send} · Shift+Enter → {copy.newLine}
          </p>
        </div>
      </AiChatFooter>
      </AiChat>

      {/* PDF panel — Sheet on desktop, Drawer on mobile */}
      <PdfPanel
        open={pdfOpen}
        url={docPublicUrl ?? ""}
        targetPage={pdfViewerState?.page ?? 1}
        highlightText={pdfViewerState?.highlightText ?? null}
        docName={selectedDoc?.name ?? ""}
        documentId={selectedDoc?.id ?? ""}
        language={language}
        onClose={handleClosePdf}
      />
    </div>
  )
}
