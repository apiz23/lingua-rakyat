"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import SmoothDialog from "@/components/smoothui/dialog"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileX,
  Loader2,
  X,
} from "lucide-react"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface PdfPanelProps {
  open: boolean
  url: string
  targetPage: number
  highlightText: string | null
  docName: string
  documentId: string
  language: string
  onClose: () => void
  mobileVariant?: "drawer" | "dialog"
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isDesktop
}

function PdfLoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function PdfErrorState({
  language,
  onRetry,
}: {
  language: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <FileX className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        {language === "ms" ? "Gagal memuatkan PDF." : "Failed to load PDF."}
      </p>
      <button
        onClick={onRetry}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        {language === "ms" ? "Cuba semula" : "Try again"}
      </button>
    </div>
  )
}

interface PdfViewerProps {
  documentId: string
  targetPage: number
  highlightText: string | null
  language: string
}

function PdfViewer({
  documentId,
  targetPage,
  highlightText,
  language,
}: PdfViewerProps) {
  const proxyUrl = `${API_URL}/api/documents/${documentId}/pdf`

  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(targetPage)
  const [hasTextLayer, setHasTextLayer] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(proxyUrl)
  const [panelWidth, setPanelWidth] = useState(440)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Declare before any useEffect that references it
  const activeHighlight = currentPage === targetPage ? highlightText : null

  useEffect(() => {
    setCurrentPage(targetPage)
    setHasTextLayer(null)
  }, [targetPage])

  useEffect(() => {
    setResolvedUrl(`${API_URL}/api/documents/${documentId}/pdf`)
    setLoadError(false)
  }, [documentId])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) =>
      setPanelWidth(entry.contentRect.width)
    )
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Auto-scroll to first highlight mark after text layer renders
  useEffect(() => {
    if (!activeHighlight || !scrollAreaRef.current) return
    const container = scrollAreaRef.current

    const scrollToMark = () => {
      const mark = container.querySelector<HTMLElement>("mark.pdf-hl")
      if (!mark) return false
      mark.scrollIntoView({ behavior: "smooth", block: "center" })
      return true
    }

    if (scrollToMark()) return

    const observer = new MutationObserver(() => {
      if (scrollToMark()) observer.disconnect()
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [currentPage, activeHighlight])

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!activeHighlight || str.trim().length < 3) return str
      const inChunk = activeHighlight
        .toLowerCase()
        .includes(str.toLowerCase().trim())
      if (inChunk) return `<mark class="pdf-hl">${str}</mark>`
      return str
    },
    [activeHighlight]
  )

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {hasTextLayer === false && highlightText && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {language === "ms"
              ? "Penyerlahan teks tidak tersedia untuk dokumen imbasan."
              : "Text highlighting unavailable for scanned documents."}
          </span>
        </div>
      )}

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto bg-[#525659]">
        {loadError ? (
          <PdfErrorState
            language={language}
            onRetry={() => {
              setLoadError(false)
              setResolvedUrl(`${API_URL}/api/documents/${documentId}/pdf`)
            }}
          />
        ) : (
          <Document
            file={resolvedUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError(true)}
            loading={<PdfLoadingSpinner />}
          >
            <Page
              pageNumber={currentPage}
              width={panelWidth - 24}
              customTextRenderer={customTextRenderer}
              onGetTextSuccess={(textContent) =>
                setHasTextLayer(textContent.items.length > 0)
              }
              renderTextLayer={true}
              renderAnnotationLayer={false}
              loading={<PdfLoadingSpinner />}
            />
          </Document>
        )}
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-3">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[11px] text-muted-foreground">
          {language === "ms" ? "Halaman" : "Page"} {currentPage}
          {numPages ? ` / ${numPages}` : ""}
        </span>
        <button
          onClick={() =>
            setCurrentPage((p) => Math.min(numPages ?? p, p + 1))
          }
          disabled={numPages !== null && currentPage >= numPages}
          aria-label="Next page"
          className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
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
        aria-label="Close PDF viewer"
        className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function PdfPanel({
  open,
  targetPage,
  highlightText,
  docName,
  documentId,
  language,
  onClose,
  mobileVariant = "drawer",
}: PdfPanelProps) {
  const isDesktop = useIsDesktop()

  const viewer = (
    <PdfViewer
      documentId={documentId}
      targetPage={targetPage}
      highlightText={highlightText}
      language={language}
    />
  )

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
