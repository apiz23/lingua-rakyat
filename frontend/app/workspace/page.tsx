"use client"

import { useState } from "react"
import { Document } from "@/lib/api"
import DocumentPanel from "@/components/doc-panel"
import ChatPanel from "@/components/chat-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Menu, MessageSquare, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export default function WorkSpacePage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [mobileView, setMobileView] = useState<"documents" | "chat">(
    "documents"
  )
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const isMobile = useMobile()

  // Mobile layout with toggle buttons
  if (isMobile) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        {/* Documents Panel */}
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-300 ease-in-out",
            mobileView === "documents" && isPanelOpen
              ? "translate-x-0"
              : "-translate-x-full"
          )}
        >
          <DocumentPanel
            selectedDoc={selectedDoc}
            onSelectDoc={(doc) => {
              setSelectedDoc(doc)
              if (doc) {
                // Auto-switch to chat when document is selected
                setMobileView("chat")
              }
            }}
          />
        </div>

        {/* Chat Panel */}
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-300 ease-in-out",
            mobileView === "chat" && isPanelOpen
              ? "translate-x-0"
              : "translate-x-full"
          )}
        >
          <ChatPanel
            selectedDoc={selectedDoc}
            onBack={() => setMobileView("documents")}
          />
        </div>

        {/* Floating action button to open panel when closed */}
        {!isPanelOpen && (
          <Button
            className="absolute right-4 bottom-4 z-50 rounded-full shadow-lg"
            size="icon"
            onClick={() => setIsPanelOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>
    )
  }

  // Desktop layout with resizable panels
  return (
    <div className="h-screen w-screen bg-background">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={25} minSize={20}>
          <DocumentPanel
            selectedDoc={selectedDoc}
            onSelectDoc={setSelectedDoc}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75}>
          <ChatPanel selectedDoc={selectedDoc} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
