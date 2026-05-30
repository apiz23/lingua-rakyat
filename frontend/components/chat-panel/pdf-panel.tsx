"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileX,
  Loader2,
  X,
} from "lucide-react"

// Set worker once, outside component — must match the file copied to public/
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface PdfPanelProps {
  url: string               // Supabase public_url (or signed URL after fallback)
  targetPage: number        // Page to open immediately
  highlightText: string | null  // source.text from the chunk — used for highlighting
  docName: string           // Shown in panel header
  documentId: string        // Used for signed URL fallback fetch
  language: string          // "ms" | "en"
  onClose: () => void
  className?: string
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

export default function PdfPanel({
  url,
  targetPage,
  highlightText,
  docName,
  documentId,
  language,
  onClose,
  className,
}: PdfPanelProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(targetPage)
  const [hasTextLayer, setHasTextLayer] = useState<boolean | null>(null) // null = unknown
  const [loadError, setLoadError] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(url)
  const [panelWidth, setPanelWidth] = useState(420)
  // Mobile only: collapse to header bar so composer stays accessible
  const [collapsed, setCollapsed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track whether the signed URL fallback was already attempted
  const triedSignedRef = useRef(false)

  // When targetPage changes (user clicks a different pill), jump to that page
  useEffect(() => {
    setCurrentPage(targetPage)
    setHasTextLayer(null)
  }, [targetPage])

  // When url prop changes (document switched), reset resolved URL and error
  useEffect(() => {
    setResolvedUrl(url)
    setLoadError(false)
    triedSignedRef.current = false
  }, [url])

  // Abort any in-flight signed URL fetch on unmount
  useEffect(() => {
    return () => {
      signedFetchAbortRef.current?.abort()
    }
  }, [])

  // Track panel container width so the PDF fills the panel at any size
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Only highlight on the targetPage; other pages render without marks
  const activeHighlight = currentPage === targetPage ? highlightText : null

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

  const signedFetchAbortRef = useRef<AbortController | null>(null)

  const fetchSignedUrl = () => {
    signedFetchAbortRef.current?.abort()
    const controller = new AbortController()
    signedFetchAbortRef.current = controller

    fetch(`${API_URL}/api/documents/${documentId}/pdf-url`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("signed url fetch failed")
        return res.json() as Promise<{ url: string }>
      })
      .then(({ url: signedUrl }) => {
        setResolvedUrl(signedUrl)
        setLoadError(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setLoadError(true)
      })
  }

  const handleLoadError = () => {
    if (!triedSignedRef.current) {
      triedSignedRef.current = true
      fetchSignedUrl()
    } else {
      setLoadError(true)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col border-l border-border bg-background",
        className,
        // On mobile collapse to just the header so the composer stays reachable
        collapsed && "!h-10 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {docName}
        </span>
        {/* Collapse toggle — only visible on mobile (hidden at lg breakpoint) */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand PDF viewer" : "Collapse PDF viewer"}
          className="mr-1 shrink-0 lg:hidden"
        >
          {collapsed
            ? <ChevronUp className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
        </button>
        <button onClick={onClose} aria-label="Close PDF viewer" className="shrink-0">
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Scanned PDF banner — shown when PDF has no text layer but highlight was requested */}
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

      {/* PDF canvas — scrollable */}
      <div className="flex-1 overflow-y-auto bg-[#525659]">
        {loadError ? (
          <PdfErrorState
            language={language}
            onRetry={() => {
              setLoadError(false)
              setResolvedUrl(url)
              triedSignedRef.current = false
            }}
          />
        ) : (
          <Document
            file={resolvedUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={handleLoadError}
            loading={<PdfLoadingSpinner />}
          >
            <Page
              pageNumber={currentPage}
              width={panelWidth - 24}
              customTextRenderer={customTextRenderer}
              onGetTextSuccess={(textContent) => {
                setHasTextLayer(textContent.items.length > 0)
              }}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              loading={<PdfLoadingSpinner />}
            />
          </Document>
        )}
      </div>

      {/* Footer — page navigation */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-3">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="disabled:opacity-40"
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
          className="disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
