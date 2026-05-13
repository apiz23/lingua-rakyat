"use client"

import { useEffect, useMemo, useState } from "react"
import { Document, listDocuments } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { cn } from "@/lib/utils"
import UploadModal from "@/components/upload-modal"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  CheckCircle,
  CircleAlert,
  Clock,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  ChevronDown,
  Plus,
  Database,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

const AGENCY_COLORS: Record<string, string> = {
  JPN: "bg-purple-700",
  IMIGRESEN: "bg-blue-700",
}

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false)

  const loadDocuments = async () => {
    setDocsLoading(true)
    try {
      const docs = await listDocuments()
      setDocuments(docs)
      setSelectedDoc((prev) => docs.find((d) => d.id === prev?.id) ?? null)
      return docs
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) =>
      a.uploaded_at < b.uploaded_at ? 1 : -1
    )
  }, [documents])

  const featuredDocs = useMemo(
    () => sortedDocs.filter((d) => d.is_featured && d.status === "ready"),
    [sortedDocs]
  )

  const userDocs = useMemo(
    () => sortedDocs.filter((d) => !d.is_featured),
    [sortedDocs]
  )

  const statusConfig = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return { icon: CheckCircle, color: "text-emerald-500", label: "Ready" }
      case "processing":
        return {
          icon: Loader2,
          color: "text-amber-500 animate-spin",
          label: "Processing",
        }
      case "error":
        return { icon: CircleAlert, color: "text-red-500", label: "Error" }
      default:
        return { icon: Clock, color: "text-muted-foreground", label: "Pending" }
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <ChatPanel
        selectedDoc={selectedDoc}
        composerTop={
          <div className="flex min-w-0 flex-col gap-2 px-1 sm:flex-row sm:justify-between">
            {/* Document Selector */}
            <Popover open={isDocPickerOpen} onOpenChange={setIsDocPickerOpen}>
              <PopoverTrigger asChild>
                <button className="group min-w-0 flex w-full flex-1 items-center justify-between border border-border bg-card px-3 py-2 text-sm transition-all hover:border-primary/30 hover:bg-accent/50 sm:max-w-[30vw]">
                  <div className="flex items-center gap-2 truncate">
                    {selectedDoc ? (
                      <>
                        {(() => {
                          const { icon: Icon, color } = statusConfig(
                            selectedDoc.status
                          )
                          return (
                            <Icon
                              className={cn("h-3.5 w-3.5 shrink-0", color)}
                            />
                          )
                        })()}
                        <span className="truncate font-medium">
                          {selectedDoc.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Select document
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                className="w-[calc(100vw-2rem)] p-0 sm:w-full"
                sideOffset={8}
              >
                <div className="flex flex-col">
                  <ScrollArea className="max-h-60 sm:max-h-80">
                    <div className="p-2 sm:p-1">
                      {/* No document option */}
                      <button
                        onClick={() => {
                          setSelectedDoc(null)
                          setIsDocPickerOpen(false)
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                          !selectedDoc && "bg-primary/5 text-primary"
                        )}
                      >
                        <Database className="h-4 w-4" />
                        <span>No document</span>
                      </button>

                      {/* Featured gov docs section */}
                      {featuredDocs.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Featured — Malaysian Gov Docs
                          </div>
                          {featuredDocs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDoc(doc)
                                setIsDocPickerOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                                selectedDoc?.id === doc.id && "bg-primary/5"
                              )}
                            >
                              {doc.agency && (
                                <div
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white",
                                    AGENCY_COLORS[doc.agency] ?? "bg-muted"
                                  )}
                                >
                                  {doc.agency}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-sm">{doc.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {doc.agency} · Official document
                                </div>
                              </div>
                              <span className="shrink-0 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                READY
                              </span>
                            </button>
                          ))}
                          {userDocs.length > 0 && (
                            <div className="mt-1 border-t border-border px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Your Uploads
                            </div>
                          )}
                        </>
                      )}

                      {/* User uploaded docs */}
                      {docsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="mx-1 my-0.5 h-9 animate-pulse bg-muted/40" />
                        ))
                      ) : userDocs.length === 0 && featuredDocs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No documents yet
                        </div>
                      ) : (
                        userDocs.map((doc) => {
                          const {
                            icon: Icon,
                            color,
                            label,
                          } = statusConfig(doc.status)
                          return (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDoc(doc)
                                setIsDocPickerOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent sm:py-2",
                                selectedDoc?.id === doc.id && "bg-primary/5"
                              )}
                            >
                              <Icon className={cn("h-4 w-4 shrink-0", color)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium">
                                    {doc.name}
                                  </span>
                                  <span className="border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {label}
                                  </span>
                                </div>
                              </div>
                              {selectedDoc?.id === doc.id && (
                                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>

            {/* Refresh Button */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh documents"
                onClick={loadDocuments}
                disabled={docsLoading}
                className="h-10 w-10 sm:h-full sm:w-fit sm:p-3"
              >
                {docsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" />
                ) : (
                  <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                )}
              </Button>

              {/* Upload Button */}
              <Button
                size="icon"
                aria-label="Upload document"
                onClick={() => setIsUploadOpen(true)}
                className="h-10 w-10 shrink-0 bg-primary shadow-sm hover:bg-primary/90 sm:h-full sm:w-fit sm:p-3"
              >
                <Upload className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </Button>
            </div>
          </div>
        }
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={async () => {
          const docs = await loadDocuments()
          const latest = docs?.sort((a, b) =>
            a.uploaded_at < b.uploaded_at ? 1 : -1
          )[0]
          if (latest) setSelectedDoc(latest)
        }}
      />
    </div>
  )
}
