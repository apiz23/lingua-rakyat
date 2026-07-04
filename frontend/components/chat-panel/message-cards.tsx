"use client"

import React, { useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ""
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
  Share2,
} from "lucide-react"
import { AnswerMetrics } from "./answer-metrics"
import { createShare } from "@/lib/api"
import { toast } from "sonner"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Loader2 } from "lucide-react"

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
  // "strong" | "cautious" | "insufficient" | "summary". Absent on rows saved
  // before this field existed — fall back to sufficient_evidence then.
  evidence_mode?: string
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
  // split with one capture group alternates: even indices = plain text,
  // odd indices = keyword matches. (Never re-test with a /g regex — its
  // lastIndex is stateful and skips alternate matches.)
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
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
// Confidence sentence helper
// ---------------------------------------------------------------------------

const CONFIDENCE_MSG: Record<string, Record<string, string>> = {
  ms: {
    low: "Padanan lemah — sila sahkan maklumat ini di sumber rasmi.",
    insufficient: "Tiada maklumat yang mencukupi dalam dokumen — sila rujuk sumber rasmi.",
  },
  en: {
    low: "Weak match — please verify this information with the official source.",
    insufficient: "Insufficient information found in the documents — please consult the official source.",
  },
  zh: {
    low: "匹配度较低 — 请向官方来源核实此信息。",
    insufficient: "文件中未找到足够信息 — 请参阅官方来源。",
  },
}

