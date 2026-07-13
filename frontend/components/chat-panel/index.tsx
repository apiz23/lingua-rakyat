"use client"

import React, { useEffect, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
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
import { CHAT_COPY } from "@/lib/i18n/chat"
import { useLocalStorageSetting } from "@/hooks/useLocalStorageSetting"
import {
  AiChat,
  AiChatBody,
  AiChatFooter,
} from "@/components/elements/ai-elements/chat/ai-chat"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
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
  Download,
  FileText,
  History,
  Languages,
  Library,
  MoreVertical,
  Plus,
  SlidersHorizontal,
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
import { ThreadHistoryPanel, type ChatThread } from "./thread-history-panel"

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
    confidence_explanation: row.confidence_explanation,
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
  // Which document the citation belongs to. In multi-doc mode this can be a
  // different file from the anchored selectedDoc.
  documentId?: string
  docName?: string
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
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [userId, setUserId] = useState(externalUserId ?? "")
  const [sessionId, setSessionId] = useState("")
  const [readyDocs, setReadyDocs] = useState<Document[]>([])
  const readyDocIds = readyDocs.map((d) => d.id)
  // "@" mention: pin retrieval to one document for upcoming questions.
  const [mentionDoc, setMentionDoc] = useState<Document | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [documentHistory, setDocumentHistory] = useState<ChatHistoryMessage[]>(
    []
  )

  // Persisted settings (localStorage-backed)
  const [selectedPopoverModel, setSelectedPopoverModel] =
    useLocalStorageSetting<string>("lr-chat-model", DEFAULT_CHAT_MODEL_ID)
  const [enableQueryAugmentation, setEnableQueryAugmentation] =
    useLocalStorageSetting<boolean>("lr-augmentation", true)
  // Multi-document mode: query across every ready doc instead of just the
  // selected one ("no file picking"). selectedDoc stays the session anchor.
  // Default ON so citizens search their whole library without choosing a file;
  // the toggle below lets them narrow to the anchored doc when they want.
  const [askAllDocs, setAskAllDocs] = useLocalStorageSetting<boolean>(
    "lr-ask-all-docs",
    true
  )
  const [textSize, setTextSize] = useLocalStorageSetting<"normal" | "large">(
    "lr-text-size",
    "normal"
  )
  const largeText = textSize === "large"
  const [autoSpeak, setAutoSpeak] = useLocalStorageSetting<boolean>(
    "lingua-autospeak",
    false
  )
  // Simple view (default ON): hides technical chrome — confidence bars,
  // latency, model picker — so non-technical citizens see just the answer.
  // Power users/judges flip it off via the options menu.
  const [simpleMode, setSimpleMode] = useLocalStorageSetting<boolean>(
    "lr-simple-mode",
    true
  )

  const [pdfViewerState, setPdfViewerState] = useState<PdfViewerState | null>(null)

  const toggleAutoSpeak = () => setAutoSpeak((prev) => !prev)

  const handleOpenPdf = React.useCallback(
    (page: number, text: string | null, documentId?: string, docName?: string) => {
      setPdfViewerState({ page, highlightText: text, documentId, docName })
    },
    []
  )

  const handleClosePdf = React.useCallback(() => {
    setPdfViewerState(null)
  }, [])

  const copy = CHAT_COPY[language]

  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0)

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
    document.documentElement.setAttribute("data-text-size", textSize)
  }, [textSize])

  // Keep the list of ready docs fresh so multi-doc mode spans the whole library.
  useEffect(() => {
    let active = true
    listDocuments()
      .then((docs) => {
        if (!active) return
        setReadyDocs(docs.filter((d) => d.status === "ready"))
      })
      .catch(() => {
        /* offline / fetch failure — multi-doc simply stays single-doc */
      })
    return () => {
      active = false
    }
  }, [selectedDoc])

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
      if (externalSessionId) {
        setSessionId(externalSessionId)
        return
      }
      // Externally-controlled "new chat" (null): mint a fresh session so the
      // composer is enabled — an empty sessionId keeps the input disabled.
      setMessages([])
      setExpandedSources(new Set())
      setDocumentHistory([])
      setShowHistory(false)
      setSessionId(selectedDoc ? createSessionId(selectedDoc.id) : "")
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
      toast.error(copy.selectDocFirst)
      return
    }

    if (!userId) {
      toast.error(copy.userNotReady)
      return
    }

    if (!sessionId) {
      toast.error(copy.sessionNotReady)
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
    setMentionQuery(null)
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
        language,
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
      // An "@" mention overrides both and pins retrieval to that one document.
      const multiDocIds = mentionDoc
        ? [mentionDoc.id]
        : askAllDocs && readyDocIds.length > 1
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
              evidence_mode: event.evidence_mode,
              faithfulness: event.faithfulness ?? null,
              confidence_explanation: event.confidence_explanation,
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
                confidence_explanation: event.confidence_explanation,
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

  // Stable identities so React.memo on the message cards actually skips
  // re-renders during token streaming.
  const submitQuestionRef = useRef(submitQuestion)
  submitQuestionRef.current = submitQuestion

  const handleSuggestionClick = React.useCallback((suggestion: string) => {
    submitQuestionRef.current(suggestion)
  }, [])

  const toggleSources = React.useCallback((messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)

      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }

      return next
    })
  }, [])


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

  const copiedToastRef = useRef(copy.copied)
  copiedToastRef.current = copy.copied

  const copyToClipboard = React.useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 2000)
      toast.success(copiedToastRef.current)
    } catch {
      // Clipboard denied (non-HTTPS / permissions) — nothing else to do
    }
  }, [])

  const handleSelectThread = (nextSessionId: string) => {
    if (!selectedDoc) return
    persistSessionId(selectedDoc.id, nextSessionId)
    setSessionId(nextSessionId)
    setShowHistory(false)
  }

  // "@" mention: typing "@…" at the end of the input opens a picker of ready
  // documents; selecting one pins retrieval to that document until removed.
  const mentionMatches = React.useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return readyDocs.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionQuery, readyDocs])

  const handleInputChange = (next: string) => {
    setInput(next)
    const match = next.match(/@([^\s@]*)$/)
    setMentionQuery(match && readyDocs.length > 0 ? match[1] : null)
    setMentionIndex(0)
  }

  const selectMention = (doc: Document) => {
    setMentionDoc(doc)
    setInput((prev) => prev.replace(/@([^\s@]*)$/, "").trimEnd())
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery === null) return
    if (e.key === "Escape") {
      e.stopPropagation()
      setMentionQuery(null)
      return
    }
    if (mentionMatches.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      e.stopPropagation()
      setMentionIndex((i) => (i + 1) % mentionMatches.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      e.stopPropagation()
      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      e.stopPropagation()
      selectMention(mentionMatches[mentionIndex])
    }
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
        {selectedDoc && !historyLoading && messages.length > 0 ? (
          <MessageScrollerProvider
            autoScroll
            defaultScrollPosition="last-anchor"
            scrollPreviousItemPeek={64}
          >
            <MessageScroller>
              <MessageScrollerViewport className="scrollbar-thumb-muted scrollbar-track-transparent">
                <MessageScrollerContent
                  aria-busy={loading}
                  className="mx-auto w-full max-w-5xl gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6"
                >
                  {showHistory ? (
                    <MessageScrollerItem messageId="thread-history">
                      <AnimatePresence>
                        <ThreadHistoryPanel
                          threads={threads}
                          activeSessionId={sessionId}
                          copy={copy}
                          onSelectThread={handleSelectThread}
                          onNewChat={handleNewChat}
                        />
                      </AnimatePresence>
                    </MessageScrollerItem>
                  ) : null}

                  {messages.map((message, index) => (
                    <React.Fragment key={message.id}>
                      <MessageScrollerItem
                        messageId={`${message.id}-q`}
                        scrollAnchor
                      >
                        <UserMessageBubble
                          message={message}
                          copiedId={copiedId}
                          copyToClipboard={copyToClipboard}
                        />
                      </MessageScrollerItem>
                      <MessageScrollerItem messageId={message.id}>
                        <AIMessageCard
                          message={message}
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
                          simpleMode={simpleMode}
                          agency={selectedDoc?.agency ?? ""}
                        />
                      </MessageScrollerItem>
                    </React.Fragment>
                  ))}

                  {loading && !messages.some((message) => message.isStreaming) ? (
                    <MessageScrollerItem messageId="typing-indicator">
                      <TypingIndicator />
                    </MessageScrollerItem>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        ) : (
          <div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent h-full overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
              <AnimatePresence>
                {selectedDoc && showHistory ? (
                  <ThreadHistoryPanel
                    threads={threads}
                    activeSessionId={sessionId}
                    copy={copy}
                    onSelectThread={handleSelectThread}
                    onNewChat={handleNewChat}
                  />
                ) : null}
              </AnimatePresence>

              {!selectedDoc ? (
                (emptyState ?? (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center">
                    <div className="max-w-md p-8 text-center">
                      <div className="mx-auto mb-6 inline-flex">
                        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
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
              ) : (
                <EmptyState onChipClick={(q) => submitQuestion(q)} />
              )}
            </div>
          </div>
        )}
      </AiChatBody>

      <AiChatFooter className="bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"
                  title={copy.back}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}

              <Attachment
                size="xs"
                state={selectedDoc ? "done" : "idle"}
                className="min-w-0"
              >
                <AttachmentMedia>
                  {askAllDocs && readyDocIds.length > 1 && selectedDoc ? (
                    <Library className="text-primary" />
                  ) : (
                    <FileText className="text-primary" />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle className="max-w-[180px] sm:max-w-[280px]">
                    {selectedDoc?.name ?? copy.noDoc}
                  </AttachmentTitle>
                  <AttachmentDescription className="text-[11px]">
                    {selectedDoc
                      ? askAllDocs && readyDocIds.length > 1
                        ? `PDF · ${copy.ready} · ${copy.allDocsBadge} (${readyDocIds.length})`
                        : `PDF · ${copy.ready}`
                      : copy.noDocDesc}
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setTextSize((p) => (p === "large" ? "normal" : "large"))
                }
                aria-label={largeText ? copy.textSizeNormal : copy.textSizeLarge}
                aria-pressed={largeText}
                className="rounded-full border border-border/60 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.95]"
              >
                {largeText ? "A" : "A⁺"}
              </button>

              <button
                type="button"
                onClick={toggleLanguage}
                className="rounded-full border border-border/60 bg-card px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:border-primary/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.95]"
                title={copy.language}
              >
                {language === "ms" ? "EN" : language === "en" ? "中文" : "BM"}
              </button>

              <button
                type="button"
                onClick={handleNewChat}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                title={copy.newChat}
              >
                <Plus className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
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
                    {showHistory ? copy.hideHistory : copy.history}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setSimpleMode((prev) => !prev)}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {simpleMode ? copy.simpleViewOff : copy.simpleViewOn}
                  </DropdownMenuItem>

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
                      {copy.exportHistory}
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

          {mentionDoc ? (
            <div className="mb-1.5 flex items-center gap-1.5">
              <span
                title={copy.mentionOnlyTitle}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">@{mentionDoc.name}</span>
                <button
                  type="button"
                  onClick={() => setMentionDoc(null)}
                  aria-label={copy.askAll}
                  className="ml-0.5 transition-colors hover:text-primary/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          ) : null}

          <div className="relative" onKeyDownCapture={handleMentionKeyDown}>
            {mentionQuery !== null ? (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-xl border border-border bg-popover shadow-md">
                <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {copy.mentionListTitle}
                </div>
                {mentionMatches.length === 0 ? (
                  <div className="px-3 pb-2 text-xs text-muted-foreground">
                    {copy.mentionNoMatch}
                  </div>
                ) : (
                  mentionMatches.map((doc, i) => (
                    <button
                      key={doc.id}
                      type="button"
                      onMouseDown={(e) => {
                        // preventDefault keeps focus in the textarea
                        e.preventDefault()
                        selectMention(doc)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                        i === mentionIndex && "bg-muted"
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{doc.name}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

          <ChatInput
            value={input}
            onChange={handleInputChange}
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
                  : copy.selectDocPlaceholder
            }
            className="bg-card"
          >
            {!simpleMode ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-fit rounded-full border border-border/60 bg-background/80 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
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
            ) : null}

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
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
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
          </div>

          <p className="mt-1.5 hidden px-1 text-[10px] text-muted-foreground sm:block">
            Enter → {copy.send} · Shift+Enter → {copy.newLine}
          </p>
        </div>
      </AiChatFooter>
      </AiChat>

      {/* PDF panel — Sheet on desktop, Drawer on mobile. Opens the cited
          source's own document, which in multi-doc mode may not be the
          anchored selectedDoc. */}
      <PdfPanel
        open={pdfOpen}
        url={docPublicUrl ?? ""}
        targetPage={pdfViewerState?.page ?? 1}
        highlightText={pdfViewerState?.highlightText ?? null}
        docName={pdfViewerState?.docName || selectedDoc?.name || ""}
        documentId={pdfViewerState?.documentId || selectedDoc?.id || ""}
        language={language}
        onClose={handleClosePdf}
      />
    </div>
  )
}
