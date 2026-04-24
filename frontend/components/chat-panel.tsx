"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  ChatHistoryMessage,
  Document,
  SourceChunk,
  askQuestionStream,
  clearChatHistory,
  getChatHistory,
  GROQ_MODELS,
} from "@/lib/api"
import { toast } from "sonner"
import { Markdown } from "@/components/markdown"
import {
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
  BookOpen,
  MessageSquare,
  ArrowLeft,
  History,
  X,
  Languages,
  Plus,
  Clock3,
  Mic,
  MicOff,
  MoreVertical,
} from "lucide-react"
import type { Components } from "react-markdown"
import { cn } from "@/lib/utils"
import { useLanguage } from "./language-provider"
import AgentAvatar from "./smoothui/agent-avatar"
import {
  AiChat,
  AiChatBody,
  AiChatFooter,
} from "@/components/elements/ai-elements/chat/ai-chat"
import { ChatInput } from "@/components/elements/ai-elements/chat/chat-input"
import { StreamingText } from "@/components/elements/ai-elements/chat/streaming-text"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Message {
  question: string
  answer: string
  sources: SourceChunk[]
  timestamp: string
  language: string
  confidence: number
  latency_ms: number
  cached: boolean
  model_used?: string
  sufficient_evidence: boolean
  isStreaming?: boolean
}

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
    color: "from-blue-500/20 to-blue-600/5",
  },
  {
    icon: Sparkles,
    text: "Siapa yang layak memohon?",
    description: "Who is eligible to apply? — Malay",
    color: "from-purple-500/20 to-purple-600/5",
  },
  {
    icon: FileText,
    text: "What documents do I need?",
    description: "Dokumen apa yang diperlukan? / 我需要什么文件？",
    color: "from-emerald-500/20 to-emerald-600/5",
  },
  {
    icon: MessageSquare,
    text: "如何一步一步申请？",
    description: "How do I apply step by step? — Chinese",
    color: "from-amber-500/20 to-amber-600/5",
  },
]

const LANGUAGE_LABELS: Record<string, { name: string; code: string }> = {
  ms: { name: "Bahasa Melayu", code: "MS" },
  id: { name: "Bahasa Indonesia", code: "ID" },
  en: { name: "English", code: "EN" },
  "zh-cn": { name: "中文", code: "ZH" },
  zh: { name: "中文", code: "ZH" },
  tl: { name: "Tagalog", code: "TL" },
  th: { name: "ภาษาไทย", code: "TH" },
  vi: { name: "Tiếng Việt", code: "VI" },
  "zh-tw": { name: "中文 (Traditional)", code: "ZH-TW" },
  jv: { name: "Basa Jawa", code: "JV" },
  ceb: { name: "Cebuano", code: "CEB" },
  fil: { name: "Filipino", code: "FIL" },
}

const markdownComponents: Partial<Components> = {
  h1: (props) => (
    <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
      <span className="h-6 w-1 rounded-full bg-primary" />
      {props.children}
    </h1>
  ),
  h2: (props) => (
    <h2 className="mt-4 mb-3 text-lg font-semibold text-foreground/90 first:mt-0">
      {props.children}
    </h2>
  ),
  h3: (props) => (
    <h3 className="mt-3 mb-2 text-base font-medium text-foreground/80">
      {props.children}
    </h3>
  ),
  p: (props) => (
    <p className="mb-3 text-sm leading-relaxed text-foreground/80 last:mb-0">
      {props.children}
    </p>
  ),
  ul: (props) => <ul className="my-4 space-y-2.5">{props.children}</ul>,
  ol: (props) => (
    <ol className="my-4 list-decimal space-y-2.5 pl-4">{props.children}</ol>
  ),
  li: (props) => (
    <li className="flex items-start gap-3 border border-border/50 bg-muted/30 p-3 text-sm">
      <span className="mt-0.5 shrink-0 text-primary">•</span>
      <span className="text-foreground/80">{props.children}</span>
    </li>
  ),
  blockquote: (props) => (
    <blockquote className="my-4 border-l-4 border-primary/40 bg-primary/5 py-2 pr-4 pl-4 text-sm text-foreground/70 italic">
      {props.children}
    </blockquote>
  ),
  code: (props) => {
    const { className, children, ...rest } = props
    const isInline = !className

    if (isInline) {
      return (
        <code className="border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
          {children}
        </code>
      )
    }

    return (
      <pre className="my-4 overflow-x-auto border border-border/50 bg-muted p-4 font-mono text-xs text-foreground/80">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    )
  },
  a: (props) => (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
    >
      {props.children}
    </a>
  ),
  table: (props) => (
    <div className="my-4 overflow-x-auto border border-border">
      <table className="w-full text-sm">{props.children}</table>
    </div>
  ),
  th: (props) => (
    <th className="bg-muted/50 px-4 py-2 text-left font-semibold">
      {props.children}
    </th>
  ),
  td: (props) => (
    <td className="border-t border-border/50 px-4 py-2">{props.children}</td>
  ),
  hr: (props) => <hr className="my-6 border-border/30" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-foreground">{props.children}</strong>
  ),
  em: (props) => (
    <em className="text-foreground/70 italic">{props.children}</em>
  ),
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <Markdown components={markdownComponents}>{content}</Markdown>
    </div>
  )
}

