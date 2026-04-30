"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Document,
  listDocuments,
  deleteDocument,
  renameDocument,
} from "@/lib/api"
import { toast } from "sonner"
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
  RefreshCw,
  ShieldAlert,
  FolderOpen,
  CheckSquare,
  Square,
  HardDrive,
  FileCheck,
  Plus,
  Pencil,
} from "lucide-react"
import UploadModal from "@/components/upload-modal"
import { useLanguage } from "@/components/language-provider"
import PageIntro from "@/components/page-intro"

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
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm duration-150">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-sm border border-border bg-card p-6 shadow-2xl duration-200">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "p-2.5",
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
            className="border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white transition-colors active:scale-[0.97]",
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
  icon: React.ComponentType<{ className?: string }>
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
    <div className="group border border-border bg-card/40 p-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "bg-primary/5 p-2.5 transition-colors group-hover:bg-primary/10",
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
  const { language } = useLanguage()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean
    document: Document | null
    name: string
    token: string
    error: string
  }>({ open: false, document: null, name: "", token: "", error: "" })
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: "", description: "", onConfirm: () => {} })

  // Add a ref to track if initial load has been done
  const initialLoadDone = useRef(false)
  // Add a ref to prevent duplicate toast calls
  const isFetching = useRef(false)

  const copy =
    language === "ms"
      ? {
          loading: "Memuatkan dokumen...",
          loaded: "Dokumen berjaya dimuatkan",
          loadError: "Gagal memuatkan dokumen",
          manager: "Pengurusan Dokumen",
          adminPortal: "Portal Pentadbir",
          refresh: "Muat Semula",
          eval: "Papan Penilaian",
          benchmark: "Makmal Benchmark",
          back: "Kembali ke Aplikasi",
          totalDocs: "Jumlah Dokumen",
          ready: "Sedia",
          totalSize: "Jumlah Saiz",
          library: "Pustaka Dokumen",
          uploadPdf: "Muat Naik PDF",
          search: "Cari dokumen...",
          introTag: "Portal Dokumen",
          introBody:
            "Urus fail yang telah dimuat naik, semak status pemprosesan, dan kekalkan perpustakaan dokumen dalam satu susun atur yang konsisten.",
          processing: "Sedang Diproses",
          failed: "Gagal",
          tableDoc: "Dokumen",
          tableUploaded: "Dimuat Naik",
          tableActions: "Tindakan",
          noMatchDocs: "Tiada dokumen sepadan dengan carian anda",
          noMatchHint: "Cuba kata kunci lain",
          noDocs: "Belum ada dokumen",
          noDocsHint: "Klik butang 'Muat Naik PDF' di atas untuk bermula",
          uploadFirstBtn: "Muat Naik Dokumen Pertama",
          cancelBtn: "Batal",
          confirmDeleteBtn: "Padam",
          confirmDeleteTitle: "Padam dokumen ini?",
          deleteFailed: "Gagal memadam dokumen",
          deleteAll: "Tiada dokumen berjaya dipadam",
          moreErrors: "lagi ralat",
          of: "daripada",
          selected: "dipilih",
          showing: "Memaparkan",
          docs: "dokumen",
        }
      : {
          loading: "Loading documents...",
          loaded: "Documents loaded successfully",
          loadError: "Failed to load documents",
          manager: "Document Manager",
          adminPortal: "Admin Portal",
          refresh: "Refresh",
          eval: "Eval Dashboard",
          benchmark: "Benchmark Lab",
          back: "Back to App",
          totalDocs: "Total Documents",
          ready: "Ready",
          totalSize: "Total Size",
          library: "Document Library",
          uploadPdf: "Upload PDF",
          search: "Search documents...",
          introTag: "Document Portal",
          introBody:
            "Manage uploaded files, review processing status, and keep the document library organized in one consistent workspace.",
          processing: "Processing",
          failed: "Failed",
          tableDoc: "Document",
          tableUploaded: "Uploaded",
          tableActions: "Actions",
          noMatchDocs: "No documents match your search",
          noMatchHint: "Try a different keyword",
          noDocs: "No documents yet",
          noDocsHint: "Click 'Upload PDF' above to get started",
          uploadFirstBtn: "Upload First Document",
          cancelBtn: "Cancel",
          confirmDeleteBtn: "Delete",
          confirmDeleteTitle: "Delete this document?",
          deleteFailed: "Failed to delete documents",
          deleteAll: "No documents were deleted",
          moreErrors: "more errors",
          of: "of",
          selected: "selected",
          showing: "Showing",
          docs: "documents",
        }

  const fetchDocuments = useCallback(
    async (showToast = true) => {
      // Prevent multiple simultaneous fetches
      if (isFetching.current) return

      isFetching.current = true

      try {
        const docs = await listDocuments()
        setDocuments(docs)
        return docs
      } catch (error) {
        if (showToast) {
          toast.error(
            `${copy.loadError}: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        }
        throw error
      } finally {
        isFetching.current = false
      }
    },
    [copy.loadError]
  )

  // Separate function for manual refresh with toast
  const refreshDocuments = useCallback(async () => {
    await toast.promise(fetchDocuments(true), {
      loading: copy.loading,
      success: copy.loaded,
      error: (err) => `${copy.loadError}: ${err.message}`,
    })
  }, [fetchDocuments, copy.loading, copy.loaded, copy.loadError])

  // Initial load - only once
  useEffect(() => {
    const load = async () => {
      if (initialLoadDone.current) return
      initialLoadDone.current = true

      setLoading(true)
      try {
        await fetchDocuments(false) // No toast on initial load
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchDocuments])

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
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
      title: copy.confirmDeleteTitle,
      description:
        language === "ms"
          ? `"${doc.name}" akan dipadam secara kekal daripada storan dan pangkalan data vektor.`
          : `"${doc.name}" will be permanently deleted from storage and the vector database.`,
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
      title:
        language === "ms"
          ? `Padam ${count} dokumen?`
          : `Delete ${count} documents?`,
      description:
        language === "ms"
          ? `Tindakan ini akan memadam ${count} dokumen secara kekal daripada storan dan pangkalan data vektor. Tindakan ini tidak boleh dibatalkan.`
          : `This will permanently delete ${count} documents from storage and the vector database. This action cannot be undone.`,
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
          throw new Error(copy.deleteAll)
        }

        setDocuments((prev) => prev.filter((d) => !ids.includes(d.id)))
        setSelected(new Set())

        return { successCount, totalCount: ids.length, errors }
      },
      {
        loading:
          language === "ms"
            ? `Memadam ${ids.length} dokumen...`
            : `Deleting ${ids.length} documents...`,
        success: (data) => {
          const { successCount, totalCount, errors } = data
          if (successCount === totalCount) {
            return language === "ms"
              ? `${successCount} dokumen berjaya dipadam`
              : `${successCount} documents deleted`
          } else {
            return (
              <div>
                <p className="font-semibold">
                  {language === "ms"
                    ? `${successCount} ${copy.of} ${totalCount} dokumen berjaya dipadam`
                    : `${successCount} ${copy.of} ${totalCount} documents deleted`}
                </p>
                {errors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs">
                    {errors.slice(0, 2).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 2 && (
                      <li>
                        ...{language === "ms" ? "dan" : "and"} {errors.length - 2} {copy.moreErrors}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          }
        },
        error: (err) => `${copy.deleteFailed}: ${err.message}`,
      }
    )

    setDeletingIds(new Set())
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const openRenameDialog = (doc: Document) => {
    setRenameDialog({
      open: true,
      document: doc,
      name: doc.name,
      token: "",
      error: "",
    })
  }

  const closeRenameDialog = () => {
    setRenameDialog({ open: false, document: null, name: "", token: "", error: "" })
  }

  const doRename = async () => {
    const doc = renameDialog.document
    const name = renameDialog.name.trim()
    const token = renameDialog.token.trim()

    if (!doc) return
    if (!name) {
      toast.error(
        language === "ms" ? "Nama fail diperlukan" : "File name is required"
      )
      return
    }
    if (!token) {
      toast.error(language === "ms" ? "Token diperlukan" : "Token is required")
      return
    }

    setRenamingId(doc.id)
    setRenameDialog((prev) => ({ ...prev, error: "" }))
    try {
      const updated = await renameDocument(doc.id, name, token)
      setDocuments((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
      toast.success(language === "ms" ? "Nama dokumen dikemas kini" : "Document renamed")
      closeRenameDialog()
    } catch (err) {
      const msg = err instanceof Error ? err.message : language === "ms" ? "Gagal menamakan semula" : "Rename failed"
      setRenameDialog((prev) => ({ ...prev, error: msg }))
    } finally {
      setRenamingId(null)
    }
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const allSelected =
    filteredDocuments.length > 0 && selected.size === filteredDocuments.length
  const someSelected = selected.size > 0 && !allSelected

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSize = documents.reduce((acc, d) => acc + d.size_bytes, 0)
  const readyCount = documents.filter((d) => d.status === "ready").length
  const processingCount = documents.filter(
    (d) => d.status === "processing"
  ).length
  const errorCount = documents.filter((d) => d.status === "error").length

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <PageIntro
          eyebrow={copy.introTag}
          title={copy.manager}
          description={copy.introBody}
          icon={FileText}
          actions={
            <button
              onClick={refreshDocuments}
              disabled={loading || isFetching.current}
              className="flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (loading || isFetching.current) && "animate-spin"
                )}
              />
              <span>{copy.refresh}</span>
            </button>
          }
        />

        {/* ── Stats Row ── */}
        {!loading && documents.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              icon={FileText}
              label={copy.totalDocs}
              value={documents.length}
            />
            <StatCard
              icon={FileCheck}
              label={copy.ready}
              value={readyCount}
              color="text-primary"
            />

            <StatCard
              icon={HardDrive}
              label={copy.totalSize}
              value={formatFileSize(totalSize)}
              color="text-secondary"
            />
          </div>
        )}

        {/* ── Upload Button ── */}
        <section>
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={copy.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 border border-border bg-background py-2 pr-4 pl-9 text-sm transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-between gap-4">
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {copy.uploadPdf}
              </button>
            </div>
          </div>
        </section>

        {/* ── Document Table ── */}
        <section>
          <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            {copy.library}
          </p>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {(processingCount > 0 || errorCount > 0) && (
                <div className="flex gap-2">
                  {processingCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1">
                      <Loader2 className="h-3 w-3 animate-spin text-accent" />
                      <span className="text-xs text-accent">
                        {processingCount} {copy.processing}
                      </span>
                    </div>
                  )}
                  {errorCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-destructive">
                        {errorCount} {copy.failed}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Bulk delete */}
              {selected.size > 0 && (
                <button
                  onClick={confirmBulkDelete}
                  className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                  {language === "ms" ? `Padam ${selected.size}` : `Delete ${selected.size}`}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center border border-border">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {copy.loading}
                </p>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center border-2 border-dashed border-border text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium text-foreground">
                {searchQuery ? copy.noMatchDocs : copy.noDocs}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery ? copy.noMatchHint : copy.noDocsHint}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="mt-4 flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  {copy.uploadFirstBtn}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden border border-border bg-card/40 backdrop-blur-sm">
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
                      {copy.tableDoc}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {language === "ms" ? "Saiz" : "Size"}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {copy.tableUploaded}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {copy.tableActions}
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
                                "shrink-0 p-2",
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
                          <div className="flex justify-center gap-1">
                            {isDeleting || renamingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                            ) : (
                              <>
                                <button
                                  onClick={() => openRenameDialog(doc)}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                  title={
                                    language === "ms"
                                      ? "Tukar nama dokumen"
                                      : "Rename document"
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => confirmDelete(doc)}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  title="Padam dokumen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
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
                    {selected.size} {copy.of} {filteredDocuments.length} {copy.selected}
                  </span>
                ) : (
                  <span>{copy.showing} {filteredDocuments.length} {copy.docs}</span>
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
          refreshDocuments()
          setUploadModalOpen(false)
        }}
      />

      {/* ── Confirm Dialog ── */}
      {renameDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-md border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-2.5">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {language === "ms" ? "Tukar nama dokumen" : "Rename document"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === "ms"
                    ? "Masukkan nama fail baharu dan token pentadbir untuk mengesahkan perubahan."
                    : "Enter the new file name and admin token to confirm this change."}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {language === "ms" ? "Nama fail" : "File name"}
                </span>
                <input
                  value={renameDialog.name}
                  onChange={(event) =>
                    setRenameDialog((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Token
                </span>
                <input
                  value={renameDialog.token}
                  type="password"
                  onChange={(event) =>
                    setRenameDialog((prev) => ({
                      ...prev,
                      token: event.target.value,
                    }))
                  }
                  className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </label>
            </div>

            {renameDialog.error && (
              <div className="mt-4 flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {renameDialog.error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeRenameDialog}
                className="border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {language === "ms" ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={doRename}
                disabled={renamingId !== null}
                className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {renamingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : language === "ms" ? "Simpan" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={copy.confirmDeleteBtn}
        cancelLabel={copy.cancelBtn}
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
