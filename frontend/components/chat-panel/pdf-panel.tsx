"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { initSync, render } from "takumi-pdf/no-init"
import { Document, Page, View } from "@/lib/pdf-primitives"
import { Text } from "@/components/pdf/text/text"
import { PdfcnThemeProvider } from "@/components/pdf/theme-provider"
import { professionalTheme } from "@/components/pdf/theme-professional"
import type { Document as AppDocument } from "@/lib/api"
import type { Message } from "./message-cards"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import SmoothDialog from "@/components/smoothui/dialog"
import { FileX, Loader2, RefreshCw, X } from "lucide-react"

// takumi-pdf ships a wasm-bindgen "no-init" entry that does NOT touch the
// wasm module at import time. We fetch the binary (copied to /public) and
// instantiate it once with initSync — no bundler `?url`/`?module` tricks that
// Turbopack can't resolve.
let wasmInit: Promise<void> | null = null
function ensureWasm() {
  if (!wasmInit) {
    wasmInit = (async () => {
      const res = await fetch("/takumi_pdf_wasm_bg.wasm")
      if (!res.ok) throw new Error("Failed to load takumi PDF wasm")
      initSync(await res.arrayBuffer())
    })()
  }
  return wasmInit
}

export interface PdfPanelProps {
  open: boolean
  docName: string
  document: AppDocument | null
  messages: Message[]
  language: string
  onClose: () => void
  mobileVariant?: "drawer" | "dialog"
  // Retained for backward compatibility with the old react-pdf viewer;
  // the generated preview does not use them.
  url?: string
  targetPage?: number
  highlightText?: string | null
  documentId?: string
}

