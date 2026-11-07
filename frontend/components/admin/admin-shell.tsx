"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import {
  Activity,
  ArrowUpRight,
  BookMarked,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  ScrollText,
  UploadCloud,
  Users,
} from "lucide-react"

import { AdminLoading } from "@/components/admin/admin-state"
import { Button } from "@/components/ui/button"
import { ADMIN_NAV } from "@/lib/admin-nav"
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
const ICONS = {
  activity: Activity,
  book: BookMarked,
  clipboard: ClipboardCheck,
  clock: Clock,
  file: FileText,
  gauge: Gauge,
  scroll: ScrollText,
  upload: UploadCloud,
  users: Users,
} as const

const GROUPS = [
  { label: "Overview", items: ADMIN_NAV.slice(0, 1) },
  { label: "Knowledge Management", items: ADMIN_NAV.slice(1, 4) },
  { label: "Governance", items: ADMIN_NAV.slice(4, 6) },
  { label: "Access & Accountability", items: ADMIN_NAV.slice(6, 8) },
  { label: "System", items: ADMIN_NAV.slice(8) },
]
function AdminNavigation() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="Lingua Rakyat administration"
            >
              <Link href="/manage">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
                  LR
                </span>
                <span className="grid text-left">
                  <span className="font-heading font-semibold">
                    Lingua Rakyat
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Administration
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Administration navigation">
          {GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon]
                  const active =
                    item.href === "/manage"
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(item.href + "/")
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Public portal">
              <Link href="/">
                <ArrowUpRight aria-hidden="true" />
                <span>Public portal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pb-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Authorized staff workspace
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()
  const current = ADMIN_NAV.find(
    (item) =>
      item.href !== "/manage" &&
      (pathname === item.href || pathname.startsWith(item.href + "/"))
  )
  return (
    <SidebarProvider>
      <AdminNavigation />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <SidebarTrigger aria-label="Toggle administration sidebar" />
          <span aria-hidden="true" className="h-5 border-l border-border" />
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/manage"
                  className="text-muted-foreground hover:text-primary"
                >
                  Administration
                </Link>
              </li>
              {current && (
                <>
                  <li aria-hidden="true" className="text-muted-foreground">
                    /
                  </li>
                  <li aria-current="page" className="font-medium">
                    {current.label}
                  </li>
                </>
              )}
            </ol>
          </nav>
          <UserButton />
        </header>
        <div
          id="admin-main"
          className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {!isLoaded ? (
            <AdminLoading label="Loading your session?" />
          ) : !isSignedIn ? (
            <section className="mx-auto mt-8 max-w-xl rounded-xl border border-border bg-card p-6 sm:p-8">
              <p className="admin-kicker">Staff access</p>
              <h1 className="mt-3 font-heading text-2xl font-semibold">
                Sign in to administration
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Use your Lingua Rakyat account. Access requires an existing
                administrator role.
              </p>
              <Button asChild className="mt-6">
                <Link href="/sign-in?redirect_url=%2Fmanage">
                  Continue to sign in
                </Link>
              </Button>
            </section>
          ) : (
            children
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
export function AdminPageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-6 border-b border-border pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker ? <p className="admin-kicker mb-3">{kicker}</p> : null}
          <h1 className="admin-title">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
