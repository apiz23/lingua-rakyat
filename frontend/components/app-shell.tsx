"use client"

import * as React from "react"
import Image from "next/image"
import { Search } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { GithubIcon } from "./ui/github"
import Link from "next/link"
import { LinkPreview } from "./ui/link-preview"
import { WorkspaceSessionProvider } from "@/components/workspace-session-context"

const OPEN_COMMAND_EVENT = "lingua-rakyat:open-command-palette"

function SidebarKeyboardShortcut() {
  const { toggleSidebar } = useSidebar()
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])
  return null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()

        window.dispatchEvent(
          new CustomEvent(OPEN_COMMAND_EVENT, { detail: { query: "" } })
        )
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const openCommandPalette = () => {
    window.dispatchEvent(
      new CustomEvent(OPEN_COMMAND_EVENT, { detail: { query: "" } })
    )
  }

  const GITHUB_URL = "https://github.com/apiz23/lingua-rakyat"

  return (
    <WorkspaceSessionProvider>
      <SidebarProvider
        defaultOpen={true}
        className="h-dvh"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-mobile": "16rem",
          } as React.CSSProperties
        }
      >
        <SidebarKeyboardShortcut />
        <AppSidebar />
        <SidebarInset className="">
          <header className="sticky top-0 z-10 flex h-fit shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors hover:text-primary" />

            <div className="flex items-center justify-end gap-2 w-full">
              {/* Mobile button */}
              <button
                type="button"
                onClick={openCommandPalette}
                className="neo-btn inline-flex h-9 w-9 items-center justify-center bg-background text-muted-foreground hover:text-primary sm:hidden"
                aria-label="Open command palette"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Desktop shortcut hint */}
              <button
                type="button"
                onClick={openCommandPalette}
                className="neo-btn hidden items-center gap-2 bg-background px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="border border-foreground/40 bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl + K
                </kbd>
              </button>

              {/* GitHub Link with text - Use LinkPreview ALONE without nested Link */}
              <LinkPreview
                url={GITHUB_URL}
                className="neo-btn hidden items-center gap-2 bg-background px-3 py-2 text-xs text-muted-foreground hover:text-primary sm:inline-flex"
              >
                <GithubIcon size={14} />
                <span>Repository</span>
              </LinkPreview>

              {/* Mobile GitHub Icon only */}
              <Link
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="neo-btn inline-flex h-9 w-9 items-center justify-center bg-background text-muted-foreground hover:text-primary sm:hidden"
              >
                <GithubIcon size={16} />
                <span className="sr-only">GitHub Repository</span>
              </Link>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceSessionProvider>
  )
}
