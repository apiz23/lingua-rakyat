"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { X, Loader2 } from "lucide-react"
import type { SourceChunk } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function ShareSources({ sources }: { sources: SourceChunk[] }) {
  const t = useTranslations()

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const openPdf = useCallback(async (documentId: string) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API_URL}/api/documents/${documentId}/pdf`)
      if (!res.ok) throw new Error("Failed to load")
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const closePdf = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setError(false)
  }, [pdfUrl])

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button
            key={s.document_id}
            onClick={() => openPdf(s.document_id)}
            type="button"
            className="max-w-full cursor-pointer rounded-md border border-border bg-muted/50 px-3 py-1 text-left text-xs break-words text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          >
            {s.doc_name || s.document_id}
            {s.page_start ? ` · ${t("Page")} ${s.page_start}` : ""}
          </button>
        ))}
      </div>

      <Sheet
        open={!!pdfUrl || loading || error}
        onOpenChange={(o) => !o && closePdf()}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex flex-col gap-0 p-0"
          style={{ width: "min(680px, 92vw)", maxWidth: "min(680px, 92vw)" }}
        >
          <SheetTitle className="sr-only">
            <UiText text="PDF" />
          </SheetTitle>
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {" "}
              <UiText text="PDF" />{" "}
            </span>
            <button
              onClick={closePdf}
              aria-label={t("Close")}
              className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : error ? (
              <p role="alert" className="p-4 text-sm text-muted-foreground">
                <UiText text="Failed to load PDF. Close this preview and select the source to try again." />
              </p>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="h-full w-full border-0"
                title={t("PDF")}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
