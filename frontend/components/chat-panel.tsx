// src/components/chat-panel.tsx
"use client"

import React, { useState, useEffect, useRef } from "react"
import { Document, SourceChunk, askQuestion } from "@/lib/api"
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
} from "lucide-react"
import type { Components } from "react-markdown"
import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import AgentAvatar from "./smoothui/agent-avatar"

interface Message {
  question: string
  answer: string
  sources: SourceChunk[]
  timestamp: string
  language: string
}

interface ChatPanelProps {
  selectedDoc: Document | null
  onBack?: () => void // Add onBack prop
}

const SUGGESTIONS = [
  {
    icon: BookOpen,
    text: "Summarize this document",
    description: "Get a concise overview",
  },
  {
    icon: MessageSquare,
    text: "What are the main points?",
    description: "Key takeaways and insights",
  },
  {
    icon: Sparkles,
    text: "List key takeaways",
    description: "Bullet-point summary",
  },
  {
    icon: FileText,
    text: "Explain the methodology",
    description: "Deep dive into methods",
  },
  {
    icon: Bot,
    text: "What are the conclusions?",
    description: "Final outcomes and results",
  },
]

// Language display names
const LANGUAGE_LABELS: Record<string, string> = {
  ms: "Bahasa Melayu",
  id: "Bahasa Melayu",
  en: "English",
  "zh-cn": "中文",
  zh: "中文",
  ta: "தமிழ்",
  ar: "العربية",
  ja: "日本語",
  th: "ภาษาไทย",
}

// Custom markdown components for consistent styling
const markdownComponents: Partial<Components> = {
  // Headings
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
      <span className="h-4 w-1 rounded-full bg-primary" />
      {props.children}
    </h1>
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold text-foreground first:mt-0">
      <span className="h-1 w-3 rounded-full bg-primary" />
      {props.children}
    </h2>
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-foreground/80 first:mt-0">
      {props.children}
    </h3>
  ),

  // Paragraphs
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2 text-sm leading-relaxed text-foreground/90 last:mb-0">
      {props.children}
    </p>
  ),

  // Lists
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-3 list-none space-y-2 pl-0">{props.children}</ul>
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-3 list-none space-y-2 pl-0">{props.children}</ol>
  ),
  li: (props: React.ComponentPropsWithoutRef<"li">) => {
    // Check if this is a bullet list item (contains bullet points in the text)
    const childrenArray = React.Children.toArray(props.children)
    const hasBulletPoint = childrenArray.some(
      (child) =>
        typeof child === "string" &&
        (child.includes("•") || child.includes("-") || child.includes("*"))
    )

    if (hasBulletPoint) {
      return (
        <li className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
          <span className="mt-1 shrink-0 text-primary">•</span>
          <span className="flex-1">{props.children}</span>
        </li>
      )
    }

    return (
      <li className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="mt-0.5 shrink-0 font-bold text-primary">•</span>
        <span className="leading-relaxed text-foreground/90">
          {props.children}
        </span>
      </li>
    )
  },

  // Blockquotes
  blockquote: (props: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="mt-3 border-l-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm text-foreground/70 italic">
      {props.children}
    </blockquote>
  ),

  // Code blocks
  code: (
    props: React.ComponentPropsWithoutRef<"code"> & { className?: string }
  ) => {
    const { className, children, ...rest } = props
    const match = /language-(\w+)/.exec(className || "")
    const isInline = !className

    if (isInline) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary"
          {...rest}
        >
          {children}
        </code>
      )
    }

    return (
      <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground/80">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    )
  },

  // Links
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {props.children}
    </a>
  ),

  // Tables
  table: (props: React.ComponentPropsWithoutRef<"table">) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{props.children}</table>
    </div>
  ),
  thead: (props: React.ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-muted/60 text-xs font-semibold text-foreground/70">
      {props.children}
    </thead>
  ),
  tbody: (props: React.ComponentPropsWithoutRef<"tbody">) => (
    <tbody className="divide-y divide-border/50">{props.children}</tbody>
  ),
  tr: (props: React.ComponentPropsWithoutRef<"tr">) => (
    <tr className="transition-colors hover:bg-muted/20">{props.children}</tr>
  ),
  th: (props: React.ComponentPropsWithoutRef<"th">) => (
    <th className="px-3 py-2 text-left font-semibold">{props.children}</th>
  ),
  td: (props: React.ComponentPropsWithoutRef<"td">) => (
    <td className="px-3 py-2 text-foreground/80">{props.children}</td>
  ),

  // Horizontal rule
  hr: (props: React.ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-4 border-border/60" {...props} />
  ),

  // Strong/Bold
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-foreground">{props.children}</strong>
  ),

  // Emphasis/Italic
  em: (props: React.ComponentPropsWithoutRef<"em">) => (
    <em className="text-foreground/80 italic">{props.children}</em>
  ),
}

