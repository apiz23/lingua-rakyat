// src/components/doc-panel.tsx
"use client"

import { useState, useEffect } from "react"
import { Document, listDocuments } from "@/lib/api"
import { toast } from "sonner"
import {
  BarChart3,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Search,
  AlertCircle,
  ArrowLeftFromLine,
  Plus,
  RotateCcw,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useLanguage } from "./language-provider"
import UploadModal from "./upload-modal"
import { Button } from "./ui/button"

interface DocumentPanelProps {
  selectedDoc: Document | null
  onSelectDoc: (doc: Document | null) => void
}

export default function DocumentPanel({
  selectedDoc,
  onSelectDoc,
}: DocumentPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isReloading, setIsReloading] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const { language } = useLanguage()
  const copy =
    language === "ms"
      ? {
          loadError: "Gagal memuatkan dokumen",
          retry: "Sila cuba lagi",
          reloadSuccess: "Senarai dokumen berjaya dimuat semula",
          reloadError: "Gagal memuat semula dokumen",
          ready: "sedia",
          processing: "sedang diproses",
          error: "ralat",
          today: "Hari ini",
          yesterday: "Semalam",
          daysAgo: "hari lalu",
          reloadTitle: "Muat semula senarai dokumen",
          evalTitle: "Papan penilaian",
          benchmarkTitle: "Makmal benchmark",
          back: "Kembali",
          search: "Cari dokumen...",
          upload: "Muat Naik Dokumen",
          documents: "dokumen",
          loading: "Memuatkan dokumen...",
          empty: "Tiada dokumen ditemui",
          emptySearch: "Cuba kata kunci lain",
          emptyUpload: "Muat naik PDF pertama untuk bermula",
          firstUpload: "Muat Naik Dokumen Pertama",
          uploadAria: "Muat naik dokumen",
        }
      : {
          loadError: "Failed to load documents",
          retry: "Please try again",
          reloadSuccess: "Document list reloaded",
          reloadError: "Failed to reload documents",
          ready: "ready",
          processing: "processing",
          error: "error",
          today: "Today",
          yesterday: "Yesterday",
          daysAgo: "days ago",
          reloadTitle: "Reload document list",
          evalTitle: "Evaluation dashboard",
          benchmarkTitle: "Benchmark lab",
          back: "Back",
          search: "Search documents...",
          upload: "Upload Document",
          documents: "documents",
          loading: "Loading documents...",
          empty: "No documents found",
          emptySearch: "Try a different search",
          emptyUpload: "Upload your first PDF to get started",
          firstUpload: "Upload Your First Document",
          uploadAria: "Upload document",
        }

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const docs = await listDocuments()
      setDocuments(docs)
    } catch (error) {
      toast.error(copy.loadError, {
        description: error instanceof Error ? error.message : copy.retry,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Reload button handler
  const handleReload = async () => {
    setIsReloading(true)
    try {
      const docs = await listDocuments()
      setDocuments(docs)
      toast.success(copy.reloadSuccess)
    } catch (error) {
      toast.error(copy.reloadError, {
        description: error instanceof Error ? error.message : copy.retry,
      })
    } finally {
      setIsReloading(false)
    }
  }

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="h-3 w-3 text-primary" />
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-accent" />
      case "error":
        return <XCircle className="h-3 w-3 text-destructive" />
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return "bg-primary/10 text-primary border-primary/20"
      case "processing":
        return "bg-accent/10 text-accent border-accent/20"
      case "error":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStatusLabel = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return copy.ready
      case "processing":
        return copy.processing
      case "error":
        return copy.error
      default:
        return status
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `${copy.today}, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays === 1) {
      return `${copy.yesterday}, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays < 7) {
      return `${diffDays} ${copy.daysAgo}`
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    }
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative flex h-full flex-col bg-card">
      {/* Header - Fixed at top */}
      <div className="flex-none border-b border-border bg-linear-to-b from-background to-card">
        <div className="p-4">
          {/* Title and Back button */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              Lingua Rakyat
            </h1>
            <div className="flex items-center gap-2">
              {/* Reload button */}
              <Button
                onClick={handleReload}
                disabled={isReloading}
                className="rounded-lg p-2 text-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                title={copy.reloadTitle}
              >
                <RotateCcw
                  className={cn("h-4 w-4", isReloading && "animate-spin")}
                />
              </Button>
              <Link
                href="/eval"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
                title={copy.evalTitle}
              >
                <FlaskConical className="h-4 w-4" />
              </Link>
              <Link
                href="/benchmark"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
                title={copy.benchmarkTitle}
              >
                <BarChart3 className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
              >
                <ArrowLeftFromLine className="h-4 w-4" />
                <span className="hidden sm:inline">{copy.back}</span>
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={copy.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pr-4 pl-9 text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Upload button - Hidden on mobile (will use floating button) */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-4 hidden w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 md:flex"
          >
            <Upload className="h-4 w-4" />
            {copy.upload}
          </button>
        </div>

        {/* Document Stats */}
        {!loading && documents.length > 0 && (
          <div className="border-t border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {documents.length} {copy.documents}
              </span>
              <span className="text-muted-foreground">
                {documents.filter((d) => d.status === "ready").length}{" "}
                {copy.ready}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Document List - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="space-y-2 p-3">
          {loading ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{copy.loading}</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
              <div className="rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="font-medium">{copy.empty}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery ? copy.emptySearch : copy.emptyUpload}
                </p>
              </div>

              {/* Mobile upload button in empty state */}
              <div className="md:hidden">
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg"
                >
                  <Upload className="h-4 w-4" />
                  {copy.firstUpload}
                </button>
              </div>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className={cn(
                  "group relative cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md",
                  selectedDoc?.id === doc.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/50 hover:bg-accent/20"
                )}
              >
                {/* Selection indicator */}
                {selectedDoc?.id === doc.id && (
                  <div className="absolute top-0 left-0 h-full w-1 rounded-l-lg bg-primary" />
                )}

                <div className="flex items-start gap-3">
                  {/* Document icon with status indicator */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        doc.status === "ready" && "bg-primary/10",
                        doc.status === "processing" && "bg-accent/10",
                        doc.status === "error" && "bg-destructive/10"
                      )}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      {getStatusIcon(doc.status)}
                    </div>
                  </div>

                  {/* Document info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>

                    {/* Metadata row */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size_bytes)} • PDF
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          getStatusBadge(doc.status)
                        )}
                      >
                        {getStatusLabel(doc.status)}
                      </span>
                    </div>

                    {/* Upload time */}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(doc.uploaded_at)}
                    </p>

                    {/* Error message if any */}
                    {doc.status === "error" && doc.error_message && (
                      <div className="mt-2 flex items-start gap-1.5 rounded bg-destructive/10 p-2">
                        <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">
                          {doc.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile Floating Upload Button - Only show when there are documents */}
      {documents.length > 0 && (
        <button
          onClick={() => setIsUploadOpen(true)}
          className="fixed right-4 bottom-20 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-95 md:hidden"
          aria-label={copy.uploadAria}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => {
          setIsUploadOpen(false)
          fetchDocuments()
        }}
      />
    </div>
  )
}