function mapHistoryRowToMessage(row: ChatHistoryMessage): Message {
  return {
    question: row.question,
    answer: row.answer,
    sources: row.sources ?? [],
    timestamp: row.timestamp,
    language: row.language,
    confidence: row.confidence ?? 0,
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

function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (i: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  const { language } = useLanguage()
  const isSourcesOpen = expandedSources.has(index)
  const langInfo = LANGUAGE_LABELS[message.language] ?? {
    name: message.language,
    code: message.language.toUpperCase(),
  }

  const [isStreamed, setIsStreamed] = React.useState(message.cached)

  React.useEffect(() => {
    if (message.cached) {
      setIsStreamed(true)
      return
    }
    if (!isLatest) return
    setIsStreamed(false)
  }, [isLatest, message.cached, message.timestamp])

  const evidenceState = message.sufficient_evidence
    ? {
        label: language === "ms" ? "Bukti kukuh" : "Strong evidence",
        badge:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        panel:
          "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
        description:
          language === "ms"
            ? "Jawapan ini disokong terus oleh kandungan dokumen yang dimuat naik."
            : "This answer is directly supported by the uploaded document.",
      }
    : {
        label:
          language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
        badge:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        panel:
          "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300",
        description:
          language === "ms"
            ? "Dokumen tidak mempunyai bukti yang cukup kuat, jadi pembantu menggunakan jawapan selamat tanpa membuat andaian."
            : "The document did not contain strong enough evidence, so the assistant used a safe fallback instead of guessing.",
      }

  const highlightSourceText = (text: string, question: string) => {
    const keywords = Array.from(
      new Set(
        question
          .toLowerCase()
          .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/)
          .filter((token) => token.length >= 4)
      )
    ).slice(0, 8)

    if (keywords.length === 0) return <>{text}</>

    const escaped = keywords.map((token) =>
      token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    const regex = new RegExp(`(${escaped.join("|")})`, "gi")
    const parts = text.split(regex)

    return (
      <>
        {parts.map((part, partIndex) =>
          regex.test(part) ? (
            <mark
              key={`${partIndex}-${part}`}
              className="rounded bg-yellow-300/50 px-0.5 text-foreground dark:bg-yellow-500/20"
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={`${partIndex}-${part}`}>{part}</React.Fragment>
          )
        )}
      </>
    )
  }

  return (
    <div className="group flex items-start gap-2.5 sm:gap-3">
      <div className="relative mt-1 shrink-0">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 sm:h-10 sm:w-10">
          <AgentAvatar seed="Charlotte" size={26} />
        </div>
      </div>

      <div className="max-w-[88%] min-w-0 flex-1 sm:max-w-[85%]">
        <div className="relative border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
          <div className="h-1 w-full bg-linear-to-r from-primary via-primary/60 to-transparent" />
          <div className="p-3.5 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
                  <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">{langInfo.code}</span>
                  <span className="text-xs font-medium text-primary">
                    {langInfo.name}
                  </span>
                </div>

                <span className="bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground sm:text-xs">
                  {language === "ms" ? "Pembantu AI" : "AI Assistant"}
                </span>

                {message.cached && (
                  <span className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    cached
                  </span>
                )}

                {message.confidence > 0 && (
                  <span
                    className={[
                      "border px-2 py-0.5 text-[10px] font-medium",
                      message.confidence >= 0.75
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                        : message.confidence >= 0.5
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-600"
                          : "border-orange-500/20 bg-orange-500/10 text-orange-600",
                    ].join(" ")}
                  >
                    {Math.round(message.confidence * 100)}%{" "}
                    {language === "ms" ? "padanan" : "match"}
                  </span>
                )}

                <span
                  className={[
                    "border px-2 py-0.5 text-[10px] font-medium",
                    evidenceState.badge,
                  ].join(" ")}
                >
                  {evidenceState.label}
                </span>

                {message.latency_ms > 0 && (
                  <span className="border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>

              <button
                onClick={() =>
                  copyToClipboard(message.answer, `a-${message.timestamp}`)
                }
                className="p-1.5 opacity-100 transition-colors group-hover:opacity-100 hover:bg-muted sm:opacity-0"
                title="Copy answer"
              >
                {copiedId === `a-${message.timestamp}` ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            <div
              className={[
                "mb-4 border px-3 py-2 text-xs leading-relaxed",
                evidenceState.panel,
              ].join(" ")}
            >
              {evidenceState.description}
            </div>

            {message.isStreaming ? (
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                {message.answer ? (
                  <>
                    {message.answer}
                    <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" />
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            ) : isLatest && !message.cached && !isStreamed && message.isStreaming === undefined ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/80">
                <StreamingText
                  text={message.answer}
                  speed={12}
                  showCursor
                  onComplete={() => setIsStreamed(true)}
                />
              </div>
            ) : (
              <MarkdownRenderer content={message.answer} />
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {message.sources.length > 0 && (
                <button
                  onClick={() => toggleSources(index)}
                  className="flex items-center gap-1.5 border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {message.sources.length}{" "}
                  {language === "ms" ? "sumber" : "sources"}
                  {isSourcesOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {isSourcesOpen && message.sources.length > 0 && (
              <div className="animate-in slide-in-from-top-2 mt-4 space-y-2 duration-200">
                <div className="px-1 text-xs font-medium text-muted-foreground">
                  {language === "ms" ? "Sumber:" : "Sources:"}
                </div>

                {message.sources.map((source, idx) => {
                  const scoreColor =
                    source.score >= 0.75
                      ? "bg-emerald-500"
                      : source.score >= 0.5
                        ? "bg-blue-500"
                        : "bg-orange-400"

                  const scoreLabel =
                    source.score >= 0.75
                      ? language === "ms"
                        ? "Padanan tinggi"
                        : "High match"
                      : source.score >= 0.5
                        ? language === "ms"
                          ? "Padanan baik"
                          : "Good match"
                        : language === "ms"
                          ? "Padanan separa"
                          : "Partial match"

                  return (
                    <div
                      key={idx}
                      className="relative border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40 sm:p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span>
                              {language === "ms" ? "Petikan" : "Excerpt"}{" "}
                              {idx + 1}
                            </span>
                          </div>
                        </div>

                        {source.score > 0 && (
                          <div className="hidden items-center gap-1.5 sm:flex">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${scoreColor}`}
                                style={{
                                  width: `${Math.round(source.score * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] whitespace-nowrap text-muted-foreground">
                              {Math.round(source.score * 100)}% - {scoreLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed text-foreground/70">
                        {highlightSourceText(source.text, message.question)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserMessageBubble({
  message,
  copiedId,
  copyToClipboard,
}: {
  message: Message
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  return (
    <div className="group flex items-start justify-end gap-2.5 sm:gap-3">
      <div className="max-w-[88%] min-w-0 sm:max-w-[80%]">
        <div className="relative">
          <div className="inline-block bg-primary px-4 py-2.5 text-primary-foreground shadow-sm sm:px-5 sm:py-3">
            <p className="text-sm leading-relaxed">{message.question}</p>
          </div>

          <div className="mt-1.5 flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <button
              onClick={() =>
                copyToClipboard(message.question, `q-${message.timestamp}`)
              }
              className="p-1 opacity-100 transition-colors group-hover:opacity-100 hover:bg-muted sm:opacity-0"
              title="Copy question"
            >
              {copiedId === `q-${message.timestamp}` ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30 sm:h-10 sm:w-10">
          <User className="h-4.5 w-4.5 text-primary sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 sm:h-10 sm:w-10">
          <AgentAvatar seed="Charlotte" size={26} />
        </div>
      </div>
      <div className="flex items-center gap-2 border border-border/50 bg-card px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export default function ChatPanel({
  selectedDoc,
  onBack,
  composerTop,
  emptyState,
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
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedPopoverModel, setSelectedPopoverModel] = useState("")
  const [userId, setUserId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [enableQueryAugmentation, setEnableQueryAugmentation] = useState(true)
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
          startNewChat: "Mulakan sembang baharu",
          smartOn: "Carian Pintar On",
          smartOff: "Carian Pintar Off",
          smartEnabled: "Carian pintar diaktifkan",
          smartDisabled: "Carian pintar dimatikan untuk jawapan lebih pantas",
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
          voiceListening: "Sedang mendengar",
          voiceUnsupported:
            "Pelayar ini tidak menyokong input suara secara langsung.",
          voiceBlocked:
            "Akses mikrofon disekat. Sila benarkan mikrofon dan cuba semula.",
          voiceUnavailable:
            "Input suara tidak tersedia sekarang. Sila cuba lagi.",
          thread: "Thread",
          loading: "Carian pintar sedang dijalankan",
          answerReady: "Jawapan sedia",
          answerError: "Gagal mendapatkan jawapan",
          loadingDesc:
            "Sistem sedang menyemak padanan pelbagai bahasa sebelum menjana jawapan.",
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
          model: "Model",
          back: "Kembali",
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
          startNewChat: "Start new chat",
          smartOn: "Smart Retrieval On",
          smartOff: "Smart Retrieval Off",
          smartEnabled: "Smart retrieval is enabled",
          smartDisabled: "Smart retrieval is disabled for faster replies",
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
          voiceListening: "Listening",
          voiceUnsupported:
            "This browser does not support built-in voice input.",
          voiceBlocked:
            "Microphone access was blocked. Please allow it and try again.",
          voiceUnavailable:
            "Voice input is unavailable right now. Please try again.",
          thread: "Thread",
          loading: "Smart retrieval is working",
          answerReady: "Answer ready",
          answerError: "Failed to get answer",
          loadingDesc:
            "Checking multilingual matches before generating the answer.",
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
          model: "Model",
          back: "Back",
        }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechCtorRef = useRef<SpeechRecognitionCtor | null>(null)
  const dictationBaseRef = useRef("")

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
    } else {
      const nextUserId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `lr-user-${Date.now()}`

      if (typeof window !== "undefined") {
        window.localStorage.setItem(userStorageKey, nextUserId)
      }

      setUserId(nextUserId)
    }
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

    let active = true
    setHistoryLoading(true)

    getChatHistory({
      userId,
      documentId: selectedDoc.id,
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

    if (isListening) stopVoiceInput()

    setInput("")
    setLoading(true)

    if (inputRef.current) inputRef.current.style.height = "auto"

    const timestamp = new Date().toISOString()
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
        (event) => {
          if (event.type === "retrieval") {
            if (!messageAdded) {
              messageAdded = true
              setMessages((prev) => [
                ...prev,
                {
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
            } else {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (!last || last.timestamp !== timestamp) return prev
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
            }
          } else if (event.type === "token") {
            if (!messageAdded) {
              messageAdded = true
              setMessages((prev) => [
                ...prev,
                {
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
            } else {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (!last || last.timestamp !== timestamp) return prev
                return [
                  ...prev.slice(0, -1),
                  { ...last, answer: last.answer + event.text },
                ]
              })
            }
          } else if (event.type === "complete") {
            const completedMessage: Message = {
              question,
              answer: event.answer,
              sources: event.sources ?? [],
              timestamp,
              language: event.language,
              confidence: event.confidence ?? 0,
              latency_ms: event.latency_ms ?? 0,
              cached: event.cached ?? false,
              model_used: event.model_used,
              sufficient_evidence: event.sufficient_evidence ?? true,
              isStreaming: false,
            }
            setMessages((prev) => {
              if (!messageAdded) return [...prev, completedMessage]
              let idx = -1
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].timestamp === timestamp) {
                  idx = i
                  break
                }
              }
              if (idx === -1) return [...prev, completedMessage]
              return [
                ...prev.slice(0, idx),
                completedMessage,
                ...prev.slice(idx + 1),
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
                latency_ms: event.latency_ms ?? 0,
                model_used: event.model_used,
                sufficient_evidence: event.sufficient_evidence ?? true,
              },
              ...prev,
            ])
          } else if (event.type === "error") {
            if (messageAdded) {
              setMessages((prev) =>
                prev.filter((m) => m.timestamp !== timestamp)
              )
            }
            const detail = event.detail ?? ""
            const isRateLimit =
              detail.toLowerCase().includes("rate limit") ||
              detail.toLowerCase().includes("too many") ||
              detail.includes("429")
            if (isRateLimit) {
              const match = detail.match(/(\d+(?:\.\d+)?)\s*s\b/)
              const seconds = match
                ? Math.ceil(parseFloat(match[1])).toString()
                : "30"
              toast.error(copy.tooManyQuestions, {
                description: `${copy.waitAgain} ${seconds} ${copy.seconds}`,
                duration: 8000,
              })
            } else {
              toast.error(copy.answerError, {
                description: detail || copy.retryLater,
              })
            }
          }
        }
      )
    } catch (error) {
      if (messageAdded) {
        setMessages((prev) => prev.filter((m) => m.timestamp !== timestamp))
      }
      const msg = error instanceof Error ? error.message : "Please try again"

      if (msg.toLowerCase().includes("too many requests")) {
        const seconds = msg.match(/\d+/)?.[0] ?? "60"
        toast.error(copy.tooManyQuestions, {
          description: `${copy.waitAgain} ${seconds} ${copy.seconds}`,
          duration: 6000,
        })
      } else {
        toast.error(copy.answerError, { description: msg })
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
    const SpeechRecognitionCtor = speechCtorRef.current

    if (!SpeechRecognitionCtor) {
      toast.error(copy.voiceUnsupported)
      return
    }

    try {
      recognitionRef.current?.stop()

      const recognition = new SpeechRecognitionCtor()
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
        setIsListening(false)

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
        setIsListening(false)
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

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
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
            {selectedDoc && showHistory && (
              <div className="mb-4 border border-border/50 bg-card p-4 shadow-sm sm:mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{copy.threadList}</h3>
                    <p className="text-xs text-muted-foreground">
                      {copy.threadDesc}
                    </p>
                  </div>

                  <button
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
                          onClick={() => handleSelectThread(thread.sessionId)}
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
                                {new Date(thread.lastUpdated).toLocaleString(
                                  [],
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
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
            )}

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
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
                  <div className="text-center">
                    <div className="relative mx-auto mb-5 h-20 w-20 sm:mb-6 sm:h-24 sm:w-24">
                      <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                        <AgentAvatar seed="Charlotte" size={44} />
                      </div>
                    </div>

                    <h3 className="mb-2 text-xl font-semibold text-foreground sm:text-2xl">
                      {language === "ms" ? "Sembang dengan dokumen anda" : "Chat with your document"}
                    </h3>

                    <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
                      {copy.askAbout}{" "}
                      <span className="font-medium text-foreground">
                        {selectedDoc?.name ?? ""}
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
                          <button
                            key={index}
                            onClick={() =>
                              handleSuggestionClick(suggestion.text)
                            }
                            className="border border-border/50 bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-card/60 sm:p-4"
                          >
                            <Icon className="mb-3 h-5 w-5 text-primary" />
                            <p className="mb-1 text-sm font-medium">
                              {suggestion.text}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.description}
                            </p>
                          </button>
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
                    key={message.timestamp}
                    className="space-y-3 sm:space-y-4"
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

                {loading && !messages.some((m) => m.isStreaming) && (
                  <TypingIndicator />
                )}
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
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 p-2 hover:bg-muted"
                  title={copy.back}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

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
                className="border border-border/50 px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:border-primary/30 hover:text-primary"
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
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "p-2 transition-colors hover:bg-muted",
                  showHistory ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                      setEnableQueryAugmentation(!enableQueryAugmentation)
                    }
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {enableQueryAugmentation ? copy.smartOff : copy.smartOn}
                  </DropdownMenuItem>

                  {messages.length > 0 && (
                    <DropdownMenuItem onClick={clearChat} variant="destructive">
                      <X className="mr-2 h-4 w-4" />
                      {copy.clearThread}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {composerTop && <div className="mb-2">{composerTop}</div>}
          <ChatInput
            value={input}
            onChange={setInput}
            ref={inputRef}
            onSubmit={submitQuestion}
            loading={loading}
            disabled={!selectedDoc || !sessionId || !userId}
            placeholder={
              selectedDoc ? copy.askPlaceholder : "Select a document to start…"
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
                    ? (GROQ_MODELS.find((m) => m.id === selectedPopoverModel)
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

                  {GROQ_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedPopoverModel(m.id)}
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                        selectedPopoverModel === m.id && "bg-muted"
                      )}
                    >
                      {m.label}
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