// ─── Markdown Renderer ─────────────────────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <Markdown components={markdownComponents}>{content}</Markdown>
    </div>
  )
}

// ─── AI Message Card ─────────────────────────────────────────────────────────
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
  const langLabel = LANGUAGE_LABELS[message.language] ?? message.language
  const isNonEnglish =
    message.language !== "en" && message.language !== "english"

  return (
    <div className="animate-in fade-in-50 slide-in-from-left-5 flex delay-100 duration-300">
      {/* Bot avatar */}
      <div className="mt-1 mr-3 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/10 ring-1 ring-primary/20">
          <Bot className="h-4 w-4 text-primary" />
          <AgentAvatar seed="Charlotte" size={25} />
        </div>
      </div>

      {/* Card */}
      <div className="group relative max-w-[85%] min-w-0">
        <div className="relative overflow-hidden rounded-2xl rounded-tl-sm border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
          {/* Subtle top accent bar */}
          <div className="h-0.5 w-full bg-linear-to-r from-primary/60 via-primary/30 to-transparent" />

          {/* Card body */}
          <div className="p-5">
            {/* Language badge — only show for non-English */}
            {isNonEnglish && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1">
                <Globe className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-medium text-primary">
                  {langLabel}
                </span>
              </div>
            )}

            {/* ── Answer content — rendered via Markdown component ── */}
            <MarkdownRenderer content={message.answer} />

            {/* Divider */}
            <div className="mt-4 border-t border-border/60" />

            {/* Footer row: timestamp + sources toggle */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {message.sources.length > 0 && (
                <button
                  onClick={() => toggleSources(index)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <BookOpen className="h-3 w-3" />
                  {message.sources.length} source
                  {message.sources.length > 1 ? "s" : ""}
                  {isSourcesOpen ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {/* Sources panel */}
            {isSourcesOpen && message.sources.length > 0 && (
              <div className="animate-in fade-in-50 slide-in-from-top-2 mt-3 space-y-2 duration-200">
                {message.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="group/source relative rounded-xl border border-border/60 bg-muted/20 p-4 transition-all hover:border-primary/30 hover:bg-muted/40"
                  >
                    {/* Source header */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>Chunk {source.chunk_index + 1}</span>
                      </div>
                    </div>
                    {/* Source text */}
                    <p className="line-clamp-4 text-xs leading-relaxed text-foreground/70">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Copy button — appears on hover */}
        <button
          onClick={() =>
            copyToClipboard(message.answer, `a-${message.timestamp}`)
          }
          className="absolute -right-2 -bottom-2 rounded-full bg-background p-1.5 opacity-0 shadow-sm ring-1 ring-border transition-all group-hover:opacity-100 hover:ring-primary/40"
          title="Copy answer"
        >
          {copiedId === `a-${message.timestamp}` ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}

// ─── User Message Bubble ──────────────────────────────────────────────────────
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
    <div className="animate-in fade-in-50 slide-in-from-right-5 flex justify-end duration-300">
      <div className="group relative max-w-[80%]">
        {/* User avatar */}
        <div className="absolute top-0 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <User className="h-4 w-4 text-primary" />
        </div>

        {/* Bubble */}
        <div className="mr-6 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed text-primary-foreground">
            {message.question}
          </p>
          <p className="mt-1 text-right text-[10px] text-primary-foreground/60">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Copy button */}
        <button
          onClick={() =>
            copyToClipboard(message.question, `q-${message.timestamp}`)
          }
          className="absolute -bottom-2 -left-2 rounded-full bg-background p-1.5 opacity-0 shadow-sm ring-1 ring-border transition-all group-hover:opacity-100 hover:ring-primary/40"
          title="Copy question"
        >
          {copiedId === `q-${message.timestamp}` ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/10 ring-1 ring-primary/20">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatPanel({ selectedDoc, onBack }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useMobile()

  useEffect(() => {
    setMessages([])
    setExpandedSources(new Set())
  }, [selectedDoc])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedDoc) {
      toast.error("Please select a document first")
      return
    }
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput("")
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    try {
      const response = await askQuestion(
        selectedDoc.id,
        selectedDoc.name,
        question
      )
      setMessages((prev) => [
        ...prev,
        {
          question,
          answer: response.answer,
          sources: response.sources,
          timestamp: response.timestamp,
          language: response.language,
        },
      ])
    } catch (error) {
      toast.error("Failed to get answer", {
        description:
          error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    textareaRef.current?.focus()
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
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!selectedDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-linear-to-b from-background to-muted/20">
        <div className="max-w-md p-8 text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div className="relative rounded-full bg-linear-to-br from-primary/20 to-primary/5 p-6">
              <FileText className="mx-auto h-16 w-16 text-primary/60" />
            </div>
          </div>
          <h3 className="mb-3 text-2xl font-semibold tracking-tight">
            No document selected
          </h3>
          <p className="text-muted-foreground">
            Select a document from the sidebar to start asking questions and get
            insights from your content.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-linear-to-r from-background via-card to-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button - only visible on mobile */}
            {isMobile && onBack && (
              <button
                onClick={onBack}
                className="mr-2 rounded-lg p-2 transition-colors hover:bg-accent"
                aria-label="Go back to documents"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-lg bg-primary/20 blur-sm" />
              <div className="relative rounded-lg bg-primary/10 p-2.5">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {selectedDoc.name}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{selectedDoc.chunk_count} chunks</span>
                <span>•</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-500">
                  Ready to chat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages area ───────────────────────────────────────────────────── */}
      <div className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {messages.length === 0 ? (
            /* Welcome / suggestion state */
            <div className="flex h-full flex-col items-center justify-center">
              <div className="max-w-2xl space-y-8">
                <div className="text-center">
                  <div className="relative mx-auto mb-6 h-20 w-20">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/30 blur-xl" />
                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5">
                      <Bot className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold tracking-tight">
                    Chat with your document
                  </h3>
                  <p className="text-muted-foreground">
                    Ask anything about{" "}
                    <span className="font-medium text-foreground">
                      {selectedDoc.name}
                    </span>{" "}
                    and get AI-powered answers with source references.
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    Try asking about:
                  </p>
                  <div
                    className={cn(
                      "grid gap-3",
                      isMobile ? "grid-cols-1" : "grid-cols-2"
                    )}
                  >
                    {SUGGESTIONS.map((suggestion, index) => {
                      const Icon = suggestion.icon
                      return (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion.text)}
                          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          <Icon className="mb-2 h-5 w-5 text-primary" />
                          <p className="text-sm font-medium">
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
            /* Message thread */
            <>
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

              {/* Typing indicator while loading */}
              {loading && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="relative mx-auto max-w-4xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-background shadow-sm transition-all focus-within:border-primary focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your document..."
              className="max-h-32 w-full resize-none rounded-2xl bg-transparent p-4 pr-16 text-sm focus:outline-none"
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 rounded-xl bg-primary p-2.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-5 flex justify-between px-2">
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              Enter to send
            </p>
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
                ⇧
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              for new line
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
