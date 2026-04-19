"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FolderOpen,
  FlaskConical,
  BarChart3,
  Target,
  Command,
  MessageSquare,
  Languages,
  Home,
  Github,
  Linkedin,
  Twitter,
} from "lucide-react"
import logo from "@/public/icons/android-chrome-512x512.png"

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
} from "@/components/ui/sidebar"
import { useLanguage } from "@/components/language-provider"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { GithubIcon } from "./ui/github"
import { LinkedinIcon } from "./ui/linkedin"

type NavItem = {
  readonly href: string
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
  readonly badge?: string
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
    href: "/eval",
    label: "Evaluation",
    icon: FlaskConical,
    badge: "BETA",
  },
  {
    href: "/benchmark",
    label: "Benchmark",
    icon: BarChart3,
  },
  {
    href: "/results",
    label: "Results",
    icon: Target,
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { language, toggleLanguage } = useLanguage()

  const copy =
    language === "ms"
      ? {
          appName: "Lingua Rakyat",
          appTagline: "AI untuk dokumen awam",
          navigation: "Navigasi",
          actions: "Tindakan",
          home: "Halaman Utama",
          language: "Tukar bahasa",
          shortcuts: "Ctrl/Cmd + B",
          followUs: "Ikuti kami",
        }
      : {
          appName: "Lingua Rakyat",
          appTagline: "AI for public documents",
          navigation: "Navigation",
          actions: "Actions",
          home: "Home",
          language: "Toggle language",
          shortcuts: "Ctrl/Cmd + B",
          followUs: "Follow us",
        }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-background data-[state=collapsed]:w-16"
      variant="inset"
    >
      <SidebarHeader className="border-b border-border/50 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={copy.appName}
              className="hover:bg-primary/5 data-[state=open]:bg-primary/5"
            >
              <Link href="/" className="group">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 p-0.5 transition-all group-hover:from-primary/30 group-hover:to-primary/20">
                  <Image
                    src={logo}
                    alt="Lingua Rakyat logo"
                    width={64}
                    height={64}
                    className="rounded-full"
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

      <SidebarContent className="bg-background py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {copy.navigation}
          </SidebarGroupLabel>
          <SidebarMenu className="space-y-1.5">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/")
              const Icon = item.icon

              return (
                <SidebarMenuItem key={item.href} className="mb-2">
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                    className={cn(
                      "transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    <Link
                      href={item.href}
                      className="group flex min-h-10 items-center gap-2 rounded-md px-2 py-1"
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-transform group-hover:scale-105",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant="outline"
                          className="ml-auto border-primary/30 bg-primary/5 text-[10px] text-primary"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {copy.actions}
          </SidebarGroupLabel>
          <SidebarMenu className="space-y-1.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={copy.home}
                className="hover:bg-primary/5 hover:text-primary"
              >
                <Link
                  href="/"
                  className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1"
                >
                  <Home className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span>{copy.home}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleLanguage}
                tooltip={copy.language}
                className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1 hover:bg-primary/5 hover:text-primary"
              >
                <Languages className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                <span>{copy.language}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 bg-background pt-4">
        <div className="px-2 pb-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2">
            <Link
              href="https://github.com/apiz23/lingua-rakyat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <GithubIcon size={20} />
            </Link>

            <Link
              href="https://www.linkedin.com/in/muh-hafizuddin/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <LinkedinIcon size={20} />
            </Link>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={copy.shortcuts}
              className="hover:bg-primary/5 hover:text-primary"
            >
              <Command className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {copy.shortcuts}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
