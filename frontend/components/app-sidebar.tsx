"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  FolderOpen,
  Target,
  Command,
  MessageSquare,
  Languages,
  BookOpen,
  Plus,
  User,
  LogOut,
  Share2,
  Check,
  X,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLanguage } from "@/components/language-provider"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"
import {
  listConversations,
  renameConversation,
  type ConversationSummary,
} from "@/lib/api"

type NavItem = {
  readonly href: string
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    href: "/workspace",
    label: "Workspace",
    icon: MessageSquare,
  },
  {
    href: "/manage",
    label: "Documents",
    icon: FolderOpen,
  },
  {
    href: "/results",
    label: "Showcase",
    icon: Target,
  },
  {
    href: "/about",
    label: "About",
    icon: BookOpen,
  },
] as const

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { language, toggleLanguage } = useLanguage()
  const { setOpenMobile, isMobile } = useSidebar()
  const { userId, activeSessionId, setActiveSessionId } = useWorkspaceSession()
  const { user, isSignedIn } = useUser()
  const { signOut } = useClerk()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState("")

  useEffect(() => {
    if (!userId) return
    setLoadingConversations(true)
    listConversations(userId)
      .then(setConversations)
      .finally(() => setLoadingConversations(false))
  }, [userId, activeSessionId])

  const handleStartRename = (conv: ConversationSummary) => {
    setRenamingId(conv.session_id)
    setRenameInput(conv.custom_title || conv.title)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
    setRenameInput("")
  }

  const handleConfirmRename = async (sessionId: string) => {
    const trimmed = renameInput.trim()
    if (!trimmed || !userId) {
      handleCancelRename()
      return
    }
    const ok = await renameConversation(userId, sessionId, trimmed)
    if (ok) {
      setConversations((prev) =>
        prev.map((c) =>
          c.session_id === sessionId ? { ...c, custom_title: trimmed } : c
        )
      )
    }
    handleCancelRename()
  }

  const REPO_URL = "https://github.com/apiz23/lingua-rakyat"

  const copy =
    language === "ms"
      ? {
          appName: "Lingua Rakyat",
          appTagline: "AI untuk dokumen awam",
          pages: "Halaman",
          recent: "Perbualan Terkini",
          recentEmpty: "Belum ada perbualan",
          newChat: "Perbualan baharu",
          language: "Tukar bahasa",
          shortcuts: "Ctrl/Cmd + B",
          navWorkspace: "Ruang Kerja",
          navDocuments: "Dokumen",
          navShowcase: "Pameran",
          navAbout: "Tentang",
          account: "Akaun",
          signIn: "Log masuk",
          signOut: "Log keluar",
          myShares: "Perkongsian saya",
        }
      : {
          appName: "Lingua Rakyat",
          appTagline: "AI for public documents",
          pages: "Pages",
          recent: "Recent chats",
          recentEmpty: "No chats yet",
          newChat: "New chat",
          language: "Toggle language",
          shortcuts: "Ctrl/Cmd + B",
          navWorkspace: "Workspace",
          navDocuments: "Documents",
          navShowcase: "Showcase",
          navAbout: "About",
          account: "Account",
          signIn: "Sign in",
          signOut: "Sign out",
          myShares: "My shares",
        }

  const navLabels: Record<string, string> = {
    "/workspace": copy.navWorkspace,
    "/manage": copy.navDocuments,
    "/results": copy.navShowcase,
    "/about": copy.navAbout,
  }

  const handleNavigation = () => {
    setOpenMobile(false)
  }

  const goToWorkspace = (sessionId: string | null) => {
    setActiveSessionId(sessionId)
    handleNavigation()
    if (pathname !== "/workspace") router.push("/workspace")
  }

  return (
    <Sidebar
      collapsible="icon"
      className="bg-background data-[state=collapsed]:w-16"
      variant="sidebar"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={copy.appName}
              className="h-auto py-2 hover:bg-transparent"
              onClick={handleNavigation}
            >
              <Link href="/" className="group">
                <div className="flex aspect-square size-8 items-center justify-center">
                  <Image
                    src="/icons/android-chrome-512x512.png"
                    alt="Lingua Rakyat logo"
                    width={64}
                    height={64}
                    className="rounded-full"
                  />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="font-heading text-sm font-bold tracking-tight text-foreground">
                    {copy.appName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {copy.appTagline}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => goToWorkspace(null)}
                tooltip={copy.newChat}
                className="neo-btn h-9 justify-start gap-2.5 bg-card px-3 text-sm font-semibold text-foreground hover:bg-card"
              >
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-data-[collapsible=icon]:hidden">
                  {copy.newChat}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-0.5">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/")
              const Icon = item.icon

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={navLabels[item.href] ?? item.label}
                    onClick={handleNavigation}
                    className={cn(
                      "h-9 gap-2.5 px-2.5 text-sm",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5"
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground/70"
                        )}
                      />
                      <span>{navLabels[item.href] ?? item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1 p-0 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
            {copy.recent}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-px">
            {loadingConversations ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="mx-2 my-1 h-8 bg-muted/30" />
              ))
            ) : conversations.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-muted-foreground/50">
                {copy.recentEmpty}
              </p>
            ) : (
              conversations.map((conv) => {
                const active = conv.session_id === activeSessionId
                const isRenaming = renamingId === conv.session_id
                const displayTitle = conv.custom_title || conv.title
                return (
                  <SidebarMenuItem key={conv.session_id}>
                    {isRenaming ? (
                      <div className="flex w-full items-center gap-1 px-2 py-1">
                        <input
                          type="text"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleConfirmRename(conv.session_id)
                            if (e.key === "Escape") handleCancelRename()
                          }}
                          onBlur={() => handleConfirmRename(conv.session_id)}
                          autoFocus
                          className="neo-input min-h-0 flex-1 bg-background px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmRename(conv.session_id)}
                          className="shrink-0 rounded p-1 text-success transition-colors hover:bg-success/10"
                          aria-label="Confirm"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                          aria-label="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <SidebarMenuButton
                        onClick={() => goToWorkspace(conv.session_id)}
                        onDoubleClick={() => handleStartRename(conv)}
                        isActive={active}
                        tooltip={displayTitle}
                        className={cn(
                          "h-auto flex-col items-start gap-0.5 px-2.5 py-2",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="w-full truncate text-[13px] leading-tight">
                          {displayTitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {relativeTime(conv.last_at)} · {conv.count}
                        </span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-2 border-foreground/15 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            {isSignedIn ? (
              <SidebarMenuButton
                onClick={() => signOut()}
                tooltip={copy.signOut}
                className="h-9 gap-2.5 px-2 text-sm text-muted-foreground hover:text-destructive"
              >
                {user?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7"
                  />
                ) : (
                  <User className="h-4 w-4 shrink-0 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                )}
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {user?.fullName ?? copy.account}
                </span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                tooltip={copy.signIn}
                className="h-9 gap-2.5 px-2 text-sm font-medium text-primary hover:text-primary"
              >
                <Link href="/sign-in" onClick={handleNavigation}>
                  <User className="h-4 w-4 shrink-0 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {copy.signIn}
                  </span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-2 flex items-center gap-1 px-1 group-data-[collapsible=icon]:hidden">
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            onClick={handleNavigation}
            className="inline-flex h-7 w-7 items-center justify-center border-2 border-transparent rounded-none text-muted-foreground/50 transition-colors hover:border-foreground/30 hover:bg-muted hover:text-muted-foreground"
          >
            <GithubIcon size={15} />
          </Link>

          <Link
            href="https://www.linkedin.com/in/muh-hafizuddin/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile"
            onClick={handleNavigation}
            className="inline-flex h-7 w-7 items-center justify-center border-2 border-transparent rounded-none text-muted-foreground/50 transition-colors hover:border-foreground/30 hover:bg-muted hover:text-muted-foreground"
          >
            <LinkedinIcon size={15} />
          </Link>

          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <Command className="h-3 w-3" />
            {copy.shortcuts}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
