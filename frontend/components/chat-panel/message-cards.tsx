"use client"

import React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { SourceChunk } from "@/lib/api"
import { useLanguage } from "@/components/language-provider"
import AgentAvatar from "@/components/smoothui/agent-avatar"
import { StreamingText } from "@/components/elements/ai-elements/chat/streaming-text"
import { ChatMarkdown } from "./chat-markdown"
import { VoiceSpeaker } from "./voice-speaker"
import { useTTS } from "@/hooks/useTTS"
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
  ExternalLink,
} from "lucide-react"
import { AnswerMetrics } from "./answer-metrics"

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
  faithfulness?: number | null
  isStreaming?: boolean
  suggestions?: string[]
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

function computeConfidenceReason(
  confidence: number,
  sources: SourceChunk[],
  sufficientEvidence: boolean,
  language: string,
): string {
  const n = sources.length
  const topScore = sources[0]?.score ?? 0
  const pct = Math.round(topScore * 100)
  const ms = language === "ms"
  const zh = language === "zh-cn" || language === "zh"

  if (!sufficientEvidence) {
    if (zh) return "未找到强匹配 — 显示最接近的段落"
    if (ms) return "Tiada padanan kukuh — menunjukkan petikan terdekat"
    return "No strong match — showing closest passage"
  }
  if (n === 1 && topScore < 0.5) {
    if (zh) return `仅找到 1 个来源，匹配度 ${pct}% — 请以官方文件核实`
    if (ms) return `1 sumber ditemui, padanan ${pct}% — sahkan dengan sumber rasmi`
    return `1 source found, ${pct}% match — verify with official source`
  }
  if (confidence < 0.5) {
    if (zh) return `找到 ${n} 个来源，最佳匹配 ${pct}% — 部分匹配`
    if (ms) return `${n} sumber ditemui, padanan terbaik ${pct}% — padanan separa`
    return `${n} sources found, best ${pct}% — partial match`
  }
  if (confidence < 0.75) {
    if (zh) return `找到 ${n} 个来源，最佳匹配 ${pct}%`
    if (ms) return `${n} sumber ditemui, padanan terbaik ${pct}%`
    return `${n} sources found, best ${pct}% match`
  }
  if (zh) return `找到 ${n} 个来源，匹配强度 ${pct}%`
  if (ms) return `${n} sumber ditemui, kekuatan padanan ${pct}%`
  return `${n} sources found, ${pct}% match strength`
}

// ---------------------------------------------------------------------------
// SourcePills — always-visible page citation badges below the answer
// ---------------------------------------------------------------------------

interface SourcePillData {
  pageStart: number
  pageEnd: number | null
  sectionTitle: string
  sourceIndex: number
  score: number
}

const SourcePills = React.memo(function SourcePills({
  sources,
  language,
  onPillClick,
}: {
  sources: SourceChunk[]
  language: string
  onPillClick: (sourceIndex: number, pageStart: number) => void
}) {
  // Deduplicate by page_start — keep highest-scoring source per page
  const pillMap = new Map<number, SourcePillData>()
  sources.forEach((source, idx) => {
    const page = source.page_start
    if (page == null) return
    const existing = pillMap.get(page)
    if (!existing || source.score > existing.score) {
      pillMap.set(page, {
        pageStart: page,
        pageEnd: source.page_end ?? null,
        sectionTitle: source.section_title ?? "",
        sourceIndex: idx,
        score: source.score,
      })
    }
  })

  // Sort by page_start ascending (document reading order), cap at 5
  const pills = Array.from(pillMap.values())
    .sort((a, b) => a.pageStart - b.pageStart)
    .slice(0, 5)

  if (pills.length === 0) return null

  const pageLabel = (pill: SourcePillData): string => {
    const range =
      pill.pageEnd && pill.pageEnd !== pill.pageStart
        ? `${pill.pageStart}–${pill.pageEnd}`
        : `${pill.pageStart}`
    if (language === "ms") return `Hlm ${range}`
    if (language === "zh-cn") return `页 ${range}`
    return `Page ${range}`
  }

  return (
    <div className="mt-3 mb-1 flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <button
          key={pill.pageStart}
          type="button"
          onClick={() => onPillClick(pill.sourceIndex, pill.pageStart)}
          className="inline-flex items-center gap-1.5 border border-primary/70 bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`${pageLabel(pill)}${pill.sectionTitle ? ` — ${pill.sectionTitle}` : ""}`}
          title={pill.sectionTitle || pageLabel(pill)}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span>{pageLabel(pill)}</span>
          {pill.sectionTitle ? (
            <span className="max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
              · {pill.sectionTitle}
            </span>
          ) : null}
          <ExternalLink className="h-3 w-3 shrink-0 text-primary/60" />
        </button>
      ))}
    </div>
  )
})

