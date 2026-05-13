"use client"

import React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { SourceChunk } from "@/lib/api"
import { useLanguage } from "@/components/language-provider"
import AgentAvatar from "@/components/smoothui/agent-avatar"
import { StreamingText } from "@/components/elements/ai-elements/chat/streaming-text"
import { ChatMarkdown } from "./chat-markdown"
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"

export interface Message {
  id: string
  question: string
  answer: string
  sources: SourceChunk[]
  timestamp: string
  language: string
  confidence: number
  confidence_label?: "high" | "medium" | "low"
  latency_ms: number
  cached: boolean
  model_used?: string
  sufficient_evidence: boolean
  isStreaming?: boolean
}

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

function highlightSourceText(text: string, question: string) {
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
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={`${index}-${part}`}
            className="bg-warning/30 px-0.5 text-foreground dark:bg-warning/20"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

export function AIMessageCard({
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
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  const { language } = useLanguage()
  const shouldReduce = useReducedMotion()
  const isSourcesOpen = expandedSources.has(index)
  const langInfo = LANGUAGE_LABELS[message.language] ?? {
    name: message.language,
    code: message.language.toUpperCase(),
  }

  const [isStreamed, setIsStreamed] = React.useState(message.cached)
  const [feedback, setFeedback] = React.useState<"up" | "down" | null>(null)

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
        badge: "border-success/20 bg-success/10 text-success",
        panel: "border-success/20 bg-success/5 text-success",
        description:
          language === "ms"
            ? "Jawapan ini disokong terus oleh kandungan dokumen yang dimuat naik."
            : "This answer is directly supported by the uploaded document.",
      }
    : {
        label:
          language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
        badge: "border-warning/20 bg-warning/10 text-warning",
        panel: "border-warning/20 bg-warning/5 text-warning",
        description:
          language === "ms"
            ? "Dokumen tidak mempunyai bukti yang cukup kuat, jadi pembantu menggunakan jawapan selamat tanpa membuat andaian."
            : "The document did not contain strong enough evidence, so the assistant used a safe fallback instead of guessing.",
      }

  return (
    <div className="group flex items-start gap-2 sm:gap-3">
      <div className="relative mt-1 hidden shrink-0 sm:block">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 sm:h-10 sm:w-10">
          <AgentAvatar seed="Charlotte" size={26} />
        </div>
      </div>

      <div className="min-w-0 max-w-[95%] flex-1 sm:max-w-[85%]">
        <div className="relative border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
          <div className="h-1 w-full bg-linear-to-r from-primary via-primary/60 to-transparent" />
          <div className="p-3.5 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
                  <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">
                    {langInfo.code}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {langInfo.name}
                  </span>
                </div>

                <span className="bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground sm:text-xs">
                  {language === "ms" ? "Pembantu AI" : "AI Assistant"}
                </span>

                {message.cached ? (
                  <span className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    cached
                  </span>
                ) : null}

                {message.confidence > 0 ? (
                  <span
                    className={[
                      "border px-2 py-0.5 text-[10px] font-medium",
                      message.confidence >= 0.75
                        ? "border-success/20 bg-success/10 text-success"
                        : message.confidence >= 0.5
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-warning/20 bg-warning/10 text-warning",
                    ].join(" ")}
                  >
                    {message.confidence_label
                      ? message.confidence_label.toUpperCase()
                      : `${Math.round(message.confidence * 100)}%`}{" "}
                    {language === "ms" ? "keyakinan" : "confidence"}
                  </span>
                ) : null}

                <span
                  className={[
                    "border px-2 py-0.5 text-[10px] font-medium",
                    evidenceState.badge,
                  ].join(" ")}
                >
                  {evidenceState.label}
                </span>

                {message.latency_ms > 0 ? (
                  <span className="border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
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
              <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/80">
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
            ) : isLatest &&
              !message.cached &&
              !isStreamed &&
              message.isStreaming === undefined ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground/80">
                <StreamingText
                  text={message.answer}
                  speed={12}
                  showCursor
                  onComplete={() => setIsStreamed(true)}
                />
              </div>
            ) : (
              <ChatMarkdown content={message.answer} />
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {!message.isStreaming ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFeedback(feedback === "up" ? null : "up")}
                      className={[
                        "p-1 transition-colors hover:text-success",
                        feedback === "up"
                          ? "text-success"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                      title={language === "ms" ? "Jawapan berguna" : "Helpful"}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback(feedback === "down" ? null : "down")}
                      className={[
                        "p-1 transition-colors hover:text-destructive",
                        feedback === "down"
                          ? "text-destructive"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                      title={language === "ms" ? "Jawapan tidak berguna" : "Not helpful"}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              {message.sources.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleSources(index)}
                  aria-expanded={isSourcesOpen}
                  className="flex items-center gap-1.5 border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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
              ) : null}
            </div>

            <AnimatePresence>
              {isSourcesOpen && message.sources.length > 0 ? (
                <motion.div
                  key="sources-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: shouldReduce ? 0.01 : 0.25,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    <div className="px-1 text-xs font-medium text-muted-foreground">
                      {language === "ms" ? "Sumber:" : "Sources:"}
                    </div>

                    {message.sources.map((source, sourceIndex) => {
                      const scoreColor =
                        source.score >= 0.75
                          ? "bg-success"
                          : source.score >= 0.5
                            ? "bg-primary"
                            : "bg-warning"

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
                          key={sourceIndex}
                          className="animate-in fade-in slide-in-from-top-1 relative border border-border/50 bg-muted/20 p-3 transition-colors duration-200 hover:bg-muted/40 sm:p-4"
                          style={{ animationDelay: `${sourceIndex * 50}ms` }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {sourceIndex + 1}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                <span>
                                  {source.doc_name ||
                                    (language === "ms"
                                      ? "Dokumen"
                                      : "Document")}
                                  {source.page_start
                                    ? `, ${language === "ms" ? "halaman" : "page"} ${
                                        source.page_end &&
                                        source.page_end !== source.page_start
                                          ? `${source.page_start}-${source.page_end}`
                                          : source.page_start
                                      }`
                                    : ""}
                                </span>
                              </div>
                            </div>

                            {source.score > 0 ? (
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
                                  {(source.confidence_label ?? scoreLabel).toString()}{" "}
                                  - {Math.round(source.score * 100)}%
                                </span>
                              </div>
                            ) : null}
                          </div>

                          {source.section_title ? (
                            <p className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                              {source.section_title}
                            </p>
                          ) : null}

                          <div className="overflow-hidden text-xs leading-relaxed text-foreground/70">
                            {highlightSourceText(source.text, message.question)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UserMessageBubble({
  message,
  copiedId,
  copyToClipboard,
}: {
  message: Message
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  return (
    <div className="group flex items-start justify-end gap-2 sm:gap-3">
      <div className="min-w-0 max-w-[95%] sm:max-w-[80%]">
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
              type="button"
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

      <div className="mt-1 hidden shrink-0 sm:block">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30 sm:h-10 sm:w-10">
          <User className="h-4.5 w-4.5 text-primary sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex items-start gap-2 duration-150 sm:gap-3">
      <div className="relative hidden shrink-0 sm:block">
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
