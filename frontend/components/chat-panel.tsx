// src/components/chat-panel.tsx
"use client"

import React, { useState, useEffect, useRef } from "react"
import { Document, SourceChunk, askQuestion, GROQ_MODELS } from "@/lib/api"
import { toast } from "sonner"
import { Markdown } from "@/components/markdown"
import {
  Send,
  Loader2,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
  User,
  BookOpen,
  Globe,
  MessageSquare,
  ArrowLeft,
  History,
  X,
  Languages,
} from "lucide-react"
import type { Components } from "react-markdown"
import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import AgentAvatar from "./smoothui/agent-avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
}

interface ChatPanelProps {
  selectedDoc: Document | null
  onBack?: () => void
}

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

// Language display names with flags
const LANGUAGE_LABELS: Record<string, { name: string; flag: string }> = {
  ms: { name: "Bahasa Melayu", flag: "🇲🇾" },
  id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
  en: { name: "English", flag: "🇬🇧" },
  "zh-cn": { name: "中文", flag: "🇨🇳" },
  zh: { name: "中文", flag: "🇨🇳" },
  tl: { name: "Tagalog", flag: "🇵🇭" },
  th: { name: "ภาษาไทย", flag: "🇹🇭" },
  vi: { name: "Tiếng Việt", flag: "🇻🇳" },
  "zh-tw": { name: "中文 (Traditional)", flag: "🇹🇼" },
  jv: { name: "Basa Jawa", flag: "🇮🇩" },
  ceb: { name: "Cebuano", flag: "🇵🇭" },
  fil: { name: "Filipino", flag: "🇵🇭" },
}