const COPY: Record<string, { summary: string; meta: string; conversation: string; question: string; answer: string; noConversation: string; failed: string; retry: string; generating: string }> = {
  ms: {
    summary: "Ringkasan Dokumen",
    meta: "Maklumat Dokumen",
    conversation: "Ringkasan Perbualan",
    question: "Soalan",
    answer: "Jawapan",
    noConversation: "Belum ada perbualan untuk dokumen ini.",
    failed: "Gagal menjana PDF.",
    retry: "Cuba semula",
    generating: "Menjana PDF…",
  },
  en: {
    summary: "Document Summary",
    meta: "Document Info",
    conversation: "Conversation Summary",
    question: "Question",
    answer: "Answer",
    noConversation: "No conversation yet for this document.",
    failed: "Failed to generate PDF.",
    retry: "Try again",
    generating: "Generating PDF…",
  },
  "zh-cn": {
    summary: "文件摘要",
    meta: "文件信息",
    conversation: "对话摘要",
    question: "问题",
    answer: "回答",
    noConversation: "此文件还没有对话。",
    failed: "生成 PDF 失败。",
    retry: "重试",
    generating: "正在生成 PDF…",
  },
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

interface SummaryDocumentProps {
  doc: AppDocument | null
  messages: Message[]
  language: string
}

function SummaryDocument({ doc, messages, language }: SummaryDocumentProps) {
  const copy = COPY[language] ?? COPY.en
  const t = professionalTheme
  const recent = messages.slice(-15)

  const metaRow = (label: string, value: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
      <Text variant="sm" color="mutedForeground" noMargin style={{ width: 140 }}>
        {label}
      </Text>
      <Text variant="sm" weight="medium" noMargin style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  )

  return (
    <Document title={doc?.name ?? "Lingua Rakyat"}>
      <Page>
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
            paddingBottom: t.spacing.componentGap,
            marginBottom: t.spacing.sectionGap,
          }}
        >
          <Text variant="xs" weight="bold" transform="uppercase" color="mutedForeground" noMargin>
            Lingua Rakyat · {copy.summary}
          </Text>
          <Text variant="3xl" weight="bold" noMargin style={{ marginTop: 6 }}>
            {doc?.name ?? "Lingua Rakyat"}
          </Text>
        </View>

        <View style={{ marginBottom: t.spacing.sectionGap }}>
          <Text variant="lg" weight="bold" noMargin style={{ marginBottom: t.spacing.componentGap }}>
            {copy.meta}
          </Text>
          {doc ? (
            <>
              {doc.agency ? metaRow("Agency", doc.agency) : null}
              {metaRow("Status", doc.status)}
              {metaRow("Size", formatFileSize(doc.size_bytes))}
              {metaRow("Chunks", String(doc.chunk_count))}
              {metaRow("Uploaded", formatDate(doc.uploaded_at))}
            </>
          ) : (
            <Text variant="sm" color="mutedForeground" noMargin>
              —
            </Text>
          )}
        </View>

        <View style={{ marginBottom: t.spacing.sectionGap }}>
          <Text variant="lg" weight="bold" noMargin style={{ marginBottom: t.spacing.componentGap }}>
            {copy.conversation}
          </Text>
          {recent.length === 0 ? (
            <Text variant="sm" color="mutedForeground" noMargin>
              {copy.noConversation}
            </Text>
          ) : (
            recent.map((m, i) => (
              <View key={m.id || i} style={{ marginBottom: t.spacing.sectionGap, breakInside: "avoid" }}>
                <Text variant="sm" weight="bold" transform="uppercase" color="mutedForeground" noMargin>
                  {copy.question}
                </Text>
                <Text variant="base" weight="semibold" noMargin style={{ marginTop: 2, marginBottom: 8 }}>
                  {stripMarkdown(m.question)}
                </Text>
                <Text variant="sm" weight="bold" transform="uppercase" color="mutedForeground" noMargin>
                  {copy.answer}
                </Text>
                <Text variant="sm" noMargin style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>
                  {stripMarkdown(m.answer)}
                </Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  )
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  )
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isDesktop
}

function GeneratedPdfViewer({
  doc,
  messages,
  language,
}: {
  doc: AppDocument | null
  messages: Message[]
  language: string
}) {
  const copy = COPY[language] ?? COPY.en
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [generating, setGenerating] = useState(true)
  const requestRef = useRef(0)

  const generate = useCallback(async () => {
    const requestId = ++requestRef.current
    setGenerating(true)
    setError(false)
    try {
      await ensureWasm()
      const tree = (
        <PdfcnThemeProvider theme={professionalTheme}>
          <SummaryDocument doc={doc} messages={messages} language={language} />
        </PdfcnThemeProvider>
      )
      const bytes = await render(tree, {
        size: "a4",
        margin: {
          top: 72,
          right: 64,
          bottom: 96,
          left: 64,
        },
        footer: (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              fontSize: 10,
              color: "#71717a",
              paddingTop: 8,
            }}
          >
            Lingua Rakyat · Page <span className="pageNumber" /> of{" "}
            <span className="totalPages" />
          </div>
        ),
        metadata: {
          title: doc?.name ?? "Lingua Rakyat",
          creator: "Lingua Rakyat",
          creationDate: new Date().toISOString().slice(0, 10),
        },
        lang: language,
      })
      if (requestId !== requestRef.current) return
      const exact = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer
      const blob = new Blob([exact], { type: "application/pdf" })
      const objectUrl = URL.createObjectURL(blob)
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return objectUrl
      })
    } catch {
      if (requestId === requestRef.current) setError(true)
    } finally {
      if (requestId === requestRef.current) setGenerating(false)
    }
  }, [doc, messages, language])

  useEffect(() => {
    generate()
  }, [generate])

  useEffect(() => {
    return () => {
      requestRef.current += 1
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (generating) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{copy.generating}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <FileX className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{copy.failed}</p>
        <button
          onClick={generate}
          className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          {copy.retry}
        </button>
      </div>
    )
  }

  return (
    <iframe
      src={url ?? undefined}
      title={doc?.name ?? "PDF preview"}
      className="h-full w-full border-0 bg-white"
    />
  )
}

function PanelHeader({
  docName,
  onClose,
}: {
  docName: string
  onClose: () => void
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {docName}
      </span>
      <button
        onClick={onClose}
        aria-label="Close PDF preview"
        className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function PdfPanel({
  open,
  docName,
  document,
  messages,
  language,
  onClose,
  mobileVariant = "drawer",
}: PdfPanelProps) {
  const isDesktop = useIsDesktop()

  const viewer = open ? (
    <GeneratedPdfViewer doc={document} messages={messages} language={language} />
  ) : null

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex flex-col gap-0 p-0"
          style={{ width: "min(680px, 92vw)", maxWidth: "min(680px, 92vw)" }}
        >
          <SheetTitle className="sr-only">{docName}</SheetTitle>
          <PanelHeader docName={docName} onClose={onClose} />
          <div className="min-h-0 flex-1">{viewer}</div>
        </SheetContent>
      </Sheet>
    )
  }

  if (mobileVariant === "dialog") {
    return (
      <SmoothDialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        showCloseButton={false}
        className="max-w-[min(95vw,540px)] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col" style={{ height: "80vh" }}>
          <PanelHeader docName={docName} onClose={onClose} />
          <div className="min-h-0 flex-1">{viewer}</div>
        </div>
      </SmoothDialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="flex max-h-[80vh] flex-col gap-0 p-0">
        <DrawerTitle className="sr-only">{docName}</DrawerTitle>
        <PanelHeader docName={docName} onClose={onClose} />
        <div className="min-h-0 flex-1">{viewer}</div>
      </DrawerContent>
    </Drawer>
  )
}