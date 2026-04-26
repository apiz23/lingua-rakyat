"use client"

import * as React from "react"
import { Menu, Search } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { GithubIcon } from "./ui/github"
import Link from "next/link"
import { LinkPreview } from "./ui/link-preview"

const OPEN_COMMAND_EVENT = "lingua-rakyat:open-command-palette"

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

  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": "20rem",
          "--sidebar-width-mobile": "20rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-fit shrink-0 items-center gap-2 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
          <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors hover:text-primary" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden text-sm font-medium text-muted-foreground sm:block">
              Lingua Rakyat
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile button */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-[0.93] sm:hidden"
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Desktop shortcut hint */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden items-center rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-[0.97] sm:inline-flex"
              aria-label="Open command palette"
            >
              <span className="mr-2">Search</span>
              <kbd className="rounded border border-border/60 px-1.5 py-0.5 text-[10px]">
                Ctrl K
              </kbd>
            </button>

            {/* GitHub Link with text */}
            <LinkPreview
              key="github"
              url="https://github.com/apiz23/lingua-rakyat"
            >
              <Link
                href="https://github.com/apiz23/lingua-rakyat"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary sm:inline-flex"
              >
                <GithubIcon size={14} />
                <span>Repository</span>
              </Link>
            </LinkPreview>

            {/* Mobile GitHub Icon only */}
            <Link
              href="https://github.com/apiz23/lingua-rakyat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary sm:hidden"
            >
              <GithubIcon size={16} />
              <span className="sr-only">GitHub Repository</span>
            </Link>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-linear-to-br from-background via-background to-muted/5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
