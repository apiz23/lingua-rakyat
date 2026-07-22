"use client"

import { useEffect, useState } from "react"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLanguage } from "@/components/language-provider"
import { useWorkspaceSession } from "@/components/workspace-session-context"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"
import { listConversations, type ConversationSummary } from "@/lib/api"

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
  const { setOpenMobile } = useSidebar()
  const { userId, activeSessionId, setActiveSessionId } = useWorkspaceSession()
  const { user, isSignedIn } = useUser()
  const { signOut } = useClerk()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoadingConversations(true)
    listConversations(userId)
      .then(setConversations)
      .finally(() => setLoadingConversations(false))
  }, [userId, activeSessionId])

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
      className="border-r border-border/50 bg-background data-[state=collapsed]:w-16"
      variant="sidebar"
    >
      <SidebarHeader className="border-b border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={copy.appName}
              className="hover:bg-primary/5 data-[state=open]:bg-primary/5"
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
                    unoptimized
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-foreground">
                    {copy.appName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {copy.appTagline}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="bg-background py-3">
        <SidebarGroup className="pb-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => goToWorkspace(null)}
                tooltip={copy.newChat}
                className="min-h-9 justify-center gap-2 font-medium text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">
                  {copy.newChat}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="pb-1">
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {copy.pages}
          </SidebarGroupLabel>
          <SidebarMenu className="space-y-1">
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
                      "transition-colors duration-150",
                      active
                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    <Link
                      href={item.href}
                      className="flex min-h-9 items-center gap-2 px-2 py-1"
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="font-medium">
                        {navLabels[item.href] ?? item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {copy.recent}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {loadingConversations ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="mx-2 my-0.5 h-9 bg-muted/40" />
              ))
            ) : conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {copy.recentEmpty}
              </p>
            ) : (
              conversations.map((conv) => {
                const active = conv.session_id === activeSessionId
                return (
                  <SidebarMenuItem key={conv.session_id}>
                    <SidebarMenuButton
                      onClick={() => goToWorkspace(conv.session_id)}
                      isActive={active}
                      tooltip={conv.title}
                      className={cn(
                        "min-h-9 flex-col items-start gap-0 px-2.5 py-1.5 leading-tight",
                        active
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {conv.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {relativeTime(conv.last_at)} &middot; {conv.count}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 bg-background pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <Popover>
              <PopoverTrigger
                data-slot="sidebar-menu-button"
                data-sidebar="menu-button"
                onClick={handleNavigation}
                className={cn(
                  sidebarMenuButtonVariants(),
                  "min-h-9 gap-2 px-2 py-1 hover:bg-primary/5 hover:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                )}
              >
                {isSignedIn && user?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.imageUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                  />
                ) : (
                  <User className="h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                )}
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {isSignedIn
                    ? (user?.fullName ??
                      user?.primaryEmailAddress?.emailAddress ??
                      copy.account)
                    : copy.signIn}
                </span>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-60 gap-1 p-1.5">
                {isSignedIn ? (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user?.fullName ?? copy.account}
                      </p>
                      {user?.primaryEmailAddress?.emailAddress && (
                        <p className="truncate text-xs text-muted-foreground">
                          {user.primaryEmailAddress.emailAddress}
                        </p>
                      )}
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <Link
                      href="/shares"
                      onClick={handleNavigation}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      {copy.myShares}
                    </Link>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      {copy.language}
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      {copy.signOut}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      onClick={handleNavigation}
                      className="flex items-center justify-center rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {copy.signIn}
                    </Link>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      {copy.language}
                    </button>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            onClick={handleNavigation}
            className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <GithubIcon size={20} />
          </Link>

          <Link
            href="https://www.linkedin.com/in/muh-hafizuddin/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile"
            onClick={handleNavigation}
            className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <LinkedinIcon size={20} />
          </Link>

          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            {copy.shortcuts}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