function confidenceSentence(msg: Message): string | null {
  const lang = msg.language?.startsWith("zh")
    ? "zh"
    : msg.language?.startsWith("ms") || msg.language?.startsWith("id")
    ? "ms"
    : "en"
  const map = CONFIDENCE_MSG[lang] ?? CONFIDENCE_MSG.en
  // "insufficient" is the canned no-answer reply; a "cautious" answer is still
  // grounded in a real chunk, so it only gets the softer "verify" note.
  if (msg.evidence_mode) {
    if (msg.evidence_mode === "insufficient") return map.insufficient
    if (msg.evidence_mode === "cautious" || msg.confidence_label === "low")
      return map.low
    return null
  }
  if (!msg.sufficient_evidence) return map.insufficient
  if (msg.confidence_label === "low") return map.low
  return null
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

  // No page-numbered pills but sources exist → show a generic "Open PDF" pill
  if (pills.length === 0) {
    if (sources.length === 0) return null
    const label =
      language === "ms" ? "Buka PDF" : language === "zh-cn" ? "打开PDF" : "Open PDF"
    return (
      <div className="mt-3 mb-1 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onPillClick(0, 1)}
          className="inline-flex items-center gap-1.5 border border-primary/70 bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={label}
          title={label}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span>{label}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-primary/60" />
        </button>
      </div>
    )
  }

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

export const AIMessageCard = React.memo(function AIMessageCard({
  message,
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
  simpleMode,
}: {
  message: Message
  isLatest: boolean
  expandedSources: Set<string>
  toggleSources: (messageId: string) => void
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
  docPublicUrl?: string
  autoSpeak?: boolean
  onOpenPdf?: (
    page: number,
    text: string | null,
    documentId?: string,
    docName?: string
  ) => void
  onSuggestionClick?: (question: string) => void
  sessionId?: string
  docId?: string
  simpleMode?: boolean
}) {
  const { language } = useLanguage()
  const shouldReduce = useReducedMotion()
  const isSourcesOpen = expandedSources.has(message.id)
  const langInfo = LANGUAGE_LABELS[message.language] ?? {
    name: message.language,
    code: message.language.toUpperCase(),
  }

  const [isStreamed, setIsStreamed] = React.useState(message.cached)
  // Feedback survives thread switches/reloads so users can't double-vote.
  const [feedback, setFeedback] = React.useState<"up" | "down" | null>(() => {
    if (typeof window === "undefined") return null
    const stored = window.localStorage.getItem(`lr-feedback:${message.id}`)
    return stored === "up" || stored === "down" ? stored : null
  })
  const [highlightedSourceIdx, setHighlightedSourceIdx] = React.useState<number | null>(null)
  const [sharing, setSharing] = useState(false)
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePillClick = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (sourceIndex: number, _pageStart: number) => {
      const source = message.sources[sourceIndex]
      // Open PDF panel with cited passage highlighted — in the source's own
      // document, which in multi-doc mode may differ from the anchored one.
      onOpenPdf?.(
        source?.page_start ?? 1,
        source?.text ?? null,
        source?.document_id,
        source?.doc_name
      )
      // Open sources panel if closed + highlight the matching card
      if (!expandedSources.has(message.id)) toggleSources(message.id)
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current)
      setHighlightedSourceIdx(sourceIndex)
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null
        setHighlightedSourceIdx(null)
      }, 1500)
    },
    [expandedSources, toggleSources, message.id, message.sources, onOpenPdf]
  )

  const handleFeedback = React.useCallback(
    async (value: "up" | "down") => {
      const next = feedback === value ? null : value
      setFeedback(next)
      if (next) {
        window.localStorage.setItem(`lr-feedback:${message.id}`, next)
      } else {
        window.localStorage.removeItem(`lr-feedback:${message.id}`)
      }
      if (!next || !sessionId) return
      try {
        await fetch(`${API_URL}/api/feedback`, {
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
    [feedback, sessionId, docId, message.id, message.question, message.sources],
  )

  const handleShare = React.useCallback(
    async () => {
      setSharing(true)
      try {
        const result = await createShare({
          question: message.question,
          answer: message.answer,
          sources: message.sources,
          language: message.language,
        })
        if (!result) {
          toast.error("Couldn't create link — try again")
          return
        }
        const url = `${window.location.origin}${result.url}`
        try {
          await navigator.clipboard.writeText(url)
          toast.success("Link copied! Share via WhatsApp or SMS.")
        } catch {
          // Clipboard denied (non-HTTPS, permissions) — show the link instead
          toast.info(url, { duration: 12000 })
        }
      } catch {
        toast.error("Couldn't create link — try again")
      } finally {
        setSharing(false)
      }
    },
    [message.question, message.answer, message.sources, message.language],
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
    <Message className="group items-start gap-2 sm:gap-3">
      <MessageAvatar className="mt-1 hidden h-9 w-9 self-start bg-primary/10 ring-1 ring-primary/20 sm:flex sm:h-10 sm:w-10">
        <AgentAvatar seed="Charlotte" size={26} />
      </MessageAvatar>

      <MessageContent className="min-w-0 max-w-[95%] flex-1 gap-0 sm:max-w-[85%]">
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
                className="p-1.5 opacity-100 transition-opacity hover:bg-muted sm:opacity-50 sm:group-hover:opacity-100"
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
              {!simpleMode && message.cached ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{language === "ms" ? "cache" : "cached"}</span>
                </>
              ) : null}
              {!simpleMode && message.latency_ms > 0 ? (
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

            {!message.isStreaming && (() => {
              const sentence = confidenceSentence(message)
              return sentence ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{sentence}</span>
                </div>
              ) : null
            })()}

            {!message.isStreaming && !simpleMode && (
              <AnswerMetrics
                confidence={message.confidence}
                faithfulness={message.faithfulness}
                language={message.language}
                sources={message.sources}
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
                      aria-pressed={feedback === "up"}
                      className={[
                        "p-2 transition-colors hover:text-success",
                        feedback === "up"
                          ? "text-success"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                      title={language === "ms" ? "Jawapan berguna" : language === "zh" ? "有帮助" : "Helpful"}
                      aria-label={language === "ms" ? "Jawapan berguna" : language === "zh" ? "有帮助" : "Helpful"}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback("down")}
                      aria-pressed={feedback === "down"}
                      className={[
                        "p-2 transition-colors hover:text-destructive",
                        feedback === "down"
                          ? "text-destructive"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                      title={language === "ms" ? "Jawapan tidak berguna" : language === "zh" ? "没帮助" : "Not helpful"}
                      aria-label={language === "ms" ? "Jawapan tidak berguna" : language === "zh" ? "没帮助" : "Not helpful"}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={sharing}
                      aria-label={language === "ms" ? "Kongsi jawapan" : language === "zh" ? "分享回答" : "Share answer"}
                      className="p-2 transition-colors hover:text-foreground text-muted-foreground/40 disabled:opacity-50"
                      title={language === "ms" ? "Kongsi jawapan" : language === "zh" ? "分享回答" : "Share answer"}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              {message.sources.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleSources(message.id)}
                  aria-expanded={isSourcesOpen}
                  className="flex items-center gap-1.5 border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {isSourcesOpen ? (
                    <>
                      {message.sources.length}{" "}
                      {language === "ms" ? "sumber" : "sources"}
                    </>
                  ) : (
                    <>
                      {message.sources.length > 0
                        ? `Source: ${message.sources[0].doc_name || message.sources[0].document_id}${message.sources[0].page_start ? ` · p.${message.sources[0].page_start}` : ""}${message.sources.length > 1 ? ` +${message.sources.length - 1} more` : ""}`
                        : "Sources"}
                    </>
                  )}
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
                                {onOpenPdf ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPdf(
                                        pageStart ?? 1,
                                        source.text ?? null,
                                        source.document_id,
                                        source.doc_name
                                      )
                                    }
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
      </MessageContent>
    </Message>
  )
})

export const UserMessageBubble = React.memo(function UserMessageBubble({
  message,
  copiedId,
  copyToClipboard,
}: {
  message: Message
  copiedId: string | null
  copyToClipboard: (text: string, id: string) => void
}) {
  return (
    <Message align="end" className="group items-start gap-2 sm:gap-3">
      <MessageAvatar className="mt-1 hidden h-9 w-9 self-start bg-primary/10 ring-1 ring-primary/30 group-has-data-[slot=message-footer]/message:translate-y-0 sm:flex sm:h-10 sm:w-10">
        <User className="h-4.5 w-4.5 text-primary sm:h-5 sm:w-5" />
      </MessageAvatar>

      <MessageContent className="w-auto min-w-0 max-w-[95%] items-end gap-1.5 sm:max-w-[80%]">
        <div className="inline-block bg-primary px-4 py-2.5 text-primary-foreground shadow-sm sm:px-5 sm:py-3">
          <p className="text-sm leading-relaxed">{message.question}</p>
        </div>

        <MessageFooter className="gap-2 px-0 font-normal">
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
            className="p-1 opacity-100 transition-opacity hover:bg-muted sm:opacity-50 sm:group-hover:opacity-100"
            title="Copy question"
          >
            {copiedId === `q-${message.timestamp}` ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
})

export function TypingIndicator() {
  const { language } = useLanguage()
  const label =
    language === "ms"
      ? "Sedang mencari dalam dokumen..."
      : language === "zh"
        ? "正在查找文件..."
        : "Searching the documents..."

  return (
    <div className="animate-in fade-in flex items-start gap-2 duration-150 sm:gap-3">
      <div className="relative hidden shrink-0 sm:block">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 sm:h-10 sm:w-10">
          <AgentAvatar seed="Charlotte" size={26} />
        </div>
      </div>
      <Marker role="status" className="w-auto py-2.5">
        <MarkerIcon>
          <Loader2 className="animate-spin text-primary" />
        </MarkerIcon>
        <MarkerContent>{label}</MarkerContent>
      </Marker>
    </div>
  )
}
