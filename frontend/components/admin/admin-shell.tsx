"use client"

import { UiText, useTranslations } from "@/components/i18n"
import { LocalizedLink as Link } from "@/components/i18n"
import { usePathname } from "@/components/i18n"

import { useAuth, UserButton } from "@clerk/nextjs"
import Image from "next/image"
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
import LanguageToggle from "@/components/language-toggle"
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
  const t = useTranslations()

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
              tooltip={t("Lingua Rakyat administration")}
            >
              <Link href="/manage">
                <Image
                  src="/icons/android-chrome-512x512.png"
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-lg object-contain"
                />
                <span className="grid text-left">
                  <span className="font-heading font-semibold">
                    {" "}
                    <UiText text="Lingua Rakyat" />{" "}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    <UiText text="Administration" />{" "}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t("Administration navigation")}>
          {GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>
                {<UiText text={group.label} />}
              </SidebarGroupLabel>
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
                          <span>{<UiText text={item.label} />}</span>
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
            <SidebarMenuButton asChild tooltip={t("Public portal")}>
              <Link href="/">
                <ArrowUpRight aria-hidden="true" />
                <span>
                  <UiText text="Public portal" />
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pb-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {" "}
          <UiText text="Authorized staff workspace" />{" "}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations()

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
          <SidebarTrigger aria-label={t("Toggle administration sidebar")} />
          <span aria-hidden="true" className="h-5 border-l border-border" />
          <nav aria-label={t("Breadcrumb")} className="min-w-0 flex-1 text-sm">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/manage"
                  className="text-muted-foreground hover:text-primary"
                >
                  {" "}
                  <UiText text="Administration" />{" "}
                </Link>
              </li>
              {current && (
                <>
                  <li aria-hidden="true" className="text-muted-foreground">
                    /
                  </li>
                  <li aria-current="page" className="font-medium">
                    {<UiText text={current.label} />}
                  </li>
                </>
              )}
            </ol>
          </nav>
          <LanguageToggle />
          <UserButton />
        </header>
        <div
          id="admin-main"
          className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {!isLoaded ? (
            <AdminLoading label={t("Loading your session?")} />
          ) : !isSignedIn ? (
            <section className="mx-auto mt-8 max-w-xl rounded-xl border border-border bg-card p-6 sm:p-8">
              <p className="admin-kicker">
                <UiText text="Staff access" />
              </p>
              <h1 className="mt-3 font-heading text-2xl font-semibold">
                {" "}
                <UiText text="Sign in to administration" />{" "}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {" "}
                <UiText text="Use your Lingua Rakyat account. Access requires an existing administrator role." />{" "}
              </p>
              <Button asChild className="mt-6">
                <Link href="/sign-in?redirect_url=%2Fmanage">
                  {" "}
                  <UiText text="Continue to sign in" />{" "}
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
          {kicker ? (
            <p className="admin-kicker mb-3">{<UiText text={kicker} />}</p>
          ) : null}
          <h1 className="admin-title">{<UiText text={title} />}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {<UiText text={description} />}
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
