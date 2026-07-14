"use client"

import { useState } from "react"
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Landmark,
  Loader2,
  Search,
  Upload,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Document } from "@/lib/api"
import { useLanguage } from "@/components/language-provider"
import { useLocalStorageSetting } from "@/hooks/useLocalStorageSetting"
import UploadModal from "@/components/upload-modal"

interface WorkspaceDocRailProps {
  documents: Document[]
  loading: boolean
  selectedDoc: Document | null
  onSelectDoc: (doc: Document) => void
  onReload: () => void
}

const COPY = {
  ms: {
    title: "Dokumen",
    search: "Cari dokumen...",
    upload: "Muat Naik",
    empty: "Tiada dokumen ditemui",
    emptySearch: "Cuba kata kunci lain",
    loading: "Memuatkan...",
    collapse: "Lipat panel dokumen",
    expand: "Buka panel dokumen",
  },
  en: {
    title: "Documents",
    search: "Search documents...",
    upload: "Upload",
    empty: "No documents found",
    emptySearch: "Try a different search",
    loading: "Loading...",
    collapse: "Collapse document panel",
    expand: "Expand document panel",
  },
  zh: {
    title: "文件",
    search: "搜索文件...",
    upload: "上传",
    empty: "未找到文件",
    emptySearch: "请尝试其他关键词",
    loading: "加载中...",
    collapse: "收起文件面板",
    expand: "展开文件面板",
  },
}

function statusIcon(status: Document["status"]) {
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

export default function WorkspaceDocRail({
  documents,
  loading,
  selectedDoc,
  onSelectDoc,
  onReload,
}: WorkspaceDocRailProps) {
  const { language } = useLanguage()
  const copy = COPY[language] ?? COPY.ms
  const [open, setOpen] = useLocalStorageSetting<boolean>("lr-doc-rail-open", true)
  const [search, setSearch] = useState("")
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!open) {
    return (
      <div className="hidden shrink-0 border-r border-border/50 bg-background md:flex md:flex-col md:items-center md:py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy.expand}
          title={copy.expand}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="hidden w-72 shrink-0 flex-col border-r border-border/50 bg-background md:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 p-3">
        <span className="text-sm font-semibold text-foreground">{copy.title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            aria-label={copy.upload}
            title={copy.upload}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.collapse}
            title={copy.collapse}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-border/50 p-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.search}
            className="w-full rounded-md border border-border bg-card py-1.5 pr-2 pl-8 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <FileText className="h-5 w-5" />
            <p>{copy.empty}</p>
            {search && <p>{copy.emptySearch}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDoc(doc)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                  selectedDoc?.id === doc.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  {doc.is_featured ? (
                    <Landmark className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="absolute -top-1 -right-1">
                    {statusIcon(doc.status)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {doc.name}
                  </span>
                  {doc.agency && (
                    <span className="text-[10px] text-muted-foreground">{doc.agency}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => {
          setIsUploadOpen(false)
          onReload()
        }}
      />
    </div>
  )
}
