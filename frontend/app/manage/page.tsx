"use client"

import { useState, useEffect, useRef } from "react"
import {
  Document,
  listDocuments,
  deleteDocument,
  uploadDocument,
} from "@/lib/api"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Search,
  AlertCircle,
  ArrowLeftFromLine,
  RefreshCw,
  ShieldAlert,
  FolderOpen,
  CheckSquare,
  Square,
  Database,
  HardDrive,
  FileCheck,
  Plus,
  FlaskConical,
} from "lucide-react"
import logo from "@/public/icons/android-chrome-512x512.png"
import Image from "next/image"
import UploadModal from "@/components/upload-modal"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const getStatusIcon = (status: Document["status"]) => {
  switch (status) {
    case "ready":
      return <CheckCircle className="h-3.5 w-3.5 text-primary" />
    case "processing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
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

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "rounded-full p-2.5",
              danger ? "bg-destructive/10" : "bg-primary/10"
            )}
          >
            <ShieldAlert
              className={cn(
                "h-5 w-5",
                danger ? "text-destructive" : "text-primary"
              )}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
              danger
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-primary",
}: StatCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-lg">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "rounded-lg bg-primary/5 p-2.5 transition-colors group-hover:bg-primary/10",
            color
          )}
        >
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: "", description: "", onConfirm: () => {} })

  const fetchDocuments = async () => {
    await toast.promise(
      async () => {
        const docs = await listDocuments()
        setDocuments(docs)
        return docs
      },
      {
        loading: "Loading documents...",
        success: "Documents loaded successfully",
        error: (err) => `Failed to load documents: ${err.message}`,
      }
    )
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchDocuments()
      setLoading(false)
    }
    load()
  }, [])

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredDocuments.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredDocuments.map((d) => d.id)))
    }
  }

  // ── Single delete ──────────────────────────────────────────────────────────
  const confirmDelete = (doc: Document) => {
    setConfirmDialog({
      open: true,
      title: "Delete document?",
      description: `"${doc.name}" will be permanently removed from storage and the vector database.`,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        doDelete([doc.id])
      },
    })
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const confirmBulkDelete = () => {
    const count = selected.size
    setConfirmDialog({
      open: true,
      title: `Delete ${count} document${count > 1 ? "s" : ""}?`,
      description: `This will permanently remove ${count} document${count > 1 ? "s" : ""} from storage and the vector database. This cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        doDelete(Array.from(selected))
      },
    })
  }

  const doDelete = async (ids: string[]) => {
    setDeletingIds(new Set(ids))

    await toast.promise(
      async () => {
        let successCount = 0
        const errors: string[] = []

        for (const id of ids) {
          try {
            await deleteDocument(id)
            successCount++
          } catch (err) {
            const doc = documents.find((d) => d.id === id)
            errors.push(
              `${doc?.name || id}: ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }

        if (successCount === 0) {
          throw new Error("No documents were deleted")
        }

        // Update the documents list
        setDocuments((prev) => prev.filter((d) => !ids.includes(d.id)))
        setSelected(new Set())

        return { successCount, totalCount: ids.length, errors }
      },
      {
        loading: `Deleting ${ids.length} document${ids.length > 1 ? "s" : ""}...`,
        success: (data) => {
          const { successCount, totalCount, errors } = data
          if (successCount === totalCount) {
            return `Successfully deleted ${successCount} document${successCount > 1 ? "s" : ""}`
          } else {
            return (
              <div>
                <p className="font-semibold">
                  Deleted {successCount} of {totalCount} documents
                </p>
                {errors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs">
                    {errors.slice(0, 2).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 2 && (
                      <li>...and {errors.length - 2} more errors</li>
                    )}
                  </ul>
                )}
              </div>
            )
          }
        },
        error: (err) => `Failed to delete documents: ${err.message}`,
      }
    )

    setDeletingIds(new Set())
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const allSelected =
    filteredDocuments.length > 0 && selected.size === filteredDocuments.length
  const someSelected = selected.size > 0 && !allSelected

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSize = documents.reduce((acc, d) => acc + d.size_bytes, 0)
  const totalChunks = documents.reduce((acc, d) => acc + d.chunk_count, 0)
  const readyCount = documents.filter((d) => d.status === "ready").length
  const processingCount = documents.filter(
    (d) => d.status === "processing"
  ).length
  const errorCount = documents.filter((d) => d.status === "error").length

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Image
              src={logo}
              alt="LinguaRakyat logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Document Manager
              </h1>
              <p className="text-sm text-muted-foreground">
                Lingua Rakyat · Admin Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLoading(true)
                fetchDocuments().finally(() => setLoading(false))
              }}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/eval"
              className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Eval Dashboard</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <ArrowLeftFromLine className="h-4 w-4" />
              <span className="hidden sm:inline">Back to App</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* ── Stats Row ── */}
        {!loading && documents.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Total Documents"
              value={documents.length}
            />
            <StatCard
              icon={FileCheck}
              label="Ready"
              value={readyCount}
              color="text-primary"
            />
            <StatCard
              icon={Database}
              label="Total Chunks"
              value={totalChunks.toLocaleString()}
              color="text-accent"
            />
            <StatCard
              icon={HardDrive}
              label="Total Size"
              value={formatFileSize(totalSize)}
              color="text-secondary"
            />
          </div>
        )}

        {/* ── Upload Button ── */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Document Library
            </h2>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Upload PDF
            </button>
          </div>
        </section>

        {/* ── Document Table ── */}
        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {(processingCount > 0 || errorCount > 0) && (
                <div className="flex gap-2">
                  {processingCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1">
                      <Loader2 className="h-3 w-3 animate-spin text-accent" />
                      <span className="text-xs text-accent">
                        {processingCount} processing
                      </span>
                    </div>
                  )}
                  {errorCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-destructive">
                        {errorCount} failed
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 rounded-lg border border-border bg-background py-2 pr-4 pl-9 text-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Bulk delete */}
              {selected.size > 0 && (
                <button
                  onClick={confirmBulkDelete}
                  className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete {selected.size}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-border">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading documents...
                </p>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium text-foreground">
                {searchQuery
                  ? "No documents match your search"
                  : "No documents yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery
                  ? "Try a different keyword"
                  : "Click the 'Upload PDF' button above to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {/* Modern Table Design */}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : someSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary/50" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Document
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Size
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Chunks
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDocuments.map((doc) => {
                    const isDeleting = deletingIds.has(doc.id)
                    const isSelected = selected.has(doc.id)

                    return (
                      <tr
                        key={doc.id}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-accent/30",
                          isDeleting && "pointer-events-none opacity-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleSelect(doc.id)}
                            className="flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "shrink-0 rounded-lg p-2",
                                doc.status === "ready" && "bg-primary/10",
                                doc.status === "processing" && "bg-accent/10",
                                doc.status === "error" && "bg-destructive/10"
                              )}
                            >
                              <FileText
                                className={cn(
                                  "h-4 w-4",
                                  doc.status === "ready" && "text-primary",
                                  doc.status === "processing" && "text-accent",
                                  doc.status === "error" && "text-destructive"
                                )}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {doc.name}
                              </p>
                              {doc.status === "error" && doc.error_message && (
                                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                                  <AlertCircle className="h-3 w-3" />
                                  {doc.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {formatFileSize(doc.size_bytes)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {doc.chunk_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {getStatusIcon(doc.status)}
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                                getStatusBadge(doc.status)
                              )}
                            >
                              {doc.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {formatDate(doc.uploaded_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                            ) : (
                              <button
                                onClick={() => confirmDelete(doc)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Table Footer */}
              <div className="border-t border-border bg-secondary/10 px-4 py-3 text-xs text-muted-foreground">
                {selected.size > 0 ? (
                  <span className="font-medium text-foreground">
                    {selected.size} of {filteredDocuments.length} selected
                  </span>
                ) : (
                  <span>
                    Showing {filteredDocuments.length} document
                    {filteredDocuments.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── Upload Modal ── */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={() => {
          fetchDocuments()
          setUploadModalOpen(false)
        }}
      />

      {/* ── Confirm Dialog ── */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