// Custom markdown components
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
  li: (props) => {
    const childrenArray = React.Children.toArray(props.children)
    const hasBulletPoint = childrenArray.some(
      (child) =>
        typeof child === "string" &&
        (child.includes("•") || child.includes("-") || child.includes("*"))
    )

    if (hasBulletPoint) {
      return (
        <li className="flex items-start gap-3 text-sm">
          <span className="mt-1 shrink-0 text-primary">•</span>
          <span className="flex-1 text-foreground/80">{props.children}</span>
        </li>
      )
    }

    return (
      <li className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
        <span className="mt-0.5 shrink-0 text-primary">•</span>
        <span className="text-foreground/80">{props.children}</span>
      </li>
    )
  },
  blockquote: (props) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-primary/40 bg-primary/5 py-2 pr-4 pl-4 text-sm text-foreground/70 italic">
      {props.children}
    </blockquote>
  ),
  code: (props) => {
    const { className, children, ...rest } = props
    const isInline = !className

    if (isInline) {
      return (
        <code className="rounded-md border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
          {children}
        </code>
      )
    }

    return (
      <pre className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted p-4 font-mono text-xs text-foreground/80">
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
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
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

function AIMessageCard({
  message,
  index,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
}: {
  message: Message
  index: number
  expandedSources: Set<number>
  toggleSources: (i: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  const isSourcesOpen = expandedSources.has(index)
  const langInfo = LANGUAGE_LABELS[message.language] ?? {
    name: message.language,
    flag: "🌐",
  }
  const isNonEnglish = true // always show detected language flag

  return (
    <div className="group flex items-start gap-3">
      {/* Bot avatar with glow effect */}
      <div className="relative mt-1 shrink-0">
        <div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30">
          <AgentAvatar seed="Charlotte" size={28} />
        </div>
      </div>

      {/* Message content */}
      <div className="max-w-[85%] min-w-0 flex-1">
        <div className="relative rounded-2xl rounded-tl-sm border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
          {/* linear header bar */}
          <div className="h-1 w-full rounded-t-2xl bg-linear-to-r from-primary via-primary/60 to-transparent" />

          <div className="p-5">
            {/* Header with language and copy */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {isNonEnglish && (
                  <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1">
                    <span className="text-xs">{langInfo.flag}</span>
                    <span className="text-xs font-medium text-primary">
                      {langInfo.name}
                    </span>
                  </div>
                )}
                <span className="rounded-full bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                  Assistant
                </span>
                {message.cached && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    ⚡ cached
                  </span>
                )}
                {message.confidence > 0 && (
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      message.confidence >= 0.75
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                        : message.confidence >= 0.5
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-600"
                          : "border-orange-500/20 bg-orange-500/10 text-orange-600",
                    ].join(" ")}
                  >
                    {Math.round(message.confidence * 100)}% match
                  </span>
                )}
                {message.latency_ms > 0 && (
                  <span className="rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
                {message.model_used && (
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      message.model_used.includes("70b")
                        ? "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    ].join(" ")}
                  >
                    {message.model_used.includes("70b")
                      ? "70B"
                      : message.model_used.includes("8b")
                        ? "8B"
                        : message.model_used.includes("gemma")
                          ? "Gemma"
                          : message.model_used.split("-")[0]}
                  </span>
                )}
              </div>

              {/* Copy button */}
              <button
                onClick={() =>
                  copyToClipboard(message.answer, `a-${message.timestamp}`)
                }
                className="rounded-lg p-1.5 opacity-0 transition-colors group-hover:opacity-100 hover:bg-muted"
                title="Copy answer"
              >
                {copiedId === `a-${message.timestamp}` ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Answer content */}
            <MarkdownRenderer content={message.answer} />

            {/* Timestamp and sources */}
            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {/* Sources button */}
              {message.sources.length > 0 && (
                <button
                  onClick={() => toggleSources(index)}
                  className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {message.sources.length} source
                  {message.sources.length > 1 ? "s" : ""}
                  {isSourcesOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Sources panel */}
            {isSourcesOpen && message.sources.length > 0 && (
              <div className="animate-in slide-in-from-top-2 mt-4 space-y-2 duration-200">
                <div className="px-1 text-xs font-medium text-muted-foreground">
                  Sources:
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
                      ? "High match"
                      : source.score >= 0.5
                        ? "Good match"
                        : "Partial match"
                  return (
                    <div
                      key={idx}
                      className="group/source relative rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Excerpt {idx + 1}</span>
                          </div>
                        </div>
                        {source.score > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${scoreColor}`}
                                style={{
                                  width: `${Math.round(source.score * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] whitespace-nowrap text-muted-foreground">
                              {Math.round(source.score * 100)}% — {scoreLabel}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-foreground/70">
                        {source.text}
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

// FIXED: User message bubble with proper width - now fits content width, not full width
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
    <div className="group flex items-start justify-end gap-3">
      {/* Message container - now fits content width with max-w-[80%] */}
      <div className="max-w-[80%] min-w-0">
        <div className="relative">
          {/* Message bubble - width fits content */}
          <div className="inline-block rounded-2xl rounded-tr-sm bg-primary px-5 py-3 text-primary-foreground shadow-sm">
            <p className="text-sm leading-relaxed">{message.question}</p>
          </div>

          {/* Footer with timestamp and copy */}
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* Copy button */}
            <button
              onClick={() =>
                copyToClipboard(message.question, `q-${message.timestamp}`)
              }
              className="rounded-lg p-1 opacity-0 transition-colors group-hover:opacity-100 hover:bg-muted"
              title="Copy question"
            >
              {copiedId === `q-${message.timestamp}` ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* User avatar */}
      <div className="mt-1 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
          <User className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30">
          <AgentAvatar seed="Charlotte" size={28} />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border/50 bg-card px-5 py-4 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export default function ChatPanel({ selectedDoc, onBack }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedModel, setSelectedModel] = useState("") // empty = server default
  const [sessionId, setSessionId] = useState("")
  const [enableQueryAugmentation, setEnableQueryAugmentation] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useMobile()

  useEffect(() => {
    setMessages([])
    setExpandedSources(new Set())
  }, [selectedDoc])

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
    const storageKey = "lr-chat-session-id"
    const existing =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null

    if (existing) {
      setSessionId(existing)
      return
    }

    const nextSessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `lr-session-${Date.now()}`

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextSessionId)
    }
    setSessionId(nextSessionId)
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedDoc) {
      toast.error("Please select a document first")
      return
    }
    if (!sessionId) {
      toast.error("Session not ready yet")
      return
    }
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput("")
    setLoading(true)
    if (inputRef.current) inputRef.current.style.height = "auto"

    try {
      const requestPromise = askQuestion(
        selectedDoc.id,
        selectedDoc.name,
        sessionId,
        question,
        selectedModel,
        enableQueryAugmentation
      )
      if (enableQueryAugmentation) {
        toast.promise(requestPromise, {
          loading: "Smart retrieval is working",
          success: "Answer ready",
          error: (message) =>
            message instanceof Error ? message.message : "Failed to get answer",
          description:
            "Checking multilingual matches before generating the answer.",
        })
      }
      const response = await requestPromise
      setMessages((prev) => [
        ...prev,
        {
          question,
          answer: response.answer,
          sources: response.sources,
          timestamp: response.timestamp,
          language: response.language,
          confidence: response.confidence ?? 0,
          latency_ms: response.latency_ms ?? 0,
          cached: false,
          model_used: response.model_used,
        },
      ])
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Please try again"
      // Rate-limit (429) gets a special toast with the wait time extracted
      if (msg.toLowerCase().includes("too many requests")) {
        const seconds = msg.match(/\d+/)?.[0] ?? "60"
        toast.error("Too many questions sent", {
          description: `Please wait ${seconds} seconds before asking again.`,
          duration: 6000,
        })
      } else if (!enableQueryAugmentation) {
        toast.error("Failed to get answer", { description: msg })
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
      next.has(messageIndex)
        ? next.delete(messageIndex)
        : next.add(messageIndex)
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Copied to clipboard")
  }

  const clearChat = () => {
    setMessages([])
    setExpandedSources(new Set())
    toast.success("Chat cleared")
  }

  // Empty state
  if (!selectedDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-linear-to-b from-background to-muted/20">
        <div className="max-w-md p-8 text-center">
          <div className="relative mx-auto mb-6">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-3xl" />
            <div className="relative rounded-full bg-linear-to-br from-primary/20 to-primary/5 p-8 ring-1 ring-primary/30">
              <FileText className="mx-auto h-16 w-16 text-primary/60" />
            </div>
          </div>
          <h3 className="mb-3 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            No document selected
          </h3>
          <p className="text-muted-foreground">
            Select a document from the sidebar to start asking questions and get
            AI-powered insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/50 bg-linear-to-r from-background via-card to-background px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && onBack && (
              <button
                onClick={onBack}
                className="rounded-lg p-2 transition-colors hover:bg-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md" />
              <div className="relative rounded-lg bg-linear-to-br from-primary/20 to-primary/5 p-2.5 ring-1 ring-primary/30">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>

            <div>
              <h2 className="line-clamp-1 text-base font-semibold tracking-tight">
                {selectedDoc.name}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                  PDF
                </span>
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                  Ready
                </span>
                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400">
                  Few-shot
                </span>
                <span className="rounded-full bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                  30 req/min
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Model selector */}
            <Select
              value={selectedModel}
              onValueChange={(value) => setSelectedModel(value)}
            >
              <SelectTrigger className="hidden w-50 text-xs sm:flex">
                <SelectValue placeholder="Auto (server default)" />
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  <SelectItem value="auto">Auto (server default)</SelectItem>

                  {GROQ_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setEnableQueryAugmentation((prev) => !prev)}
              className={[
                "hidden h-9 items-center justify-between gap-1.5 rounded-md border border-input py-2 pr-2 pl-2.5 text-xs whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex",
                enableQueryAugmentation
                  ? "bg-transparent text-foreground"
                  : "bg-muted/40 text-muted-foreground",
              ].join(" ")}
              title={
                enableQueryAugmentation
                  ? "Smart retrieval is enabled"
                  : "Smart retrieval is disabled for faster replies"
              }
            >
              <Languages className="h-4 w-4" />
              {enableQueryAugmentation ? "Smart Retrieval On" : "Smart Retrieval Off"}
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="rounded-lg p-2 transition-colors hover:bg-muted"
                title="Clear chat"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-lg p-2 transition-colors hover:bg-muted"
              title="Chat history"
            >
              <History className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {messages.length === 0 ? (
            // Welcome state with suggestions
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
              <div className="w-full max-w-2xl space-y-8">
                <div className="text-center">
                  <div className="relative mx-auto mb-6 h-24 w-24">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/30 blur-2xl" />
                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 ring-2 ring-primary/30">
                      <AgentAvatar seed="Charlotte" size={50} />
                    </div>
                  </div>
                  <h3 className="mb-2 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-2xl font-semibold text-transparent">
                    Chat with your document
                  </h3>
                  <p className="mx-auto max-w-md text-muted-foreground">
                    Ask anything about{" "}
                    <span className="font-medium text-foreground">
                      {selectedDoc.name}
                    </span>{" "}
                    and get simple, clear answers with sources.
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Try asking about:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion, index) => {
                      const Icon = suggestion.icon
                      return (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion.text)}
                          className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
                        >
                          <div
                            className={cn(
                              "absolute inset-0 bg-linear-to-r opacity-0 transition-opacity group-hover:opacity-100",
                              suggestion.color
                            )}
                          />
                          <Icon className="relative mb-3 h-5 w-5 text-primary" />
                          <p className="relative mb-1 text-sm font-medium">
                            {suggestion.text}
                          </p>
                          <p className="relative text-xs text-muted-foreground">
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
            // Message thread
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={message.timestamp} className="space-y-4">
                  <UserMessageBubble
                    message={message}
                    copiedId={copiedId}
                    copyToClipboard={copyToClipboard}
                  />
                  <AIMessageCard
                    message={message}
                    index={index}
                    expandedSources={expandedSources}
                    toggleSources={toggleSources}
                    copiedId={copiedId}
                    copyToClipboard={copyToClipboard}
                  />
                </div>
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area - simplified, no voice buttons */}
      <div className="border-t border-border/50 bg-linear-to-t from-background via-background to-transparent px-4 py-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/50 bg-card shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-md">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="max-h-32 w-full resize-none rounded-2xl bg-transparent px-4 py-4 pr-20 text-sm focus:outline-none"
              rows={1}
              disabled={loading}
            />

            <div className="absolute right-3 bottom-3">
              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || loading || !sessionId}
                className="rounded-xl bg-primary p-2.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Input footer */}
          <div className="mt-3 flex justify-between px-2">
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              Send
            </p>
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px]">
                ⇧
              </kbd>{" "}
              +
              <kbd className="ml-1 rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              New line
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
