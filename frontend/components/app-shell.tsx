"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { GithubIcon } from "./ui/github"
import Link from "next/link"

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-mobile": "18rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
          <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors hover:text-primary" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden text-sm font-medium text-muted-foreground sm:block">
              Lingua Rakyat
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="https://github.com/apiz23/lingua-rakyat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              <GithubIcon size={16} />
              <span className="sr-only">GitHub</span>
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