export function AIMessageCard({
  message,
  index,
  isLatest,
  expandedSources,
  toggleSources,
  copiedId,
  copyToClipboard,
  docPublicUrl,
  autoSpeak,
  onOpenPdf,
  onSuggestionClick,
  sessionId,
  docId,
}: {
  message: Message
  index: number
  isLatest: boolean
  expandedSources: Set<number>
  toggleSources: (index: number) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
  autoSpeak?: boolean
  onOpenPdf?: (page: number, text: string | null) => void
  onSuggestionClick?: (question: string) => void
  sessionId?: string
  docId?: string
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
  const [highlightedSourceIdx, setHighlightedSourceIdx] = React.useState<number | null>(null)
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePillClick = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (sourceIndex: number, _pageStart: number) => {
      const source = message.sources[sourceIndex]
      // Open PDF panel with cited passage highlighted
      onOpenPdf?.(source?.page_start ?? 1, source?.text ?? null)
      // Open sources panel if closed + highlight the matching card
      if (!expandedSources.has(index)) toggleSources(index)
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
      setHighlightedSourceIdx(sourceIndex)
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null
        setHighlightedSourceIdx(null)
      }, 1500)
    },
    [expandedSources, toggleSources, index, message.sources, onOpenPdf]
  )

  const handleFeedback = React.useCallback(
    async (value: "up" | "down") => {
      const next = feedback === value ? null : value
      setFeedback(next)
      if (!next || !sessionId) return
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            question: message.question,
            doc_id: docId ?? message.sources[0]?.document_id ?? "",
            feedback: next,
          }),
        })
      } catch {
        // silent — don't interrupt demo on network failure
      }
    },
    [feedback, sessionId, docId, message.question, message.sources],
  )

  React.useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  const { play } = useTTS()

  React.useEffect(() => {
    if (!isLatest) return
    if (message.isStreaming) return
    if (!autoSpeak) return

    play(message.answer, message.language)
    // play is stable (useCallback with no deps) — safe to include, prevents stale closure if deps change
  }, [message.isStreaming, isLatest, autoSpeak, play])

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
        dotColor: "bg-success",
      }
    : {
        label:
          language === "ms" ? "Padanan terdekat sahaja" : "Closest match only",
        dotColor: "bg-warning",
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
            {/* Primary row: language badge + copy button */}
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/10 px-2 py-1">
                  <span className="bg-primary/20 px-1 font-mono text-[10px] text-primary">
                    {langInfo.code}
                  </span>
                  <span className="truncate text-xs font-medium text-primary">
                    {langInfo.name}
                  </span>
                </div>
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

            {/* Compact secondary line: evidence dot + label + cached + latency */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", evidenceState.dotColor)} />
              <span>{evidenceState.label}</span>
              {message.cached ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{language === "ms" ? "cache" : "cached"}</span>
                </>
              ) : null}
              {message.latency_ms > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {message.latency_ms < 1000
                      ? `${message.latency_ms}ms`
                      : `${(message.latency_ms / 1000).toFixed(1)}s`}
                  </span>
                </>
              ) : null}
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

            {!message.isStreaming && (
              <AnswerMetrics
                confidence={message.confidence}
                faithfulness={message.faithfulness}
                language={message.language}
                confidenceReason={
                  message.sources.length > 0
                    ? computeConfidenceReason(
                        message.confidence,
                        message.sources,
                        message.sufficient_evidence,
                        message.language,
                      )
                    : undefined
                }
              />
            )}

            {!message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {message.language === "ms" ? "Soalan susulan:" : message.language === "zh-cn" ? "后续问题：" : "Follow-up questions:"}
                </p>
                <div className="flex flex-col gap-1.5">
                  {message.suggestions.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSuggestionClick?.(q)}
                      className="w-fit max-w-full truncate border border-primary/20 bg-primary/5 px-3 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!message.isStreaming && message.sources.length > 0 && (
              <SourcePills
                sources={message.sources}
                language={message.language}
                onPillClick={handlePillClick}
              />
            )}

            {!message.isStreaming && (
              <VoiceSpeaker text={message.answer} language={message.language} />
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
                      onClick={() => handleFeedback("up")}
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
                      onClick={() => handleFeedback("down")}
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
                      const pageStart = source.page_start
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
                          className={cn(
                            "animate-in fade-in slide-in-from-top-1 relative border p-3 transition-all duration-300 sm:p-4",
                            highlightedSourceIdx === sourceIndex
                              ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/50 bg-muted/20 hover:bg-muted/40"
                          )}
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
                                {pageStart && docPublicUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenPdf?.(pageStart as number, source.text ?? null)}
                                    className="ml-1 inline-flex items-center gap-1 border border-primary/60 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:border-primary/80 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                    title={language === "ms" ? "Lihat halaman asal" : "View source page"}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {language === "ms" ? "lihat" : "view"}
                                  </button>
                                ) : null}
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
