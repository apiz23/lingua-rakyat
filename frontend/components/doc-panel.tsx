// src/components/doc-panel.tsx
"use client"

import { useState, useEffect } from "react"
import { Document, listDocuments } from "@/lib/api"
import { toast } from "sonner"
import {
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useMobile } from "@/hooks/use-mobile"
import UploadModal from "./upload-modal"

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
  const isMobile = useMobile()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const docs = await listDocuments()
      setDocuments(docs)
    } catch (error) {
      toast.error("Failed to load documents", {
        description:
          error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

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
      return `Today at ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
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
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeftFromLine className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
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
            Upload Document
          </button>
        </div>

        {/* Document Stats */}
        {!loading && documents.length > 0 && (
          <div className="border-t border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {documents.length} document{documents.length > 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground">
                {documents.filter((d) => d.status === "ready").length} ready
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
              <p className="text-sm text-muted-foreground">
                Loading documents...
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
              <div className="rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="font-medium">No documents found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try a different search"
                    : "Upload your first PDF to get started"}
                </p>
              </div>

              {/* Mobile upload button in empty state */}
              {isMobile && (
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg"
                >
                  <Upload className="h-4 w-4" />
                  Upload Your First Document
                </button>
              )}
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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size_bytes)}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {doc.chunk_count} chunks
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          getStatusBadge(doc.status)
                        )}
                      >
                        {doc.status}
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
      {isMobile && documents.length > 0 && (
        <button
          onClick={() => setIsUploadOpen(true)}
          className="fixed right-4 bottom-20 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-95"
          aria-label="Upload document"
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
