"use client"

import { useEffect, useMemo, useState } from "react"
import { Document, listDocuments } from "@/lib/api"
import ChatPanel from "@/components/chat-panel"
import { cn } from "@/lib/utils"
import UploadModal from "@/components/upload-modal"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"

const AGENCY_COLORS: Record<string, string> = {
  JPN: "bg-purple-700",
  IMIGRESEN: "bg-blue-700",
}

const QUICK_STARTS = [
  "Summarize this document",
  "Siapa yang layak memohon?",
  "What documents do I need?",
  "Bagaimana cara memohon langkah demi langkah?",
]

const FEATURED_DOC_NAMES = new Set([
  "MyKad FAQ (JPN)",
  "Malaysian Passport Guidelines",
])

const FEATURED_DOC_NAME_AGENCY: Record<string, string> = {
  "MyKad FAQ (JPN)": "JPN",
  "Malaysian Passport Guidelines": "IMIGRESEN",
}

function getAgency(doc: { name: string; agency?: string }): string | undefined {
  return doc.agency ?? FEATURED_DOC_NAME_AGENCY[doc.name]
}

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false)
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>()

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

  useEffect(() => {
    setInitialQuestion(undefined)
  }, [selectedDoc?.id])

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) =>
      a.uploaded_at < b.uploaded_at ? 1 : -1
    )
  }, [documents])

  const featuredDocs = useMemo(
    () =>
      sortedDocs.filter(
        (d) =>
          (d.is_featured || FEATURED_DOC_NAMES.has(d.name)) &&
          d.status === "ready"
      ),
    [sortedDocs]
  )

  const userDocs = useMemo(
    () =>
      sortedDocs.filter(
        (d) => !d.is_featured && !FEATURED_DOC_NAMES.has(d.name)
      ),
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
        initialQuestion={initialQuestion}
        composerTop={
          <div className="space-y-3 px-1 sm:space-y-4">
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              {/* Document Selector */}
              <Popover open={isDocPickerOpen} onOpenChange={setIsDocPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="group h-auto min-h-11 w-full min-w-0 justify-between rounded-none border-border bg-card px-3 py-2.5 text-sm shadow-none hover:border-primary/30 hover:bg-accent/50 sm:min-h-10 sm:max-w-[30rem] sm:px-3 sm:py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2 truncate">
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
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  className="w-[min(calc(100vw-1rem),28rem)] max-w-[calc(100vw-1rem)] p-0 sm:w-[30rem] sm:max-w-[30rem]"
                  sideOffset={8}
                >
                  <div className="flex flex-col">
                    <ScrollArea className="max-h-[min(65vh,26rem)] sm:max-h-[28rem]">
                      <div className="p-2 sm:p-1">
                        {/* No document option */}
                        <Button
                          onClick={() => {
                            setSelectedDoc(null)
                            setIsDocPickerOpen(false)
                          }}
                          variant="ghost"
                          className={cn(
                            "h-auto min-h-11 w-full justify-start rounded-none px-3 py-2.5 text-left text-sm sm:min-h-10 sm:py-2",
                            !selectedDoc && "bg-primary/5 text-primary"
                          )}
                        >
                          <Database className="h-4 w-4" />
                          <span>No document</span>
                        </Button>

                        {/* Featured gov docs section */}
                        {featuredDocs.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                              Featured — Malaysian Gov Docs
                            </div>
                            {featuredDocs.map((doc) => (
                              <Button
                                key={doc.id}
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setIsDocPickerOpen(false)
                                }}
                                variant="ghost"
                                className={cn(
                                  "h-auto min-h-11 w-full justify-start rounded-none px-3 py-2.5 text-left text-sm sm:min-h-10 sm:py-2",
                                  selectedDoc?.id === doc.id && "bg-primary/5"
                                )}
                              >
                                {getAgency(doc) && (
                                  <div
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white",
                                      AGENCY_COLORS[getAgency(doc)!] ??
                                        "bg-muted"
                                    )}
                                  >
                                    {getAgency(doc)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">
                                    {doc.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {getAgency(doc)} · Official document
                                  </div>
                                </div>
                                <Badge className="ml-auto h-auto shrink-0 self-start bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  READY
                                </Badge>
                              </Button>
                            ))}
                            {userDocs.length > 0 && (
                              <div className="mt-1 border-t border-border px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                Your Uploads
                              </div>
                            )}
                          </>
                        )}

                        {/* User uploaded docs */}
                        {docsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton
                              key={i}
                              className="mx-1 my-0.5 h-9 animate-pulse bg-muted/40"
                            />
                          ))
                        ) : userDocs.length === 0 &&
                          featuredDocs.length === 0 ? (
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
                              <Button
                                key={doc.id}
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setIsDocPickerOpen(false)
                                }}
                                variant="ghost"
                                className={cn(
                                  "h-auto min-h-11 w-full justify-start rounded-none px-3 py-2.5 text-left text-sm sm:min-h-10 sm:py-2",
                                  selectedDoc?.id === doc.id && "bg-primary/5"
                                )}
                              >
                                <Icon
                                  className={cn("h-4 w-4 shrink-0", color)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate font-medium">
                                      {doc.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="h-auto border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    >
                                      {label}
                                    </Badge>
                                  </div>
                                </div>
                                {selectedDoc?.id === doc.id && (
                                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                                )}
                              </Button>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Refresh Button */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  aria-label="Refresh documents"
                  onClick={loadDocuments}
                  disabled={docsLoading}
                  className="min-h-11 w-full px-4 sm:min-h-10 sm:w-auto"
                >
                  {docsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span className="sm:hidden">Refresh</span>
                </Button>

                {/* Upload Button */}
                <Button
                  size="lg"
                  aria-label="Upload document"
                  onClick={() => setIsUploadOpen(true)}
                  className="min-h-11 w-full bg-primary shadow-sm hover:bg-primary/90 sm:min-h-10 sm:w-auto sm:px-4"
                >
                  <Upload className="h-4 w-4" />
                  <span className="sm:hidden">Upload</span>
                </Button>
              </div>
            </div>

            {selectedDoc?.status === "ready" ? (
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                {QUICK_STARTS.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    onClick={() => setInitialQuestion(question)}
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-10 justify-start rounded-none border-border/50 bg-background px-3 py-2 text-left text-xs text-muted-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-foreground sm:min-h-0 sm:justify-center sm:py-1.5 sm:text-center"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            ) : null}
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
